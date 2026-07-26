/**
 * Targeted purchase-requisition notifications.
 * Prefer specific managers (targetUserIds) over blasting an entire space role.
 */
import { emitNotification } from "../notifications/notification-emitter.js";
import { normalizeDepartment } from "../org/departments.js";
import { findDepartmentManagers, findFinanceApprovers, findPurchasingApprovers, } from "../org/membership.js";
const actionUrlFor = (id) => `/purchasing?requisition=${encodeURIComponent(id)}`;
const resolveNextApproverIds = async (level, department) => {
    if (!level)
        return [];
    if (level === "dept_manager" && department) {
        return (await findDepartmentManagers(department)).map((user) => user.userId);
    }
    if (level === "purchasing_officer") {
        return (await findPurchasingApprovers("purchasing_officer")).map((user) => user.userId);
    }
    if (level === "purchasing_manager") {
        return (await findPurchasingApprovers("purchasing_manager")).map((user) => user.userId);
    }
    if (level === "daf") {
        return (await findFinanceApprovers("daf")).map((user) => user.userId);
    }
    if (level === "general_direction") {
        return (await findFinanceApprovers("general_direction")).map((user) => user.userId);
    }
    return [];
};
export const notifyPurchaseRequisitionTransition = async (requisition, decision, actorId) => {
    const number = String(requisition.requisition_number || requisition.id);
    const material = String(requisition.material_name || "matériel");
    const department = normalizeDepartment(requisition.department);
    const requesterId = requisition.requester_id ? String(requisition.requester_id) : null;
    if (decision.notify.confirmation && requesterId) {
        await emitNotification({
            notificationType: "PR_SUBMITTED_CONFIRMATION",
            category: "purchasing",
            space: "purchasing",
            title: `DA ${number} soumise`,
            message: `Votre demande pour ${material} a été soumise et attend la validation de votre responsable.`,
            severity: "success",
            entityType: "purchase_requisitions",
            entityId: requisition.id,
            actionUrl: actionUrlFor(requisition.id),
            targetRoles: ["__none__"],
            targetUserIds: [requesterId],
            actorId: actorId || null,
            metadata: { status: decision.status, level: decision.current_approval_level },
        });
    }
    if (decision.notify.requester && requesterId && !decision.notify.confirmation) {
        const action = decision.transition.action;
        const title = action === "reject"
            ? `DA ${number} rejetée`
            : action === "return"
                ? `DA ${number} renvoyée`
                : action === "cancel"
                    ? `DA ${number} annulée`
                    : decision.status === "APPROVED"
                        ? `DA ${number} approuvée`
                        : `DA ${number} — ${decision.transition.actor_name} a agi`;
        const message = action === "reject"
            ? `Motif: ${decision.rejection_reason || "—"}`
            : action === "return"
                ? `À corriger: ${decision.rejection_reason || "—"}`
                : decision.status === "APPROVED"
                    ? `Votre demande pour ${material} est entièrement approuvée.`
                    : `Statut: ${decision.status}. Prochaine étape: ${decision.notify.nextApproverLevel || "—"}.`;
        await emitNotification({
            notificationType: `PR_${decision.transition.action.toUpperCase()}_REQUESTER`,
            category: "purchasing",
            space: "purchasing",
            title,
            message,
            severity: action === "reject" ? "error" : action === "return" ? "warning" : "info",
            entityType: "purchase_requisitions",
            entityId: requisition.id,
            actionUrl: actionUrlFor(requisition.id),
            targetRoles: ["__none__"],
            targetUserIds: [requesterId],
            actorId: actorId || null,
            metadata: { status: decision.status, reason: decision.rejection_reason },
        });
    }
    if (decision.notify.nextApproverLevel) {
        const targetUserIds = await resolveNextApproverIds(decision.notify.nextApproverLevel, department);
        // Exclude the actor and the requester from the actionable queue.
        const filtered = targetUserIds.filter((id) => id !== actorId && id !== requesterId);
        // Never pass an empty target_roles array — that broadcasts to everyone.
        // Prefer named managers; fall back to purchasing roles only when nobody is mapped.
        const fallbackRoles = filtered.length > 0
            ? ["__none__"]
            : decision.notify.nextApproverLevel.startsWith("purchasing")
                ? ["responsable_achats", "directeur_achat"]
                : decision.notify.nextApproverLevel === "daf" ||
                    decision.notify.nextApproverLevel === "general_direction"
                    ? ["daf", "directeur_general", "direction"]
                    : ["__none__"];
        if (filtered.length === 0 && fallbackRoles[0] === "__none__") {
            // No department manager membership configured yet — nothing actionable to send.
            return;
        }
        await emitNotification({
            notificationType: `PR_ACTION_REQUIRED_${decision.notify.nextApproverLevel}`,
            category: "purchasing",
            space: "purchasing",
            title: `Action requise — DA ${number}`,
            message: `${requisition.requester_name || "Un collègue"} demande ${material}. Niveau: ${decision.notify.nextApproverLevel}.`,
            severity: "warning",
            entityType: "purchase_requisitions",
            entityId: requisition.id,
            actionUrl: actionUrlFor(requisition.id),
            targetRoles: fallbackRoles,
            targetUserIds: filtered,
            actorId: actorId || null,
            metadata: {
                status: decision.status,
                approval_level: decision.notify.nextApproverLevel,
                department,
            },
        });
    }
};
