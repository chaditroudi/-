import { openIndexedDb } from '@/lib/offline/idb';
import type { IntakeDraft } from '@/lib/receptionIntake';
import { readFactorySession } from '@/lib/factorySession';

export type LocalIntakeDraft = {
  draft: IntakeDraft;
  ownerUserId: string | null;
  savedAt: string;
  ownerScope?: string;
  storageId?: string;
};

const DB_NAME = 'royal-palm-reception-drafts';
// Keep pre-tenancy drafts intact in the old store; their ownership cannot be inferred safely.
const STORE = 'factory-drafts';

const openDb = () =>
  openIndexedDb(DB_NAME, 2, (db) => {
    if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'storageId' });
  });

const run = async <T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>) => {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const request = operation(db.transaction(STORE, mode).objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
};

/** Survives a reload, a closed tablet and an expired session. Photos included. */
export const saveLocalDraft = (draft: IntakeDraft, ownerUserId: string | null, expectedScope = readFactorySession()?.ownerKey) => {
  const session = readFactorySession();
  if (!session || session.userId !== ownerUserId || session.ownerKey !== expectedScope) return Promise.reject(new Error('Factory session required to save a draft.'));
  return run('readwrite', (store) => store.put({ draft, ownerUserId, ownerScope: session.ownerKey,
    storageId: `${session.ownerKey}::${draft.id}`, savedAt: new Date().toISOString() } satisfies LocalIntakeDraft));
};

export const listLocalDrafts = async () => {
  const rows = await run<LocalIntakeDraft[]>('readonly', (store) => store.getAll());
  const session = readFactorySession();
  return session ? rows.filter((row) => row.ownerScope === session.ownerKey && row.ownerUserId === session.userId) : [];
};

export const getLocalDraft = async (id: string) => {
  const session = readFactorySession();
  if (!session) return undefined;
  const row = await run<LocalIntakeDraft | undefined>('readonly', (store) => store.get(`${session.ownerKey}::${id}`));
  return readFactorySession()?.ownerKey === session.ownerKey ? row : undefined;
};

export const deleteLocalDraft = (id: string) => {
  const session = readFactorySession();
  return session ? run('readwrite', (store) => store.delete(`${session.ownerKey}::${id}`)) : Promise.resolve();
};
