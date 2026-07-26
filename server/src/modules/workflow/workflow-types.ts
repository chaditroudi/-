/**
 * Reusable workflow primitives — first consumer: purchase requisitions.
 * CAPA / maintenance / overtime can reuse the same transition + history shape.
 */

export type WorkflowTransitionRecord = {
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
};

export type ApprovalMatrixStep = {
  level: string;
  threshold_gte: number;
  label: string;
};

export const DEFAULT_PR_APPROVAL_MATRIX: ApprovalMatrixStep[] = [
  { level: "dept_manager", threshold_gte: 0, label: "Responsable département" },
  { level: "purchasing_manager", threshold_gte: 1000, label: "Responsable Achats" },
  { level: "daf", threshold_gte: 10000, label: "DAF" },
  { level: "general_direction", threshold_gte: 50000, label: "Direction Générale" },
];

export const PURCHASE_REQUISITION_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "DEPARTMENT_APPROVED",
  "PURCHASING_REVIEW",
  "FINANCE_APPROVAL",
  "APPROVED",
  "ORDERED",
  "REJECTED",
  "RETURNED_FOR_CHANGES",
  "CANCELLED",
] as const;

export type PurchaseRequisitionWorkflowStatus = (typeof PURCHASE_REQUISITION_STATUSES)[number];

const LEGACY_STATUS_MAP: Record<string, PurchaseRequisitionWorkflowStatus> = {
  draft: "DRAFT",
  pending_approval: "SUBMITTED",
  submitted: "SUBMITTED",
  department_approved: "DEPARTMENT_APPROVED",
  purchasing_review: "PURCHASING_REVIEW",
  finance_approval: "FINANCE_APPROVAL",
  approved: "APPROVED",
  ordered: "ORDERED",
  rejected: "REJECTED",
  returned_for_changes: "RETURNED_FOR_CHANGES",
  cancelled: "CANCELLED",
  canceled: "CANCELLED",
};

export const normalizePurchaseRequisitionStatus = (
  value: unknown,
): PurchaseRequisitionWorkflowStatus => {
  const raw = String(value || "").trim();
  if (!raw) return "DRAFT";
  const upper = raw.toUpperCase() as PurchaseRequisitionWorkflowStatus;
  if ((PURCHASE_REQUISITION_STATUSES as readonly string[]).includes(upper)) return upper;
  return LEGACY_STATUS_MAP[raw.toLowerCase()] ?? "DRAFT";
};

/** Statuses still waiting on an approval action. */
export const isPurchaseRequisitionPending = (status: unknown) => {
  const normalized = normalizePurchaseRequisitionStatus(status);
  return (
    normalized === "SUBMITTED" ||
    normalized === "DEPARTMENT_APPROVED" ||
    normalized === "PURCHASING_REVIEW" ||
    normalized === "FINANCE_APPROVAL"
  );
};

export const isPurchaseRequisitionOpen = (status: unknown) => {
  const normalized = normalizePurchaseRequisitionStatus(status);
  return (
    normalized === "DRAFT" ||
    isPurchaseRequisitionPending(normalized) ||
    normalized === "APPROVED" ||
    normalized === "RETURNED_FOR_CHANGES"
  );
};

export const requiredApprovalLevels = (
  amount: number,
  matrix: ApprovalMatrixStep[] = DEFAULT_PR_APPROVAL_MATRIX,
): ApprovalMatrixStep[] =>
  [...matrix]
    .sort((left, right) => left.threshold_gte - right.threshold_gte)
    .filter((step) => amount >= step.threshold_gte);

export const nextUnsignedApprovalLevel = (
  amount: number,
  signedLevels: string[],
  matrix: ApprovalMatrixStep[] = DEFAULT_PR_APPROVAL_MATRIX,
): ApprovalMatrixStep | null => {
  const signed = new Set(signedLevels.map((level) => String(level || "").trim()).filter(Boolean));
  return requiredApprovalLevels(amount, matrix).find((step) => !signed.has(step.level)) ?? null;
};

export const buildTransitionRecord = (input: {
  fromStatus: string;
  toStatus: string;
  action: string;
  actorId: string;
  actorName: string;
  reason?: string | null;
  department?: string | null;
  approvalLevel?: string | null;
  metadata?: Record<string, unknown> | null;
  timestamp?: string;
}): WorkflowTransitionRecord => ({
  from_status: input.fromStatus,
  to_status: input.toStatus,
  action: input.action,
  actor_id: input.actorId,
  actor_name: input.actorName,
  timestamp: input.timestamp || new Date().toISOString(),
  reason: input.reason?.trim() || null,
  department: input.department || null,
  approval_level: input.approvalLevel || null,
  metadata: input.metadata ?? null,
});

export const appendTransition = (
  history: unknown,
  record: WorkflowTransitionRecord,
): WorkflowTransitionRecord[] => {
  const prior = Array.isArray(history) ? (history as WorkflowTransitionRecord[]) : [];
  return [...prior, record];
};
