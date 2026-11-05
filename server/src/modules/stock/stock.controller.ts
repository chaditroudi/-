import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { Roles } from "../../nest/route-metadata.js";
import { RequireAuthGuard, RolesGuard } from "../../nest/route-guards.js";
import { badRequest, forbidden } from "../../core/app-error.js";
import { hasAnyRole, QUALITY_ROLES } from "../../middleware/authorization.js";
import { getCollectionModel, sanitizeDocument } from "../../db/dynamic-model.js";
import { prepareInsertDocument } from "../../db/defaults.js";
import { CollectionsService } from "../collections/collections.service.js";
import { publishRealtimeDbChange } from "../realtime/realtime.bus.js";
import { scanService } from "../trust/scan.service.js";
import { autoReorderOnStockChange } from "../purchasing/stock-reorder.service.js";
import { planExpeditionDecrement, type ExpeditionLot } from "./expedition-decrement.js";
import { consumeStockLotKg, creditStockLotKg } from "./stock-quantity.js";
import { applyInventoryAdjustment } from "./stock-adjustment.js";
import { applyQualityHold, releaseQualityHold } from "./stock-hold.js";
import { runStockIntegrityDiagnostics } from "./stock-diagnostics.js";
import { assertShipmentReadyToShip } from "./shipment-integrity.js";

const compactIds = (...values: unknown[]) =>
  values.flat().map((value) => String(value || "")).filter(Boolean);

const STOCK_ACCESS_ROLES = [
  "responsable_stock", "magasinier_wms", "responsable_logistique",
  "responsable_reception", "chef_reception", "responsable_qualite",
  "administrateur_systeme", "directeur_usine", "directeur_general",
];

@Controller("api/stock")
@UseGuards(RequireAuthGuard, RolesGuard)
@Roles(...STOCK_ACCESS_ROLES)
export class StockController {
  constructor(private readonly cs: CollectionsService) {}

  // ── Summary ───────────────────────────────────────────────────────────────
  // W0: stock_lots is the warehouse projection of reception_lots (linked by
  // reception_lot_id). Prefer stock_lots; fall back to reception_lots when
  // projection is empty so dashboards never go blank mid-migration.

  @Get("summary")
  async getStockSummary() {
    const cutoff48h = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

    type CatStat = { total: number; inQuarantine: number; alertsMin: number; alertsSecurity: number };
    const summary: Record<string, CatStat> = {
      MP:  { total: 0, inQuarantine: 0, alertsMin: 0, alertsSecurity: 0 },
      WIP: { total: 0, inQuarantine: 0, alertsMin: 0, alertsSecurity: 0 },
      PF:  { total: 0, inQuarantine: 0, alertsMin: 0, alertsSecurity: 0 },
      EMB: { total: 0, inQuarantine: 0, alertsMin: 0, alertsSecurity: 0 },
    };

    const stockLots = sanitizeDocument(
      await getCollectionModel("stock_lots").find({}).lean().exec(),
    ) as Record<string, unknown>[];

    if (stockLots.length > 0) {
      for (const lot of stockLots) {
        const qty = Number(lot.current_quantity ?? lot.initial_quantity ?? 0);
        const status = String(lot.status ?? "").toUpperCase();
        const createdAt = String(lot.created_at ?? lot.reception_date ?? "");
        const category = String(lot.category || "MP").toUpperCase();
        const bucket = summary[category] ? category : "MP";

        if (status === "VALIDATED" || status === "RELEASED") {
          summary[bucket].total += qty;
        } else if (status === "QUARANTINE" || status === "HOLD") {
          summary[bucket].inQuarantine += qty;
          if (createdAt && createdAt < cutoff48h) summary[bucket].alertsMin++;
        } else if (status === "BLOCKED" || status === "REJECTED") {
          summary[bucket].alertsSecurity++;
        }
      }

      return {
        data: summary,
        meta: {
          source: "stock_lots",
          identity: "reception_lot_id",
          lotCount: stockLots.length,
        },
      };
    }

    const rawLots = await getCollectionModel("reception_lots")
      .find({ stock_status: { $in: ["EN_QUARANTAINE", "STOCK_LIBERE", "STOCK_REJETE"] } })
      .lean()
      .exec();

    const lots = sanitizeDocument(rawLots) as Record<string, unknown>[];

    for (const lot of lots) {
      const qty = Number(lot.quantity ?? 0);
      const status = String(lot.stock_status ?? "");
      const createdAt = String(lot.created_at ?? "");

      if (status === "STOCK_LIBERE") {
        summary.MP.total += qty;
      } else if (status === "EN_QUARANTAINE") {
        summary.MP.inQuarantine += qty;
        if (createdAt && createdAt < cutoff48h) summary.MP.alertsMin++;
      } else if (status === "STOCK_REJETE") {
        summary.MP.alertsSecurity++;
      }
    }

    return {
      data: summary,
      meta: {
        source: "reception_lots_fallback",
        identity: "reception_lots.id → stock_lots.reception_lot_id",
        lotCount: lots.length,
      },
    };
  }

