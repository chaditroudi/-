var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Injectable } from "@nestjs/common";
import { notFound } from "../../core/app-error.js";
import { prepareInsertDocument } from "../../db/defaults.js";
import { getCollectionModel, sanitizeDocument } from "../../db/dynamic-model.js";
import { AuthUserModel } from "../../models/auth-user.model.js";
import { normalizeDepartment } from "../org/departments.js";
import { membershipFromActor } from "../org/membership.js";
import { notifyMaintenanceRequestTransition } from "../workflow/maintenance-request-notify.js";
import { approveMaintenanceRequest, cancelMaintenanceRequest, completeMaintenanceRequest, isMaintenanceRequestPending, normalizeMaintenanceRequestStatus, rejectMaintenanceRequest, returnMaintenanceRequest, submitMaintenanceRequest, } from "../workflow/maintenance-request-workflow.js";
const MaintenanceRequests = () => getCollectionModel("maintenance_requests");
const cleanPatch = (input, blocked = []) => {
    const output = {};
    for (const [key, value] of Object.entries(input || {})) {
        if (value === undefined)
            continue;
        if (blocked.includes(key))
            continue;
        output[key] = value;
    }
    return output;
};
let MaintenanceService = class MaintenanceService {
    /** Prefer live membership from DB so admin org updates apply without re-login. */
    async resolveActor(actor) {
        const id = typeof actor?.id === "string" ? actor.id.trim() : "";
        if (!id)
            return actor;
        const user = (await AuthUserModel.findOne({ id })
            .select("id email user_metadata is_active")
            .lean()
            .exec());
        if (!user || user.is_active === false)
            return actor;
        return { id: user.id, email: user.email, user_metadata: user.user_metadata || {} };
    }
    applyWorkflowDecision(decision) {
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
    async listRequests(status) {
        const query = status ? { status } : {};
        return sanitizeDocument(await MaintenanceRequests().find(query).sort({ created_at: -1 }).lean().exec());
    }
    async getRequestById(requestId) {
        if (!requestId)
            return null;
        return sanitizeDocument(await MaintenanceRequests().findOne({ id: requestId }).lean().exec());
    }
    async createRequest(payload, actor) {
        const membership = membershipFromActor(actor);
        const requestedStatus = normalizeMaintenanceRequestStatus(payload.status);
        const department = normalizeDepartment(payload.department) || membership?.primaryDepartment || null;
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
        if (requestedStatus === "SUBMITTED" ||
            String(payload.status || "").toLowerCase() === "pending_approval") {
            return this.submitRequest(String(request.id), actor);
        }
        return this.getRequestById(String(request.id));
    }
    async updateRequest(requestId, payload) {
        const existing = await MaintenanceRequests().findOne({ id: requestId }).lean().exec();
        if (!existing) {
            throw notFound("MAINTENANCE_REQUEST_NOT_FOUND", "Demande de maintenance introuvable.");
        }
        await MaintenanceRequests()
            .updateOne({ id: requestId }, {
            $set: {
                ...cleanPatch(payload, ["id", "request_number", "created_at"]),
                updated_at: new Date().toISOString(),
            },
        })
            .exec();
        return this.getRequestById(requestId);
    }
    async runTransition(requestId, actor, run, extraPatch) {
        const existing = (await MaintenanceRequests().findOne({ id: requestId }).lean().exec());
        if (!existing) {
            throw notFound("MAINTENANCE_REQUEST_NOT_FOUND", "Demande de maintenance introuvable.");
        }
        const resolvedActor = await this.resolveActor(actor);
        const decision = run(existing, resolvedActor);
        const updated = await this.updateRequest(requestId, {
            ...this.applyWorkflowDecision(decision),
            ...(extraPatch || {}),
        });
        await notifyMaintenanceRequestTransition({
            id: requestId,
            request_number: updated?.request_number,
            requester_id: updated?.requester_id,
            requester_name: updated?.requester_name,
            department: updated?.department,
            equipment_name: updated?.equipment_name,
            title: updated?.title,
        }, decision, resolvedActor?.id);
        return updated;
    }
    async submitRequest(requestId, actor, reason) {
        return this.runTransition(requestId, actor, (state, resolvedActor) => submitMaintenanceRequest(state, resolvedActor, { reason }));
    }
    async approveRequest(requestId, actor, reason) {
        return this.runTransition(requestId, actor, (state, resolvedActor) => approveMaintenanceRequest(state, resolvedActor, { reason }));
    }
    async rejectRequest(requestId, reason, actor) {
        return this.runTransition(requestId, actor, (state, resolvedActor) => rejectMaintenanceRequest(state, resolvedActor, reason));
    }
    async returnRequest(requestId, reason, actor) {
        return this.runTransition(requestId, actor, (state, resolvedActor) => returnMaintenanceRequest(state, resolvedActor, reason));
    }
    async cancelRequest(requestId, actor, reason) {
        return this.runTransition(requestId, actor, (state, resolvedActor) => cancelMaintenanceRequest(state, resolvedActor, reason));
    }
    async completeRequest(requestId, actor, reason) {
        return this.runTransition(requestId, actor, (state, resolvedActor) => completeMaintenanceRequest(state, resolvedActor, reason), { completed_at: new Date().toISOString() });
    }
    async deleteRequest(requestId) {
        const result = await MaintenanceRequests().deleteOne({ id: requestId }).exec();
        if (!result.deletedCount) {
            throw notFound("MAINTENANCE_REQUEST_NOT_FOUND", "Demande de maintenance introuvable.");
        }
        return { id: requestId, deleted: true };
    }
    async getStats() {
        const rows = (await MaintenanceRequests().find({}).lean().exec());
        const countStatus = (status) => rows.filter((row) => normalizeMaintenanceRequestStatus(row.status) === status).length;
        return {
            total: rows.length,
            draft: countStatus("DRAFT"),
            pending: rows.filter((row) => isMaintenanceRequestPending(row.status)).length,
            approved: countStatus("APPROVED"),
            completed: countStatus("COMPLETED"),
            rejected: countStatus("REJECTED"),
        };
    }
};
MaintenanceService = __decorate([
    Injectable()
], MaintenanceService);
export { MaintenanceService };
