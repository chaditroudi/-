import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiRequestError, axiosClient } from '@/lib/axiosClient';
import {
  drainOutbox,
  enqueueReceptionIntake,
  isOutboxRetryable,
  isSessionExpiredError,
  listOutbox,
  RECEPTION_INTAKE_TIMEOUT_MS,
  retryOutboxItem,
} from './outbox';

const database = vi.hoisted(() => ({ rows: new Map<string, unknown>() }));

vi.mock('@/lib/offline/idb', () => {
  const rows = database.rows;
  const request = (result?: unknown) => {
    const pending: { result?: unknown; onsuccess?: () => void } = { result };
    queueMicrotask(() => pending.onsuccess?.());
    return pending;
  };
  const store = {
    get: (id: string) => request(rows.get(id)),
    getAll: () => request([...rows.values()]),
    put: (row: { id: string }) => { rows.set(row.id, row); return request(); },
    delete: (id: string) => { rows.delete(id); return request(); },
  };
  const db = { transaction: () => ({ objectStore: () => store }), close: () => undefined };
  return { openIndexedDb: async () => db };
});

beforeEach(() => {
  database.rows.clear();
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
});
afterEach(() => vi.restoreAllMocks());

describe('delivery being sent from the form', () => {
  it('is left to that request until it comes back unsent', async () => {
    const post = vi.spyOn(axiosClient, 'post').mockResolvedValue({ data: { data: {} } });
    const queued = await enqueueReceptionIntake({ client_request_id: 'in-flight' }, 'user-1');

    await drainOutbox('user-1');
    expect(post).not.toHaveBeenCalled();

    await retryOutboxItem(queued.id);
    await drainOutbox('user-1');
    expect(post).not.toHaveBeenCalled();

    await retryOutboxItem(queued.id, new ApiRequestError({ message: 'Connection interrupted', isNetworkError: true }));
    await drainOutbox('user-1');
    expect(post).toHaveBeenCalledTimes(1);
    post.mockRestore();
  });
});

describe('recovering an unsent reception', () => {
  it('retains the first failure and expired-session state without changing the delivery', async () => {
    const queued = await enqueueReceptionIntake({ client_request_id: 'expired', draft_version: 2 }, 'user-1');

    await retryOutboxItem(queued.id, new ApiRequestError({ message: 'Session terminée', status: 401 }));

    expect(await listOutbox()).toEqual([expect.objectContaining({
      id: queued.id, ownerUserId: 'user-1', payload: queued.payload,
      status: 'pending', lastError: 'Session terminée', waitingForLogin: true,
    })]);
  });

  it('backs off on a server failure and retries the same delivery without a page reload', async () => {
    const queued = await enqueueReceptionIntake({ client_request_id: 'server-retry', draft_version: 2 }, 'user-1');
    await retryOutboxItem(queued.id, new ApiRequestError({ message: 'Connection interrupted', isNetworkError: true }));
    const post = vi.spyOn(axiosClient, 'post')
      .mockRejectedValueOnce(new ApiRequestError({ message: 'Serveur temporairement indisponible', status: 503 }))
      .mockResolvedValueOnce({ data: { data: { reception: { id: 'confirmed' } } } });
    const synced = vi.fn();

    await drainOutbox('user-1', synced);

    expect(await listOutbox()).toEqual([expect.objectContaining({
      payload: queued.payload, ownerUserId: 'user-1', status: 'pending', attempts: 1,
      lastError: 'Serveur temporairement indisponible',
    })]);
    expect((await listOutbox())[0].nextAttemptAt).toBeGreaterThan(Date.now());
    expect(post).toHaveBeenCalledWith('/receptions/intake', queued.payload, { timeout: RECEPTION_INTAKE_TIMEOUT_MS });
    expect(synced).not.toHaveBeenCalled();

    await retryOutboxItem(queued.id);
    await drainOutbox('user-1', synced);

    expect(post).toHaveBeenCalledTimes(2);
    expect(post.mock.calls[1][1]).toEqual(queued.payload);
    expect(await listOutbox()).toEqual([]);
    expect(synced).toHaveBeenCalledTimes(1);
  });

  it('releases the drain after a timed-out retry and prevents a competing send while it is active', async () => {
    const queued = await enqueueReceptionIntake({ client_request_id: 'timeout-retry' }, 'user-1');
    await retryOutboxItem(queued.id, new ApiRequestError({ message: 'Unsent', isNetworkError: true }));
    let timeout!: (error: Error) => void;
    const post = vi.spyOn(axiosClient, 'post').mockImplementationOnce(() => new Promise<never>((_resolve, reject) => { timeout = reject; }));
    const sending = drainOutbox('user-1');
    await vi.waitFor(() => expect(post).toHaveBeenCalledTimes(1));

    await retryOutboxItem(queued.id);
    await drainOutbox('user-1');
    expect(post).toHaveBeenCalledTimes(1);
    expect((await listOutbox())[0].status).toBe('syncing');
    expect(post.mock.calls[0][2]).toEqual({ timeout: 30_000 });

    timeout(new ApiRequestError({ message: 'Le serveur ne répond pas.', code: 'ECONNABORTED', isNetworkError: true }));
    await sending;
    expect((await listOutbox())[0]).toMatchObject({ status: 'pending', lastError: 'Le serveur ne répond pas.' });

    post.mockResolvedValueOnce({ data: { data: { reception: { id: 'confirmed' } } } });
    await retryOutboxItem(queued.id);
    await drainOutbox('user-1');
    expect(post).toHaveBeenCalledTimes(2);
    expect(await listOutbox()).toEqual([]);
  });

  it('keeps a stale draft refusal for correction instead of automatically retrying it', async () => {
    const queued = await enqueueReceptionIntake({ client_request_id: 'stale', draft_version: 1 }, 'user-1');
    await retryOutboxItem(queued.id, new ApiRequestError({ message: 'Unsent', isNetworkError: true }));
    const post = vi.spyOn(axiosClient, 'post').mockRejectedValue(new ApiRequestError({
      status: 409, code: 'DRAFT_STALE', message: 'Rechargez la dernière version du brouillon.',
    }));

    await drainOutbox('user-1');
    await drainOutbox('user-1');

    expect(post).toHaveBeenCalledTimes(1);
    expect((await listOutbox())[0]).toMatchObject({
      status: 'failed', lastError: 'Rechargez la dernière version du brouillon.',
      payload: queued.payload, ownerUserId: 'user-1',
    });
  });
});

