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
let QualityExtController = class QualityExtController {
    cs;
    constructor(cs) {
        this.cs = cs;
    }
    // ── CAPA Tickets ──────────────────────────────────────────────────────────
    async listCAPATickets(status, supplierId) {
        const filters = [];
        if (status)
            filters.push({ type: "eq", column: "status", value: status });
        if (supplierId)
            filters.push({ type: "eq", column: "supplier_id", value: supplierId });
        const data = await this.cs.query({ table: "capa_tickets", filters, orderBy: { column: "created_at", ascending: false } });
        return { data };
    }
    async getCAPATicket(id) {
        const rows = await this.cs.query({ table: "capa_tickets", filters: [{ type: "eq", column: "id", value: id }] });
        return { data: rows[0] ?? null };
    }
    async createCAPATicket(body) {
        const data = await this.cs.insert({ table: "capa_tickets", values: body });
        return { data: data[0] };
    }
    async updateCAPATicket(id, body) {
        const { after } = await this.cs.update({ table: "capa_tickets", filters: [{ type: "eq", column: "id", value: id }], values: body });
        return { data: after[0] };
    }
    // ── Inbound Notices ───────────────────────────────────────────────────────
    async listInboundNotices(status, dateFrom, dateTo) {
        const filters = [];
        if (status)
            filters.push({ type: "eq", column: "status", value: status });
        if (dateFrom)
            filters.push({ type: "gte", column: "estimated_arrival_at", value: dateFrom });
        if (dateTo)
            filters.push({ type: "lte", column: "estimated_arrival_at", value: dateTo });
        const data = await this.cs.query({ table: "inbound_notices", filters, orderBy: { column: "estimated_arrival_at", ascending: true } });
        return { data };
    }
    async createInboundNotice(body) {
        const data = await this.cs.insert({ table: "inbound_notices", values: { ...body, status: "PENDING" } });
        return { data: data[0] };
    }
    async updateInboundNotice(id, body) {
        const { after } = await this.cs.update({ table: "inbound_notices", filters: [{ type: "eq", column: "id", value: id }], values: body });
        return { data: after[0] };
    }
    // ── QC Lab Results (read qc_inspections with lab filters) ─────────────────
    async listQcLabResults() {
        const data = await this.cs.query({
            table: "qc_inspections",
            filters: [{ type: "eq", column: "lab_sample_required", value: true }],
            orderBy: { column: "started_at", ascending: false },
        });
        return { data };
    }
};
__decorate([
    Get("capa-tickets"),
    __param(0, Query("status")),
    __param(1, Query("supplier_id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], QualityExtController.prototype, "listCAPATickets", null);
__decorate([
    Get("capa-tickets/:id"),
    __param(0, Param("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], QualityExtController.prototype, "getCAPATicket", null);
__decorate([
    Post("capa-tickets"),
    __param(0, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], QualityExtController.prototype, "createCAPATicket", null);
__decorate([
    Patch("capa-tickets/:id"),
    __param(0, Param("id")),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], QualityExtController.prototype, "updateCAPATicket", null);
__decorate([
    Get("inbound-notices"),
    __param(0, Query("status")),
    __param(1, Query("date_from")),
    __param(2, Query("date_to")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], QualityExtController.prototype, "listInboundNotices", null);
__decorate([
    Post("inbound-notices"),
    __param(0, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], QualityExtController.prototype, "createInboundNotice", null);
__decorate([
    Patch("inbound-notices/:id"),
    __param(0, Param("id")),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], QualityExtController.prototype, "updateInboundNotice", null);
__decorate([
    Get("qc-lab-results"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], QualityExtController.prototype, "listQcLabResults", null);
QualityExtController = __decorate([
    Controller("api"),
    UseGuards(RequireAuthGuard),
    __metadata("design:paramtypes", [CollectionsService])
], QualityExtController);
export { QualityExtController };