  // ── Reception Lots (unified view across all receptions) ──────────────────

  @Get("reception-lots")
  async listAllReceptionLots(
    @Query("stock_status") stockStatus?: string,
    @Query("variety") variety?: string,
  ) {
    const filters: any[] = [];
    if (stockStatus) filters.push({ type: "eq", column: "stock_status", value: stockStatus });
    if (variety)     filters.push({ type: "eq", column: "variety",      value: variety });
    const data = await this.cs.query({
      table: "reception_lots",
      filters,
      orderBy: { column: "created_at", ascending: false },
    });
    return { data };
  }

  // ── Products ──────────────────────────────────────────────────────────────

  @Get("products")
  async listProducts() {
    const data = await this.cs.query({ table: "products", filters: [], orderBy: { column: "name", ascending: true } });
    return { data };
  }

  @Post("products")
  async createProduct(@Req() req: any, @Body() body: any) {
    const data = await this.cs.insert({ table: "products", values: body });
    publishRealtimeDbChange({
      type: "stock_product_created",
      table: "products",
      action: "INSERT",
      actorId: req.auth?.user?.id || null,
      rowIds: compactIds(data[0]?.id),
    });
    return { data: data[0] };
  }

  @Patch("products/:id")
  async updateProduct(@Req() req: any, @Param("id") id: string, @Body() body: any) {
    const { after } = await this.cs.update({ table: "products", filters: [{ type: "eq", column: "id", value: id }], values: body });
    publishRealtimeDbChange({
      type: "stock_product_updated",
      table: "products",
      action: "UPDATE",
      actorId: req.auth?.user?.id || null,
      rowIds: compactIds(id),
    });
    return { data: after[0] };
  }

  // ── Stock Lots ────────────────────────────────────────────────────────────

  @Get("lots")
  async listLots(@Query("status") status?: string) {
    const filters: any[] = [];
    if (status) filters.push({ type: "eq", column: "status", value: status });
    const data = await this.cs.query({ table: "stock_lots", filters, orderBy: { column: "created_at", ascending: false } });
    return { data };
  }

  @Post("lots")
  async createLot(@Req() req: any, @Body() body: any) {
    const data = await this.cs.insert({ table: "stock_lots", values: body });
    publishRealtimeDbChange({
      type: "stock_lot_created",
      table: "stock_lots",
      action: "INSERT",
      actorId: req.auth?.user?.id || null,
      rowIds: compactIds(data[0]?.id),
      relatedTables: ["stock_summary"],
    });
    return { data: data[0] };
  }

  @Patch("lots/:id")
  async updateLot(@Req() req: any, @Param("id") id: string, @Body() body: any) {
    const { after } = await this.cs.update({ table: "stock_lots", filters: [{ type: "eq", column: "id", value: id }], values: body });
    publishRealtimeDbChange({
      type: "stock_lot_updated",
      table: "stock_lots",
      action: "UPDATE",
      actorId: req.auth?.user?.id || null,
      rowIds: compactIds(id),
      relatedTables: ["stock_summary"],
    });
    return { data: after[0] };
  }

  // ── Locations ─────────────────────────────────────────────────────────────

