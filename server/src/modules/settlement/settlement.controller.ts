import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from "@nestjs/common";

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
] as const;

@Controller()
@UseGuards(RequireAuthGuard, RolesGuard)
export class SettlementController {
  constructor(
    private readonly settlements: SettlementService,
    private readonly exportMargin: ExportMarginService,
  ) {}

  @Get("api/settlements")
  @Roles(...SETTLEMENT_ROLES)
  async list(
    @Query("supplier_id") supplierId?: string,
    @Query("status") status?: string,
  ) {
    return { data: await this.settlements.list({ supplierId, status }) };
  }

  @Get("api/settlements/:id")
  @Roles(...SETTLEMENT_ROLES)
  async get(@Param("id") id: string) {
    return { data: await this.settlements.get(id) };
  }

  @Post("api/settlements/from-triage/:sessionId")
  @Roles(...SETTLEMENT_ROLES)
  async fromTriage(@Req() req: any, @Param("sessionId") sessionId: string) {
    const actorId = req.auth?.user?.id || null;
    return { data: await this.settlements.createFromTriageSession(sessionId, actorId) };
  }

  @Post("api/settlements/:id/approve")
  @Roles(...SETTLEMENT_ROLES)
  async approve(@Req() req: any, @Param("id") id: string) {
    return { data: await this.settlements.transition(id, "APPROVED", req.auth?.user?.id || null) };
  }

  @Post("api/settlements/:id/pay")
  @Roles(...SETTLEMENT_ROLES)
  async pay(@Req() req: any, @Param("id") id: string) {
    return { data: await this.settlements.transition(id, "PAID", req.auth?.user?.id || null) };
  }

  @Post("api/settlements/:id/cancel")
  @Roles(...SETTLEMENT_ROLES)
  async cancel(@Req() req: any, @Param("id") id: string) {
    return { data: await this.settlements.transition(id, "CANCELLED", req.auth?.user?.id || null) };
  }

  @Get("api/export-orders/:id/margin")
  @Roles(...SETTLEMENT_ROLES)
  async exportMarginForOrder(@Param("id") id: string) {
    return { data: await this.exportMargin.getOrderMargin(id) };
  }
}
