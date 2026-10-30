import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { badRequest, conflict, forbidden, notFound } from "../../core/app-error.js";
import { hasAnyRole } from "../../middleware/authorization.js";
import { Roles } from "../../nest/route-metadata.js";
import { RequireAuthGuard, RolesGuard } from "../../nest/route-guards.js";
import { CollectionsService } from "../collections/collections.service.js";
import { getCollectionModel, sanitizeDocument } from "../../db/dynamic-model.js";
import {
  QUALITY_ROLES,
  RECEPTION_CANCEL_ROLES,
  RECEPTION_READ_ROLES,
  RECEPTION_WRITE_ROLES,
} from "../receptions/reception-roles.js";
import { ReceptionsService } from "../receptions/receptions.service.js";

/** Lifecycle and QC fields: written only by the reception domain service. */
const RECEPTION_LIFECYCLE_FIELDS = [
  "_id", "id", "reception_number", "status", "client_request_id", "created_at", "created_by",
  "purchase_order_id", "purchase_order_line_id", "purchase_order_number",
  "qc_decision", "qc_score", "qc_grade", "qc_auto_reject_reasons", "qc_closed_at", "qc_closed_by",
  "validated_at", "validated_by", "cancelled_at", "cancelled_by", "cancellation_reason",
];
/** Once a delivery is booked its supplier, quantities and weights feed stock and the PO. */
const RECEPTION_BOOKED_FIELDS = [
  ...RECEPTION_LIFECYCLE_FIELDS,
  "supplier_id", "supplier_code_snapshot", "supplier_name_snapshot", "quantity_total", "unit",
  "gross_weight_kg", "tare_weight_kg", "gross_reading_id", "tare_reading_id",
  "weighing_verified_device", "weight_gap_percent", "manufacturing_route",
];
const LOT_SYSTEM_FIELDS = [
  "_id", "id", "lot_internal", "stock_status", "qr_code_payload", "created_at", "cancelled_at",
  "release_date", "released_by", "release_pin_verified", "release_reason", "quarantine_date", "quarantine_reason",
  "gross_weight_kg", "tare_weight_kg", "net_weight_kg",
  "purchase_cost_tnd_per_kg", "purchase_cost_tnd", "cost_source",
];
const LOT_LOCKED_FIELDS = [...LOT_SYSTEM_FIELDS, "reception_id", "quantity", "unit", "manufacturing_route"];
const INSPECTION_LOCKED_FIELDS = [
  "_id", "id", "reception_id", "inspection_number", "decision", "decided_by", "ended_at",
  "started_at", "inspector_id", "release_pin_verified", "created_at",
];

const without = (body: unknown, fields: string[]) =>
  Object.fromEntries(
    Object.entries((body || {}) as Record<string, unknown>).filter(([key]) => !fields.includes(key)),
  );

const findReception = async (id: string) =>
  sanitizeDocument(
    await getCollectionModel("receptions_v2").findOne({ id }).lean().exec(),
  ) as Record<string, unknown> | null;

/**
 * Extension controller for reception-related tables that are not covered
 * by the main ReceptionsController (which uses a custom ReceptionsService).
 * Uses CollectionsService for descriptive edits on receptions_v2, reception_lots
 * and qc_inspections; status, quantity and QC changes go through ReceptionsService.
 */
@Controller("api")
@UseGuards(RequireAuthGuard, RolesGuard)
export class ReceptionsExtController {
  constructor(
    private readonly cs: CollectionsService,
    private readonly receptionsService: ReceptionsService,
  ) {}

  // ── Reception V2 draft create (header only) ──────────────────────────────

  @Post("receptions-v2")
  @Roles(...RECEPTION_WRITE_ROLES)
  async createReceptionHeader(@Body() body: any) {
    // Resolve unit if not provided
    let unit = String(body?.unit ?? "").trim();
    if (!unit && body?.product_id) {
      const rows = await this.cs.query({ table: "products", filters: [{ type: "eq", column: "id", value: body.product_id }] });
      unit = (rows[0] as any)?.unit ?? "";
    }
    if (!unit && body?.material_id) {
      const rows = await this.cs.query({ table: "materials", filters: [{ type: "eq", column: "id", value: body.material_id }] });
      unit = (rows[0] as any)?.unit ?? "";
    }
    if (!unit) unit = "kg";

    const data = await this.cs.insert({
      table: "receptions_v2",
      values: {
        ...without(body, RECEPTION_LIFECYCLE_FIELDS.filter((field) => field !== "created_by")),
        unit,
        status: "BROUILLON",
      },
    });
    return { data: data[0] };
  }

  // ── Reception V2 descriptive update ────────────────────────────────────────

  @Patch("receptions-v2/:id")
  @Roles(...RECEPTION_WRITE_ROLES)
  async updateReception(@Param("id") id: string, @Body() body: any) {
    const reception = await findReception(id);
    if (!reception) throw notFound("RECEPTION_NOT_FOUND", "Reception not found.");
    if (reception.status === "ANNULE") {
      throw conflict("RECEPTION_CANCELLED", `La réception ${reception.reception_number} est annulée : elle n'est plus modifiable.`);
    }

    const values = without(body, reception.status === "BROUILLON" ? RECEPTION_LIFECYCLE_FIELDS : RECEPTION_BOOKED_FIELDS);
    if (Object.keys(values).length === 0) return { data: reception };

    const { after } = await this.cs.update({
      table: "receptions_v2",
      filters: [{ type: "eq", column: "id", value: id }],
      values,
    });
    return { data: after[0] };
  }

  // ── Reception V2 status: only draft submission here, cancellation delegated ─

