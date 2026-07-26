/**
 * Reusable workflow primitives — first consumer: purchase requisitions.
 * CAPA / maintenance / overtime can reuse the same transition + history shape.
 */
export const DEFAULT_PR_APPROVAL_MATRIX = [
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
];
const LEGACY_STATUS_MAP = {
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
export const normalizePurchaseRequisitionStatus = (value) => {
    const raw = String(value || "").trim();
    if (!raw)
        return "DRAFT";
    const upper = raw.toUpperCase();
    if (PURCHASE_REQUISITION_STATUSES.includes(upper))
        return upper;
    return LEGACY_STATUS_MAP[raw.toLowerCase()] ?? "DRAFT";
};
/** Statuses still waiting on an approval action. */
export const isPurchaseRequisitionPending = (status) => {
    const normalized = normalizePurchaseRequisitionStatus(status);
    return (normalized === "SUBMITTED" ||
        normalized === "DEPARTMENT_APPROVED" ||
        normalized === "PURCHASING_REVIEW" ||
        normalized === "FINANCE_APPROVAL");
};
export const isPurchaseRequisitionOpen = (status) => {
    const normalized = normalizePurchaseRequisitionStatus(status);
    return (normalized === "DRAFT" ||
        isPurchaseRequisitionPending(normalized) ||
        normalized === "APPROVED" ||
        normalized === "RETURNED_FOR_CHANGES");
};
export const requiredApprovalLevels = (amount, matrix = DEFAULT_PR_APPROVAL_MATRIX) => [...matrix]
    .sort((left, right) => left.threshold_gte - right.threshold_gte)
    .filter((step) => amount >= step.threshold_gte);
export const nextUnsignedApprovalLevel = (amount, signedLevels, matrix = DEFAULT_PR_APPROVAL_MATRIX) => {
    const signed = new Set(signedLevels.map((level) => String(level || "").trim()).filter(Boolean));
    return requiredApprovalLevels(amount, matrix).find((step) => !signed.has(step.level)) ?? null;
};
export const buildTransitionRecord = (input) => ({
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
export const appendTransition = (history, record) => {
    const prior = Array.isArray(history) ? history : [];
    return [...prior, record];
};
