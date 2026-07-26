/**
 * Purchase-requisition workflow — declared on top of the reusable approval
 * engine (approval-engine.ts) rather than hand-rolled, so separation of duties,
 * audit trail and routing stay identical across every approval domain.
 *
 * DRAFT → SUBMITTED → PURCHASING_REVIEW
 *   → FINANCE_APPROVAL (optional by threshold) → APPROVED → ORDERED
 * Branches: REJECTED | RETURNED_FOR_CHANGES | CANCELLED
 *
 * DEPARTMENT_APPROVED is retained as a tolerated inbound status for records
 * written before purchasing review became a single step.
 */

import { badRequest } from "../../core/app-error.js";
import { normalizeDepartment } from "../org/departments.js";
import {
  canDepartmentApprove,
  canFinanceApprove,
  canPurchasingApprove,
  type ActorIdentity,
} from "../org/membership.js";
import {
  type ApprovalLevel,
  type ApprovalSignature,
  type GenericWorkflowState,
  type WorkflowDecision as GenericWorkflowDecision,
  type WorkflowDefinition,
  approveWorkflow,
  cancelWorkflow,
  rejectWorkflow,
  returnWorkflow,
  submitWorkflow,
} from "./approval-engine.js";
import {
  type ApprovalMatrixStep,
  DEFAULT_PR_APPROVAL_MATRIX,
  PR_LEGACY_STATUS_MAP,
  PURCHASE_REQUISITION_STATUSES,
} from "./workflow-types.js";

export type RequisitionApprovalSignature = ApprovalSignature;
export type PurchaseRequisitionWorkflowState = GenericWorkflowState;
export type WorkflowDecision = GenericWorkflowDecision;

/** Purchasing always reviews sourcing; below the manager threshold a buyer does it. */
export const PURCHASING_OFFICER_STEP: ApprovalMatrixStep = {
  level: "purchasing_officer",
  threshold_gte: 0,
  label: "Acheteur",
};

const requesterDepartment = (state: GenericWorkflowState) => normalizeDepartment(state.department);

const amountOf = (state: GenericWorkflowState) => {
  const parsed = Number(state.estimated_cost);
  return Number.isFinite(parsed) ? parsed : 0;
};

/**
 * How each matrix level behaves. Levels deliberately leave `department`
 * unset so the audit trail keeps attributing transitions to the requesting
 * department rather than to Achats/Finance.
 */
const LEVEL_BUILDERS: Record<string, (step: ApprovalMatrixStep) => ApprovalLevel> = {
  dept_manager: (step) => ({
    level: step.level,
    threshold_gte: step.threshold_gte,
    label: step.label,
    pendingStatus: "SUBMITTED",
    canApprove: (membership, department) => canDepartmentApprove(membership, department),
    forbiddenMessage: (department) =>
      `Seul le responsable du département ${department || "concerné"} peut valider cette DA.`,
  }),
  purchasing_officer: (step) => ({
    level: step.level,
    threshold_gte: step.threshold_gte,
    label: step.label,
    pendingStatus: "PURCHASING_REVIEW",
    acceptFrom: ["DEPARTMENT_APPROVED"],
    canApprove: (membership) => canPurchasingApprove(membership, "purchasing_officer"),
    forbiddenMessage: () => "Seuls les acheteurs peuvent valider cette étape.",
  }),
  purchasing_manager: (step) => ({
    level: step.level,
    threshold_gte: step.threshold_gte,
    label: step.label,
    pendingStatus: "PURCHASING_REVIEW",
    acceptFrom: ["DEPARTMENT_APPROVED"],
    canApprove: (membership) => canPurchasingApprove(membership, "purchasing_manager"),
    forbiddenMessage: () => "Seul le responsable Achats peut valider ce niveau.",
  }),
  daf: (step) => ({
    level: step.level,
    threshold_gte: step.threshold_gte,
    label: step.label,
    pendingStatus: "FINANCE_APPROVAL",
    acceptFrom: ["PURCHASING_REVIEW"],
    canApprove: (membership) => canFinanceApprove(membership, "daf"),
    forbiddenMessage: () => "Seul le DAF peut valider ce niveau.",
  }),
  general_direction: (step) => ({
    level: step.level,
    threshold_gte: step.threshold_gte,
    label: step.label,
    pendingStatus: "FINANCE_APPROVAL",
    canApprove: (membership) => canFinanceApprove(membership, "general_direction"),
    forbiddenMessage: () => "Seule la Direction Générale peut valider ce niveau.",
  }),
};

