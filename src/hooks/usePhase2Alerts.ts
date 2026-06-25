import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { phase2Api } from '@/lib/api/phase2';
import { PHASE2_ALERT_CATALOG, Phase2AlertCode } from '@/types/phase2';
import type { SystemNotification } from '@/types/notifications';
import { useNotifications } from '@/hooks/useNotifications';
import { useAppDispatch } from '@/store/hooks';
import { notificationPatched } from '@/store/slices/notificationsSlice';

export type Phase2Notification = Pick<
  SystemNotification,
  'id' | 'notification_type' | 'title' | 'message' | 'severity' | 'is_read' | 'created_at'
>;

const ALL_PHASE2_CODES = new Set(Object.keys(PHASE2_ALERT_CATALOG));

export function usePhase2ActiveAlerts() {
  const { data = [], isLoading, isFetching, isError, error } = useNotifications(true);
  const phase2Active = (data as Phase2Notification[]).filter(
    (notification) =>
      ALL_PHASE2_CODES.has(notification.notification_type as Phase2AlertCode),
  );

  return {
    data: phase2Active,
    isLoading,
    isFetching,
    isError,
    error,
  };
}

export function usePhase2AllAlerts() {
  const { data = [], isLoading, isFetching, isError, error } = useNotifications();
  const phase2All = (data as Phase2Notification[]).filter((notification) =>
    ALL_PHASE2_CODES.has(notification.notification_type as Phase2AlertCode),
  );

  return {
    data: phase2All,
    isLoading,
    isFetching,
    isError,
    error,
  };
}

export function useAcknowledgePhase2Alert() {
  const dispatch = useAppDispatch();
  return useMutation({
    mutationFn: async (id: string) => {
      await phase2Api.acknowledgePhase2Alert(id, 'operator');
      return id;
    },
    onSuccess: (id) => {
      dispatch(notificationPatched({
        id,
        changes: {
          is_read: true,
          read_at: new Date().toISOString(),
          read_by: 'operator',
        },
      }));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useAcknowledgeAllPhase2Alerts() {
  const dispatch = useAppDispatch();
  const { data = [] } = useNotifications(true);
  return useMutation({
    mutationFn: async () => {
      const ids = await phase2Api.acknowledgeAllPhase2Alerts('operator');
      return ids.length > 0
        ? ids
        : (data as Phase2Notification[])
            .filter((notification) =>
              ALL_PHASE2_CODES.has(notification.notification_type as Phase2AlertCode),
            )
            .map((notification) => notification.id);
    },
    onSuccess: (ids) => {
      if (ids.length === 0) return;

      const readAt = new Date().toISOString();
      toast.success(`${ids.length} alerte(s) acquittée(s)`);

      ids.forEach((id) => {
        dispatch(notificationPatched({
          id,
          changes: {
            is_read: true,
            read_at: readAt,
            read_by: 'operator',
          },
        }));
      });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function usePhase2AlertKpis() {
  const { data: active = [] } = usePhase2ActiveAlerts();
  const catalog = PHASE2_ALERT_CATALOG;
  const urgence = active.filter(
    (a) => catalog[a.notification_type as Phase2AlertCode]?.level === 'URGENCE'
  ).length;
  const critique = active.filter(
    (a) => catalog[a.notification_type as Phase2AlertCode]?.level === 'CRITIQUE'
  ).length;
  const important = active.filter(
    (a) => catalog[a.notification_type as Phase2AlertCode]?.level === 'IMPORTANT'
  ).length;
  const preventif = active.filter(
    (a) => catalog[a.notification_type as Phase2AlertCode]?.level === 'PREVENTIF'
  ).length;
  return { total: active.length, urgence, critique, important, preventif };
}

export function formatSla(createdAt: string, slaMinutes: number): { label: string; overdue: boolean } {
  const elapsed = (Date.now() - new Date(createdAt).getTime()) / 60_000;
  const remaining = slaMinutes - elapsed;
  if (remaining <= 0) {
    const over = Math.abs(remaining);
    const h = Math.floor(over / 60);
    const m = Math.round(over % 60);
    return { label: h > 0 ? `+${h}h${m.toString().padStart(2, '0')}` : `+${m}min`, overdue: true };
  }
  const h = Math.floor(remaining / 60);
  const m = Math.round(remaining % 60);
  return { label: h > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${m}min`, overdue: false };
}
