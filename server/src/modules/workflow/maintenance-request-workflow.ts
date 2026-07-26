/**
 * Maintenance-request workflow — second consumer of the reusable approval
 * engine (approval-engine.ts). Reuses org membership for permissions and the
 * shared transition/history primitives.
 *
 * DRAFT → SUBMITTED → MAINTENANCE_REVIEW → FINANCE_APPROVAL (by threshold)
 *   → APPROVED → COMPLETED
 * Branches: REJECTED | RETURNED_FOR_CHANGES | CANCELLED
 *
 * Routing intent: the requester's own department manager first authorises the
 * need, then the Maintenance manager accepts the work; expensive interventions
 * additionally require finance (DAF) sign-off.
 */

import { normalizeDepartment } from "../org/departments.js";
import { canDepartmentApprove, canFinanceApprove } from "../org/membership.js";
import type { ActorIdentity } from "../org/membership.js";
import {
  type ApprovalLevel,
  type GenericWorkflowState,
  type WorkflowDefinition,
  approveWorkflow,
  cancelWorkflow,
  manualTransitionWorkflow,
  normalizeStatus,
  rejectWorkflow,
  returnWorkflow,
  submitWorkflow,
} from "./approval-engine.js";

export const MAINTENANCE_REQUEST_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "MAINTENANCE_REVIEW",
  "FINANCE_APPROVAL",
  "APPROVED",
  "COMPLETED",
  "REJECTED",
  "RETURNED_FOR_CHANGES",
  "CANCELLED",
] as const;

export type MaintenanceRequestStatus = (typeof MAINTENANCE_REQUEST_STATUSES)[number];

export const MAINTENANCE_FINANCE_THRESHOLD = 5000;

const LEGACY_STATUS_MAP: Record<string, string> = {
  draft: "DRAFT",
  submitted: "SUBMITTED",
  pending_approval: "SUBMITTED",
  maintenance_review: "MAINTENANCE_REVIEW",
  finance_approval: "FINANCE_APPROVAL",
  approved: "APPROVED",
  scheduled: "APPROVED",
  completed: "COMPLETED",
  done: "COMPLETED",
  closed: "COMPLETED",
  rejected: "REJECTED",
  returned_for_changes: "RETURNED_FOR_CHANGES",
  cancelled: "CANCELLED",
  canceled: "CANCELLED",
};

const requesterDepartment = (state: GenericWorkflowState) => normalizeDepartment(state.department);

const deptManagerLevel: ApprovalLevel = {
  level: "dept_manager",
  threshold_gte: 0,
  label: "Responsable du département demandeur",
  pendingStatus: "SUBMITTED",
  department: (state) => requesterDepartment(state),
  canApprove: (membership, department) => canDepartmentApprove(membership, department),
  forbiddenMessage: (department) =>
    `Seul le responsable du département ${department || "demandeur"} peut valider cette demande.`,
};

const maintenanceManagerLevel: ApprovalLevel = {
  level: "maintenance_manager",
  threshold_gte: 0,
  label: "Responsable Maintenance",
  pendingStatus: "MAINTENANCE_REVIEW",
  department: () => "maintenance",
  canApprove: (membership) => canDepartmentApprove(membership, "maintenance"),
  forbiddenMessage: () => "Seul le responsable Maintenance peut valider cette étape.",
};

const financeLevel: ApprovalLevel = {
  level: "daf",
  threshold_gte: MAINTENANCE_FINANCE_THRESHOLD,
  label: "DAF",
  pendingStatus: "FINANCE_APPROVAL",
  department: () => "finance",
  canApprove: (membership) => canFinanceApprove(membership, "daf"),
  forbiddenMessage: () => "Seul le DAF peut valider ce niveau de dépense.",
};

