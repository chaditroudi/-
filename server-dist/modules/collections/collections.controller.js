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
import { Body, Controller, Post, Req, UseGuards } from "@nestjs/common";
import { appendActionAudit } from "../../middleware/security-audit.js";
import { DbAction } from "../../nest/route-metadata.js";
import { DbActionGuard, RequireAuthGuard } from "../../nest/route-guards.js";
import { publishRealtimeDbChange } from "../realtime/realtime.bus.js";
import { CollectionsService } from "./collections.service.js";
const readRowIds = (rows) => rows.map((row) => String(row?.id || "")).filter(Boolean);
const relatedTablesByTable = {
    reception_lots: ["receptions_v2", "stock_lots", "stock_summary"],
    reception_units: ["reception_lots", "receptions_v2"],
    qc_inspections: ["receptions_v2", "reception_lots", "reception_units", "stock_lots", "stock_summary"],
    qc_check_results: ["qc_inspections"],
    stock_lots: ["stock_summary"],
    stock_movements: ["stock_lots", "stock_summary"],
    storage_zones: ["module3-storage-zones"],
    storage_locations: ["stock_locations", "module3-storage-locations"],
    storage_location_movements: ["stock_movements", "stock_lots", "stock_summary"],
    storage_condition_readings: ["module3-storage-readings", "storage_zones"],
    storage_door_events: ["module3-storage-door-events", "storage_zones"],
    suppliers: ["receptions_v2"],
    purchase_orders: ["purchasing_stats"],
    purchase_requisitions: ["purchasing_stats"],
    system_notifications: ["notifications"],
    reception_alerts: ["alerts", "notifications"],
};
const publishCollectionChange = (table, action, rows, actorId, before) => {
    publishRealtimeDbChange({
        table,
        action,
        actorId,
        rowIds: readRowIds(rows),
        rows,
        before,
        relatedTables: relatedTablesByTable[table] || [],
    });
};
let CollectionsController = class CollectionsController {
    collectionsService;
    constructor(collectionsService) {
        this.collectionsService = collectionsService;
    }
    async query(body) {
        const data = await this.collectionsService.query(body || {});
        return { data };
    }
    async insert(req, body) {
        const actorId = req.auth?.user?.id || null;
        const table = String(body?.table || "");
        const data = await this.collectionsService.insert({ ...(body || {}), actorId });
        publishCollectionChange(table, "INSERT", data, actorId);
        appendActionAudit(req, "INSERT", table, data).catch(() => { });
        return { data };
    }
    async update(req, body) {
        const actorId = req.auth?.user?.id || null;
        const table = String(body?.table || "");
        const result = await this.collectionsService.update({ ...(body || {}), actorId });
        publishCollectionChange(table, "UPDATE", result.after, actorId, result.before);
        appendActionAudit(req, "UPDATE", table, result.after, result.before).catch(() => { });
        return { data: result.after, before: result.before };
    }
    async remove(req, body) {
        const table = String(body?.table || "");
        const data = await this.collectionsService.remove(body || {});
        publishCollectionChange(table, "DELETE", data, req.auth?.user?.id || null);
        appendActionAudit(req, "DELETE", table, data).catch(() => { });
        return { data };
    }
};
__decorate([
    Post("query"),
    DbAction("read"),
    __param(0, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], CollectionsController.prototype, "query", null);
__decorate([
    Post("insert"),
    DbAction("write"),
    __param(0, Req()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], CollectionsController.prototype, "insert", null);
__decorate([
    Post("update"),
    DbAction("write"),
    __param(0, Req()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], CollectionsController.prototype, "update", null);
__decorate([
    Post("delete"),
    DbAction("write"),
    __param(0, Req()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], CollectionsController.prototype, "remove", null);
CollectionsController = __decorate([
    Controller("api/db"),
    UseGuards(RequireAuthGuard, DbActionGuard),
    __metadata("design:paramtypes", [CollectionsService])
], CollectionsController);
export { CollectionsController };
