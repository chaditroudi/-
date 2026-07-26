/**
 * Generic, config-driven approval workflow engine.
 *
 * A `WorkflowDefinition` describes the statuses, the ordered approval levels
 * (with amount thresholds + per-level permission checks) and how to read the
 * requester department / amount from a domain record. The five verbs
 * (submit / approve / reject / return / cancel) then operate over any
 * definition, so new consumers (maintenance requests, CAPA, overtime, supplier
 * approvals, ...) reuse the exact same separation-of-duties, audit-trail and
 * routing logic that purchase requisitions pioneered.
 *
 * Reuses the shared primitives in workflow-types.ts (transition record +
 * history helpers) and org membership for actor identity + permissions.
 */

import { badRequest, forbidden } from "../../core/app-error.js";
import { type DepartmentCode } from "../org/departments.js";
import {
  type ActorIdentity,
  type OrgMembership,
  membershipFromActor,
} from "../org/membership.js";
import {
  type WorkflowTransitionRecord,
  appendTransition,
  buildTransitionRecord,
} from "./workflow-types.js";

export type ApprovalSignature = {
  level: string;
  label: string;
  approved_by: string;
  approved_by_id?: string | null;
  approved_at: string;
};

export type GenericWorkflowState = {
  id?: string;
  status?: string | null;
  requester_id?: string | null;
  requester_name?: string | null;
  department?: string | null;
  estimated_cost?: number | null;
  approvals?: ApprovalSignature[] | null;
  workflow_history?: WorkflowTransitionRecord[] | null;
  [key: string]: unknown;
};

export type ApprovalLevel = {
  /** Stable identifier persisted on signatures + transitions. */
  level: string;
  /** Minimum amount for this level to be required (0 = always). */
  threshold_gte: number;
  label: string;
  /** Status the record sits in while awaiting this level. */
  pendingStatus: string;
  /** Department to attribute/check for this level; defaults to requester dept. */
  department?: (state: GenericWorkflowState) => DepartmentCode | null;
  /** Whether the acting membership may sign this level. */
  canApprove: (
    membership: OrgMembership,
    department: DepartmentCode | null,
    state: GenericWorkflowState,
  ) => boolean;
  forbiddenMessage: (department: DepartmentCode | null) => string;
};

export type WorkflowDefinition = {
  key: string;
  entityType: string;
  entityLabel: string;
  entityShort: string;
  statuses: readonly string[];
  legacyStatusMap: Record<string, string>;
  initialStatus: string;
  approvedStatus: string;
  rejectedStatus: string;
  returnedStatus: string;
  cancelledStatus: string;
  submittableFrom: string[];
  /** Statuses eligible for approve / reject / return. */
  actionableStatuses: string[];
  /** Statuses from which cancellation is not allowed. */
  nonCancellableStatuses: string[];
  amountOf: (state: GenericWorkflowState) => number;
  requesterDepartment: (state: GenericWorkflowState) => DepartmentCode | null;
  /** Ordered approval levels for a given record (may vary by state). */
  resolveLevels: (state: GenericWorkflowState) => ApprovalLevel[];
  /** MES roles allowed to cancel regardless of ownership. */
  adminCancelRoles?: string[];
};

export type WorkflowDecision = {
  status: string;
  approvals: ApprovalSignature[];
  workflow_history: WorkflowTransitionRecord[];
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  current_approval_level: string | null;
  notify: {
    requester: boolean;
    nextApproverLevel: string | null;
    confirmation: boolean;
  };
  transition: WorkflowTransitionRecord;
};

const DEFAULT_ADMIN_CANCEL_ROLES = [
  "administrateur_systeme",
  "directeur_general",
  "direction",
];

const readString = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
};

export const normalizeStatus = (def: WorkflowDefinition, value: unknown): string => {
  const raw = String(value || "").trim();
  if (!raw) return def.initialStatus;
  const upper = raw.toUpperCase();
  if ((def.statuses as readonly string[]).includes(upper)) return upper;
  return def.legacyStatusMap[raw.toLowerCase()] ?? def.initialStatus;
};

