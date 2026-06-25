export interface SystemNotification {
  id: string;
  notification_type: string;
  category: string;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'error' | 'success';
  entity_type: string | null;
  entity_id: string | null;
  action_url: string | null;
  is_read: boolean;
  read_at: string | null;
  read_by: string | null;
  created_at: string;
  expires_at: string | null;
  metadata: Record<string, unknown> | null;
  status?: string | null;
}

export interface NotificationStats {
  total: number;
  unread: number;
  last24h: number;
  byCategory: Record<string, number>;
  bySeverity: { error: number; warning: number; info: number; success: number };
  avgAckTimeMinutes: number | null;
  resolutionRate: number;
  auditLogsLast24h: number;
}

export interface AuditLog {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  action_label: string;
  old_state: Record<string, unknown> | null;
  new_state: Record<string, unknown> | null;
  changed_fields: string[] | null;
  performed_by: string;
  performed_at: string;
  ip_address: string | null;
  user_agent: string | null;
  session_id: string | null;
  metadata: Record<string, unknown> | null;
}
