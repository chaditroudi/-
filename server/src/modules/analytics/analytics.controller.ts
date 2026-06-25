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

@Controller("api/analytics")
@UseGuards(RequireAuthGuard, RolesGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get("sage-operations")
  @Roles(...ANALYTICS_ROLES)
  async getSageOperations() {
    return { data: await this.analyticsService.getSageOperations() };
  }

  @Get("live-factory")
  @Roles(...ANALYTICS_ROLES)
  async getLiveFactory() {
    return { data: await this.analyticsService.getFounderLiveFactory() };
  }

  @Get("supply-funnel")
  @Roles(...ANALYTICS_ROLES)
  async getSupplyFunnel(@Query("period") period?: string) {
    return { data: await this.analyticsService.getFounderSupplyFunnel(period) };
  }

  @Get("phase2")
  @Roles(...ANALYTICS_ROLES)
  async getPhase2Analytics(@Query("period") period?: string) {
    return { data: await this.analyticsService.getFounderPhase2Analytics(period) };
  }

  @Get("packaging")
  @Roles(...ANALYTICS_ROLES)
  async getPackagingAnalytics(@Query("period") period?: string) {
    return { data: await this.analyticsService.getFounderPackagingAnalytics(period) };
  }

  @Get("alerts")
  @Roles(...ANALYTICS_ROLES)
  async getAlertIntelligence(@Query("period") period?: string) {
    return { data: await this.analyticsService.getFounderAlertIntelligence(period) };
  }

  @Get("reception-phase1")
  @Roles(...ANALYTICS_ROLES)
  async getReceptionPhase1Analytics(@Query("period") period?: string) {
    return { data: await this.analyticsService.getFounderReceptionPhase1Analytics(period) };
  }

  @Get("stock-storage")
  @Roles(...ANALYTICS_ROLES)
  async getStockStorageAnalytics(@Query("period") period?: string) {
    return { data: await this.analyticsService.getFounderStockStorageAnalytics(period) };
  }

  @Get("suppliers")
  @Roles(...ANALYTICS_ROLES)
  async getSupplierIntelligence(@Query("period") period?: string) {
    return { data: await this.analyticsService.getFounderSupplierIntelligence(period) };
  }

  @Get("health-score")
  @Roles(...ANALYTICS_ROLES)
  async getPlantHealthScore(@Query("period") period?: string) {
    return { data: await this.analyticsService.getFounderPlantHealthScore(period) };
  }
}