const requiredLevels = (def: WorkflowDefinition, state: GenericWorkflowState): ApprovalLevel[] => {
  const amount = def.amountOf(state);
  return def
    .resolveLevels(state)
    .filter((level) => amount >= level.threshold_gte)
    .slice()
    .sort((left, right) => left.threshold_gte - right.threshold_gte);
};

const signedLevels = (state: GenericWorkflowState) =>
  (Array.isArray(state.approvals) ? state.approvals : []).map((entry) => readString(entry.level));

const assertActor = (actor: ActorIdentity): OrgMembership => {
  const membership = membershipFromActor(actor);
  if (!membership?.userId) {
    throw forbidden("Authentication required for workflow actions.");
  }
  return membership;
};

const assertNotSelfApprove = (state: GenericWorkflowState, membership: OrgMembership) => {
  const requesterId = readString(state.requester_id);
  if (requesterId && requesterId === membership.userId) {
    throw badRequest(
      "SOD_VIOLATION",
      "RG-VAL-02 — Un demandeur ne peut pas valider sa propre demande.",
    );
  }
};

const assertNotDoubleSign = (state: GenericWorkflowState, membership: OrgMembership) => {
  const approvals = Array.isArray(state.approvals) ? state.approvals : [];
  const already = approvals.some(
    (entry) =>
      readString(entry.approved_by_id) === membership.userId ||
      readString(entry.approved_by).toLowerCase() === membership.fullName.toLowerCase(),
  );
  if (already) {
    throw badRequest(
      "SOD_VIOLATION",
      "Séparation des tâches — un même valideur ne peut pas signer deux niveaux du circuit.",
    );
  }
};

const departmentForLevel = (
  def: WorkflowDefinition,
  level: ApprovalLevel,
  state: GenericWorkflowState,
): DepartmentCode | null => level.department?.(state) ?? def.requesterDepartment(state);

export const submitWorkflow = (
  def: WorkflowDefinition,
  state: GenericWorkflowState,
  actor: ActorIdentity,
  options?: { reason?: string | null },
): WorkflowDecision => {
  const membership = assertActor(actor);
  const from = normalizeStatus(def, state.status);
  if (!def.submittableFrom.includes(from)) {
    throw badRequest("INVALID_TRANSITION", `Impossible de soumettre depuis le statut ${from}.`);
  }

  const department = def.requesterDepartment(state) || membership.primaryDepartment;
  if (!department) {
    throw badRequest("DEPARTMENT_REQUIRED", "Un département est requis pour la soumission.");
  }

  const stateWithDept: GenericWorkflowState = { ...state, department };
  const required = requiredLevels(def, stateWithDept);
  const firstLevel = required[0] ?? null;
  const to = firstLevel ? firstLevel.pendingStatus : def.approvedStatus;

  const transition = buildTransitionRecord({
    fromStatus: from,
    toStatus: to,
    action: "submit",
    actorId: membership.userId,
    actorName: membership.fullName,
    reason: options?.reason,
    department,
    approvalLevel: firstLevel?.level ?? null,
  });

  return {
    status: to,
    approvals: Array.isArray(state.approvals) ? state.approvals : [],
    workflow_history: appendTransition(state.workflow_history, transition),
    approved_by: null,
    approved_at: null,
    rejection_reason: null,
    current_approval_level: firstLevel?.level ?? null,
    notify: {
      requester: true,
      nextApproverLevel: firstLevel?.level ?? null,
      confirmation: true,
    },
    transition,
  };
};

