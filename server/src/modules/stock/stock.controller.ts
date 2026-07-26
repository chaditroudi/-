import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { Roles } from "../../nest/route-metadata.js";
import { RequireAuthGuard, RolesGuard } from "../../nest/route-guards.js";
import { getCollectionModel, sanitizeDocument } from "../../db/dynamic-model.js";
import { prepareInsertDocument } from "../../db/defaults.js";
import { CollectionsService } from "../collections/collections.service.js";
import { publishRealtimeDbChange } from "../realtime/realtime.bus.js";
import { scanService } from "../trust/scan.service.js";

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
      rows: [data[0]].filter(Boolean),
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
      rows: [after[0]].filter(Boolean),
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
      rows: [data[0]].filter(Boolean),
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
      rows: [after[0]].filter(Boolean),
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
      rows: [after[0]].filter(Boolean),
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
  async createMovement(@Req() req: any, @Body() body: any) {
    const requestId = String(body?.request_id || body?.requestId || "").trim();
    if (requestId) {
      const existing = await this.cs.query({
        table: "stock_movements",
        filters: [{ type: "eq", column: "request_id", value: requestId }],
        limit: 1,
      });
      if (existing[0]) return { data: existing[0], meta: { replayed: true } };
      body.request_id = requestId;
    }
    await scanService.consumeMoveProof({
      token: body?.scan_proof?.lotToken || body?.scanProof?.lotToken,
      actorId: String(req.auth?.user?.id || ""),
      expectedStockLotId: String(body?.lot_id || ""),
      collection: "stock_movements",
    });
    const data = await this.cs.insert({
      table: "stock_movements",
      values: body,
      actorId: req.auth?.user?.id || null,
      trustedInternal: true,
    });
    publishRealtimeDbChange({
      type: "stock_movement_created",
      table: "stock_movements",
      action: "INSERT",
      actorId: req.auth?.user?.id || null,
      rows: [data[0]].filter(Boolean),
      rowIds: compactIds(data[0]?.id),
      relatedTables: ["stock_lots", "stock_summary"],
    });
    return { data: data[0] };
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
      rows: [after[0]].filter(Boolean),
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
    const data = await this.cs.insert({ table: "inventory_counts", values: body });
    publishRealtimeDbChange({
      type: "inventory_count_created",
      table: "inventory_counts",
      action: "INSERT",
      actorId: req.auth?.user?.id || null,
      rows: [data[0]].filter(Boolean),
      rowIds: compactIds(data[0]?.id),
    });
    return { data: data[0] };
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
      rows: [data[0]].filter(Boolean),
      rowIds: compactIds(data[0]?.id),
    });
    return { data: data[0] };
  }

  @Patch("shipments/:id")
  async updateShipment(@Req() req: any, @Param("id") id: string, @Body() body: any) {
    const { after } = await this.cs.update({ table: "shipment_preparations", filters: [{ type: "eq", column: "id", value: id }], values: body });
    publishRealtimeDbChange({
      type: "shipment_updated",
      table: "shipment_preparations",
      action: "UPDATE",
      actorId: req.auth?.user?.id || null,
      rows: [after[0]].filter(Boolean),
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
      rows: [data[0]].filter(Boolean),
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
      rows: [after[0]].filter(Boolean),
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
      rows: [data[0]].filter(Boolean),
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

    const now = new Date().toISOString();
    const Lots = getCollectionModel("stock_lots");
    const Movements = getCollectionModel("stock_movements");

    const lotIds = pickedLines.map((l) => l.lot_id).filter(Boolean);
    const existingLots = sanitizeDocument(
      await Lots.find({ id: { $in: lotIds } })
        .lean()
        .exec(),
    ) as any[];
    const lotMap = new Map(existingLots.map((l) => [l.id, l]));

    for (const line of pickedLines) {
      const lot = lotMap.get(line.lot_id);
      if (!lot) continue;
      if (lot.status !== "VALIDATED") {
        throw new Error(`Le lot ${lot.lot_number ?? line.lot_id} n'est pas libéré (statut: ${lot.status}).`);
      }
    }

    for (const line of pickedLines) {
      await scanService.consumeMoveProof({
        token: line.scan_token,
        actorId: String(req.auth?.user?.id || ""),
        expectedStockLotId: line.lot_id,
        collection: "stock_movements",
      });
    }

    for (const line of pickedLines) {
      const lot = lotMap.get(line.lot_id);
      if (!lot) continue;
      const newQty = Math.max(0, Number(lot.current_quantity) - Number(line.quantity));
      await Lots.updateOne(
        { id: line.lot_id },
        { $set: { current_quantity: newQty, ...(newQty <= 0 ? { status: "CONSUMED" } : {}), updated_at: now } },
      ).exec();
    }

    const movementDocs = await Promise.all(
      pickedLines.map((line) =>
        prepareInsertDocument("stock_movements", {
          lot_id: line.lot_id,
          product_id: line.product_id ?? lotMap.get(line.lot_id)?.product_id ?? null,
          movement_type: "EXPEDITION",
          quantity: line.quantity,
          unit: "kg",
          movement_date: now,
          request_id: requestId ? `${requestId}:${line.lot_id}` : null,
          scan_token: line.scan_token || null,
          scan_verified: Boolean(line.scan_token),
          movement_source: "OPERATOR",
        }),
      ),
    );
    if (movementDocs.length > 0) await Movements.insertMany(movementDocs);

    const { after } = await this.cs.update({
      table: "shipment_preparations",
      filters: [{ type: "eq", column: "id", value: shipmentId }],
      values: { status },
    });

    publishRealtimeDbChange({
      type: "stock_expedition",
      table: "stock_movements",
      action: "INSERT",
      actorId: req.auth?.user?.id || null,
      rows: movementDocs,
      rowIds: compactIds(...movementDocs.map((doc) => doc.id), shipmentId, ...lotIds),
      relatedTables: ["stock_lots", "stock_summary", "shipment_preparations"],
    });

    return { data: after[0] };
  }
}