  @Patch("receptions-v2/:id/status")
  @Roles(...RECEPTION_WRITE_ROLES)
  async updateReceptionStatus(@Param("id") id: string, @Req() req: any, @Body() body: any) {
    const { status, cancellation_reason } = (body || {}) as { status?: string; cancellation_reason?: string };
    const actor = req.auth?.user || null;

    if (status === "ANNULE") {
      if (!hasAnyRole(req, RECEPTION_CANCEL_ROLES)) {
        throw forbidden("Seul un responsable peut annuler une réception.");
      }
      const result = await this.receptionsService.cancelReception(id, { reason: cancellation_reason }, actor);
      return { data: result.reception };
    }

    const reception = await findReception(id);
    if (!reception) throw notFound("RECEPTION_NOT_FOUND", "Reception not found.");
    if (status !== "EN_ATTENTE_QC" || reception.status !== "BROUILLON") {
      throw conflict(
        "INVALID_STATUS_TRANSITION",
        `Transition ${reception.status} → ${status} non autorisée : les statuts QC et stock sont pilotés par le contrôle qualité.`,
      );
    }

    // QC inspects lots: a draft without a supplier or a weighed lot cannot be submitted.
    const draftLots = sanitizeDocument(
      await getCollectionModel("reception_lots").find({ reception_id: id }).lean().exec(),
    ) as Array<Record<string, unknown>>;
    const missing: string[] = [];
    if (!reception.supplier_id) missing.push("fournisseur");
    if (!draftLots.some((lot) => Number(lot.quantity) > 0)) missing.push("au moins un lot avec une quantité");
    if (missing.length > 0) {
      throw badRequest(
        "RECEPTION_INCOMPLETE",
        `Brouillon incomplet — à renseigner avant le contrôle : ${missing.join(", ")}.`,
        { missing },
      );
    }

    const previousStatus = reception.status;
    const { after } = await this.cs.update({
      table: "receptions_v2",
      filters: [{ type: "eq", column: "id", value: id }],
      values: { status, validated_at: new Date().toISOString(), validated_by: actor?.id ?? null },
      actorId: actor?.id ?? null,
      // Draft submission is the one status change this controller owns.
      trustedInternal: true,
    });

    await this.cs.insert({
      table: "reception_audit_logs_v2",
      values: {
        entity_type: "RECEPTION",
        entity_id: id,
        action: "STATUS_CHANGE",
        previous_state: { status: previousStatus },
        new_state: { status },
        performed_by: actor?.id ?? "system",
      },
    });

    return { data: after[0] };
  }

  // ── Reception Lots (draft receptions only — intake creates booked lots) ───

  @Post("reception-lots")
  @Roles(...RECEPTION_WRITE_ROLES)
  async createReceptionLot(@Body() body: any) {
    const { supplier_code, origin_region, harvest_date, ...rest } = without(body, LOT_SYSTEM_FIELDS) as {
      supplier_code?: string | null;
      origin_region?: string;
      harvest_date?: string;
      [key: string]: unknown;
    };

    const reception = await findReception(String(rest.reception_id || ""));
    if (!reception) throw notFound("RECEPTION_NOT_FOUND", "Reception not found.");
    if (reception.status !== "BROUILLON") {
      throw conflict(
        "RECEPTION_NOT_DRAFT",
        "Des lots ne peuvent être ajoutés qu'à une réception en brouillon : le stock et le bon de commande sont déjà comptabilisés.",
      );
    }

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

    // The generic insert projects the lot into stock_lots with its reception.
    const data = await this.cs.insert({
      table: "reception_lots",
      values: {
        ...rest,
        lot_internal,
        stock_status: "EN_QUARANTAINE",
        origin_country: rest.origin_country || "Tunisie",
        unit: rest.unit || "kg",
        harvest_date: harvest_date || null,
        origin_region: origin_region || null,
      },
    });
    return { data: data[0] };
  }

  // ── Reception Lot descriptive update ──────────────────────────────────────

  @Patch("reception-lots/:lotId")
  @Roles(...RECEPTION_WRITE_ROLES)
  async updateReceptionLot(@Param("lotId") lotId: string, @Body() body: any) {
    const values = sanitizeDocument(without(body, LOT_LOCKED_FIELDS));
    const lot = sanitizeDocument(
      await getCollectionModel("reception_lots").findOne({ id: lotId }).lean().exec(),
    ) as Record<string, unknown> | null;
    if (!lot) throw notFound("RECEPTION_LOT_NOT_FOUND", "Reception lot not found.");
    if (Object.keys(values).length === 0) return { data: lot };

    // Status changes use POST /reception-lots/:lotId/quality-status; the generic
    // update re-projects the lot into stock_lots with its reception.
    const { after } = await this.cs.update({
      table: "reception_lots",
      filters: [{ type: "eq", column: "id", value: lotId }],
      values,
    });
    return { data: after[0] };
  }

  // ── QC Inspections ────────────────────────────────────────────────────────

  @Get("qc-inspections")
  @Roles(...RECEPTION_READ_ROLES, ...QUALITY_ROLES)
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

  /** Lab results and comments; the decision itself is recorded by POST /qc/submit. */
  @Patch("qc-inspections/:id")
  @Roles(...QUALITY_ROLES)
  async updateQcInspection(@Param("id") id: string, @Body() body: any) {
    const { after } = await this.cs.update({
      table: "qc_inspections",
      filters: [{ type: "eq", column: "id", value: id }],
      values: without(body, INSPECTION_LOCKED_FIELDS),
    });
    return { data: after[0] };
  }
}