  @Get("locations")
  async listLocations() {
    const data = await this.cs.query({ table: "stock_locations", filters: [], orderBy: { column: "code", ascending: true } });
    return { data };
  }

  @Patch("locations/:id")
  async updateLocation(@Req() req: any, @Param("id") id: string, @Body() body: any) {
    const { after } = await this.cs.update({ table: "stock_locations", filters: [{ type: "eq", column: "id", value: id }], values: body });
    publishRealtimeDbChange({
      type: "stock_location_updated",
      table: "stock_locations",
      action: "UPDATE",
      actorId: req.auth?.user?.id || null,
      rowIds: compactIds(id),
    });
    return { data: after[0] };
  }

  // ── Movements ─────────────────────────────────────────────────────────────

  @Get("movements")
  async listMovements(@Query("lot_id") lotId?: string) {
    const filters: any[] = [];
    if (lotId) filters.push({ type: "eq", column: "lot_id", value: lotId });
    const data = await this.cs.query({ table: "stock_movements", filters, orderBy: { column: "movement_date", ascending: false } });
    return { data };
  }

  @Post("movements")
  async createMovement() {
    // Gate 2 P0: stock_movements are append-only ledger rows owned by domain
    // services (reception, production, packaging, expedition, storage). A free
    // HTTP insert previously wrote a movement without changing quantity.
    throw badRequest(
      "STOCK_MOVEMENT_DOMAIN_ONLY",
      "Les mouvements de stock s'enregistrent uniquement par les services métier (réception, production, conditionnement, expédition, stockage).",
    );
  }

  // ── Alerts ────────────────────────────────────────────────────────────────
  // Static alerts from stock_alerts + dynamic alerts derived from reception_lots.

  @Get("alerts")
  async listAlerts(@Query("status") status?: string) {
    const cutoff48h = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

    const [staticAlerts, rawRejected, rawStale] = await Promise.all([
      this.cs.query({ table: "stock_alerts", filters: [], orderBy: { column: "created_at", ascending: false } }),
      getCollectionModel("reception_lots")
        .find({ stock_status: "STOCK_REJETE" })
        .lean().exec(),
      getCollectionModel("reception_lots")
        .find({ stock_status: "EN_QUARANTAINE", created_at: { $lt: cutoff48h } })
        .lean().exec(),
    ]);

    const rejected = sanitizeDocument(rawRejected) as Record<string, unknown>[];
    const stale    = sanitizeDocument(rawStale)    as Record<string, unknown>[];

    const dynamic: Record<string, unknown>[] = [];

    for (const lot of rejected) {
      dynamic.push({
        id:         `dyn-rej-${lot.id}`,
        title:      `Lot rejeté : ${lot.lot_internal ?? lot.id}`,
        message:    lot.quarantine_reason ?? "Lot rejeté lors du contrôle qualité",
        severity:   "critical",
        status:     "active",
        entity_type: "reception_lot",
        entity_id:  lot.id,
        created_at: lot.updated_at ?? lot.created_at,
      });
    }

    if (stale.length > 0) {
      dynamic.push({
        id:       "dyn-quarantine-stale",
        title:    `${stale.length} lot(s) bloqués en quarantaine > 48 h`,
        message:  stale.map((l) => l.lot_internal ?? l.id).join(", "),
        severity: "warning",
        status:   "active",
        entity_type: "reception_lot",
        created_at: stale[0]?.created_at,
      });
    }

    const all = [...(staticAlerts as Record<string, unknown>[]), ...dynamic];
    const filtered = status ? all.filter((a) => a.status === status) : all;
    return { data: filtered };
  }

  @Patch("alerts/:id")
  async updateAlert(@Req() req: any, @Param("id") id: string, @Body() body: any) {
    const { after } = await this.cs.update({ table: "stock_alerts", filters: [{ type: "eq", column: "id", value: id }], values: body });
    publishRealtimeDbChange({
      type: "stock_alert_updated",
      table: "stock_alerts",
      action: "UPDATE",
      actorId: req.auth?.user?.id || null,
      rowIds: compactIds(id),
    });
    return { data: after[0] };
  }