describe('W3 offline outbox retry classification', () => {
  it('retries transport, server, and in-progress conflicts', () => {
    expect(isOutboxRetryable(new ApiRequestError({
      message: 'offline',
      isNetworkError: true,
    }))).toBe(true);
    expect(isOutboxRetryable(new ApiRequestError({ message: 'busy', status: 409, code: 'IDEMPOTENT_IN_PROGRESS' }))).toBe(true);
    expect(isOutboxRetryable(new ApiRequestError({ message: 'server', status: 503 }))).toBe(true);
  });

  it('keeps a queued delivery when the session has ended', () => {
    const expired = new ApiRequestError({ message: 'auth', status: 401 });
    expect(isOutboxRetryable(expired)).toBe(true);
    expect(isSessionExpiredError(expired)).toBe(true);
  });

  it('asks a person to resolve business conflicts instead of retrying forever', () => {
    expect(isOutboxRetryable(new ApiRequestError({ message: 'stale', status: 409, code: 'DRAFT_STALE' }))).toBe(false);
    expect(isOutboxRetryable(new ApiRequestError({ message: 'other', status: 409, code: 'IDEMPOTENT_PAYLOAD_MISMATCH' }))).toBe(false);
  });

  it('leaves validation and permission failures for operator action', () => {
    expect(isOutboxRetryable(new ApiRequestError({ message: 'bad', status: 400 }))).toBe(false);
    expect(isOutboxRetryable(new ApiRequestError({ message: 'forbidden', status: 403 }))).toBe(false);
  });
});

describe('delivery with no recorded owner', () => {
  it('is not sent under the account that happens to be signed in', async () => {
    const send = vi.spyOn(axiosClient, 'post').mockResolvedValue({ data: { data: {} } });
    const { enqueueReceptionIntake, drainOutbox, listOutbox } = await import('@/lib/offline/outbox');
    const queued = await enqueueReceptionIntake({ client_request_id: 'no-owner', delivery_note_photos: [] }, null);
    const later = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 60 * 60_000);

    await drainOutbox('user-b');

    expect(send).not.toHaveBeenCalled();
    expect((await listOutbox()).some((item) => item.id === queued.id)).toBe(true);
    later.mockRestore();
    send.mockRestore();
  });
});
