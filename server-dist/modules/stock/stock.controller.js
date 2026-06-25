var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { RequireAuthGuard } from "../../nest/route-guards.js";
import { getCollectionModel, sanitizeDocument } from "../../db/dynamic-model.js";
import { prepareInsertDocument } from "../../db/defaults.js";
import { CollectionsService } from "../collections/collections.service.js";
let StockController = class StockController {
    cs;
    constructor(cs) {
        this.cs = cs;
    }
    // ── Summary ───────────────────────────────────────────────────────────────
    // Reads reception_lots (always populated) instead of the separate stock_lots
    // collection which requires an explicit sync step.
    async getStockSummary() {
        const cutoff48h = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
        const rawLots = await getCollectionModel("reception_lots")
            .find({ stock_status: { $in: ["EN_QUARANTAINE", "STOCK_LIBERE", "STOCK_REJETE"] } })
            .lean()
            .exec();
        const lots = sanitizeDocument(rawLots);
        const summary = {
            MP: { total: 0, inQuarantine: 0, alertsMin: 0, alertsSecurity: 0 },
            WIP: { total: 0, inQuarantine: 0, alertsMin: 0, alertsSecurity: 0 },
            PF: { total: 0, inQuarantine: 0, alertsMin: 0, alertsSecurity: 0 },
            EMB: { total: 0, inQuarantine: 0, alertsMin: 0, alertsSecurity: 0 },
        };
        for (const lot of lots) {
            const qty = Number(lot.quantity ?? 0);
            const status = String(lot.stock_status ?? "");
            const createdAt = String(lot.created_at ?? "");
            if (status === "STOCK_LIBERE") {
                summary.MP.total += qty;
            }
            else if (status === "EN_QUARANTAINE") {
                summary.MP.inQuarantine += qty;
                // Lots stuck in quarantine > 48 h → min-stock warning
                if (createdAt && createdAt < cutoff48h)
                    summary.MP.alertsMin++;
            }
            else if (status === "STOCK_REJETE") {
                // Rejected lots still present → security alert
                summary.MP.alertsSecurity++;
            }
        }
        return { data: summary };
    }
    // ── Reception Lots (unified view across all receptions) ──────────────────
    async listAllReceptionLots(stockStatus, variety) {
        const filters = [];
        if (stockStatus)
            filters.push({ type: "eq", column: "stock_status", value: stockStatus });
        if (variety)
            filters.push({ type: "eq", column: "variety", value: variety });
        const data = await this.cs.query({
            table: "reception_lots",
            filters,
            orderBy: { column: "created_at", ascending: false },
        });
        return { data };
    }
    // ── Products ──────────────────────────────────────────────────────────────
    async listProducts() {
        const data = await this.cs.query({ table: "products", filters: [], orderBy: { column: "name", ascending: true } });
        return { data };
    }
    async createProduct(body) {
        const data = await this.cs.insert({ table: "products", values: body });
        return { data: data[0] };
    }
    async updateProduct(id, body) {
        const { after } = await this.cs.update({ table: "products", filters: [{ type: "eq", column: "id", value: id }], values: body });
        return { data: after[0] };
    }
    // ── Stock Lots ────────────────────────────────────────────────────────────
    async listLots(status) {
        const filters = [];
        if (status)
            filters.push({ type: "eq", column: "status", value: status });
        const data = await this.cs.query({ table: "stock_lots", filters, orderBy: { column: "created_at", ascending: false } });
        return { data };
    }
    async createLot(body) {
        const data = await this.cs.insert({ table: "stock_lots", values: body });
        return { data: data[0] };
    }
    async updateLot(id, body) {
        const { after } = await this.cs.update({ table: "stock_lots", filters: [{ type: "eq", column: "id", value: id }], values: body });
        return { data: after[0] };
    }
    // ── Locations ─────────────────────────────────────────────────────────────
    async listLocations() {
        const data = await this.cs.query({ table: "stock_locations", filters: [], orderBy: { column: "code", ascending: true } });
        return { data };
    }
    async updateLocation(id, body) {
        const { after } = await this.cs.update({ table: "stock_locations", filters: [{ type: "eq", column: "id", value: id }], values: body });
        return { data: after[0] };
    }
    // ── Movements ─────────────────────────────────────────────────────────────
    async listMovements(lotId) {
        const filters = [];
        if (lotId)
            filters.push({ type: "eq", column: "lot_id", value: lotId });
        const data = await this.cs.query({ table: "stock_movements", filters, orderBy: { column: "movement_date", ascending: false } });
        return { data };
    }
    async createMovement(body) {
        const data = await this.cs.insert({ table: "stock_movements", values: body });
        return { data: data[0] };
    }
    // ── Alerts ────────────────────────────────────────────────────────────────
    // Static alerts from stock_alerts + dynamic alerts derived from reception_lots.
    async listAlerts(status) {
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
        const rejected = sanitizeDocument(rawRejected);
        const stale = sanitizeDocument(rawStale);
        const dynamic = [];
        for (const lot of rejected) {
            dynamic.push({
                id: `dyn-rej-${lot.id}`,
                title: `Lot rejeté : ${lot.lot_internal ?? lot.id}`,
                message: lot.quarantine_reason ?? "Lot rejeté lors du contrôle qualité",
                severity: "critical",
                status: "active",
                entity_type: "reception_lot",
                entity_id: lot.id,
                created_at: lot.updated_at ?? lot.created_at,
            });
        }
        if (stale.length > 0) {
            dynamic.push({
                id: "dyn-quarantine-stale",
                title: `${stale.length} lot(s) bloqués en quarantaine > 48 h`,
                message: stale.map((l) => l.lot_internal ?? l.id).join(", "),
                severity: "warning",
                status: "active",
                entity_type: "reception_lot",
                created_at: stale[0]?.created_at,
            });
        }
        const all = [...staticAlerts, ...dynamic];
        const filtered = status ? all.filter((a) => a.status === status) : all;
        return { data: filtered };
    }
    async updateAlert(id, body) {
        const { after } = await this.cs.update({ table: "stock_alerts", filters: [{ type: "eq", column: "id", value: id }], values: body });
        return { data: after[0] };
    }
    // ── Inventory Counts ──────────────────────────────────────────────────────
    async listInventoryCounts() {
        const data = await this.cs.query({ table: "inventory_counts", filters: [], orderBy: { column: "created_at", ascending: false } });
        return { data };
    }
    async createInventoryCount(body) {
        const data = await this.cs.insert({ table: "inventory_counts", values: body });
        return { data: data[0] };
    }
    // ── Shipment Preparations ─────────────────────────────────────────────────
    async listShipments() {
        const data = await this.cs.query({ table: "shipment_preparations", filters: [], orderBy: { column: "created_at", ascending: false } });
        return { data };
    }
    async createShipment(body) {
        const data = await this.cs.insert({ table: "shipment_preparations", values: body });
        return { data: data[0] };
    }
    async updateShipment(id, body) {
        const { after } = await this.cs.update({ table: "shipment_preparations", filters: [{ type: "eq", column: "id", value: id }], values: body });
        return { data: after[0] };
    }
    // ── Shipment Lines ────────────────────────────────────────────────────────
    async listShipmentLines(shipmentId) {
        const filters = [];
        if (shipmentId)
            filters.push({ type: "eq", column: "shipment_id", value: shipmentId });
        const data = await this.cs.query({ table: "shipment_lines", filters });
        return { data };
    }
    async createShipmentLine(body) {
        const data = await this.cs.insert({ table: "shipment_lines", values: body });
        return { data: data[0] };
    }
    async updateShipmentLine(id, body) {
        const { after } = await this.cs.update({ table: "shipment_lines", filters: [{ type: "eq", column: "id", value: id }], values: body });
        return { data: after[0] };
    }
    async deleteShipmentLine(id) {
        const data = await this.cs.remove({ table: "shipment_lines", filters: [{ type: "eq", column: "id", value: id }] });
        return { data: data[0] };
    }
    // ── Expedition (multi-table transaction) ──────────────────────────────────
    async expedition(body) {
        const { shipmentId, pickedLines, status } = body;
        const now = new Date().toISOString();
        const Lots = getCollectionModel("stock_lots");
        const Movements = getCollectionModel("stock_movements");
        const lotIds = pickedLines.map((l) => l.lot_id).filter(Boolean);
        const existingLots = sanitizeDocument(await Lots.find({ id: { $in: lotIds } })
            .lean()
            .exec());
        const lotMap = new Map(existingLots.map((l) => [l.id, l]));
        for (const line of pickedLines) {
            const lot = lotMap.get(line.lot_id);
            if (!lot)
                continue;
            if (lot.status !== "VALIDATED") {
                throw new Error(`Le lot ${lot.lot_number ?? line.lot_id} n'est pas libéré (statut: ${lot.status}).`);
            }
            const newQty = Math.max(0, Number(lot.current_quantity) - Number(line.quantity));
            await Lots.updateOne({ id: line.lot_id }, { $set: { current_quantity: newQty, ...(newQty <= 0 ? { status: "CONSUMED" } : {}), updated_at: now } }).exec();
        }
        const movementDocs = await Promise.all(pickedLines.map((line) => prepareInsertDocument("stock_movements", {
            lot_id: line.lot_id,
            product_id: line.product_id ?? lotMap.get(line.lot_id)?.product_id ?? null,
            movement_type: "EXPEDITION",
            quantity: line.quantity,
            unit: "kg",
            movement_date: now,
        })));
        if (movementDocs.length > 0)
            await Movements.insertMany(movementDocs);
        const { after } = await this.cs.update({
            table: "shipment_preparations",
            filters: [{ type: "eq", column: "id", value: shipmentId }],
            values: { status },
        });
        return { data: after[0] };
    }
};
__decorate([
    Get("summary"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], StockController.prototype, "getStockSummary", null);
__decorate([
    Get("reception-lots"),
    __param(0, Query("stock_status")),
    __param(1, Query("variety")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], StockController.prototype, "listAllReceptionLots", null);
__decorate([
    Get("products"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], StockController.prototype, "listProducts", null);
__decorate([
    Post("products"),
    __param(0, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], StockController.prototype, "createProduct", null);
__decorate([
    Patch("products/:id"),
    __param(0, Param("id")),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], StockController.prototype, "updateProduct", null);
__decorate([
    Get("lots"),
    __param(0, Query("status")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], StockController.prototype, "listLots", null);
__decorate([
    Post("lots"),
    __param(0, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], StockController.prototype, "createLot", null);
__decorate([
    Patch("lots/:id"),
    __param(0, Param("id")),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], StockController.prototype, "updateLot", null);
__decorate([
    Get("locations"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], StockController.prototype, "listLocations", null);
__decorate([
    Patch("locations/:id"),
    __param(0, Param("id")),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], StockController.prototype, "updateLocation", null);
__decorate([
    Get("movements"),
    __param(0, Query("lot_id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], StockController.prototype, "listMovements", null);
__decorate([
    Post("movements"),
    __param(0, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], StockController.prototype, "createMovement", null);
__decorate([
    Get("alerts"),
    __param(0, Query("status")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], StockController.prototype, "listAlerts", null);
__decorate([
    Patch("alerts/:id"),
    __param(0, Param("id")),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], StockController.prototype, "updateAlert", null);
__decorate([
    Get("inventory-counts"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], StockController.prototype, "listInventoryCounts", null);
__decorate([
    Post("inventory-counts"),
    __param(0, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], StockController.prototype, "createInventoryCount", null);
__decorate([
    Get("shipments"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], StockController.prototype, "listShipments", null);
__decorate([
    Post("shipments"),
    __param(0, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], StockController.prototype, "createShipment", null);
__decorate([
    Patch("shipments/:id"),
    __param(0, Param("id")),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], StockController.prototype, "updateShipment", null);
__decorate([
    Get("shipment-lines"),
    __param(0, Query("shipment_id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], StockController.prototype, "listShipmentLines", null);
__decorate([
    Post("shipment-lines"),
    __param(0, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], StockController.prototype, "createShipmentLine", null);
__decorate([
    Patch("shipment-lines/:id"),
    __param(0, Param("id")),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], StockController.prototype, "updateShipmentLine", null);
__decorate([
    Delete("shipment-lines/:id"),
    __param(0, Param("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], StockController.prototype, "deleteShipmentLine", null);
__decorate([
    Post("expedition"),
    __param(0, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], StockController.prototype, "expedition", null);
StockController = __decorate([
    Controller("api/stock"),
    UseGuards(RequireAuthGuard),
    __metadata("design:paramtypes", [CollectionsService])
], StockController);
export { StockController };