  // ── Inventory Counts ──────────────────────────────────────────────────────

  @Get("inventory-counts")
  async listInventoryCounts() {
    const data = await this.cs.query({ table: "inventory_counts", filters: [], orderBy: { column: "created_at", ascending: false } });
    return { data };
  }

  @Post("inventory-counts")
  async createInventoryCount(@Req() req: any, @Body() body: any) {
    const actorId = req.auth?.user?.id || null;
    const apply = Boolean(body?.apply_adjustment ?? body?.apply);
    if (apply) {
      const result = await applyInventoryAdjustment({
        stockLotId: String(body?.stock_lot_id || body?.lot_id || ""),
        countedQuantityKg: Number(body?.counted_quantity ?? body?.counted_quantity_kg),
        reason: String(body?.reason || body?.notes || ""),
        actorId,
        requestId: body?.request_id ? String(body.request_id) : null,
        countPayload: body,
      });
      publishRealtimeDbChange({
        type: "inventory_count_created",
        table: "inventory_counts",
        action: "INSERT",
        actorId,
        rowIds: compactIds(result.count?.id, result.movement?.id, body?.stock_lot_id),
        relatedTables: ["stock_lots", "stock_movements"],
      });
      return { data: result.count, adjustment: result };
    }

    const data = await this.cs.insert({ table: "inventory_counts", values: body });
    publishRealtimeDbChange({
      type: "inventory_count_created",
      table: "inventory_counts",
      action: "INSERT",
      actorId,
      rowIds: compactIds(data[0]?.id),
    });
    return { data: data[0] };
  }

  @Post("adjustments")
  async createAdjustment(@Req() req: any, @Body() body: any) {
    const result = await applyInventoryAdjustment({
      stockLotId: String(body?.stock_lot_id || body?.lot_id || ""),
      countedQuantityKg: body?.counted_quantity != null
        ? Number(body.counted_quantity)
        : Number(body?.delta_kg) + Number(body?.expected_quantity ?? NaN),
      deltaKg: body?.delta_kg != null ? Number(body.delta_kg) : undefined,
      reason: String(body?.reason || ""),
      actorId: req.auth?.user?.id || null,
      requestId: body?.request_id ? String(body.request_id) : null,
      countPayload: body,
    });
    return { data: result };
  }

  @Post("holds")
  async createHold(@Req() req: any, @Body() body: any) {
    const action = String(body?.action || "HOLD").toUpperCase();
    if (action === "RELEASE" && !hasAnyRole(req, QUALITY_ROLES)) throw forbidden("La levée d'un blocage requiert un rôle qualité.");
    const payload = {
      stockLotId: String(body?.stock_lot_id || body?.lot_id || ""),
      reason: String(body?.reason || ""),
      actorId: req.auth?.user?.id || null,
      propagateGenealogy: body?.propagate !== false,
      requestId: body?.request_id ? String(body.request_id) : null,
    };
    const data = action === "RELEASE"
      ? await releaseQualityHold(payload)
      : await applyQualityHold(payload);
    return { data };
  }

  @Get("diagnostics")
  async diagnostics() {
    const data = await runStockIntegrityDiagnostics();
    return { data };
  }

  // ── Shipment Preparations ─────────────────────────────────────────────────

  @Get("shipments")
  async listShipments() {
    const data = await this.cs.query({ table: "shipment_preparations", filters: [], orderBy: { column: "created_at", ascending: false } });
    return { data };
  }

  @Post("shipments")
  async createShipment(@Req() req: any, @Body() body: any) {
    const data = await this.cs.insert({ table: "shipment_preparations", values: body });
    publishRealtimeDbChange({
      type: "shipment_created",
      table: "shipment_preparations",
      action: "INSERT",
      actorId: req.auth?.user?.id || null,
      rowIds: compactIds(data[0]?.id),
    });
    return { data: data[0] };
  }

