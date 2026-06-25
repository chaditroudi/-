import { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { useSettingsContext } from '@/contexts/SettingsContext';
import { getSseConnection } from '@/lib/sseClient';
import {
  getNotificationFingerprint,
  getNotificationTarget,
  isAlertsExperience,
  isInternalNotificationTarget,
} from '@/lib/notifications';
import {
  fetchNotifications,
  notificationRemoved,
  notificationRealtimeReceived,
  notificationUpserted,
  selectAllNotifications,
  selectNotificationsError,
  selectNotificationsInitialized,
  selectNotificationsLastRealtimeAt,
  selectNotificationsStatus,
  selectRecentRealtimeNotifications,
  selectUnreadNotifications,
} from '@/store/slices/notificationsSlice';
import {
  useGetNotificationsStatsQuery,
  useListAuditLogsQuery,
  useMarkNotificationReadMutation as useMarkReadRtk,
  useMarkAllNotificationsReadMutation,
  useCreateAuditLogMutation,
  notificationsApi,
} from '@/store/api/notificationsApi';
import type { AuditLog, SystemNotification } from '@/types/notifications';

export type { AuditLog, SystemNotification } from '@/types/notifications';

// ── Notifications list (Redux slice) ──────────────────────────────────────────

export const useNotifications = (unreadOnly = false) => {
  const dispatch = useAppDispatch();
  const initialized = useAppSelector(selectNotificationsInitialized);
  const status = useAppSelector(selectNotificationsStatus);
  const errorMessage = useAppSelector(selectNotificationsError);
  const allNotifications = useAppSelector(selectAllNotifications);
  const unreadNotifications = useAppSelector(selectUnreadNotifications);

  useEffect(() => {
    if (!initialized && status === 'idle') void dispatch(fetchNotifications());
  }, [dispatch, initialized, status]);

  return {
    data: unreadOnly ? unreadNotifications : allNotifications,
    isLoading: status === 'loading' || (!initialized && status === 'idle'),
    isFetching: status === 'loading',
    isError: Boolean(errorMessage),
    error: errorMessage ? new Error(errorMessage) : null,
    refetch: () => dispatch(fetchNotifications({ force: true })).unwrap(),
  };
};

export const useNotificationRealtimeState = () => ({
  recentNotifications: useAppSelector(selectRecentRealtimeNotifications),
  lastRealtimeAt: useAppSelector(selectNotificationsLastRealtimeAt),
});

// ── Audit logs (RTK Query) ─────────────────────────────────────────────────────

export const useAuditLogs = (entityType?: string, entityId?: string) => {
  // Primary invalidation comes from the SSE handler in useRealtimeNotifications.
  // 60s polling is a resilience fallback for when the SSE connection is down.
  return useListAuditLogsQuery(
    entityType || entityId ? { entityType, entityId, limit: 100 } : undefined,
    { pollingInterval: 5 * 60_000 },
  );
};

export const useNotificationStats = () => {
  return useGetNotificationsStatsQuery(undefined, { pollingInterval: 5 * 60_000 });
};

// ── Mark read mutations (RTK Query) ────────────────────────────────────────────

export const useMarkNotificationRead = () => {
  const dispatch = useAppDispatch();
  const [mutate, state] = useMarkReadRtk();

  return {
    mutateAsync: async (id: string) => {
      const data = await mutate(id).unwrap();
      dispatch(notificationUpserted(data));
      return data;
    },
    isPending: state.isLoading,
    isError: !!state.error,
    mutate: (id: string) => void mutate(id).unwrap().then((data) => dispatch(notificationUpserted(data))),
  };
};

export const useMarkAllRead = () => {
  const dispatch = useAppDispatch();
  const [mutate, state] = useMarkAllNotificationsReadMutation();

  return {
    mutateAsync: async () => {
      const data = await mutate().unwrap();
      data.forEach((n) => dispatch(notificationUpserted(n)));
      return data;
    },
    isPending: state.isLoading,
    isError: !!state.error,
    mutate: () => void mutate().unwrap().then((data) => data.forEach((n) => dispatch(notificationUpserted(n)))),
  };
};

// ── Realtime notification popups (SSE) ────────────────────────────────────────

export const useRealtimeNotifications = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const { settings } = useSettingsContext();
  const shownIds = useRef<Set<string>>(new Set());
  const recentFingerprints = useRef<Map<string, number>>(new Map());
  const [markReadMutation] = useMarkReadRtk();

  const markRead = useCallback(
    async (notification: SystemNotification) => {
      if (notification.is_read) return;
      try {
        const updated = await markReadMutation(notification.id).unwrap();
        dispatch(notificationUpserted(updated));
      } catch { /* non-critical */ }
    },
    [dispatch, markReadMutation],
  );

  const openTarget = useCallback(
    async (notification: SystemNotification) => {
      const target = getNotificationTarget(notification);
      await markRead(notification);
      if (!target) return;
      if (isInternalNotificationTarget(target)) {
        if (`${location.pathname}${location.search}` !== target) navigate(target);
        return;
      }
      window.open(target, '_blank', 'noopener,noreferrer');
    },
    [location.pathname, location.search, markRead, navigate],
  );

  const showBrowserNotif = useCallback(
    (notification: SystemNotification) => {
      if (
        typeof Notification === 'undefined' ||
        Notification.permission !== 'granted' ||
        !settings.notifications.browser_notifications_enabled
      ) return false;

      const n = new Notification(notification.title, {
        body: notification.message,
        tag: getNotificationFingerprint(notification),
        requireInteraction: notification.severity === 'error',
      });
      n.onclick = () => { window.focus(); void openTarget(notification); n.close(); };
      window.setTimeout(() => n.close(), notification.severity === 'error' ? 15000 : 7000);
      return true;
    },
    [openTarget, settings.notifications.browser_notifications_enabled],
  );

  useEffect(() => {
    const sse = getSseConnection();

    return sse.subscribe((msg) => {
      if (msg.eventName !== 'db_change') return;
      if (msg.payload.resource !== 'notifications') return;

      // Invalidate RTK Query cache so useAuditLogs refreshes
      dispatch(notificationsApi.util.invalidateTags(['Notification', 'AuditLog']));
      // Also refresh the Redux-slice notifications
      void dispatch(fetchNotifications({ force: true }));
    });
  }, [dispatch]);

  // Separate effect: watch the Redux slice for new inserts and show toasts
  const allNotifications = useAppSelector(selectAllNotifications);
  const prevCountRef = useRef(allNotifications.length);

  useEffect(() => {
    const current = allNotifications.length;
    if (current <= prevCountRef.current) { prevCountRef.current = current; return; }
    prevCountRef.current = current;

    const newest = allNotifications[0];
    if (!newest || newest.is_read) return;

    const fingerprint = getNotificationFingerprint(newest);
    const now = Date.now();
    for (const [k, ts] of recentFingerprints.current.entries()) {
      if (now - ts > 15000) recentFingerprints.current.delete(k);
    }

    if (recentFingerprints.current.has(fingerprint) || shownIds.current.has(newest.id)) return;
    shownIds.current.add(newest.id);
    recentFingerprints.current.set(fingerprint, now);

    const alertsViewActive = isAlertsExperience(location.pathname, location.search);
    const pageHidden = document.visibilityState === 'hidden';
    const browserShown = pageHidden && showBrowserNotif(newest);

    if (!browserShown && (!alertsViewActive || newest.severity === 'error')) {
      const toastFn = newest.severity === 'error' ? toast.error
        : newest.severity === 'warning' ? toast.warning
        : newest.severity === 'success' ? toast.success
        : toast.info;

      toastFn(newest.title, {
        description: newest.message,
        duration: newest.severity === 'error' ? 9000 : 5000,
        action: { label: t('common.view'), onClick: () => void openTarget(newest) },
      });
    }
  }, [allNotifications, location.pathname, location.search, openTarget, showBrowserNotif, t]);
};

// ── Audit log mutation (RTK Query) ─────────────────────────────────────────────

export const useLogAction = () => {
  const [createLog, state] = useCreateAuditLogMutation();

  return {
    mutateAsync: async (params: {
      entityType: string;
      entityId: string;
      action: string;
      actionLabel: string;
      performedBy?: string;
      metadata?: Record<string, unknown>;
    }) => {
      return createLog({
        entityType: params.entityType,
        entityId: params.entityId,
        action: params.action,
        actionLabel: params.actionLabel,
        performedBy: params.performedBy || 'operator',
        metadata: params.metadata ? JSON.parse(JSON.stringify(params.metadata)) : undefined,
      }).unwrap();
    },
    isPending: state.isLoading,
    isError: !!state.error,
  };
};
