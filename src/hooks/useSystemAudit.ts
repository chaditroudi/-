import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/integrations/mongodb/client';

export type AuditLog = {
  id: string;
  event_type: string;
  severity: 'info' | 'warning' | 'critical';
  action: string;
  module: string;
  table: string | null;
  message: string;
  user_id: string | null;
  user_email: string | null;
  user_name: string | null;
  user_roles: string[];
  ip_address: string | null;
  affected_ids: string[];
  after_snapshot: unknown[] | null;
  before_snapshot: unknown[] | null;
  created_at: string;
  // Extended fields returned by some audit log sources
  action_label?: string;
  performed_by?: string;
  performed_at?: string;
  entity_type?: string;
  changed_fields?: string[];
};

export type AuditStats = {
  total: number;
  securityEvents: number;
  byAction: Record<string, number>;
  topUsers: { id: string; email: string; name: string | null; count: number }[];
  topModules: { module: string; count: number }[];
  timeline: { hour: string; count: number }[];
};

export type AuditLogsResult = {
  logs: AuditLog[];
  total: number;
};

export const useAuditLogs = (opts: {
  limit?: number;
  offset?: number;
  userId?: string;
  module?: string;
  eventType?: string;
  from?: string;
  to?: string;
} = {}) => {
  const params = new URLSearchParams();
  if (opts.limit) params.set('limit', String(opts.limit));
  if (opts.offset) params.set('offset', String(opts.offset));
  if (opts.userId) params.set('userId', opts.userId);
  if (opts.module) params.set('module', opts.module);
  if (opts.eventType) params.set('eventType', opts.eventType);
  if (opts.from) params.set('from', opts.from);
  if (opts.to) params.set('to', opts.to);

  const qs = params.toString();

  return useQuery<AuditLogsResult>({
    queryKey: ['audit-logs', opts],
    queryFn: () => apiRequest<AuditLogsResult>(`/audit/logs${qs ? `?${qs}` : ''}`),
    refetchInterval: 10_000,
  });
};

export const useAuditStats = (from?: string) => {
  const qs = from ? `?from=${encodeURIComponent(from)}` : '';
  return useQuery<AuditStats>({
    queryKey: ['audit-stats', from],
    queryFn: () => apiRequest<AuditStats>(`/audit/stats${qs}`),
    refetchInterval: 15_000,
  });
};