  @Patch("shipments/:id")
  async updateShipment(@Req() req: any, @Param("id") id: string, @Body() body: any) {
    const nextStatus = String(body?.status || "").toUpperCase();
    if (nextStatus === "SHIPPED" || nextStatus === "EXPEDIE" || nextStatus === "EXPÉDIÉ") {
      await assertShipmentReadyToShip(id);
    }
    if (nextStatus === "CANCELLED" || nextStatus === "ANNULE" || nextStatus === "ANNULÉ") {
      const shipment = sanitizeDocument(
        await getCollectionModel("shipment_preparations").findOne({ id }).lean().exec(),
      ) as Record<string, unknown> | null;
      const current = String(shipment?.status || "").toUpperCase();
      if (current === "SHIPPED" || current === "EXPEDIE" || current === "EXPÉDIÉ") {
        throw badRequest(
          "SHIPMENT_ALREADY_SHIPPED",
          "Une expédition déjà expédiée ne peut pas être annulée sans retour stock dédié.",
          { shipmentId: id },
        );
      }
    }

    const { after } = await this.cs.update({ table: "shipment_preparations", filters: [{ type: "eq", column: "id", value: id }], values: body });
    publishRealtimeDbChange({
      type: "shipment_updated",
      table: "shipment_preparations",
      action: "UPDATE",
      actorId: req.auth?.user?.id || null,
      rowIds: compactIds(id),
    });
    return { data: after[0] };
  }

  // ── Shipment Lines ────────────────────────────────────────────────────────

  @Get("shipment-lines")
  async listShipmentLines(@Query("shipment_id") shipmentId: string) {
    const filters: any[] = [];
    if (shipmentId) filters.push({ type: "eq", column: "shipment_id", value: shipmentId });
    const data = await this.cs.query({ table: "shipment_lines", filters });
    return { data };
  }

  @Post("shipment-lines")
  async createShipmentLine(@Req() req: any, @Body() body: any) {
    const data = await this.cs.insert({ table: "shipment_lines", values: body });
    publishRealtimeDbChange({
      type: "shipment_line_created",
      table: "shipment_lines",
      action: "INSERT",
      actorId: req.auth?.user?.id || null,
      rowIds: compactIds(data[0]?.id),
      relatedTables: ["shipment_preparations"],
    });
    return { data: data[0] };
  }

  @Patch("shipment-lines/:id")
  async updateShipmentLine(@Req() req: any, @Param("id") id: string, @Body() body: any) {
    const { after } = await this.cs.update({ table: "shipment_lines", filters: [{ type: "eq", column: "id", value: id }], values: body });
    publishRealtimeDbChange({
      type: "shipment_line_updated",
      table: "shipment_lines",
      action: "UPDATE",
      actorId: req.auth?.user?.id || null,
      rowIds: compactIds(id),
      relatedTables: ["shipment_preparations"],
    });
    return { data: after[0] };
  }

  @Delete("shipment-lines/:id")
  async deleteShipmentLine(@Req() req: any, @Param("id") id: string) {
    const data = await this.cs.remove({ table: "shipment_lines", filters: [{ type: "eq", column: "id", value: id }] });
    publishRealtimeDbChange({
      type: "shipment_line_deleted",
      table: "shipment_lines",
      action: "DELETE",
      actorId: req.auth?.user?.id || null,
      rowIds: compactIds(id),
      relatedTables: ["shipment_preparations"],
    });
    return { data: data[0] };
  }

  // ── Expedition (multi-table transaction) ──────────────────────────────────

