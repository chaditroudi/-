import { apiRequest } from '@/integrations/mongodb/client';
import type { AuditLog, SystemNotification } from '@/types/notifications';

type ApiEnvelope<T> = {
  data: T;
};

type ListNotificationsOptions = {
  unreadOnly?: boolean;
  limit?: number;
};

type ListAuditLogsOptions = {
  entityType?: string;
  entityId?: string;
  limit?: number;
};

type CreateAuditLogInput = {
  entityType: string;
  entityId: string;
  action: string;
  actionLabel: string;
  performedBy?: string;
  metadata?: Record<string, unknown>;
  oldState?: Record<string, unknown> | null;
  newState?: Record<string, unknown> | null;
  changedFields?: string[] | null;
  module?: string | null;
  table?: string | null;
  eventType?: string | null;
};

type CreateNotificationInput = {
  notificationType: string;
  category: string;
  title: string;
  message: string;
  severity: SystemNotification['severity'];
  entityType?: string | null;
  entityId?: string | null;
  actionUrl?: string | null;
  status?: string | null;
  metadata?: Record<string, unknown> | null;
  expiresAt?: string | null;
};

const buildQueryString = (params: Record<string, string | number | boolean | undefined>) => {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    searchParams.set(key, String(value));
  }

  const suffix = searchParams.toString();
  return suffix ? `?${suffix}` : '';
};

export const notificationsApi = {
  listNotifications: async (options: ListNotificationsOptions = {}) => {
    const suffix = buildQueryString({
      unreadOnly: options.unreadOnly,
      limit: options.limit,
    });
    const response = await apiRequest<ApiEnvelope<SystemNotification[]>>(`/notifications${suffix}`);
    return response.data || [];
  },

  createNotification: async (payload: CreateNotificationInput) => {
    const response = await apiRequest<ApiEnvelope<SystemNotification>>('/notifications', {
      method: 'POST',
      body: JSON.stringify({
        notification_type: payload.notificationType,
        category: payload.category,
        title: payload.title,
        message: payload.message,
        severity: payload.severity,
        entity_type: payload.entityType ?? null,
        entity_id: payload.entityId ?? null,
        action_url: payload.actionUrl ?? null,
        status: payload.status ?? null,
        metadata: payload.metadata ?? null,
        expires_at: payload.expiresAt ?? null,
      }),
    });
    return response.data;
  },

  markNotificationRead: async (id: string, read_by?: string) => {
    const response = await apiRequest<ApiEnvelope<SystemNotification>>(`/notifications/${encodeURIComponent(id)}/read`, {
      method: 'PATCH',
      body: JSON.stringify(read_by ? { read_by } : {}),
    });
    return response.data;
  },

  markAllNotificationsRead: async (read_by?: string) => {
    const response = await apiRequest<ApiEnvelope<SystemNotification[]>>('/notifications/mark-all-read', {
      method: 'POST',
      body: JSON.stringify(read_by ? { read_by } : {}),
    });
    return response.data || [];
  },

  listAuditLogs: async (options: ListAuditLogsOptions = {}) => {
    const suffix = buildQueryString({
      entityType: options.entityType,
      entityId: options.entityId,
      limit: options.limit,
    });
    const response = await apiRequest<ApiEnvelope<AuditLog[]>>(`/notifications/audit${suffix}`);
    return response.data || [];
  },

  createAuditLog: async (payload: CreateAuditLogInput) => {
    const response = await apiRequest<ApiEnvelope<AuditLog>>('/notifications/audit', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return response.data;
  },
};
