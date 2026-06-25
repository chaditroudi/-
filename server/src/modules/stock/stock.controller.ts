import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { RequireAuthGuard } from "../../nest/route-guards.js";
import { getCollectionModel, sanitizeDocument } from "../../db/dynamic-model.js";
import { prepareInsertDocument } from "../../db/defaults.js";
import { CollectionsService } from "../collections/collections.service.js";

@Controller("api/stock")
@UseGuards(RequireAuthGuard)
export class StockController {
  constructor(private readonly cs: CollectionsService) {}

  // ── Summary ───────────────────────────────────────────────────────────────
  // Reads reception_lots (always populated) instead of the separate stock_lots
  // collection which requires an explicit sync step.

  @Get("summary")
  async getStockSummary() {
    const cutoff48h = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

    const rawLots = await getCollectionModel("reception_lots")
      .find({ stock_status: { $in: ["EN_QUARANTAINE", "STOCK_LIBERE", "STOCK_REJETE"] } })
      .lean()
      .exec();

    const lots = sanitizeDocument(rawLots) as Record<string, unknown>[];

    type CatStat = { total: number; inQuarantine: number; alertsMin: number; alertsSecurity: number };
    const summary: Record<string, CatStat> = {
      MP:  { total: 0, inQuarantine: 0, alertsMin: 0, alertsSecurity: 0 },
      WIP: { total: 0, inQuarantine: 0, alertsMin: 0, alertsSecurity: 0 },
      PF:  { total: 0, inQuarantine: 0, alertsMin: 0, alertsSecurity: 0 },
      EMB: { total: 0, inQuarantine: 0, alertsMin: 0, alertsSecurity: 0 },
    };

    for (const lot of lots) {
      const qty = Number(lot.quantity ?? 0);
      const status = String(lot.stock_status ?? "");
      const createdAt = String(lot.created_at ?? "");

      if (status === "STOCK_LIBERE") {
        summary.MP.total += qty;
      } else if (status === "EN_QUARANTAINE") {
        summary.MP.inQuarantine += qty;
        // Lots stuck in quarantine > 48 h → min-stock warning
        if (createdAt && createdAt < cutoff48h) summary.MP.alertsMin++;
      } else if (status === "STOCK_REJETE") {
        // Rejected lots still present → security alert
        summary.MP.alertsSecurity++;
      }
    }

    return { data: summary };
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
  async createProduct(@Body() body: any) {
    const data = await this.cs.insert({ table: "products", values: body });
    return { data: data[0] };
  }

  @Patch("products/:id")
  async updateProduct(@Param("id") id: string, @Body() body: any) {
    const { after } = await this.cs.update({ table: "products", filters: [{ type: "eq", column: "id", value: id }], values: body });
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
  async createLot(@Body() body: any) {
    const data = await this.cs.insert({ table: "stock_lots", values: body });
    return { data: data[0] };
  }

  @Patch("lots/:id")
  async updateLot(@Param("id") id: string, @Body() body: any) {
    const { after } = await this.cs.update({ table: "stock_lots", filters: [{ type: "eq", column: "id", value: id }], values: body });
    return { data: after[0] };
  }

  // ── Locations ─────────────────────────────────────────────────────────────

  @Get("locations")
  async listLocations() {
    const data = await this.cs.query({ table: "stock_locations", filters: [], orderBy: { column: "code", ascending: true } });
    return { data };
  }

  @Patch("locations/:id")
  async updateLocation(@Param("id") id: string, @Body() body: any) {
    const { after } = await this.cs.update({ table: "stock_locations", filters: [{ type: "eq", column: "id", value: id }], values: body });
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
  async createMovement(@Body() body: any) {
    const data = await this.cs.insert({ table: "stock_movements", values: body });
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
  async updateAlert(@Param("id") id: string, @Body() body: any) {
    const { after } = await this.cs.update({ table: "stock_alerts", filters: [{ type: "eq", column: "id", value: id }], values: body });
    return { data: after[0] };
  }

  // ── Inventory Counts ──────────────────────────────────────────────────────

  @Get("inventory-counts")
  async listInventoryCounts() {
    const data = await this.cs.query({ table: "inventory_counts", filters: [], orderBy: { column: "created_at", ascending: false } });
    return { data };
  }

  @Post("inventory-counts")
  async createInventoryCount(@Body() body: any) {
    const data = await this.cs.insert({ table: "inventory_counts", values: body });
    return { data: data[0] };
  }

  // ── Shipment Preparations ─────────────────────────────────────────────────

  @Get("shipments")
  async listShipments() {
    const data = await this.cs.query({ table: "shipment_preparations", filters: [], orderBy: { column: "created_at", ascending: false } });
    return { data };
  }

  @Post("shipments")
  async createShipment(@Body() body: any) {
    const data = await this.cs.insert({ table: "shipment_preparations", values: body });
    return { data: data[0] };
  }

  @Patch("shipments/:id")
  async updateShipment(@Param("id") id: string, @Body() body: any) {
    const { after } = await this.cs.update({ table: "shipment_preparations", filters: [{ type: "eq", column: "id", value: id }], values: body });
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
  async createShipmentLine(@Body() body: any) {
    const data = await this.cs.insert({ table: "shipment_lines", values: body });
    return { data: data[0] };
  }

  @Patch("shipment-lines/:id")
  async updateShipmentLine(@Param("id") id: string, @Body() body: any) {
    const { after } = await this.cs.update({ table: "shipment_lines", filters: [{ type: "eq", column: "id", value: id }], values: body });
    return { data: after[0] };
  }

  @Delete("shipment-lines/:id")
  async deleteShipmentLine(@Param("id") id: string) {
    const data = await this.cs.remove({ table: "shipment_lines", filters: [{ type: "eq", column: "id", value: id }] });
    return { data: data[0] };
  }

  // ── Expedition (multi-table transaction) ──────────────────────────────────

  @Post("expedition")
  async expedition(@Body() body: any) {
    const { shipmentId, pickedLines, status } = body as {
      shipmentId: string;
      pickedLines: { lot_id: string; quantity: number; product_id?: string | null }[];
      status: string;
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
        }),
      ),
    );
    if (movementDocs.length > 0) await Movements.insertMany(movementDocs);

    const { after } = await this.cs.update({
      table: "shipment_preparations",
      filters: [{ type: "eq", column: "id", value: shipmentId }],
      values: { status },
    });

    return { data: after[0] };
  }
}
