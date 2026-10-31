import { axiosClient, ApiRequestError } from '@/lib/axiosClient';
import { openIndexedDb } from '@/lib/offline/idb';

export type OutboxStatus = 'pending' | 'syncing' | 'failed';

export type OutboxItem<T = Record<string, unknown>> = {
  id: string;
  kind: 'reception_intake';
  status: OutboxStatus;
  payload: T & { client_request_id: string };
  createdAt: string;
  updatedAt: string;
  attempts: number;
  nextAttemptAt: number;
  lastError: string | null;
  /** Who entered it: a shared tablet must not book one employee's delivery under another's session. */
  ownerUserId: string | null;
  /** The session ended: nothing is wrong with the delivery, it waits for the next sign-in. */
  waitingForLogin?: boolean;
};

const DB_NAME = 'royal-palm-edge';
const DB_VERSION = 1;
const STORE = 'outbox';
/** Longer than the form's own request, so a tablet closed mid-send is still retried. */
const FORM_REQUEST_WINDOW_MS = 35_000;
const listeners = new Set<() => void>();
let draining = false;

const openDb = () =>
  openIndexedDb(DB_NAME, DB_VERSION, (db) => {
    if (!db.objectStoreNames.contains(STORE)) {
      const store = db.createObjectStore(STORE, { keyPath: 'id' });
      store.createIndex('status', 'status');
    }
  });

const transact = async <T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
) => {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const request = operation(tx.objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
};

const notify = () => listeners.forEach((listener) => listener());
const put = async (item: OutboxItem) => {
  await transact('readwrite', (store) => store.put(item));
  notify();
};

export const listOutbox = async () =>
  transact<OutboxItem[]>('readonly', (store) => store.getAll());

export const subscribeOutbox = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const enqueueReceptionIntake = async <T extends Record<string, unknown>>(
  payload: T,
  ownerUserId: string | null,
) => {
  const photos = Array.isArray(payload.delivery_note_photos)
    ? payload.delivery_note_photos.filter((photo): photo is string => typeof photo === 'string')
    : [];
  const photoSizes = photos.map((photo) => Math.ceil((photo.length * 3) / 4));
  if (photoSizes.some((bytes) => bytes > 5 * 1024 * 1024)) {
    throw new ApiRequestError({
      message: 'Chaque photo de réception doit être inférieure à 5 Mo.',
      status: 413,
    });
  }
  if (photoSizes.reduce((total, bytes) => total + bytes, 0) > 20 * 1024 * 1024) {
    throw new ApiRequestError({
      message: 'Les photos de cette réception dépassent la limite hors ligne de 20 Mo.',
      status: 413,
    });
  }

  // A caller-supplied key (one per form draft) makes a double submit write the same
  // outbox row and replay the same server intake instead of creating a second reception.
  const requested = typeof payload.client_request_id === 'string' ? payload.client_request_id.trim() : '';
  const id = requested || crypto.randomUUID();
  const now = new Date().toISOString();
  const item: OutboxItem<T> = {
    id,
    kind: 'reception_intake',
    status: 'pending',
    payload: { ...payload, client_request_id: id },
    createdAt: now,
    updatedAt: now,
    attempts: 0,
    // The form sends it first. A drain now would race that request, and a refusal
    // it recorded would bring back a delivery the employee is already correcting.
    nextAttemptAt: Date.now() + FORM_REQUEST_WINDOW_MS,
    lastError: null,
    ownerUserId,
  };
  await put(item as OutboxItem);
  return item;
};

export const retryOutboxItem = async (id: string) => {
  const item = await transact<OutboxItem | undefined>('readonly', (store) => store.get(id));
  if (!item) return;
  await put({ ...item, status: 'pending', nextAttemptAt: Date.now(), lastError: null });
};

export const discardOutboxItem = async (id: string) => {
  await transact('readwrite', (store) => store.delete(id));
  notify();
};

export const isOutboxRetryable = (error: unknown) => {
  if (!(error instanceof ApiRequestError)) return true;
  // 401 means the session ended, not that the delivery is wrong: keep it for after sign-in.
  if (error.status === 401) return true;
  // Only "still running" clears up alone. Other conflicts need a person.
  if (error.status === 409) return error.code === 'IDEMPOTENT_IN_PROGRESS' || !error.code;
  return error.isNetworkError || (error.status ?? 500) >= 500;
};

export const isSessionExpiredError = (error: unknown) =>
  error instanceof ApiRequestError && error.status === 401;

export const drainOutbox = async (
  userId: string | null,
  onSynced?: (item: OutboxItem, response: unknown) => void | Promise<void>,
) => {
  if (draining || !navigator.onLine || !userId) return;
  draining = true;
  try {
    const items = (await listOutbox())
      .filter((item) =>
        (item.status === 'pending' || item.status === 'syncing')
        && (item.ownerUserId ?? userId) === userId
        && item.nextAttemptAt <= Date.now())
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

    for (const item of items) {
      const syncing: OutboxItem = {
        ...item,
        status: 'syncing',
        attempts: item.attempts + 1,
        updatedAt: new Date().toISOString(),
      };
      await put(syncing);

      try {
        const response = await axiosClient.post('/receptions/intake', syncing.payload);
        const data = response.data?.data ?? response.data;
        // The server holds it now, photos included: nothing is kept on the device.
        await discardOutboxItem(syncing.id);
        await onSynced?.(syncing, data);
      } catch (error) {
        const retryable = isOutboxRetryable(error);
        const backoff = Math.min(60_000, 1_000 * (2 ** Math.min(syncing.attempts, 6)));
        await put({
          ...syncing,
          status: retryable ? 'pending' : 'failed',
          nextAttemptAt: retryable ? Date.now() + backoff : Number.MAX_SAFE_INTEGER,
          lastError: error instanceof Error ? error.message : String(error),
          waitingForLogin: isSessionExpiredError(error),
          updatedAt: new Date().toISOString(),
        });
        if (!retryable) continue;
        break; // preserve intake order while connectivity/server is unhealthy
      }
    }
  } finally {
    draining = false;
  }
};
