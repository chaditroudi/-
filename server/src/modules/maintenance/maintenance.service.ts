import { Injectable } from "@nestjs/common";

import { notFound } from "../../core/app-error.js";
import { prepareInsertDocument } from "../../db/defaults.js";
import { getCollectionModel, sanitizeDocument } from "../../db/dynamic-model.js";
import { AuthUserModel } from "../../models/auth-user.model.js";
import { normalizeDepartment } from "../org/departments.js";
import { membershipFromActor } from "../org/membership.js";
import { notifyMaintenanceRequestTransition } from "../workflow/maintenance-request-notify.js";
import {
  approveMaintenanceRequest,
  cancelMaintenanceRequest,
  completeMaintenanceRequest,
  isMaintenanceRequestPending,
  normalizeMaintenanceRequestStatus,
  rejectMaintenanceRequest,
  returnMaintenanceRequest,
  submitMaintenanceRequest,
} from "../workflow/maintenance-request-workflow.js";
import type { WorkflowDecision } from "../workflow/approval-engine.js";

type ActorContext = {
  id?: string | null;
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
} | null | undefined;

type MaintenanceRequestRow = Record<string, unknown> & {
  id?: string;
  status?: string | null;
  requester_id?: string | null;
  requester_name?: string | null;
  department?: string | null;
  estimated_cost?: number | null;
};

const MaintenanceRequests = () => getCollectionModel("maintenance_requests");

const cleanPatch = (input: Record<string, unknown>, blocked: string[] = []) => {
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input || {})) {
    if (value === undefined) continue;
    if (blocked.includes(key)) continue;
    output[key] = value;
  }
  return output;
};

@Injectable()
export class MaintenanceService {
  /** Prefer live membership from DB so admin org updates apply without re-login. */
  private async resolveActor(actor: ActorContext): Promise<ActorContext> {
    const id = typeof actor?.id === "string" ? actor.id.trim() : "";
    if (!id) return actor;
    const user = (await AuthUserModel.findOne({ id })
      .select("id email user_metadata is_active")
      .lean()
      .exec()) as {
      id?: string;
      email?: string;
      is_active?: boolean;
      user_metadata?: Record<string, unknown>;
    } | null;
    if (!user || user.is_active === false) return actor;
    return { id: user.id, email: user.email, user_metadata: user.user_metadata || {} };
  }

  private applyWorkflowDecision(decision: WorkflowDecision): Record<string, unknown> {
    return {
      status: decision.status,
      approvals: decision.approvals,
      workflow_history: decision.workflow_history,
      approved_by: decision.approved_by,
      approved_at: decision.approved_at,
      rejection_reason: decision.rejection_reason,
      current_approval_level: decision.current_approval_level,
    };
  }

  async listRequests(status?: string) {
    const query = status ? { status } : {};
    return sanitizeDocument(
      await MaintenanceRequests().find(query).sort({ created_at: -1 }).lean().exec(),
    ) as MaintenanceRequestRow[];
  }

  async getRequestById(requestId: string) {
    if (!requestId) return null;
    return sanitizeDocument(
      await MaintenanceRequests().findOne({ id: requestId }).lean().exec(),
    ) as MaintenanceRequestRow | null;
  }

  async createRequest(payload: Record<string, unknown>, actor: ActorContext) {
    const membership = membershipFromActor(actor);
    const requestedStatus = normalizeMaintenanceRequestStatus(payload.status);
    const department =
      normalizeDepartment(payload.department) || membership?.primaryDepartment || null;

    const request = await prepareInsertDocument("maintenance_requests", {
      ...payload,
      requester_id: payload.requester_id ?? actor?.id ?? null,
      requester_name: payload.requester_name || membership?.fullName || null,
      department,
      status: requestedStatus === "SUBMITTED" ? "DRAFT" : requestedStatus,
      approvals: Array.isArray(payload.approvals) ? payload.approvals : [],
      workflow_history: Array.isArray(payload.workflow_history) ? payload.workflow_history : [],
      current_approval_level: null,
    });

    await MaintenanceRequests().create([request]);

    if (
      requestedStatus === "SUBMITTED" ||
      String(payload.status || "").toLowerCase() === "pending_approval"
    ) {
      return this.submitRequest(String(request.id), actor);
    }

    return this.getRequestById(String(request.id));
  }

