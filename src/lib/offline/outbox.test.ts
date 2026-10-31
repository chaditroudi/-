import { describe, expect, it, vi } from 'vitest';

import { ApiRequestError, axiosClient } from '@/lib/axiosClient';
import {
  drainOutbox,
  enqueueReceptionIntake,
  isOutboxRetryable,
  isSessionExpiredError,
  retryOutboxItem,
} from './outbox';

vi.mock('@/lib/offline/idb', () => {
  const rows = new Map<string, unknown>();
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

describe('delivery being sent from the form', () => {
  it('is left to that request until it comes back unsent', async () => {
    const post = vi.spyOn(axiosClient, 'post').mockResolvedValue({ data: { data: {} } });
    const queued = await enqueueReceptionIntake({ client_request_id: 'in-flight' }, 'user-1');

    await drainOutbox('user-1');
    expect(post).not.toHaveBeenCalled();

    await retryOutboxItem(queued.id);
    await drainOutbox('user-1');
    expect(post).toHaveBeenCalledTimes(1);
    post.mockRestore();
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
