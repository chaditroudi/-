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
import { Controller, Get, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { Roles } from "../../nest/route-metadata.js";
import { RequireAuthGuard, RolesGuard } from "../../nest/route-guards.js";
import { ExportMarginService } from "./export-margin.service.js";
import { SettlementService } from "./settlement.service.js";
const SETTLEMENT_ROLES = [
    "administrateur_systeme",
    "directeur_general",
    "directeur_usine",
    "daf",
    "directeur_financier",
    "responsable_achats",
    "directeur_achat",
    "responsable_production",
    "responsable_qualite",
];
let SettlementController = class SettlementController {
    settlements;
    exportMargin;
    constructor(settlements, exportMargin) {
        this.settlements = settlements;
        this.exportMargin = exportMargin;
    }
    async list(supplierId, status) {
        return { data: await this.settlements.list({ supplierId, status }) };
    }
    async get(id) {
        return { data: await this.settlements.get(id) };
    }
    async fromTriage(req, sessionId) {
        const actorId = req.auth?.user?.id || null;
        return { data: await this.settlements.createFromTriageSession(sessionId, actorId) };
    }
    async approve(req, id) {
        return { data: await this.settlements.transition(id, "APPROVED", req.auth?.user?.id || null) };
    }
    async pay(req, id) {
        return { data: await this.settlements.transition(id, "PAID", req.auth?.user?.id || null) };
    }
    async cancel(req, id) {
        return { data: await this.settlements.transition(id, "CANCELLED", req.auth?.user?.id || null) };
    }
    async exportMarginForOrder(id) {
        return { data: await this.exportMargin.getOrderMargin(id) };
    }
};
__decorate([
    Get("api/settlements"),
    Roles(...SETTLEMENT_ROLES),
    __param(0, Query("supplier_id")),
    __param(1, Query("status")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], SettlementController.prototype, "list", null);
__decorate([
    Get("api/settlements/:id"),
    Roles(...SETTLEMENT_ROLES),
    __param(0, Param("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], SettlementController.prototype, "get", null);
__decorate([
    Post("api/settlements/from-triage/:sessionId"),
    Roles(...SETTLEMENT_ROLES),
    __param(0, Req()),
    __param(1, Param("sessionId")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], SettlementController.prototype, "fromTriage", null);
__decorate([
    Post("api/settlements/:id/approve"),
    Roles(...SETTLEMENT_ROLES),
    __param(0, Req()),
    __param(1, Param("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], SettlementController.prototype, "approve", null);
__decorate([
    Post("api/settlements/:id/pay"),
    Roles(...SETTLEMENT_ROLES),
    __param(0, Req()),
    __param(1, Param("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], SettlementController.prototype, "pay", null);
__decorate([
    Post("api/settlements/:id/cancel"),
    Roles(...SETTLEMENT_ROLES),
    __param(0, Req()),
    __param(1, Param("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], SettlementController.prototype, "cancel", null);
__decorate([
    Get("api/export-orders/:id/margin"),
    Roles(...SETTLEMENT_ROLES),
    __param(0, Param("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], SettlementController.prototype, "exportMarginForOrder", null);
SettlementController = __decorate([
    Controller(),
    UseGuards(RequireAuthGuard, RolesGuard),
    __metadata("design:paramtypes", [SettlementService,
        ExportMarginService])
], SettlementController);
export { SettlementController };
