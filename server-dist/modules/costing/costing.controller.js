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
import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { Roles } from "../../nest/route-metadata.js";
import { RequireAuthGuard, RolesGuard } from "../../nest/route-guards.js";
import { CostingService } from "./costing.service.js";
const COSTING_ROLES = [
    "administrateur_systeme",
    "directeur_general",
    "directeur_usine",
    "daf",
    "directeur_financier",
    "responsable_achats",
    "directeur_achat",
    "responsable_production",
    "responsable_stock",
    "responsable_qualite",
];
let CostingController = class CostingController {
    costingService;
    constructor(costingService) {
        this.costingService = costingService;
    }
    async getSummary(period) {
        return { data: await this.costingService.getSummary(period) };
    }
    async getLotCost(lotId) {
        return { data: await this.costingService.getLotCost(lotId) };
    }
};
__decorate([
    Get("summary"),
    Roles(...COSTING_ROLES),
    __param(0, Query("period")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CostingController.prototype, "getSummary", null);
__decorate([
    Get("lots/:lotId"),
    Roles(...COSTING_ROLES),
    __param(0, Param("lotId")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CostingController.prototype, "getLotCost", null);
CostingController = __decorate([
    Controller("api/costing"),
    UseGuards(RequireAuthGuard, RolesGuard),
    __metadata("design:paramtypes", [CostingService])
], CostingController);
export { CostingController };
