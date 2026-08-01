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
] as const;

@Controller("api/costing")
@UseGuards(RequireAuthGuard, RolesGuard)
export class CostingController {
  constructor(private readonly costingService: CostingService) {}

  @Get("summary")
  @Roles(...COSTING_ROLES)
  async getSummary(@Query("period") period?: string) {
    return { data: await this.costingService.getSummary(period) };
  }

  @Get("lots/:lotId")
  @Roles(...COSTING_ROLES)
  async getLotCost(@Param("lotId") lotId: string) {
    return { data: await this.costingService.getLotCost(lotId) };
  }
}