  async updateRequest(requestId: string, payload: Record<string, unknown>) {
    const existing = await MaintenanceRequests().findOne({ id: requestId }).lean().exec();
    if (!existing) {
      throw notFound("MAINTENANCE_REQUEST_NOT_FOUND", "Demande de maintenance introuvable.");
    }

    await MaintenanceRequests()
      .updateOne(
        { id: requestId },
        {
          $set: {
            ...cleanPatch(payload, ["id", "request_number", "created_at"]),
            updated_at: new Date().toISOString(),
          },
        },
      )
      .exec();

    return this.getRequestById(requestId);
  }

  private async runTransition(
    requestId: string,
    actor: ActorContext,
    run: (state: MaintenanceRequestRow, resolvedActor: ActorContext) => WorkflowDecision,
    extraPatch?: Record<string, unknown>,
  ) {
    const existing = (await MaintenanceRequests().findOne({ id: requestId }).lean().exec()) as
      | MaintenanceRequestRow
      | null;
    if (!existing) {
      throw notFound("MAINTENANCE_REQUEST_NOT_FOUND", "Demande de maintenance introuvable.");
    }

    const resolvedActor = await this.resolveActor(actor);
    const decision = run(existing, resolvedActor);
    const updated = await this.updateRequest(requestId, {
      ...this.applyWorkflowDecision(decision),
      ...(extraPatch || {}),
    });

    await notifyMaintenanceRequestTransition(
      {
        id: requestId,
        request_number: (updated as any)?.request_number,
        requester_id: (updated as any)?.requester_id,
        requester_name: (updated as any)?.requester_name,
        department: (updated as any)?.department,
        equipment_name: (updated as any)?.equipment_name,
        title: (updated as any)?.title,
      },
      decision,
      resolvedActor?.id,
    );

    return updated;
  }

  async submitRequest(requestId: string, actor: ActorContext, reason?: string | null) {
    return this.runTransition(requestId, actor, (state, resolvedActor) =>
      submitMaintenanceRequest(state, resolvedActor, { reason }),
    );
  }

  async approveRequest(requestId: string, actor: ActorContext, reason?: string | null) {
    return this.runTransition(requestId, actor, (state, resolvedActor) =>
      approveMaintenanceRequest(state, resolvedActor, { reason }),
    );
  }

  async rejectRequest(requestId: string, reason: string, actor: ActorContext) {
    return this.runTransition(requestId, actor, (state, resolvedActor) =>
      rejectMaintenanceRequest(state, resolvedActor, reason),
    );
  }

  async returnRequest(requestId: string, reason: string, actor: ActorContext) {
    return this.runTransition(requestId, actor, (state, resolvedActor) =>
      returnMaintenanceRequest(state, resolvedActor, reason),
    );
  }

  async cancelRequest(requestId: string, actor: ActorContext, reason?: string | null) {
    return this.runTransition(requestId, actor, (state, resolvedActor) =>
      cancelMaintenanceRequest(state, resolvedActor, reason),
    );
  }

  async completeRequest(requestId: string, actor: ActorContext, reason?: string | null) {
    return this.runTransition(
      requestId,
      actor,
      (state, resolvedActor) => completeMaintenanceRequest(state, resolvedActor, reason),
      { completed_at: new Date().toISOString() },
    );
  }

  async deleteRequest(requestId: string) {
    const result = await MaintenanceRequests().deleteOne({ id: requestId }).exec();
    if (!result.deletedCount) {
      throw notFound("MAINTENANCE_REQUEST_NOT_FOUND", "Demande de maintenance introuvable.");
    }
    return { id: requestId, deleted: true };
  }

  async getStats() {
    const rows = (await MaintenanceRequests().find({}).lean().exec()) as MaintenanceRequestRow[];
    const countStatus = (status: string) =>
      rows.filter((row) => normalizeMaintenanceRequestStatus(row.status) === status).length;

    return {
      total: rows.length,
      draft: countStatus("DRAFT"),
      pending: rows.filter((row) => isMaintenanceRequestPending(row.status)).length,
      approved: countStatus("APPROVED"),
      completed: countStatus("COMPLETED"),
      rejected: countStatus("REJECTED"),
    };
  }
}
