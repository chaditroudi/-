/** Maintenance requests — mirrors server/src/modules/workflow/maintenance-request-workflow.ts */

import type { DepartmentCode } from './org';

export const MAINTENANCE_REQUEST_STATUSES = [
  'DRAFT',
  'SUBMITTED',
  'MAINTENANCE_REVIEW',
  'FINANCE_APPROVAL',
  'APPROVED',
  'COMPLETED',
  'REJECTED',
  'RETURNED_FOR_CHANGES',
  'CANCELLED',
] as const;

export type MaintenanceRequestStatus = (typeof MAINTENANCE_REQUEST_STATUSES)[number];

export type MaintenancePriority = 'low' | 'normal' | 'high' | 'critical';

export const MAINTENANCE_FINANCE_THRESHOLD = 5000;

export interface MaintenanceApprovalSignature {
  level: string;
  label: string;
  approved_by: string;
  approved_by_id?: string | null;
  approved_at: string;
}

export interface MaintenanceWorkflowTransition {
  from_status: string;
  to_status: string;
  action: string;
  actor_id: string;
  actor_name: string;
  timestamp: string;
  reason: string | null;
  department: string | null;
  approval_level: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface MaintenanceRequest {
  id: string;
  request_number?: string | null;
  title?: string | null;
  description?: string | null;
  equipment_name?: string | null;
  equipment_id?: string | null;
  department?: DepartmentCode | string | null;
  priority?: MaintenancePriority | null;
  estimated_cost?: number | null;
  requester_id?: string | null;
  requester_name?: string | null;
  status: MaintenanceRequestStatus | string;
  approvals?: MaintenanceApprovalSignature[] | null;
  workflow_history?: MaintenanceWorkflowTransition[] | null;
  current_approval_level?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
  rejection_reason?: string | null;
  completed_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

const LEGACY_STATUS_MAP: Record<string, MaintenanceRequestStatus> = {
  draft: 'DRAFT',
  submitted: 'SUBMITTED',
  pending_approval: 'SUBMITTED',
  maintenance_review: 'MAINTENANCE_REVIEW',
  finance_approval: 'FINANCE_APPROVAL',
  approved: 'APPROVED',
  scheduled: 'APPROVED',
  completed: 'COMPLETED',
  done: 'COMPLETED',
  closed: 'COMPLETED',
  rejected: 'REJECTED',
  returned_for_changes: 'RETURNED_FOR_CHANGES',
  cancelled: 'CANCELLED',
  canceled: 'CANCELLED',
};

export const normalizeMaintenanceRequestStatus = (value: unknown): MaintenanceRequestStatus => {
  const raw = String(value ?? '').trim();
  if (!raw) return 'DRAFT';
  const upper = raw.toUpperCase() as MaintenanceRequestStatus;
  if ((MAINTENANCE_REQUEST_STATUSES as readonly string[]).includes(upper)) return upper;
  return LEGACY_STATUS_MAP[raw.toLowerCase()] ?? 'DRAFT';
};

export const isMaintenanceRequestPending = (value: unknown): boolean => {
  const status = normalizeMaintenanceRequestStatus(value);
  return status === 'SUBMITTED' || status === 'MAINTENANCE_REVIEW' || status === 'FINANCE_APPROVAL';
};

export const MAINTENANCE_STATUS_LABELS: Record<MaintenanceRequestStatus, string> = {
  DRAFT: 'Brouillon',
  SUBMITTED: 'Soumise',
  MAINTENANCE_REVIEW: 'Revue Maintenance',
  FINANCE_APPROVAL: 'Validation DAF',
  APPROVED: 'Approuvée',
  COMPLETED: 'Clôturée',
  REJECTED: 'Rejetée',
  RETURNED_FOR_CHANGES: 'À corriger',
  CANCELLED: 'Annulée',
};

export const MAINTENANCE_PRIORITY_LABELS: Record<MaintenancePriority, string> = {
  low: 'Basse',
  normal: 'Normale',
  high: 'Haute',
  critical: 'Critique',
};

export const MAINTENANCE_APPROVAL_LEVEL_LABELS: Record<string, string> = {
  dept_manager: 'Responsable département',
  maintenance_manager: 'Responsable Maintenance',
  daf: 'DAF',
};