  @Post("expedition")
  async expedition(@Req() req: any, @Body() body: any) {
    const { shipmentId, pickedLines, status, requestId } = body as {
      shipmentId: string;
      pickedLines: {
        lot_id: string;
        quantity: number;
        product_id?: string | null;
        scan_token?: string | null;
      }[];
      status: string;
      requestId?: string;
    };

    const lines = Array.isArray(pickedLines) ? pickedLines : [];
    const now = new Date().toISOString();
    const Lots = getCollectionModel("stock_lots");
    const Movements = getCollectionModel("stock_movements");
    const idempotencyKey = String(requestId || "").trim();

    if (idempotencyKey) {
      const requestIds = lines.map((line) => `${idempotencyKey}:${line.lot_id}`);
      const prior = sanitizeDocument(
        await Movements.find({ request_id: { $in: requestIds }, movement_type: "EXPEDITION" }).lean().exec(),
      ) as Array<{ id?: string }>;
      if (prior.length === lines.length && lines.length > 0) {
        const shipment = sanitizeDocument(
          await getCollectionModel("shipment_preparations").findOne({ id: shipmentId }).lean().exec(),
        );
        return { data: shipment, replayed: true };
      }
      if (prior.length > 0) {
        throw badRequest(
          "EXPEDITION_INCOMPLETE",
          "Une expédition précédente a enregistré une partie des mouvements. Le stock n'est pas décrémenté à nouveau.",
          { requestId: idempotencyKey, movements: prior.length, lines: lines.length },
        );
      }
    }

    const lotIds = lines.map((line) => line.lot_id).filter(Boolean);
    const existingLots = sanitizeDocument(
      await Lots.find({ id: { $in: lotIds } }).lean().exec(),
    ) as ExpeditionLot[];
    const totals = planExpeditionDecrement(lines, existingLots);
    const lotMap = new Map(existingLots.map((lot) => [String(lot.id), lot]));

    for (const line of lines) {
      await scanService.consumeMoveProof({
        token: line.scan_token,
        actorId: String(req.auth?.user?.id || ""),
        expectedStockLotId: line.lot_id,
        collection: "stock_movements",
      });
    }

    const consumed: Array<{ lotId: string; quantity: number }> = [];
    let movementIds: string[] = [];
    let movementDocs: Array<Record<string, unknown>> = [];
    let shipmentRow: Record<string, unknown> | null = null;

    const rollback = async () => {
      if (movementIds.length > 0) {
        await Movements.deleteMany({ id: { $in: movementIds } }).exec();
      }
      for (const entry of consumed.reverse()) {
        await creditStockLotKg(entry.lotId, entry.quantity, now);
      }
    };

    try {
      // Gate 2: CAS consume per lot total — concurrent picks cannot drive qty negative.
      for (const [lotId, quantity] of totals) {
        await consumeStockLotKg(lotId, quantity, now);
        consumed.push({ lotId, quantity });
      }

      movementDocs = await Promise.all(
        lines.map((line) =>
          prepareInsertDocument("stock_movements", {
            lot_id: line.lot_id,
            product_id: line.product_id ?? lotMap.get(String(line.lot_id))?.product_id ?? null,
            movement_type: "EXPEDITION",
            quantity: line.quantity,
            unit: "kg",
            movement_date: now,
            request_id: idempotencyKey ? `${idempotencyKey}:${line.lot_id}` : null,
            scan_token: line.scan_token || null,
            scan_verified: Boolean(line.scan_token),
            movement_source: "OPERATOR",
            document_type: "SHIPMENT",
            document_reference: shipmentId,
            shipment_id: shipmentId,
          }),
        ),
      );
      movementIds = movementDocs.map((doc) => String(doc.id || "")).filter(Boolean);
      if (movementDocs.length > 0) await Movements.insertMany(movementDocs);

      const { after } = await this.cs.update({
        table: "shipment_preparations",
        filters: [{ type: "eq", column: "id", value: shipmentId }],
        values: { status },
      });
      shipmentRow = (after?.[0] as Record<string, unknown> | undefined) ?? null;
    } catch (error) {
      await rollback();
      throw error;
    }

    publishRealtimeDbChange({
      type: "stock_expedition",
      table: "stock_movements",
      action: "INSERT",
      actorId: req.auth?.user?.id || null,
      rowIds: compactIds(...movementDocs.map((doc) => doc.id), shipmentId, ...lotIds),
      relatedTables: ["stock_lots", "stock_summary", "shipment_preparations"],
    });

    try {
      await autoReorderOnStockChange(
        lines.map((line) => lotMap.get(line.lot_id)?.product_id ?? line.product_id ?? null),
        req.auth?.user?.id || null,
      );
    } catch (error) {
      console.error("[Stock] threshold reorder after expedition failed:", error);
    }

    return { data: shipmentRow, replayed: false };
  }
}
