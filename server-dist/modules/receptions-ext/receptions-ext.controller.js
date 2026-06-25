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
import { getCollectionModel, sanitizeDocument } from "../../db/dynamic-model.js";
import { syncReceptionLotsToStock } from "../receptions/reception-stock-sync.js";
/**
 * Extension controller for reception-related tables that are not covered
 * by the main ReceptionsController (which uses a custom ReceptionsService).
 * Uses CollectionsService for simple CRUD on receptions_v2, reception_lots,
 * qc_inspections, and reception_audit_logs_v2.
 */
let ReceptionsExtController = class ReceptionsExtController {
    cs;
    constructor(cs) {
        this.cs = cs;
    }
    // ── Reception V2 simple create (header only) ──────────────────────────────
    async createReceptionHeader(body) {
        // Resolve unit if not provided
        let unit = (body.unit ?? "").trim();
        if (!unit && body.product_id) {
            const rows = await this.cs.query({ table: "products", filters: [{ type: "eq", column: "id", value: body.product_id }] });
            unit = rows[0]?.unit ?? "";
        }
        if (!unit && body.material_id) {
            const rows = await this.cs.query({ table: "materials", filters: [{ type: "eq", column: "id", value: body.material_id }] });
            unit = rows[0]?.unit ?? "";
        }
        if (!unit)
            unit = "kg";
        const data = await this.cs.insert({ table: "receptions_v2", values: { ...body, unit } });
        return { data: data[0] };
    }
    // ── Reception V2 simple update ─────────────────────────────────────────────
    async updateReception(id, body) {
        const { after } = await this.cs.update({
            table: "receptions_v2",
            filters: [{ type: "eq", column: "id", value: id }],
            values: body,
        });
        return { data: after[0] };
    }
    // ── Reception V2 status update with audit log ──────────────────────────────
    async updateReceptionStatus(id, body) {
        const { status, validated_by, cancellation_reason } = body;
        const updateData = { status };
        if (status === "EN_ATTENTE_QC") {
            updateData.validated_at = new Date().toISOString();
            updateData.validated_by = validated_by ?? null;
        }
        if (status === "ANNULE") {
            updateData.cancelled_at = new Date().toISOString();
            updateData.cancelled_by = validated_by ?? null;
            updateData.cancellation_reason = cancellation_reason ?? null;
        }
        const { after } = await this.cs.update({
            table: "receptions_v2",
            filters: [{ type: "eq", column: "id", value: id }],
            values: updateData,
        });
        // Non-blocking audit log
        this.cs.insert({
            table: "reception_audit_logs_v2",
            values: {
                entity_type: "RECEPTION",
                entity_id: id,
                action: "STATUS_CHANGE",
                new_state: { status },
                performed_by: validated_by ?? "system",
            },
        }).catch(() => null);
        return { data: after[0] };
    }
    // ── Reception Lots ────────────────────────────────────────────────────────
    async createReceptionLot(body) {
        const { supplier_code, origin_region, harvest_date, ...rest } = body;
        // RG-R01: count today's lots for sequential suffix
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const Lots = getCollectionModel("reception_lots");
        const todayCount = await Lots.countDocuments({ created_at: { $gte: todayStart.toISOString() } }).exec();
        const seq = String(todayCount + 1).padStart(3, "0");
        // Build lot_internal: RP-[REG]-[FOURN]-[DATE]-[SEQ]
        const dateStr = (harvest_date || new Date().toISOString().slice(0, 10)).replace(/-/g, "");
        const regionCode = (origin_region || "TZ").slice(0, 2).toUpperCase();
        const supplierCode = (supplier_code || "XX").slice(0, 4).toUpperCase();
        const lot_internal = `RP-${regionCode}-${supplierCode}-${dateStr}-${seq}`;
        const data = await this.cs.insert({
            table: "reception_lots",
            values: {
                ...rest,
                lot_internal,
                origin_country: rest.origin_country || "Tunisie",
                unit: rest.unit || "kg",
                harvest_date: harvest_date || null,
                origin_region: origin_region || null,
            },
        });
        const created = data[0];
        syncReceptionLotsToStock([created]).catch((e) => console.error("[ext] syncReceptionLotsToStock create failed:", e));
        return { data: created };
    }
    // ── Reception Lot update ──────────────────────────────────────────────────
    async updateReceptionLot(lotId, body) {
        const { after } = await this.cs.update({
            table: "reception_lots",
            filters: [{ type: "eq", column: "id", value: lotId }],
            values: sanitizeDocument(body),
        });
        const updated = after[0];
        syncReceptionLotsToStock([updated]).catch((e) => console.error("[ext] syncReceptionLotsToStock update failed:", e));
        return { data: updated };
    }
    // ── QC Inspections ────────────────────────────────────────────────────────
    async listQcInspections(labPending, stepId) {
        const filters = [];
        if (labPending === "true") {
            filters.push({ type: "eq", column: "lab_sample_required", value: true });
        }
        if (stepId)
            filters.push({ type: "eq", column: "production_step_id", value: stepId });
        const data = await this.cs.query({
            table: "qc_inspections",
            filters,
            orderBy: { column: "started_at", ascending: false },
        });
        return { data };
    }
    async updateQcInspection(id, body) {
        const { after } = await this.cs.update({
            table: "qc_inspections",
            filters: [{ type: "eq", column: "id", value: id }],
            values: body,
        });
        return { data: after[0] };
    }
};
__decorate([
    Post("receptions-v2"),
    __param(0, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ReceptionsExtController.prototype, "createReceptionHeader", null);
__decorate([
    Patch("receptions-v2/:id"),
    __param(0, Param("id")),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ReceptionsExtController.prototype, "updateReception", null);
__decorate([
    Patch("receptions-v2/:id/status"),
    __param(0, Param("id")),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ReceptionsExtController.prototype, "updateReceptionStatus", null);
__decorate([
    Post("reception-lots"),
    __param(0, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ReceptionsExtController.prototype, "createReceptionLot", null);
__decorate([
    Patch("reception-lots/:lotId"),
    __param(0, Param("lotId")),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ReceptionsExtController.prototype, "updateReceptionLot", null);
__decorate([
    Get("qc-inspections"),
    __param(0, Query("lab_pending")),
    __param(1, Query("step_id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], ReceptionsExtController.prototype, "listQcInspections", null);
__decorate([
    Patch("qc-inspections/:id"),
    __param(0, Param("id")),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ReceptionsExtController.prototype, "updateQcInspection", null);
ReceptionsExtController = __decorate([
    Controller("api"),
    UseGuards(RequireAuthGuard),
    __metadata("design:paramtypes", [CollectionsService])
], ReceptionsExtController);
export { ReceptionsExtController };
