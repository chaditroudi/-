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
import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { RequireAuthGuard } from "../../nest/route-guards.js";
import { CollectionsService } from "../collections/collections.service.js";
import { ReceptionsService } from "../receptions/receptions.service.js";
let SuppliersController = class SuppliersController {
    cs;
    receptionsService;
    constructor(cs, receptionsService) {
        this.cs = cs;
        this.receptionsService = receptionsService;
    }
    async list() {
        const data = await this.cs.query({ table: "suppliers", filters: [], orderBy: { column: "name", ascending: true } });
        return { data };
    }
    async create(body) {
        const data = await this.cs.insert({ table: "suppliers", values: body });
        return { data: data[0] };
    }
    async update(id, body) {
        const { after } = await this.cs.update({ table: "suppliers", filters: [{ type: "eq", column: "id", value: id }], values: body });
        return { data: after[0] };
    }
    async remove(id) {
        const data = await this.cs.remove({ table: "suppliers", filters: [{ type: "eq", column: "id", value: id }] });
        return { data: data[0] };
    }
    async receptionCheck(id) {
        const data = await this.cs.query({ table: "receptions", filters: [{ type: "eq", column: "supplier_id", value: id }], limit: 1 });
        return { data, hasReceptions: data.length > 0 };
    }
    async getLots(id) {
        const data = await this.cs.query({
            table: "receptions_v2",
            filters: [{ type: "eq", column: "supplier_id", value: id }],
            orderBy: { column: "actual_arrival_date", ascending: false },
        });
        return { data };
    }
    async getOrders(id) {
        const data = await this.cs.query({
            table: "purchase_orders",
            filters: [{ type: "eq", column: "supplier_id", value: id }],
            orderBy: { column: "order_date", ascending: false },
        });
        return { data };
    }
    async getPayments(id) {
        const data = await this.cs.query({
            table: "supplier_payments",
            filters: [{ type: "eq", column: "supplier_id", value: id }],
            orderBy: { column: "created_at", ascending: false },
        });
        return { data };
    }
    async getAuditLogs(id) {
        const data = await this.cs.query({
            table: "audit_logs",
            filters: [
                { type: "eq", column: "entity_type", value: "supplier" },
                { type: "eq", column: "entity_id", value: id },
            ],
            orderBy: { column: "created_at", ascending: false },
        });
        return { data };
    }
    async createAuditLog(id, body) {
        const data = await this.cs.insert({ table: "audit_logs", values: { ...body, entity_type: "supplier", entity_id: id } });
        return { data: data[0] };
    }
    async checkExpirations() {
        return this.receptionsService.checkSupplierContractExpirations();
    }
};
__decorate([
    Get(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SuppliersController.prototype, "list", null);
__decorate([
    Post(),
    __param(0, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], SuppliersController.prototype, "create", null);
__decorate([
    Patch(":id"),
    __param(0, Param("id")),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], SuppliersController.prototype, "update", null);
__decorate([
    Delete(":id"),
    __param(0, Param("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], SuppliersController.prototype, "remove", null);
__decorate([
    Get(":id/reception-check"),
    __param(0, Param("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], SuppliersController.prototype, "receptionCheck", null);
__decorate([
    Get(":id/lots"),
    __param(0, Param("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], SuppliersController.prototype, "getLots", null);
__decorate([
    Get(":id/orders"),
    __param(0, Param("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], SuppliersController.prototype, "getOrders", null);
__decorate([
    Get(":id/payments"),
    __param(0, Param("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], SuppliersController.prototype, "getPayments", null);
__decorate([
    Get(":id/audit-logs"),
    __param(0, Param("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], SuppliersController.prototype, "getAuditLogs", null);
__decorate([
    Post(":id/audit-logs"),
    __param(0, Param("id")),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], SuppliersController.prototype, "createAuditLog", null);
__decorate([
    Post("check-expirations"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SuppliersController.prototype, "checkExpirations", null);
SuppliersController = __decorate([
    Controller("api/suppliers"),
    UseGuards(RequireAuthGuard),
    __metadata("design:paramtypes", [CollectionsService,
        ReceptionsService])
], SuppliersController);
export { SuppliersController };
