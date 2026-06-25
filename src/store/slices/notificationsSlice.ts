import { createAsyncThunk, createSelector, createSlice, type PayloadAction } from '@reduxjs/toolkit';

import { notificationsApi } from '@/lib/api/notifications';
import type { SystemNotification } from '@/types/notifications';
import type { RootState } from '@/store';

type AsyncStatus = 'idle' | 'loading' | 'succeeded' | 'failed';

interface NotificationsState {
  items: SystemNotification[];
  status: AsyncStatus;
  error: string | null;
  initialized: boolean;
  lastSyncedAt: string | null;
  lastRealtimeAt: string | null;
  recentRealtimeIds: string[];
}

const initialState: NotificationsState = {
  items: [],
  status: 'idle',
  error: null,
  initialized: false,
  lastSyncedAt: null,
  lastRealtimeAt: null,
  recentRealtimeIds: [],
};

const MAX_RECENT_REALTIME_IDS = 8;

const sortNotifications = (items: SystemNotification[]) =>
  [...items].sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime());

const mergeNotification = (current: SystemNotification | undefined, incoming: SystemNotification): SystemNotification => ({
  ...(current || {}),
  ...incoming,
});

const upsertNotificationList = (items: SystemNotification[], notification: SystemNotification) => {
  const existingIndex = items.findIndex((entry) => entry.id === notification.id);
  if (existingIndex === -1) {
    return sortNotifications([mergeNotification(undefined, notification), ...items]);
  }

  const next = [...items];
  next[existingIndex] = mergeNotification(next[existingIndex], notification);
  return sortNotifications(next);
};

const pushRecentRealtimeId = (ids: string[], id: string) => [id, ...ids.filter((entry) => entry !== id)].slice(0, MAX_RECENT_REALTIME_IDS);

export const fetchNotifications = createAsyncThunk<
  SystemNotification[],
  { force?: boolean } | void,
  { state: RootState; rejectValue: string }
>(
  'notifications/fetchAll',
  async (_arg, { rejectWithValue }) => {
    try {
      return await notificationsApi.listNotifications({
        unreadOnly: false,
        limit: 200,
      });
    } catch (error) {
      if (error instanceof Error) {
        return rejectWithValue(error.message || 'Impossible de charger les notifications.');
      }
      return rejectWithValue('Impossible de charger les notifications.');
    }
  },
  {
    condition: (arg, { getState }) => {
      const { notifications } = getState();

      if (notifications.status === 'loading') {
        return false;
      }

      if (arg?.force) {
        return true;
      }

      return !notifications.initialized;
    },
  },
);

const notificationsSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    notificationUpserted(state, action: PayloadAction<SystemNotification>) {
      state.items = upsertNotificationList(state.items, action.payload);
      state.initialized = true;
      state.lastSyncedAt = new Date().toISOString();
    },
    notificationRealtimeReceived(state, action: PayloadAction<SystemNotification>) {
      state.items = upsertNotificationList(state.items, action.payload);
      state.initialized = true;
      state.lastSyncedAt = new Date().toISOString();
      state.lastRealtimeAt = new Date().toISOString();
      state.recentRealtimeIds = pushRecentRealtimeId(state.recentRealtimeIds, action.payload.id);
    },
    notificationRemoved(state, action: PayloadAction<string>) {
      state.items = state.items.filter((entry) => entry.id !== action.payload);
      state.recentRealtimeIds = state.recentRealtimeIds.filter((entry) => entry !== action.payload);
      state.lastSyncedAt = new Date().toISOString();
    },
    notificationPatched(
      state,
      action: PayloadAction<{ id: string; changes: Partial<SystemNotification> }>,
    ) {
      const target = state.items.find((entry) => entry.id === action.payload.id);
      if (!target) return;

      Object.assign(target, action.payload.changes);
      state.items = sortNotifications(state.items);
      state.lastSyncedAt = new Date().toISOString();
    },
    notificationsMarkedAllRead(state) {
      state.items = state.items.map((entry) =>
        entry.is_read
          ? entry
          : {
              ...entry,
              is_read: true,
              read_at: entry.read_at || new Date().toISOString(),
              read_by: entry.read_by || 'operator',
            },
      );
      state.lastSyncedAt = new Date().toISOString();
    },
    notificationsCleared(state) {
      state.items = [];
      state.status = 'idle';
      state.error = null;
      state.initialized = false;
      state.lastSyncedAt = null;
      state.lastRealtimeAt = null;
      state.recentRealtimeIds = [];
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchNotifications.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchNotifications.fulfilled, (state, action) => {
        state.items = sortNotifications(action.payload);
        state.status = 'succeeded';
        state.error = null;
        state.initialized = true;
        state.lastSyncedAt = new Date().toISOString();
      })
      .addCase(fetchNotifications.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload || action.error.message || 'Impossible de charger les notifications.';
      });
  },
});

export const {
  notificationPatched,
  notificationRealtimeReceived,
  notificationRemoved,
  notificationsCleared,
  notificationsMarkedAllRead,
  notificationUpserted,
} = notificationsSlice.actions;

export const notificationsReducer = notificationsSlice.reducer;

const selectNotificationsState = (state: RootState) => state.notifications;

export const selectAllNotifications = createSelector(
  [selectNotificationsState],
  (state) => state.items,
);

export const selectNotificationsStatus = createSelector(
  [selectNotificationsState],
  (state) => state.status,
);

export const selectNotificationsError = createSelector(
  [selectNotificationsState],
  (state) => state.error,
);

export const selectNotificationsInitialized = createSelector(
  [selectNotificationsState],
  (state) => state.initialized,
);

export const selectNotificationsLastRealtimeAt = createSelector(
  [selectNotificationsState],
  (state) => state.lastRealtimeAt,
);

export const selectNotificationRecentRealtimeIds = createSelector(
  [selectNotificationsState],
  (state) => state.recentRealtimeIds,
);

export const selectUnreadNotifications = createSelector(
  [selectAllNotifications],
  (items) => items.filter((entry) => !entry.is_read),
);

export const selectNotificationsUnreadCount = createSelector(
  [selectUnreadNotifications],
  (items) => items.length,
);

export const selectRecentRealtimeNotifications = createSelector(
  [selectAllNotifications, selectNotificationRecentRealtimeIds],
  (items, ids) =>
    ids
      .map((id) => items.find((item) => item.id === id))
      .filter((item): item is SystemNotification => Boolean(item)),
);
