import { describe, expect, it } from 'vitest';
import { ApiRequestError } from '@/lib/axiosClient';
import { fetchNotifications, notificationsCleared, notificationsReducer } from './notificationsSlice';
import type { SystemNotification } from '@/types/notifications';

const row = { id: 'secret', created_at: '2026-11-01', title: 'Lot réservé', is_read: false } as SystemNotification;
const loaded = () => {
  const pending = notificationsReducer(undefined, fetchNotifications.pending('first', undefined));
  return notificationsReducer(pending, fetchNotifications.fulfilled([row], 'first', undefined));
};

describe('notification session and failure boundaries', () => {
  it.each([401, 403])('keeps HTTP %s and removes previously visible records', status => {
    let state = notificationsReducer(loaded(), fetchNotifications.pending('refresh', undefined));
    const error = new ApiRequestError({ status, message: 'Refus' });
    state = notificationsReducer(state, fetchNotifications.rejected(null, 'refresh', undefined, error));
    expect(state.error?.status).toBe(status);
    expect(state.items).toEqual([]);
    expect(state.initialized).toBe(false);
  });
  it('retains the last good answer with its timestamp on a failed refresh', () => {
    let state = loaded();
    const at = state.lastSyncedAt;
    state = notificationsReducer(state, fetchNotifications.pending('refresh', undefined));
    state = notificationsReducer(state, fetchNotifications.rejected(null, 'refresh', undefined, new ApiRequestError({ status: 500, message: 'Erreur' })));
    expect(state.items).toEqual([row]);
    expect(state.lastSyncedAt).toBe(at);
    expect(state.error?.status).toBe(500);
  });
  it('ignores an old account response that arrives after logout or user switching', () => {
    const pending = notificationsReducer(loaded(), fetchNotifications.pending('old-user', undefined));
    const cleared = notificationsReducer(pending, notificationsCleared());
    const late = notificationsReducer(cleared, fetchNotifications.fulfilled([row], 'old-user', undefined));
    expect(late.items).toEqual([]);
    expect(late.initialized).toBe(false);
  });
  it('represents a genuine successful empty response', () => {
    const state = notificationsReducer(notificationsReducer(undefined, fetchNotifications.pending('empty', undefined)), fetchNotifications.fulfilled([], 'empty', undefined));
    expect(state.initialized).toBe(true);
    expect(state.status).toBe('succeeded');
    expect(state.error).toBeNull();
  });
});