export const approveWorkflow = (
  def: WorkflowDefinition,
  state: GenericWorkflowState,
  actor: ActorIdentity,
  options?: { reason?: string | null },
): WorkflowDecision => {
  const membership = assertActor(actor);
  assertNotSelfApprove(state, membership);
  assertNotDoubleSign(state, membership);

  const from = normalizeStatus(def, state.status);
  const required = requiredLevels(def, state);
  const signed = signedLevels(state);
  const nextStep = required.find((level) => !signed.includes(level.level));

  if (!nextStep) {
    throw badRequest("NO_PENDING_APPROVAL", "Aucun niveau d'approbation en attente.");
  }
  if (from !== nextStep.pendingStatus) {
    throw badRequest(
      "INVALID_TRANSITION",
      `Approbation « ${nextStep.level} » invalide depuis le statut ${from}.`,
    );
  }

  const department = departmentForLevel(def, nextStep, state);
  if (!nextStep.canApprove(membership, department, state)) {
    throw forbidden(nextStep.forbiddenMessage(department));
  }

  const signature: ApprovalSignature = {
    level: nextStep.level,
    label: nextStep.label,
    approved_by: membership.fullName,
    approved_by_id: membership.userId,
    approved_at: new Date().toISOString(),
  };
  const approvals = [...(Array.isArray(state.approvals) ? state.approvals : []), signature];
  const newSigned = approvals.map((entry) => entry.level);
  const nextRequired = required.find((level) => !newSigned.includes(level.level)) ?? null;

  const to = nextRequired ? nextRequired.pendingStatus : def.approvedStatus;
  const nextApproverLevel = nextRequired?.level ?? null;
  const finalApproved = to === def.approvedStatus;

  const transition = buildTransitionRecord({
    fromStatus: from,
    toStatus: to,
    action: "approve",
    actorId: membership.userId,
    actorName: membership.fullName,
    reason: options?.reason,
    department,
    approvalLevel: nextStep.level,
  });

  return {
    status: to,
    approvals,
    workflow_history: appendTransition(state.workflow_history, transition),
    approved_by: finalApproved ? membership.fullName : null,
    approved_at: finalApproved ? signature.approved_at : null,
    rejection_reason: null,
    current_approval_level: nextApproverLevel,
    notify: { requester: true, nextApproverLevel, confirmation: false },
    transition,
  };
};

export const rejectWorkflow = (
  def: WorkflowDefinition,
  state: GenericWorkflowState,
  actor: ActorIdentity,
  reason: string,
): WorkflowDecision => {
  const membership = assertActor(actor);
  assertNotSelfApprove(state, membership);

  if (!readString(reason)) {
    throw badRequest("REJECTION_REASON_REQUIRED", "Un motif de rejet est requis.");
  }

  const from = normalizeStatus(def, state.status);
  if (!def.actionableStatuses.includes(from)) {
    throw badRequest("INVALID_TRANSITION", `Rejet impossible depuis le statut ${from}.`);
  }

  const to = def.rejectedStatus;
  const transition = buildTransitionRecord({
    fromStatus: from,
    toStatus: to,
    action: "reject",
    actorId: membership.userId,
    actorName: membership.fullName,
    reason,
    department: def.requesterDepartment(state),
    approvalLevel: null,
  });

  return {
    status: to,
    approvals: Array.isArray(state.approvals) ? state.approvals : [],
    workflow_history: appendTransition(state.workflow_history, transition),
    approved_by: membership.fullName,
    approved_at: transition.timestamp,
    rejection_reason: reason.trim(),
    current_approval_level: null,
    notify: { requester: true, nextApproverLevel: null, confirmation: false },
    transition,
  };
};