const buildLevel = (step: ApprovalMatrixStep): ApprovalLevel => {
  const builder = LEVEL_BUILDERS[step.level];
  if (!builder) {
    throw badRequest("UNKNOWN_APPROVAL_LEVEL", `Niveau d'approbation inconnu: ${step.level}`);
  }
  return builder(step);
};

export const purchaseRequisitionWorkflow = (
  matrix: ApprovalMatrixStep[] = DEFAULT_PR_APPROVAL_MATRIX,
): WorkflowDefinition => ({
  key: "purchase_requisition",
  entityType: "purchase_requisitions",
  entityLabel: "demande d'achat",
  entityShort: "DA",
  statuses: PURCHASE_REQUISITION_STATUSES,
  legacyStatusMap: PR_LEGACY_STATUS_MAP,
  initialStatus: "DRAFT",
  approvedStatus: "APPROVED",
  rejectedStatus: "REJECTED",
  returnedStatus: "RETURNED_FOR_CHANGES",
  cancelledStatus: "CANCELLED",
  submittableFrom: ["DRAFT", "RETURNED_FOR_CHANGES"],
  actionableStatuses: [
    "SUBMITTED",
    "DEPARTMENT_APPROVED",
    "PURCHASING_REVIEW",
    "FINANCE_APPROVAL",
  ],
  // An ordered DA is already committed to a supplier; cancelling it is a
  // purchase-order concern, not a requisition one.
  nonCancellableStatuses: ["ORDERED", "CANCELLED"],
  amountOf,
  requesterDepartment,
  resolveLevels: (state) => {
    const amount = amountOf(state);
    const steps = [...matrix].sort((left, right) => left.threshold_gte - right.threshold_gte);
    const levels = steps.map(buildLevel);

    // Small requisitions never reach the Achats manager, so a buyer performs
    // the sourcing review instead. Sits right after the department level.
    const managerHandlesReview = steps.some(
      (step) => step.level === "purchasing_manager" && amount >= step.threshold_gte,
    );
    if (!managerHandlesReview) {
      const afterDept = levels.findIndex((level) => level.level === "dept_manager") + 1;
      levels.splice(afterDept, 0, buildLevel(PURCHASING_OFFICER_STEP));
    }

    return levels;
  },
});

export const PURCHASE_REQUISITION_WORKFLOW = purchaseRequisitionWorkflow();

const definitionFor = (matrix?: ApprovalMatrixStep[]) =>
  matrix ? purchaseRequisitionWorkflow(matrix) : PURCHASE_REQUISITION_WORKFLOW;

export const submitRequisition = (
  state: PurchaseRequisitionWorkflowState,
  actor: ActorIdentity,
  options?: { reason?: string | null; matrix?: ApprovalMatrixStep[] },
): WorkflowDecision =>
  submitWorkflow(definitionFor(options?.matrix), state, actor, { reason: options?.reason });

export const approveRequisitionStep = (
  state: PurchaseRequisitionWorkflowState,
  actor: ActorIdentity,
  options?: { reason?: string | null; matrix?: ApprovalMatrixStep[] },
): WorkflowDecision =>
  approveWorkflow(definitionFor(options?.matrix), state, actor, { reason: options?.reason });

export const rejectRequisitionStep = (
  state: PurchaseRequisitionWorkflowState,
  actor: ActorIdentity,
  reason: string,
): WorkflowDecision => rejectWorkflow(PURCHASE_REQUISITION_WORKFLOW, state, actor, reason);

export const returnRequisitionForChanges = (
  state: PurchaseRequisitionWorkflowState,
  actor: ActorIdentity,
  reason: string,
): WorkflowDecision => returnWorkflow(PURCHASE_REQUISITION_WORKFLOW, state, actor, reason);

export const cancelRequisitionStep = (
  state: PurchaseRequisitionWorkflowState,
  actor: ActorIdentity,
  reason?: string | null,
): WorkflowDecision => cancelWorkflow(PURCHASE_REQUISITION_WORKFLOW, state, actor, reason);
