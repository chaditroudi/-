/**
 * Purchase-requisition workflow engine.
 *
 * DRAFT → SUBMITTED → DEPARTMENT_APPROVED → PURCHASING_REVIEW
 *   → FINANCE_APPROVAL (optional by threshold) → APPROVED → ORDERED
 * Branches: REJECTED | RETURNED_FOR_CHANGES | CANCELLED
 */
import { badRequest, forbidden } from "../../core/app-error.js";
import { normalizeDepartment } from "../org/departments.js";
import { canDepartmentApprove, canFinanceApprove, canPurchasingApprove, membershipFromActor, } from "../org/membership.js";
import { appendTransition, buildTransitionRecord, DEFAULT_PR_APPROVAL_MATRIX, nextUnsignedApprovalLevel, normalizePurchaseRequisitionStatus, requiredApprovalLevels, } from "./workflow-types.js";
const readString = (...values) => {
    for (const value of values) {
        if (typeof value === "string" && value.trim())
            return value.trim();
    }
    return "";
};
const readNumber = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};
const assertActor = (actor) => {
    const membership = membershipFromActor(actor);
    if (!membership?.userId) {
        throw forbidden("Authentication required for workflow actions.");
    }
    return membership;
};
const assertNotSelfApprove = (state, membership) => {
    const requesterId = readString(state.requester_id);
    if (requesterId && requesterId === membership.userId) {
        throw badRequest("SOD_VIOLATION", "RG-VAL-02 — Un demandeur ne peut pas valider sa propre demande d'achat.");
    }
};
const assertNotDoubleSign = (state, membership) => {
    const approvals = Array.isArray(state.approvals) ? state.approvals : [];
    const already = approvals.some((entry) => readString(entry.approved_by_id) === membership.userId ||
        readString(entry.approved_by).toLowerCase() === membership.fullName.toLowerCase());
    if (already) {
        throw badRequest("SOD_VIOLATION", "Séparation des tâches — un même valideur ne peut pas signer deux niveaux du circuit.");
    }
};
const departmentOf = (state) => normalizeDepartment(state.department);
const signedLevels = (state) => (Array.isArray(state.approvals) ? state.approvals : []).map((entry) => readString(entry.level));
const resolveNextStatus = (amount, signed, matrix) => {
    const required = requiredApprovalLevels(amount, matrix);
    const next = required.find((step) => !signed.includes(step.level)) ?? null;
    if (!next)
        return { status: "APPROVED", nextLevel: null };
    if (next.level === "dept_manager") {
        return { status: "SUBMITTED", nextLevel: next };
    }
    if (next.level === "purchasing_manager") {
        return { status: "PURCHASING_REVIEW", nextLevel: next };
    }
    if (next.level === "daf" || next.level === "general_direction") {
        return { status: "FINANCE_APPROVAL", nextLevel: next };
    }
    return { status: "PURCHASING_REVIEW", nextLevel: next };
};
/**
 * After department approval, always enter PURCHASING_REVIEW for sourcing/RFQ.
 * Higher amount thresholds then route to purchasing manager / finance / direction.
 */
