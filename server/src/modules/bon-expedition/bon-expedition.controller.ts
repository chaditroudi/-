import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { RequireAuthGuard } from "../../nest/route-guards.js";
import { CollectionsService } from "../collections/collections.service.js";
import { publishRealtimeDbChange } from "../realtime/realtime.bus.js";
import { lotLifecycleService } from "../trust/lot-lifecycle.service.js";

const compactIds = (...values: unknown[]) =>
  values.flat().map((value) => String(value || "")).filter(Boolean);

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
  async create(@Req() req: any, @Body() body: any) {
    const data = await this.cs.insert({
      table: "bon_expeditions",
      values: body,
      actorId: req.auth?.user?.id || null,
    });
    await this.maybeRecordShipped(data[0], req.auth?.user?.id || null);
    publishRealtimeDbChange({
      type: "bon_expedition_created",
      table: "bon_expeditions",
      action: "INSERT",
      actorId: req.auth?.user?.id || null,
      rows: [data[0]].filter(Boolean),
      rowIds: compactIds(data[0]?.id),
      relatedTables: ["lot_events", "stock_lots"],
    });
    return { data: data[0] };
  }

  @Patch(":id")
  async update(@Req() req: any, @Param("id") id: string, @Body() body: any) {
    const { after } = await this.cs.update({
      table: "bon_expeditions",
      filters: [{ type: "eq", column: "id", value: id }],
      values: body,
      actorId: req.auth?.user?.id || null,
    });
    await this.maybeRecordShipped(after[0], req.auth?.user?.id || null);
    publishRealtimeDbChange({
      type: "bon_expedition_updated",
      table: "bon_expeditions",
      action: "UPDATE",
      actorId: req.auth?.user?.id || null,
      rows: [after[0]].filter(Boolean),
      rowIds: compactIds(id),
      relatedTables: ["lot_events", "stock_lots"],
    });
    return { data: after[0] };
  }

  @Delete(":id")
  async remove(@Req() req: any, @Param("id") id: string) {
    const data = await this.cs.remove({
      table: "bon_expeditions",
      filters: [{ type: "eq", column: "id", value: id }],
    });
    publishRealtimeDbChange({
      type: "bon_expedition_deleted",
      table: "bon_expeditions",
      action: "DELETE",
      actorId: req.auth?.user?.id || null,
      rows: [data[0]].filter(Boolean),
      rowIds: compactIds(id),
    });
    return { data: data[0] };
  }

  private async maybeRecordShipped(doc: Record<string, unknown> | null | undefined, actorId: string | null) {
    if (!doc) return;
    const statut = String(doc.statut || doc.status || "").toUpperCase();
    const closing = ["EXPEDIE", "SHIPPED", "CLOSED", "CLOTURE", "LIVRE", "DELIVERED"].includes(statut);
    if (!closing) return;

    const lignes = Array.isArray(doc.lignes) ? doc.lignes : [];
    const lotIds = new Set<string>();

    for (const ligne of lignes) {
      const row = (ligne || {}) as Record<string, unknown>;
      const resolved = await lotLifecycleService.resolveReceptionLotId({
        lotId: String(row.lot_id || row.reception_lot_id || "") || null,
        lotNumber: String(row.lot_number || row.lot_internal || "") || null,
      });
      if (resolved) lotIds.add(resolved);
    }

    for (const lotId of Array.from(lotIds)) {
      await lotLifecycleService.recordStageSafe({
        lotId,
        toStage: "SHIPPED",
        collection: "bon_expeditions",
        actorId,
        payload: {
          bon_id: doc.id ?? null,
          numero_bon: doc.numero_bon ?? null,
          statut,
        },
        route: "PREMIUM_WHOLE",
      });
    }
  }
}