export const MAINTENANCE_WORKFLOW: WorkflowDefinition = {
  key: "maintenance_request",
  entityType: "maintenance_requests",
  entityLabel: "demande de maintenance",
  entityShort: "DM",
  statuses: MAINTENANCE_REQUEST_STATUSES,
  legacyStatusMap: LEGACY_STATUS_MAP,
  initialStatus: "DRAFT",
  approvedStatus: "APPROVED",
  rejectedStatus: "REJECTED",
  returnedStatus: "RETURNED_FOR_CHANGES",
  cancelledStatus: "CANCELLED",
  submittableFrom: ["DRAFT", "RETURNED_FOR_CHANGES"],
  actionableStatuses: ["SUBMITTED", "MAINTENANCE_REVIEW", "FINANCE_APPROVAL"],
  nonCancellableStatuses: ["COMPLETED", "CANCELLED", "REJECTED"],
  amountOf: (state) => {
    const parsed = Number(state.estimated_cost);
    return Number.isFinite(parsed) ? parsed : 0;
  },
  requesterDepartment,
  resolveLevels: (state) => {
    const department = requesterDepartment(state);
    const levels: ApprovalLevel[] = [];
    // When the requester already belongs to Maintenance, the maintenance
    // manager sign-off covers the departmental authorisation — skip the
    // duplicate dept-manager level (which would also deadlock SoD).
    if (department && department !== "maintenance") {
      levels.push(deptManagerLevel);
    }
    levels.push(maintenanceManagerLevel);
    levels.push(financeLevel);
    return levels;
  },
};

export const normalizeMaintenanceRequestStatus = (value: unknown): MaintenanceRequestStatus =>
  normalizeStatus(MAINTENANCE_WORKFLOW, value) as MaintenanceRequestStatus;

export const isMaintenanceRequestPending = (value: unknown): boolean =>
  MAINTENANCE_WORKFLOW.actionableStatuses.includes(normalizeMaintenanceRequestStatus(value));

export const isMaintenanceRequestOpen = (value: unknown): boolean => {
  const status = normalizeMaintenanceRequestStatus(value);
  return (
    status === "DRAFT" ||
    status === "RETURNED_FOR_CHANGES" ||
    status === "APPROVED" ||
    MAINTENANCE_WORKFLOW.actionableStatuses.includes(status)
  );
};

export const submitMaintenanceRequest = (
  state: GenericWorkflowState,
  actor: ActorIdentity,
  options?: { reason?: string | null },
) => submitWorkflow(MAINTENANCE_WORKFLOW, state, actor, options);

export const approveMaintenanceRequest = (
  state: GenericWorkflowState,
  actor: ActorIdentity,
  options?: { reason?: string | null },
) => approveWorkflow(MAINTENANCE_WORKFLOW, state, actor, options);

export const rejectMaintenanceRequest = (
  state: GenericWorkflowState,
  actor: ActorIdentity,
  reason: string,
) => rejectWorkflow(MAINTENANCE_WORKFLOW, state, actor, reason);

export const returnMaintenanceRequest = (
  state: GenericWorkflowState,
  actor: ActorIdentity,
  reason: string,
) => returnWorkflow(MAINTENANCE_WORKFLOW, state, actor, reason);

export const cancelMaintenanceRequest = (
  state: GenericWorkflowState,
  actor: ActorIdentity,
  reason?: string | null,
) => cancelWorkflow(MAINTENANCE_WORKFLOW, state, actor, reason);

export const completeMaintenanceRequest = (
  state: GenericWorkflowState,
  actor: ActorIdentity,
  reason?: string | null,
) =>
  manualTransitionWorkflow(MAINTENANCE_WORKFLOW, state, actor, {
    action: "complete",
    toStatus: "COMPLETED",
    allowedFrom: ["APPROVED"],
    reason,
    canPerform: (membership) =>
      canDepartmentApprove(membership, "maintenance") ||
      membership.mesRoles.some((role) =>
        [
          "responsable_maintenance",
          "technicien_maintenance",
          "administrateur_systeme",
          "directeur_general",
          "directeur_usine",
        ].includes(role),
      ),
    forbiddenMessage: "Seule l'équipe Maintenance peut clôturer l'intervention.",
  });
