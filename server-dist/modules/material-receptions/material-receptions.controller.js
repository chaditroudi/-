var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { RequireAuthGuard } from "../../nest/route-guards.js";
import { CollectionsService } from "../collections/collections.service.js";
/**
 * Legacy material_receptions system (V1 reception flow).
 * Handles the older reception workflow that predates receptions_v2.
 */
let MaterialReceptionsController = class MaterialReceptionsController {
    cs;
    constructor(cs) {
        this.cs = cs;
    }
    async list(status, supplierId) {
        const filters = [];
        if (status)
            filters.push({ type: "eq", column: "status", value: status });
        if (supplierId)
            filters.push({ type: "eq", column: "supplier_id", value: supplierId });
        const data = await this.cs.query({
            table: "material_receptions",
            filters,
            orderBy: { column: "received_at", ascending: false },
        });
        return { data };
    }
    async getOne(id) {
        const rows = await this.cs.query({
            table: "material_receptions",
            filters: [{ type: "eq", column: "id", value: id }],
        });
        return { data: rows[0] ?? null };
    }
    async create(body) {
        const data = await this.cs.insert({ table: "material_receptions", values: body });
        return { data: data[0] };
    }
    async auditLogs(id) {
        const data = await this.cs.query({
            table: "reception_audit_logs",
            filters: [{ type: "eq", column: "reception_id", value: id }],
            orderBy: { column: "created_at", ascending: false },
        });
        return { data };
    }
    async createAuditLog(id, body) {
        const data = await this.cs.insert({
            table: "reception_audit_logs",
            values: { ...body, reception_id: id },
        });
        return { data: data[0] };
    }
    /**
     * Complex status update: when accepted creates a batch record;
     * when rejected/quarantine creates alerts and updates existing batch.
     */
    async updateStatus(id, body) {
        const { status, verified_by, quality_score, visual_appearance, defect_percentage, rejection_reason, document_compliance, origin_compliance, visual_compliance, temperature_compliance, humidity_compliance, contamination_check, packaging_compliance, qc_decision, quarantine_reason, critical_non_conformity_count, non_conformity_count, } = body;
        // Fetch current reception
        const [current] = await this.cs.query({
            table: "material_receptions",
            filters: [{ type: "eq", column: "id", value: id }],
        });
        const updateData = { status };
        if (["verified", "accepted", "rejected", "quarantine"].includes(status)) {
            updateData.verified_at = new Date().toISOString();
            updateData.verified_by = verified_by ?? null;
        }
        if (quality_score !== undefined)
            updateData.quality_score = quality_score;
        if (visual_appearance)
            updateData.visual_appearance = visual_appearance;
        if (defect_percentage !== undefined)
            updateData.defect_percentage = defect_percentage;
        if (rejection_reason && status === "rejected")
            updateData.rejection_reason = rejection_reason;
        if (document_compliance)
            updateData.document_compliance = document_compliance;
        if (origin_compliance)
            updateData.origin_compliance = origin_compliance;
        if (visual_compliance)
            updateData.visual_compliance = visual_compliance;
        if (temperature_compliance)
            updateData.temperature_compliance = temperature_compliance;
        if (humidity_compliance)
            updateData.humidity_compliance = humidity_compliance;
        if (contamination_check)
            updateData.contamination_check = contamination_check;
        if (packaging_compliance)
            updateData.packaging_compliance = packaging_compliance;
        if (qc_decision) {
            updateData.qc_decision = qc_decision;
            updateData.qc_decision_date = new Date().toISOString();
            updateData.qc_decision_by = verified_by ?? null;
        }
        if (quarantine_reason && status === "quarantine")
            updateData.quarantine_reason = quarantine_reason;
        if (critical_non_conformity_count !== undefined)
            updateData.critical_non_conformity_count = critical_non_conformity_count;
        if (non_conformity_count !== undefined)
            updateData.non_conformity_count = non_conformity_count;
        const { after } = await this.cs.update({
            table: "material_receptions",
            filters: [{ type: "eq", column: "id", value: id }],
            values: updateData,
        });
        const updated = after[0];
        // Grade inference
        const inferGrade = (score) => {
            if (!score)
                return null;
            if (score >= 8)
                return "premium";
            if (score >= 6)
                return "standard";
            if (score > 0)
                return "economy";
            return "rejected";
        };
        const grade = inferGrade(quality_score);
        if (status === "accepted") {
            const existingBatchId = current?.batch_id;
            if (!existingBatchId) {
                const [batch] = await this.cs.insert({
                    table: "batches",
                    values: {
                        reception_id: id,
                        supplier_id: current?.supplier_id ?? null,
                        material_id: current?.material_id ?? null,
                        origin_farm: current?.origin_farm ?? null,
                        harvest_date: current?.harvest_date ?? null,
                        initial_weight_kg: Number(current?.quantity ?? 0),
                        current_weight_kg: Number(current?.quantity ?? 0),
                        quality_grade: grade,
                        status: "accepted",
                        notes: current?.notes
                            ? `Réception ${current?.reception_number}: ${current?.notes}`
                            : `Réception ${current?.reception_number}`,
                        created_by: verified_by ?? null,
                    },
                });
                const batchRecord = batch;
                // Link batch to reception
                await this.cs.update({
                    table: "material_receptions",
                    filters: [{ type: "eq", column: "id", value: id }],
                    values: { batch_id: batchRecord.id },
                });
                // Log batch movement
                this.cs.insert({
                    table: "batch_movements",
                    values: {
                        batch_id: batchRecord.id,
                        movement_type: "CREATION",
                        to_status: "accepted",
                        quantity_kg: Number(current?.quantity ?? 0),
                        performed_by: verified_by ?? null,
                        reason: `Créé depuis la réception ${current?.reception_number}`,
                    },
                }).catch(() => null);
                updated.batch_id = batchRecord.id;
            }
            else {
                this.cs.update({
                    table: "batches",
                    filters: [{ type: "eq", column: "id", value: existingBatchId }],
                    values: { status: "accepted", quality_grade: grade, current_weight_kg: Number(current?.quantity ?? 0) },
                }).catch(() => null);
            }
        }
        const existingBatchId = current?.batch_id;
        if (existingBatchId && (status === "rejected" || status === "quarantine")) {
            this.cs.update({
                table: "batches",
                filters: [{ type: "eq", column: "id", value: existingBatchId }],
                values: {
                    status: status === "rejected" ? "rejected" : "quarantine",
                    quality_grade: status === "rejected" ? "rejected" : grade,
                },
            }).catch(() => null);
        }
        if (status === "rejected" || status === "quarantine") {
            this.cs.insert({
                table: "alerts",
                values: {
                    alert_type: status === "rejected" ? "RECEPTION_REJECTED" : "RECEPTION_QUARANTINE",
                    title: status === "rejected" ? "Réception rejetée" : "Réception en quarantaine",
                    message: status === "rejected"
                        ? rejection_reason || `La réception ${current?.reception_number} a été rejetée.`
                        : quarantine_reason || `La réception ${current?.reception_number} a été mise en quarantaine.`,
                    severity: status === "rejected" ? "critical" : "warning",
                },
            }).catch(() => null);
        }
        // Audit log
        this.cs.insert({
            table: "reception_audit_logs",
            values: {
                reception_id: id,
                action: status === "rejected" ? "REJECTED" : status === "accepted" ? "ACCEPTED" : status === "quarantine" ? "QUARANTINE" : "STATUS_CHANGED",
                old_status: current?.status ?? null,
                new_status: status,
                performed_by: verified_by ?? null,
                details: { quality_score, visual_appearance, defect_percentage, rejection_reason, qc_decision, quarantine_reason, critical_non_conformity_count, non_conformity_count },
            },
        }).catch(() => null);
        return { data: updated };
    }
};
__decorate([
    Get(),
    __param(0, Query("status")),
    __param(1, Query("supplier_id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], MaterialReceptionsController.prototype, "list", null);
__decorate([
    Get(":id"),
    __param(0, Param("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], MaterialReceptionsController.prototype, "getOne", null);
__decorate([
    Post(),
    __param(0, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], MaterialReceptionsController.prototype, "create", null);
__decorate([
    Get(":id/audit-logs"),
    __param(0, Param("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], MaterialReceptionsController.prototype, "auditLogs", null);
__decorate([
    Post(":id/audit-logs"),
    __param(0, Param("id")),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], MaterialReceptionsController.prototype, "createAuditLog", null);
__decorate([
    Patch(":id/status"),
    __param(0, Param("id")),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], MaterialReceptionsController.prototype, "updateStatus", null);
MaterialReceptionsController = __decorate([
    Controller("api/material-receptions"),
    UseGuards(RequireAuthGuard),
    __metadata("design:paramtypes", [CollectionsService])
], MaterialReceptionsController);
export { MaterialReceptionsController };
