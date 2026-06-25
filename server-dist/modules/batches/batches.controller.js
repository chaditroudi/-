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
import { BatchesService } from "./batches.service.js";
let BatchesController = class BatchesController {
    cs;
    batchesService;
    constructor(cs, batchesService) {
        this.cs = cs;
        this.batchesService = batchesService;
    }
    // ── Storage Zones ─────────────────────────────────────────────────────────
    async listZones() {
        const data = await this.cs.query({ table: "storage_zones", filters: [], orderBy: { column: "name", ascending: true } });
        return { data };
    }
    async createZone(body) {
        const data = await this.cs.insert({ table: "storage_zones", values: body });
        return { data: data[0] };
    }
    async updateZone(id, body) {
        const { after } = await this.cs.update({ table: "storage_zones", filters: [{ type: "eq", column: "id", value: id }], values: body });
        return { data: after[0] };
    }
    // ── Quality Inspections ───────────────────────────────────────────────────
    async listInspections(batchId) {
        const filters = [];
        if (batchId)
            filters.push({ type: "eq", column: "batch_id", value: batchId });
        const data = await this.cs.query({ table: "quality_inspections", filters, orderBy: { column: "created_at", ascending: false } });
        return { data };
    }
    async createInspection(body) {
        const data = await this.cs.insert({ table: "quality_inspections", values: body });
        return { data: data[0] };
    }
    // ── Non Conformities ──────────────────────────────────────────────────────
    async listNonConformities() {
        const data = await this.cs.query({ table: "non_conformities", filters: [], orderBy: { column: "created_at", ascending: false } });
        return { data };
    }
    async createNonConformity(body) {
        const data = await this.cs.insert({ table: "non_conformities", values: body });
        return { data: data[0] };
    }
    // ── Alerts ────────────────────────────────────────────────────────────────
    async listAlerts(batchId) {
        const filters = [];
        if (batchId)
            filters.push({ type: "eq", column: "batch_id", value: batchId });
        const data = await this.cs.query({ table: "alerts", filters, orderBy: { column: "created_at", ascending: false } });
        return { data };
    }
    async createAlert(body) {
        const data = await this.cs.insert({ table: "alerts", values: body });
        return { data: data[0] };
    }
    async updateAlert(id, body) {
        const { after } = await this.cs.update({ table: "alerts", filters: [{ type: "eq", column: "id", value: id }], values: body });
        return { data: after[0] };
    }
    // ── Batch Movements ───────────────────────────────────────────────────────
    async listMovements(batchId) {
        const filters = [];
        if (batchId)
            filters.push({ type: "eq", column: "batch_id", value: batchId });
        const data = await this.cs.query({ table: "batch_movements", filters, orderBy: { column: "created_at", ascending: false } });
        return { data };
    }
    async createMovement(body) {
        const data = await this.cs.insert({ table: "batch_movements", values: body });
        return { data: data[0] };
    }
    // ── Batches — summary and :id must be declared before wildcard ───────────
    async getSummary() {
        const data = await this.batchesService.getSummary();
        return { data };
    }
    async getBatch(id) {
        const rows = await this.cs.query({ table: "batches", filters: [{ type: "eq", column: "id", value: id }] });
        return { data: rows[0] ?? null };
    }
    async listBatches() {
        const data = await this.cs.query({ table: "batches", filters: [], orderBy: { column: "created_at", ascending: false } });
        return { data };
    }
    async createBatch(body) {
        const data = await this.cs.insert({ table: "batches", values: body });
        return { data: data[0] };
    }
    async updateBatch(id, body) {
        const { after } = await this.cs.update({ table: "batches", filters: [{ type: "eq", column: "id", value: id }], values: body });
        return { data: after[0] };
    }
    // ── Business action endpoints ─────────────────────────────────────────────
    async decideQC(id, body) {
        const data = await this.batchesService.decideQC(id, body ?? {}, body?.actor ?? null);
        return { data };
    }
    async addInspection(id, body) {
        const data = await this.batchesService.createInspection(id, body ?? {}, body?.actor ?? null);
        return { data };
    }
    async addNonConformity(id, body) {
        const data = await this.batchesService.createNonConformity(id, body ?? {}, body?.actor ?? null);
        return { data };
    }
};
__decorate([
    Get("storage-zones"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], BatchesController.prototype, "listZones", null);
__decorate([
    Post("storage-zones"),
    __param(0, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], BatchesController.prototype, "createZone", null);
__decorate([
    Patch("storage-zones/:id"),
    __param(0, Param("id")),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], BatchesController.prototype, "updateZone", null);
__decorate([
    Get("quality-inspections"),
    __param(0, Query("batch_id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], BatchesController.prototype, "listInspections", null);
__decorate([
    Post("quality-inspections"),
    __param(0, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], BatchesController.prototype, "createInspection", null);
__decorate([
    Get("non-conformities"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], BatchesController.prototype, "listNonConformities", null);
__decorate([
    Post("non-conformities"),
    __param(0, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], BatchesController.prototype, "createNonConformity", null);
__decorate([
    Get("alerts"),
    __param(0, Query("batch_id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], BatchesController.prototype, "listAlerts", null);
__decorate([
    Post("alerts"),
    __param(0, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], BatchesController.prototype, "createAlert", null);
__decorate([
    Patch("alerts/:id"),
    __param(0, Param("id")),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], BatchesController.prototype, "updateAlert", null);
__decorate([
    Get("movements"),
    __param(0, Query("batch_id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], BatchesController.prototype, "listMovements", null);
__decorate([
    Post("movements"),
    __param(0, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], BatchesController.prototype, "createMovement", null);
__decorate([
    Get("summary"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], BatchesController.prototype, "getSummary", null);
__decorate([
    Get(":id"),
    __param(0, Param("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], BatchesController.prototype, "getBatch", null);
__decorate([
    Get(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], BatchesController.prototype, "listBatches", null);
__decorate([
    Post(),
    __param(0, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], BatchesController.prototype, "createBatch", null);
__decorate([
    Patch(":id"),
    __param(0, Param("id")),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], BatchesController.prototype, "updateBatch", null);
__decorate([
    Post(":id/decide"),
    __param(0, Param("id")),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], BatchesController.prototype, "decideQC", null);
__decorate([
    Post(":id/inspections"),
    __param(0, Param("id")),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], BatchesController.prototype, "addInspection", null);
__decorate([
    Post(":id/non-conformities"),
    __param(0, Param("id")),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], BatchesController.prototype, "addNonConformity", null);
BatchesController = __decorate([
    Controller("api/batches"),
    UseGuards(RequireAuthGuard),
    __metadata("design:paramtypes", [CollectionsService,
        BatchesService])
], BatchesController);
export { BatchesController };
