import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { RequireAuthGuard } from "../../nest/route-guards.js";
import { CollectionsService } from "../collections/collections.service.js";
import { prepareInsertDocument } from "../../db/defaults.js";
import { getCollectionModel, sanitizeDocument } from "../../db/dynamic-model.js";
import { syncReceptionLotsToStock } from "../receptions/reception-stock-sync.js";

/**
 * Extension controller for reception-related tables that are not covered
 * by the main ReceptionsController (which uses a custom ReceptionsService).
 * Uses CollectionsService for simple CRUD on receptions_v2, reception_lots,
 * qc_inspections, and reception_audit_logs_v2.
 */
@Controller("api")
@UseGuards(RequireAuthGuard)
export class ReceptionsExtController {
  constructor(private readonly cs: CollectionsService) {}

  // ── Reception V2 simple create (header only) ──────────────────────────────

  @Post("receptions-v2")
  async createReceptionHeader(@Body() body: any) {
    // Resolve unit if not provided
    let unit = (body.unit ?? "").trim();
    if (!unit && body.product_id) {
      const rows = await this.cs.query({ table: "products", filters: [{ type: "eq", column: "id", value: body.product_id }] });
      unit = (rows[0] as any)?.unit ?? "";
    }
    if (!unit && body.material_id) {
      const rows = await this.cs.query({ table: "materials", filters: [{ type: "eq", column: "id", value: body.material_id }] });
      unit = (rows[0] as any)?.unit ?? "";
    }
    if (!unit) unit = "kg";

    const data = await this.cs.insert({ table: "receptions_v2", values: { ...body, unit } });
    return { data: data[0] };
  }

  // ── Reception V2 simple update ─────────────────────────────────────────────

  @Patch("receptions-v2/:id")
  async updateReception(@Param("id") id: string, @Body() body: any) {
    const { after } = await this.cs.update({
      table: "receptions_v2",
      filters: [{ type: "eq", column: "id", value: id }],
      values: body,
    });
    return { data: after[0] };
  }

  // ── Reception V2 status update with audit log ──────────────────────────────

  @Patch("receptions-v2/:id/status")
  async updateReceptionStatus(@Param("id") id: string, @Body() body: any) {
    const { status, validated_by, cancellation_reason } = body as {
      status: string;
      validated_by?: string;
      cancellation_reason?: string;
    };

    const updateData: Record<string, unknown> = { status };
    if (status === "EN_ATTENTE_QC") {
      updateData.validated_at = new Date().toISOString();
      updateData.validated_by = validated_by ?? null;
    }
    if (status === "ANNULE") {
      updateData.cancelled_at = new Date().toISOString();
      updateData.cancelled_by = validated_by ?? null;
      updateData.cancellation_reason = cancellation_reason ?? null;
    }

    const { after } = await this.cs.update({
      table: "receptions_v2",
      filters: [{ type: "eq", column: "id", value: id }],
      values: updateData,
    });

    // Non-blocking audit log
    this.cs.insert({
      table: "reception_audit_logs_v2",
      values: {
        entity_type: "RECEPTION",
        entity_id: id,
        action: "STATUS_CHANGE",
        new_state: { status },
        performed_by: validated_by ?? "system",
      },
    }).catch(() => null);

    return { data: after[0] };
  }

  // ── Reception Lots ────────────────────────────────────────────────────────

  @Post("reception-lots")
  async createReceptionLot(@Body() body: any) {
    const { supplier_code, origin_region, harvest_date, ...rest } = body as {
      supplier_code?: string | null;
      origin_region?: string;
      harvest_date?: string;
      [key: string]: unknown;
    };

    // RG-R01: count today's lots for sequential suffix
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const Lots = getCollectionModel("reception_lots");
    const todayCount = await Lots.countDocuments({ created_at: { $gte: todayStart.toISOString() } }).exec();
    const seq = String(todayCount + 1).padStart(3, "0");

    // Build lot_internal: RP-[REG]-[FOURN]-[DATE]-[SEQ]
    const dateStr = (harvest_date || new Date().toISOString().slice(0, 10)).replace(/-/g, "");
    const regionCode = (origin_region || "TZ").slice(0, 2).toUpperCase();
    const supplierCode = (supplier_code || "XX").slice(0, 4).toUpperCase();
    const lot_internal = `RP-${regionCode}-${supplierCode}-${dateStr}-${seq}`;

    const data = await this.cs.insert({
      table: "reception_lots",
      values: {
        ...rest,
        lot_internal,
        origin_country: rest.origin_country || "Tunisie",
        unit: rest.unit || "kg",
        harvest_date: harvest_date || null,
        origin_region: origin_region || null,
      },
    });
    const created = data[0] as Record<string, unknown>;
    syncReceptionLotsToStock([created]).catch((e) =>
      console.error("[ext] syncReceptionLotsToStock create failed:", e),
    );
    return { data: created };
  }

  // ── Reception Lot update ──────────────────────────────────────────────────

  @Patch("reception-lots/:lotId")
  async updateReceptionLot(@Param("lotId") lotId: string, @Body() body: any) {
    const { after } = await this.cs.update({
      table: "reception_lots",
      filters: [{ type: "eq", column: "id", value: lotId }],
      values: sanitizeDocument(body),
    });
    const updated = after[0] as Record<string, unknown>;
    syncReceptionLotsToStock([updated]).catch((e) =>
      console.error("[ext] syncReceptionLotsToStock update failed:", e),
    );
    return { data: updated };
  }

  // ── QC Inspections ────────────────────────────────────────────────────────

  @Get("qc-inspections")
  async listQcInspections(@Query("lab_pending") labPending?: string, @Query("step_id") stepId?: string) {
    const filters: any[] = [];
    if (labPending === "true") {
      filters.push({ type: "eq", column: "lab_sample_required", value: true });
    }
    if (stepId) filters.push({ type: "eq", column: "production_step_id", value: stepId });
    const data = await this.cs.query({
      table: "qc_inspections",
      filters,
      orderBy: { column: "started_at", ascending: false },
    });
    return { data };
  }

  @Patch("qc-inspections/:id")
  async updateQcInspection(@Param("id") id: string, @Body() body: any) {
    const { after } = await this.cs.update({
      table: "qc_inspections",
      filters: [{ type: "eq", column: "id", value: id }],
      values: body,
    });
    return { data: after[0] };
  }
}
