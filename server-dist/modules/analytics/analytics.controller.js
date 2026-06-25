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
import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { Roles } from "../../nest/route-metadata.js";
import { RequireAuthGuard, RolesGuard } from "../../nest/route-guards.js";
import { AnalyticsService } from "./analytics.service.js";
const ANALYTICS_ROLES = [
    "directeur_general",
    "directeur_usine",
    "responsable_production",
    "responsable_qualite",
    "chef_reception",
    "responsable_reception",
    "responsable_stock",
    "responsable_logistique",
    "responsable_achats",
    "technico_commercial",
    "directeur_achat",
    "resp_management_qualite",
    "resp_qualite_haccp",
    "administrateur_systeme",
    "admin",
    "direction",
];
let AnalyticsController = class AnalyticsController {
    analyticsService;
    constructor(analyticsService) {
        this.analyticsService = analyticsService;
    }
    async getSageOperations() {
        return { data: await this.analyticsService.getSageOperations() };
    }
    async getLiveFactory() {
        return { data: await this.analyticsService.getFounderLiveFactory() };
    }
    async getSupplyFunnel(period) {
        return { data: await this.analyticsService.getFounderSupplyFunnel(period) };
    }
    async getPhase2Analytics(period) {
        return { data: await this.analyticsService.getFounderPhase2Analytics(period) };
    }
    async getPackagingAnalytics(period) {
        return { data: await this.analyticsService.getFounderPackagingAnalytics(period) };
    }
    async getAlertIntelligence(period) {
        return { data: await this.analyticsService.getFounderAlertIntelligence(period) };
    }
    async getReceptionPhase1Analytics(period) {
        return { data: await this.analyticsService.getFounderReceptionPhase1Analytics(period) };
    }
    async getStockStorageAnalytics(period) {
        return { data: await this.analyticsService.getFounderStockStorageAnalytics(period) };
    }
    async getSupplierIntelligence(period) {
        return { data: await this.analyticsService.getFounderSupplierIntelligence(period) };
    }
    async getPlantHealthScore(period) {
        return { data: await this.analyticsService.getFounderPlantHealthScore(period) };
    }
};
__decorate([
    Get("sage-operations"),
    Roles(...ANALYTICS_ROLES),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AnalyticsController.prototype, "getSageOperations", null);
__decorate([
    Get("live-factory"),
    Roles(...ANALYTICS_ROLES),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AnalyticsController.prototype, "getLiveFactory", null);
__decorate([
    Get("supply-funnel"),
    Roles(...ANALYTICS_ROLES),
    __param(0, Query("period")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AnalyticsController.prototype, "getSupplyFunnel", null);
__decorate([
    Get("phase2"),
    Roles(...ANALYTICS_ROLES),
    __param(0, Query("period")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AnalyticsController.prototype, "getPhase2Analytics", null);
__decorate([
    Get("packaging"),
    Roles(...ANALYTICS_ROLES),
    __param(0, Query("period")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AnalyticsController.prototype, "getPackagingAnalytics", null);
__decorate([
    Get("alerts"),
    Roles(...ANALYTICS_ROLES),
    __param(0, Query("period")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AnalyticsController.prototype, "getAlertIntelligence", null);
__decorate([
    Get("reception-phase1"),
    Roles(...ANALYTICS_ROLES),
    __param(0, Query("period")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AnalyticsController.prototype, "getReceptionPhase1Analytics", null);
__decorate([
    Get("stock-storage"),
    Roles(...ANALYTICS_ROLES),
    __param(0, Query("period")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AnalyticsController.prototype, "getStockStorageAnalytics", null);
__decorate([
    Get("suppliers"),
    Roles(...ANALYTICS_ROLES),
    __param(0, Query("period")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AnalyticsController.prototype, "getSupplierIntelligence", null);
__decorate([
    Get("health-score"),
    Roles(...ANALYTICS_ROLES),
    __param(0, Query("period")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AnalyticsController.prototype, "getPlantHealthScore", null);
AnalyticsController = __decorate([
    Controller("api/analytics"),
    UseGuards(RequireAuthGuard, RolesGuard),
    __metadata("design:paramtypes", [AnalyticsService])
], AnalyticsController);
export { AnalyticsController };
