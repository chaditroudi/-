import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { RequireAuthGuard } from "../../nest/route-guards.js";
import { CollectionsService } from "../collections/collections.service.js";

@Controller("api/bon-expeditions")
@UseGuards(RequireAuthGuard)
export class BonExpeditionController {
  constructor(private readonly cs: CollectionsService) {}

  @Get()
  async list(
    @Query("fournisseur_id") fournisseurId?: string,
    @Query("statut") statut?: string,
  ) {
    const filters: any[] = [];
    if (fournisseurId) filters.push({ type: "eq", column: "fournisseur_id", value: fournisseurId });
    if (statut) filters.push({ type: "eq", column: "statut", value: statut });
    const data = await this.cs.query({
      table: "bon_expeditions",
      filters,
      orderBy: { column: "created_at", ascending: false },
    });
    return { data };
  }

  @Get(":id")
  async detail(@Param("id") id: string) {
    const rows = await this.cs.query({
      table: "bon_expeditions",
      filters: [{ type: "eq", column: "id", value: id }],
      limit: 1,
    });
    return { data: rows[0] ?? null };
  }

  @Post()
  async create(@Body() body: any) {
    const data = await this.cs.insert({ table: "bon_expeditions", values: body });
    return { data: data[0] };
  }

  @Patch(":id")
  async update(@Param("id") id: string, @Body() body: any) {
    const { after } = await this.cs.update({
      table: "bon_expeditions",
      filters: [{ type: "eq", column: "id", value: id }],
      values: body,
    });
    return { data: after[0] };
  }

  @Delete(":id")
  async remove(@Param("id") id: string) {
    const data = await this.cs.remove({
      table: "bon_expeditions",
      filters: [{ type: "eq", column: "id", value: id }],
    });
    return { data: data[0] };
  }
}
