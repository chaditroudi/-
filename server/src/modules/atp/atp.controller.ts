import { Controller, Get, Param, Post, Query, Req, UseGuards } from "@nestjs/common";

import { Roles } from "../../nest/route-metadata.js";
import { RequireAuthGuard, RolesGuard } from "../../nest/route-guards.js";
import { AtpService } from "./atp.service.js";

const ATP_ROLES = [
  "administrateur_systeme",
  "directeur_general",
  "directeur_usine",
  "responsable_logistique",
  "responsable_export",
  "responsable_stock",
  "magasinier_wms",
  "responsable_production",
  "daf",
] as const;

@Controller("api/atp")
@UseGuards(RequireAuthGuard, RolesGuard)
export class AtpController {
  constructor(private readonly atp: AtpService) {}

  @Get("summary")
  @Roles(...ATP_ROLES)
  async summary() {
    return { data: await this.atp.summary() };
  }

  @Get("promise")
  @Roles(...ATP_ROLES)
  async promise(
    @Query("qty_kg") qtyKg?: string,
    @Query("product_id") productId?: string,
    @Query("grade") grade?: string,
  ) {
    return {
      data: await this.atp.promise({
        qtyKg: Number(qtyKg || 0),
        productId: productId || null,
        grade: grade || null,
      }),
    };
  }

  // Wave D — calcule et inscrit la promesse ATP sur la commande export.
  @Post("orders/:id/promise")
  @Roles(...ATP_ROLES)
  async promiseOrder(@Req() req: any, @Param("id") id: string) {
    return { data: await this.atp.promiseForOrder(id, req.auth?.user?.id || null) };
  }
}