export const returnWorkflow = (
  def: WorkflowDefinition,
  state: GenericWorkflowState,
  actor: ActorIdentity,
  reason: string,
): WorkflowDecision => {
  const membership = assertActor(actor);
  assertNotSelfApprove(state, membership);

  if (!readString(reason)) {
    throw badRequest("RETURN_REASON_REQUIRED", "Un motif de retour est requis.");
  }

  const from = normalizeStatus(def, state.status);
  if (!def.actionableStatuses.includes(from)) {
    throw badRequest("INVALID_TRANSITION", `Retour impossible depuis le statut ${from}.`);
  }

  const to = def.returnedStatus;
  const transition = buildTransitionRecord({
    fromStatus: from,
    toStatus: to,
    action: "return",
    actorId: membership.userId,
    actorName: membership.fullName,
    reason,
    department: def.requesterDepartment(state),
    approvalLevel: null,
  });

  return {
    status: to,
    // Returning for changes clears prior sign-offs — the circuit restarts.
    approvals: [],
    workflow_history: appendTransition(state.workflow_history, transition),
    approved_by: null,
    approved_at: null,
    rejection_reason: reason.trim(),
    current_approval_level: null,
    notify: { requester: true, nextApproverLevel: null, confirmation: false },
    transition,
  };
};

export const cancelWorkflow = (
  def: WorkflowDefinition,
  state: GenericWorkflowState,
  actor: ActorIdentity,
  reason?: string | null,
): WorkflowDecision => {
  const membership = assertActor(actor);
  const from = normalizeStatus(def, state.status);
  if (def.nonCancellableStatuses.includes(from)) {
    throw badRequest("INVALID_TRANSITION", `Annulation impossible depuis le statut ${from}.`);
  }

  const requesterId = readString(state.requester_id);
  const isRequester = requesterId === membership.userId;
  const adminRoles = def.adminCancelRoles ?? DEFAULT_ADMIN_CANCEL_ROLES;
  const isAdmin = membership.mesRoles.some((role) => adminRoles.includes(role));
  if (!isRequester && !isAdmin) {
    throw forbidden("Seul le demandeur (ou un administrateur) peut annuler cette demande.");
  }

  const to = def.cancelledStatus;
  const transition = buildTransitionRecord({
    fromStatus: from,
    toStatus: to,
    action: "cancel",
    actorId: membership.userId,
    actorName: membership.fullName,
    reason: reason || null,
    department: def.requesterDepartment(state),
    approvalLevel: null,
  });

  return {
    status: to,
    approvals: Array.isArray(state.approvals) ? state.approvals : [],
    workflow_history: appendTransition(state.workflow_history, transition),
    approved_by: membership.fullName,
    approved_at: transition.timestamp,
    rejection_reason: reason?.trim() || null,
    current_approval_level: null,
    notify: { requester: true, nextApproverLevel: null, confirmation: false },
    transition,
  };
};

/**
 * Non-approval state change (e.g. execution complete / close). Records a full
 * audit transition and optionally enforces an actor permission check.
 */
export const manualTransitionWorkflow = (
  def: WorkflowDefinition,
  state: GenericWorkflowState,
  actor: ActorIdentity,
  opts: {
    action: string;
    toStatus: string;
    allowedFrom: string[];
    reason?: string | null;
    canPerform?: (membership: OrgMembership) => boolean;
    forbiddenMessage?: string;
  },
): WorkflowDecision => {
  const membership = assertActor(actor);
  const from = normalizeStatus(def, state.status);
  if (!opts.allowedFrom.includes(from)) {
    throw badRequest("INVALID_TRANSITION", `Transition « ${opts.action} » impossible depuis ${from}.`);
  }
  if (opts.canPerform && !opts.canPerform(membership)) {
    throw forbidden(opts.forbiddenMessage || "Action non autorisée pour votre profil.");
  }

  const transition = buildTransitionRecord({
    fromStatus: from,
    toStatus: opts.toStatus,
    action: opts.action,
    actorId: membership.userId,
    actorName: membership.fullName,
    reason: opts.reason || null,
    department: def.requesterDepartment(state),
    approvalLevel: null,
  });

  return {
    status: opts.toStatus,
    approvals: Array.isArray(state.approvals) ? state.approvals : [],
    workflow_history: appendTransition(state.workflow_history, transition),
    approved_by: membership.fullName,
    approved_at: transition.timestamp,
    rejection_reason: null,
    current_approval_level: null,
    notify: { requester: true, nextApproverLevel: null, confirmation: false },
    transition,
  };
};
