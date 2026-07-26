/**
 * Targeted maintenance-request notifications.
 * Prefers specific managers (targetUserIds) over blasting an entire space role,
 * mirroring the purchase-requisition notifier but for the maintenance domain.
 */

import { emitNotification } from "../notifications/notification-emitter.js";
import { normalizeDepartment, type DepartmentCode } from "../org/departments.js";
import { findDepartmentManagers, findFinanceApprovers } from "../org/membership.js";
import type { WorkflowDecision } from "./approval-engine.js";

type MaintenanceNotifyContext = {
  id: string;
  request_number?: string | null;
  requester_id?: string | null;
  requester_name?: string | null;
  department?: string | null;
  equipment_name?: string | null;
  title?: string | null;
};

const actionUrlFor = (id: string) => `/?tab=maintenance&request=${encodeURIComponent(id)}`;

const resolveNextApproverIds = async (
  level: string | null,
  requesterDepartment: DepartmentCode | null,
): Promise<string[]> => {
  if (!level) return [];

  if (level === "dept_manager" && requesterDepartment) {
    return (await findDepartmentManagers(requesterDepartment)).map((user) => user.userId);
  }
  if (level === "maintenance_manager") {
    return (await findDepartmentManagers("maintenance")).map((user) => user.userId);
  }
  if (level === "daf") {
    return (await findFinanceApprovers("daf")).map((user) => user.userId);
  }
  return [];
};

export const notifyMaintenanceRequestTransition = async (
  request: MaintenanceNotifyContext,
  decision: WorkflowDecision,
  actorId?: string | null,
) => {
  const number = String(request.request_number || request.id);
  const subject = String(request.equipment_name || request.title || "intervention");
  const department = normalizeDepartment(request.department);
  const requesterId = request.requester_id ? String(request.requester_id) : null;

  if (decision.notify.confirmation && requesterId) {
    await emitNotification({
      notificationType: "MR_SUBMITTED_CONFIRMATION",
      category: "maintenance",
      space: "maintenance",
      title: `Demande ${number} soumise`,
      message: `Votre demande de maintenance (${subject}) a été soumise et attend la validation de votre responsable.`,
      severity: "success",
      entityType: "maintenance_requests",
      entityId: request.id,
      actionUrl: actionUrlFor(request.id),
      targetRoles: ["__none__"],
      targetUserIds: [requesterId],
      actorId: actorId || null,
      metadata: { status: decision.status, level: decision.current_approval_level },
    });
  }

  if (decision.notify.requester && requesterId && !decision.notify.confirmation) {
    const action = decision.transition.action;
    const title =
      action === "reject"
        ? `Demande ${number} rejetée`
        : action === "return"
          ? `Demande ${number} renvoyée`
          : action === "cancel"
            ? `Demande ${number} annulée`
            : action === "complete"
              ? `Demande ${number} clôturée`
              : decision.status === "APPROVED"
                ? `Demande ${number} approuvée`
                : `Demande ${number} — ${decision.transition.actor_name} a agi`;

    const message =
      action === "reject"
        ? `Motif: ${decision.rejection_reason || "—"}`
        : action === "return"
          ? `À corriger: ${decision.rejection_reason || "—"}`
          : action === "complete"
            ? `L'intervention (${subject}) est terminée.`
            : decision.status === "APPROVED"
              ? `Votre demande (${subject}) est entièrement approuvée et peut être planifiée.`
              : `Statut: ${decision.status}. Prochaine étape: ${decision.notify.nextApproverLevel || "—"}.`;

    await emitNotification({
      notificationType: `MR_${action.toUpperCase()}_REQUESTER`,
      category: "maintenance",
      space: "maintenance",
      title,
      message,
      severity: action === "reject" ? "error" : action === "return" ? "warning" : "info",
      entityType: "maintenance_requests",
      entityId: request.id,
      actionUrl: actionUrlFor(request.id),
      targetRoles: ["__none__"],
      targetUserIds: [requesterId],
      actorId: actorId || null,
      metadata: { status: decision.status, reason: decision.rejection_reason },
    });
  }

  if (decision.notify.nextApproverLevel) {
    const level = decision.notify.nextApproverLevel;
    const targetUserIds = await resolveNextApproverIds(
      level,
      level === "dept_manager" ? department : null,
    );
    const filtered = targetUserIds.filter((id) => id !== actorId && id !== requesterId);

    // Never pass an empty target_roles array — that broadcasts to everyone.
    const fallbackRoles =
      filtered.length > 0
        ? ["__none__"]
        : level === "maintenance_manager"
          ? ["responsable_maintenance"]
          : level === "daf"
            ? ["daf", "directeur_financier", "directeur_general", "direction"]
            : ["__none__"];

    if (filtered.length === 0 && fallbackRoles[0] === "__none__") {
      return;
    }

    await emitNotification({
      notificationType: `MR_ACTION_REQUIRED_${level}`,
      category: "maintenance",
      space: "maintenance",
      title: `Action requise — Demande ${number}`,
      message: `${request.requester_name || "Un collègue"} demande une intervention (${subject}). Niveau: ${level}.`,
      severity: "warning",
      entityType: "maintenance_requests",
      entityId: request.id,
      actionUrl: actionUrlFor(request.id),
      targetRoles: fallbackRoles,
      targetUserIds: filtered,
      actorId: actorId || null,
      metadata: {
        status: decision.status,
        approval_level: level,
        department,
      },
    });
  }
};
