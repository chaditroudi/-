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
let ExportContractsController = class ExportContractsController {
    cs;
    constructor(cs) {
        this.cs = cs;
    }
    async list(orderId, status) {
        const filters = [];
        if (orderId)
            filters.push({ type: "eq", column: "order_id", value: orderId });
        if (status)
            filters.push({ type: "eq", column: "status", value: status });
        const data = await this.cs.query({
            table: "export_contracts",
            filters,
            orderBy: { column: "created_at", ascending: false },
        });
        return { data };
    }
    async detail(id) {
        const rows = await this.cs.query({
            table: "export_contracts",
            filters: [{ type: "eq", column: "id", value: id }],
            limit: 1,
        });
        return { data: rows[0] ?? null };
    }
    async create(body) {
        const data = await this.cs.insert({ table: "export_contracts", values: body });
        return { data: data[0] };
    }
    async update(id, body) {
        const { after } = await this.cs.update({
            table: "export_contracts",
            filters: [{ type: "eq", column: "id", value: id }],
            values: body,
        });
        return { data: after[0] };
    }
};
__decorate([
    Get(),
    __param(0, Query("order_id")),
    __param(1, Query("status")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], ExportContractsController.prototype, "list", null);
__decorate([
    Get(":id"),
    __param(0, Param("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ExportContractsController.prototype, "detail", null);
__decorate([
    Post(),
    __param(0, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ExportContractsController.prototype, "create", null);
__decorate([
    Patch(":id"),
    __param(0, Param("id")),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ExportContractsController.prototype, "update", null);
ExportContractsController = __decorate([
    Controller("api/export-contracts"),
    UseGuards(RequireAuthGuard),
    __metadata("design:paramtypes", [CollectionsService])
], ExportContractsController);
export { ExportContractsController };
