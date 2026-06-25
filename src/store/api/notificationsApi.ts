import { createApi } from '@reduxjs/toolkit/query/react';
import { axiosBaseQuery } from '@/lib/axiosBaseQuery';
import type { AuditLog, NotificationStats, SystemNotification } from '@/types/notifications';

export const notificationsApi = createApi({
  reducerPath: 'notificationsApi',
  baseQuery: axiosBaseQuery,
  tagTypes: ['Notification', 'AuditLog', 'NotificationStats'],
  endpoints: (b) => ({

    getNotificationsStats: b.query<NotificationStats, void>({
      query: () => ({ url: '/notifications/stats' }),
      transformResponse: (res: any) => res.data,
      providesTags: ['NotificationStats'],
      keepUnusedDataFor: 60,
    }),

    listNotifications: b.query<SystemNotification[], { unreadOnly?: boolean; limit?: number } | void>({
      query: (params) => ({
        url: '/notifications',
        params: params ? { unreadOnly: params?.unreadOnly, limit: params?.limit } : undefined,
      }),
      transformResponse: (res: any) => res.data ?? [],
      providesTags: ['Notification'],
      keepUnusedDataFor: 30,
    }),

    createNotification: b.mutation<SystemNotification, {
      notification_type: string;
      category: string;
      title: string;
      message: string;
      severity: SystemNotification['severity'];
      entity_type?: string | null;
      entity_id?: string | null;
      metadata?: Record<string, unknown> | null;
    }>({
      query: (body) => ({ url: '/notifications', method: 'POST', data: body }),
      transformResponse: (res: any) => res.data,
      invalidatesTags: ['Notification'],
    }),

    markNotificationRead: b.mutation<SystemNotification, string>({
      query: (id) => ({ url: `/notifications/${encodeURIComponent(id)}/read`, method: 'PATCH' }),
      transformResponse: (res: any) => res.data,
      invalidatesTags: ['Notification'],
    }),

    markAllNotificationsRead: b.mutation<SystemNotification[], void>({
      query: () => ({ url: '/notifications/mark-all-read', method: 'POST' }),
      transformResponse: (res: any) => res.data ?? [],
      invalidatesTags: ['Notification'],
    }),

    listAuditLogs: b.query<AuditLog[], { entityType?: string; entityId?: string; limit?: number } | void>({
      query: (params) => ({
        url: '/notifications/audit',
        params: params ? { entityType: params?.entityType, entityId: params?.entityId, limit: params?.limit } : undefined,
      }),
      transformResponse: (res: any) => res.data ?? [],
      providesTags: ['AuditLog'],
      keepUnusedDataFor: 20,
    }),

    createAuditLog: b.mutation<AuditLog, Record<string, unknown>>({
      query: (body) => ({ url: '/notifications/audit', method: 'POST', data: body }),
      transformResponse: (res: any) => res.data,
      invalidatesTags: ['AuditLog'],
    }),

  }),
});

export const {
  useGetNotificationsStatsQuery,
  useListNotificationsQuery,
  useCreateNotificationMutation,
  useMarkNotificationReadMutation,
  useMarkAllNotificationsReadMutation,
  useListAuditLogsQuery,
  useCreateAuditLogMutation,
} = notificationsApi;