export const statusAfterDepartmentApproval = (amount, matrix = DEFAULT_PR_APPROVAL_MATRIX) => {
    const required = requiredApprovalLevels(amount, matrix).filter((step) => step.level !== "dept_manager");
    if (required.length === 0 || required[0]?.level === "purchasing_manager") {
        return {
            status: "PURCHASING_REVIEW",
            nextLevel: required[0] ??
                { level: "purchasing_officer", threshold_gte: 0, label: "Acheteur" },
        };
    }
    // Amount skips straight to finance in the matrix — purchasing still reviews first.
    return {
        status: "PURCHASING_REVIEW",
        nextLevel: { level: "purchasing_officer", threshold_gte: 0, label: "Acheteur" },
    };
};
export const submitRequisition = (state, actor, options) => {
    const membership = assertActor(actor);
    const from = normalizePurchaseRequisitionStatus(state.status);
    if (from !== "DRAFT" && from !== "RETURNED_FOR_CHANGES") {
        throw badRequest("INVALID_TRANSITION", `Impossible de soumettre une DA en statut ${from}.`);
    }
    const department = departmentOf(state) || membership.primaryDepartment;
    if (!department) {
        throw badRequest("DEPARTMENT_REQUIRED", "Un département est requis pour soumettre une demande d'achat.");
    }
    const to = "SUBMITTED";
    const transition = buildTransitionRecord({
        fromStatus: from,
        toStatus: to,
        action: "submit",
        actorId: membership.userId,
        actorName: membership.fullName,
        reason: options?.reason,
        department,
        approvalLevel: "dept_manager",
    });
    return {
        status: to,
        approvals: Array.isArray(state.approvals) ? state.approvals : [],
        workflow_history: appendTransition(state.workflow_history, transition),
        approved_by: null,
        approved_at: null,
        rejection_reason: null,
        current_approval_level: "dept_manager",
        notify: {
            requester: true,
            nextApproverLevel: "dept_manager",
            confirmation: true,
        },
        transition,
    };
};
export const approveRequisitionStep = (state, actor, options) => {
    const membership = assertActor(actor);
    assertNotSelfApprove(state, membership);
    assertNotDoubleSign(state, membership);
    const from = normalizePurchaseRequisitionStatus(state.status);
    const matrix = options?.matrix ?? DEFAULT_PR_APPROVAL_MATRIX;
    const amount = readNumber(state.estimated_cost);
    const department = departmentOf(state);
    const alreadySigned = signedLevels(state);
    const nextStep = nextUnsignedApprovalLevel(amount, alreadySigned, matrix) ||
        (from === "PURCHASING_REVIEW" && !alreadySigned.includes("purchasing_officer")
            ? { level: "purchasing_officer", threshold_gte: 0, label: "Acheteur" }
            : null);
    if (!nextStep) {
        throw badRequest("NO_PENDING_APPROVAL", "Aucun niveau d'approbation en attente.");
    }
    // Permission checks by level
    if (nextStep.level === "dept_manager") {
        if (from !== "SUBMITTED") {
            throw badRequest("INVALID_TRANSITION", `Approbation département invalide depuis ${from}.`);
        }
        if (!canDepartmentApprove(membership, department)) {
            throw forbidden(`Seul le responsable du département ${department || "concerné"} peut valider cette DA.`);
        }
    }
    else if (nextStep.level === "purchasing_officer") {
        if (from !== "PURCHASING_REVIEW" && from !== "DEPARTMENT_APPROVED") {
            throw badRequest("INVALID_TRANSITION", `Revue Achats invalide depuis ${from}.`);
        }
        if (!canPurchasingApprove(membership, "purchasing_officer")) {
            throw forbidden("Seuls les acheteurs peuvent valider cette étape.");
        }
    }
    else if (nextStep.level === "purchasing_manager") {
        if (from !== "PURCHASING_REVIEW" && from !== "DEPARTMENT_APPROVED") {
            throw badRequest("INVALID_TRANSITION", `Approbation Achats invalide depuis ${from}.`);
        }
        if (!canPurchasingApprove(membership, "purchasing_manager")) {
            throw forbidden("Seul le responsable Achats peut valider ce niveau.");
        }
    }
    else if (nextStep.level === "daf") {
        if (from !== "FINANCE_APPROVAL" && from !== "PURCHASING_REVIEW") {
            throw badRequest("INVALID_TRANSITION", `Approbation DAF invalide depuis ${from}.`);
        }
        if (!canFinanceApprove(membership, "daf")) {
            throw forbidden("Seul le DAF peut valider ce niveau.");
        }
    }
    else if (nextStep.level === "general_direction") {
        if (from !== "FINANCE_APPROVAL") {
            throw badRequest("INVALID_TRANSITION", `Approbation Direction invalide depuis ${from}.`);
        }
        if (!canFinanceApprove(membership, "general_direction")) {
            throw forbidden("Seule la Direction Générale peut valider ce niveau.");
        }
    }
    else {
        throw badRequest("UNKNOWN_APPROVAL_LEVEL", `Niveau d'approbation inconnu: ${nextStep.level}`);
    }
    const signature = {
        level: nextStep.level,
        label: nextStep.label,
        approved_by: membership.fullName,
        approved_by_id: membership.userId,
        approved_at: new Date().toISOString(),
    };
    const approvals = [...(Array.isArray(state.approvals) ? state.approvals : []), signature];
    const signed = approvals.map((entry) => entry.level);
    let to;
    let nextApproverLevel = null;
    if (nextStep.level === "dept_manager") {
        const after = statusAfterDepartmentApproval(amount, matrix);
        // Intermediate DEPARTMENT_APPROVED then purchasing — we persist PURCHASING_REVIEW directly
        // and record both in history via one transition to PURCHASING_REVIEW with dept signature.
        to = after.status;
        nextApproverLevel = after.nextLevel?.level ?? "purchasing_officer";
    }
    else if (nextStep.level === "purchasing_officer") {
        const needsManager = requiredApprovalLevels(amount, matrix).some((step) => step.level === "purchasing_manager");
        if (needsManager && !signed.includes("purchasing_manager")) {
            to = "PURCHASING_REVIEW";
            nextApproverLevel = "purchasing_manager";
        }
        else {
            const financeNext = requiredApprovalLevels(amount, matrix).find((step) => (step.level === "daf" || step.level === "general_direction") &&
                !signed.includes(step.level));
            if (financeNext) {
                to = "FINANCE_APPROVAL";
                nextApproverLevel = financeNext.level;
            }
            else {
                to = "APPROVED";
                nextApproverLevel = null;
            }
        }
    }
    else if (nextStep.level === "purchasing_manager") {
        const financeNext = requiredApprovalLevels(amount, matrix).find((step) => (step.level === "daf" || step.level === "general_direction") &&
            !signed.includes(step.level));
        if (financeNext) {
            to = "FINANCE_APPROVAL";
            nextApproverLevel = financeNext.level;
        }
        else {
            to = "APPROVED";
            nextApproverLevel = null;
        }
    }
    else {
        const resolved = resolveNextStatus(amount, signed, matrix);
        to = resolved.status;
        nextApproverLevel = resolved.nextLevel?.level ?? null;
    }
    const transition = buildTransitionRecord({
        fromStatus: from,
        toStatus: to,
        action: "approve",
        actorId: membership.userId,
        actorName: membership.fullName,
        reason: options?.reason,
        department: department,
        approvalLevel: nextStep.level,
    });
    const finalApproved = to === "APPROVED";
    return {
        status: to,
        approvals,
        workflow_history: appendTransition(state.workflow_history, transition),
        approved_by: finalApproved ? membership.fullName : null,
        approved_at: finalApproved ? signature.approved_at : null,
        rejection_reason: null,
        current_approval_level: nextApproverLevel,
        notify: {
            requester: true,
            nextApproverLevel,
            confirmation: false,
        },
        transition,
    };
};
export const rejectRequisitionStep = (state, actor, reason) => {
    const membership = assertActor(actor);
    assertNotSelfApprove(state, membership);
    if (!readString(reason)) {
        throw badRequest("REJECTION_REASON_REQUIRED", "Un motif de rejet est requis.");
    }
    const from = normalizePurchaseRequisitionStatus(state.status);
    if (from !== "SUBMITTED" &&
        from !== "DEPARTMENT_APPROVED" &&
        from !== "PURCHASING_REVIEW" &&
        from !== "FINANCE_APPROVAL") {
        throw badRequest("INVALID_TRANSITION", `Rejet impossible depuis le statut ${from}.`);
    }
    const to = "REJECTED";
    const transition = buildTransitionRecord({
        fromStatus: from,
        toStatus: to,
        action: "reject",
        actorId: membership.userId,
        actorName: membership.fullName,
        reason,
        department: departmentOf(state),
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
export const returnRequisitionForChanges = (state, actor, reason) => {
    const membership = assertActor(actor);
    assertNotSelfApprove(state, membership);
    if (!readString(reason)) {
        throw badRequest("RETURN_REASON_REQUIRED", "Un motif de retour est requis.");
    }
    const from = normalizePurchaseRequisitionStatus(state.status);
    if (from !== "SUBMITTED" &&
        from !== "DEPARTMENT_APPROVED" &&
        from !== "PURCHASING_REVIEW" &&
        from !== "FINANCE_APPROVAL") {
        throw badRequest("INVALID_TRANSITION", `Retour impossible depuis le statut ${from}.`);
    }
    const to = "RETURNED_FOR_CHANGES";
    const transition = buildTransitionRecord({
        fromStatus: from,
        toStatus: to,
        action: "return",
        actorId: membership.userId,
        actorName: membership.fullName,
        reason,
        department: departmentOf(state),
        approvalLevel: null,
    });
    return {
        status: to,
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
export const cancelRequisitionStep = (state, actor, reason) => {
    const membership = assertActor(actor);
    const from = normalizePurchaseRequisitionStatus(state.status);
    if (from === "ORDERED" || from === "CANCELLED") {
        throw badRequest("INVALID_TRANSITION", `Annulation impossible depuis le statut ${from}.`);
    }
    const requesterId = readString(state.requester_id);
    const isRequester = requesterId === membership.userId;
    const isAdmin = membership.mesRoles.some((role) => ["administrateur_systeme", "directeur_general", "direction"].includes(role));
    if (!isRequester && !isAdmin) {
        throw forbidden("Seul le demandeur (ou un admin) peut annuler cette DA.");
    }
    const to = "CANCELLED";
    const transition = buildTransitionRecord({
        fromStatus: from,
        toStatus: to,
        action: "cancel",
        actorId: membership.userId,
        actorName: membership.fullName,
        reason: reason || null,
        department: departmentOf(state),
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
