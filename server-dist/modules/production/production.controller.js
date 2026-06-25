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
import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { RequireAuthGuard } from "../../nest/route-guards.js";
import { CollectionsService } from "../collections/collections.service.js";
import { ProductionService } from "./production.service.js";
let ProductionController = class ProductionController {
    cs;
    productionService;
    constructor(cs, productionService) {
        this.cs = cs;
        this.productionService = productionService;
    }
    // ── Configuration (flux codes, order & step statuses) ────────────────────
    async getConfig() {
        const [fluxCodes, orderStatuses, stepStatuses] = await Promise.all([
            this.cs.query({ table: "production_flux_codes", filters: [], orderBy: { column: "code", ascending: true } }),
            this.cs.query({ table: "production_order_statuses", filters: [], orderBy: { column: "code", ascending: true } }),
            this.cs.query({ table: "production_step_statuses", filters: [], orderBy: { column: "code", ascending: true } }),
        ]);
        return { data: { flux_codes: fluxCodes, order_statuses: orderStatuses, step_statuses: stepStatuses } };
    }
    // ── Step Definitions ──────────────────────────────────────────────────────
    async listStepDefinitions() {
        const data = await this.cs.query({ table: "production_step_definitions", filters: [], orderBy: { column: "sequence_order", ascending: true } });
        return { data };
    }
    // ── Quality Checks ────────────────────────────────────────────────────────
    async listQualityChecks(stepId) {
        const filters = [];
        if (stepId)
            filters.push({ type: "eq", column: "production_step_id", value: stepId });
        const data = await this.cs.query({ table: "quality_checks", filters, orderBy: { column: "created_at", ascending: false } });
        return { data };
    }
    async createQualityCheck(body) {
        const data = await this.cs.insert({ table: "quality_checks", values: body });
        return { data: data[0] };
    }
    // ── Audit Logs ────────────────────────────────────────────────────────────
    async createAuditLog(body) {
        const data = await this.cs.insert({ table: "production_audit_logs", values: body });
        return { data: data[0] };
    }
    // ── Libered Lots (STOCK_LIBERE reception lots) ────────────────────────────
    async listLiberedLots() {
        const data = await this.cs.query({
            table: "reception_lots",
            filters: [{ type: "eq", column: "stock_status", value: "STOCK_LIBERE" }],
            orderBy: { column: "created_at", ascending: false },
        });
        return { data };
    }
    // ── Steps ─────────────────────────────────────────────────────────────────
    async listSteps(orderId) {
        const filters = [];
        if (orderId)
            filters.push({ type: "eq", column: "production_order_id", value: orderId });
        const data = await this.cs.query({ table: "production_steps", filters, orderBy: { column: "sequence_order", ascending: true } });
        return { data };
    }
    async createStep(body) {
        const data = await this.cs.insert({ table: "production_steps", values: body });
        return { data: data[0] };
    }
    async updateStep(id, body) {
        const { after } = await this.cs.update({ table: "production_steps", filters: [{ type: "eq", column: "id", value: id }], values: body });
        return { data: after[0] };
    }
    // ── Lot Allocations ───────────────────────────────────────────────────────
    async listAllocations(orderId) {
        const filters = [];
        if (orderId)
            filters.push({ type: "eq", column: "production_order_id", value: orderId });
        const data = await this.cs.query({ table: "production_lot_allocations", filters, orderBy: { column: "allocated_at", ascending: true } });
        return { data };
    }
    async deleteAllocation(id) {
        const data = await this.cs.remove({ table: "production_lot_allocations", filters: [{ type: "eq", column: "id", value: id }] });
        return { data: data[0] };
    }
    // ── Output Lots ───────────────────────────────────────────────────────────
    async listOutputLots(orderId) {
        const filters = [];
        if (orderId)
            filters.push({ type: "eq", column: "production_order_id", value: orderId });
        const data = await this.cs.query({ table: "production_output_lots", filters, orderBy: { column: "recorded_at", ascending: true } });
        return { data };
    }
    async createOutputLot(body) {
        const data = await this.cs.insert({ table: "production_output_lots", values: body });
        return { data: data[0] };
    }
    // ── Orders — summary must come before :id param route ────────────────────
    async getOrdersSummary() {
        const data = await this.productionService.getSummary();
        return { data };
    }
    async getOrder(id) {
        const rows = await this.cs.query({ table: "production_orders", filters: [{ type: "eq", column: "id", value: id }] });
        return { data: rows[0] ?? null };
    }
    async listOrders() {
        const data = await this.cs.query({ table: "production_orders", filters: [], orderBy: { column: "created_at", ascending: false } });
        return { data };
    }
    async createOrder(body) {
        const actor = body._actor ?? null;
        delete body._actor;
        const data = await this.productionService.createOrder(body, actor);
        return { data };
    }
    async updateOrder(id, body) {
        const { after } = await this.cs.update({ table: "production_orders", filters: [{ type: "eq", column: "id", value: id }], values: body });
        return { data: after[0] };
    }
    // ── Business action endpoints ─────────────────────────────────────────────
    async startOrder(id, body) {
        const data = await this.productionService.startOrder(id, body?.actor ?? null);
        return { data };
    }
    async completeOrder(id, body) {
        const data = await this.productionService.completeOrder(id, body ?? {}, body?.actor ?? null);
        return { data };
    }
    async cancelOrder(id, body) {
        const data = await this.productionService.cancelOrder(id, String(body?.reason ?? "Annulé"), body?.actor ?? null);
        return { data };
    }
    async allocateLot(id, body) {
        const data = await this.productionService.allocateLot(id, body ?? {}, body?.actor ?? null);
        return { data };
    }
};
__decorate([
    Get("config"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ProductionController.prototype, "getConfig", null);
__decorate([
    Get("step-definitions"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ProductionController.prototype, "listStepDefinitions", null);
__decorate([
    Get("quality-checks"),
    __param(0, Query("step_id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ProductionController.prototype, "listQualityChecks", null);
__decorate([
    Post("quality-checks"),
    __param(0, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ProductionController.prototype, "createQualityCheck", null);
__decorate([
    Post("audit-logs"),
    __param(0, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ProductionController.prototype, "createAuditLog", null);
__decorate([
    Get("libered-lots"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ProductionController.prototype, "listLiberedLots", null);
__decorate([
    Get("steps"),
    __param(0, Query("order_id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ProductionController.prototype, "listSteps", null);
__decorate([
    Post("steps"),
    __param(0, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ProductionController.prototype, "createStep", null);
__decorate([
    Patch("steps/:id"),
    __param(0, Param("id")),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ProductionController.prototype, "updateStep", null);
__decorate([
    Get("allocations"),
    __param(0, Query("order_id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ProductionController.prototype, "listAllocations", null);
__decorate([
    Delete("allocations/:id"),
    __param(0, Param("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ProductionController.prototype, "deleteAllocation", null);
__decorate([
    Get("output-lots"),
    __param(0, Query("order_id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ProductionController.prototype, "listOutputLots", null);
__decorate([
    Post("output-lots"),
    __param(0, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ProductionController.prototype, "createOutputLot", null);
__decorate([
    Get("orders/summary"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ProductionController.prototype, "getOrdersSummary", null);
__decorate([
    Get("orders/:id"),
    __param(0, Param("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ProductionController.prototype, "getOrder", null);
__decorate([
    Get("orders"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ProductionController.prototype, "listOrders", null);
__decorate([
    Post("orders"),
    __param(0, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ProductionController.prototype, "createOrder", null);
__decorate([
    Patch("orders/:id"),
    __param(0, Param("id")),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ProductionController.prototype, "updateOrder", null);
__decorate([
    Post("orders/:id/start"),
    __param(0, Param("id")),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ProductionController.prototype, "startOrder", null);
__decorate([
    Post("orders/:id/complete"),
    __param(0, Param("id")),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ProductionController.prototype, "completeOrder", null);
__decorate([
    Post("orders/:id/cancel"),
    __param(0, Param("id")),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ProductionController.prototype, "cancelOrder", null);
__decorate([
    Post("orders/:id/allocate-lot"),
    __param(0, Param("id")),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ProductionController.prototype, "allocateLot", null);
ProductionController = __decorate([
    Controller("api/production"),
    UseGuards(RequireAuthGuard),
    __metadata("design:paramtypes", [CollectionsService,
        ProductionService])
], ProductionController);
export { ProductionController };
