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
import { Body, Controller, Get, HttpCode, Post, Query, Req, UseGuards } from "@nestjs/common";
import { Roles } from "../../nest/route-metadata.js";
import { RequireAuthGuard, RolesGuard } from "../../nest/route-guards.js";
import { publishRealtimeDbChange } from "../realtime/realtime.bus.js";
import { StorageService } from "./storage.service.js";
const STORAGE_ROLES = [
    "responsable_stock", "magasinier_wms", "responsable_logistique",
    "responsable_reception", "chef_reception", "operateur_reception",
    "responsable_maintenance", "technicien_maintenance",
];
const compactIds = (...values) => values.flat().map((value) => String(value || "")).filter(Boolean);
const publishRows = (rows, table, action, actorId, type, relatedTables) => {
    if (!Array.isArray(rows) || rows.length === 0)
        return;
    publishRealtimeDbChange({
        type,
        table,
        action,
        actorId,
        rows,
        rowIds: compactIds(rows.map((row) => row?.id)),
        relatedTables,
    });
};
let StorageController = class StorageController {
    storageService;
    constructor(storageService) {
        this.storageService = storageService;
    }
    async listModule3Zones() {
        return { data: await this.storageService.listModule3Zones() };
    }
    async listModule3Locations(storageZoneId) {
        return { data: await this.storageService.listModule3Locations(storageZoneId ? String(storageZoneId) : undefined) };
    }
    async listStorageReadings(limit) {
        return { data: await this.storageService.listStorageConditionReadings(limit ? Number(limit) : undefined) };
    }
    async listStorageLocationMovements(limit) {
        return { data: await this.storageService.listStorageLocationMovements(limit ? Number(limit) : undefined) };
    }
    async listStorageDoorEvents(limit) {
        return { data: await this.storageService.listStorageDoorEvents(limit ? Number(limit) : undefined) };
    }
    async listStorageDlcAlerts(limit) {
        return { data: await this.storageService.listStorageDlcAlerts(limit ? Number(limit) : undefined) };
    }
    async seedModule3() {
        const data = await this.storageService.seedModule3();
        publishRealtimeDbChange({
            type: "storage_seeded",
            table: "storage_zones",
            action: "SYNC",
            relatedTables: ["storage_locations", "module3-storage-zones", "module3-storage-locations"],
        });
        return { data };
    }
    async recordReading(req, body) {
        const data = await this.storageService.recordReading(body || {}, req.auth?.user || null);
        publishRealtimeDbChange({
            type: "storage_reading",
            table: "storage_condition_readings",
            action: "INSERT",
            rows: [data?.reading].filter(Boolean),
            rowIds: compactIds(data?.reading?.id),
            relatedTables: ["storage_zones", "module3-storage-readings", "alerts", "system_notifications"],
        });
        publishRows(data?.alerts || [], "alerts", "INSERT", req.auth?.user?.id || null, "storage_alert_created", ["system_notifications"]);
        publishRows(data?.notifications || [], "system_notifications", "INSERT", req.auth?.user?.id || null, "storage_notification_created");
        return { data };
    }
    async recordDoorEvent(req, body) {
        const data = await this.storageService.recordDoorEvent(body || {}, req.auth?.user || null);
        publishRealtimeDbChange({
            type: "storage_door_event",
            table: "storage_door_events",
            action: "INSERT",
            rows: [data?.event].filter(Boolean),
            rowIds: compactIds(data?.event?.id),
            relatedTables: ["storage_zones", "module3-storage-door-events", "alerts", "system_notifications"],
        });
        publishRows(data?.alerts || [], "alerts", "INSERT", req.auth?.user?.id || null, "storage_alert_created", ["system_notifications"]);
        publishRows(data?.notifications || [], "system_notifications", "INSERT", req.auth?.user?.id || null, "storage_notification_created");
        return { data };
    }
    async suggestLocation(body) {
        const data = await this.storageService.suggestLocation(body || {});
        return { data };
    }
    async suggestFefo(body) {
        const data = await this.storageService.suggestFefo(body || {});
        return { data };
    }
    async evaluateBusinessRules() {
        const data = await this.storageService.evaluateBusinessRules();
        publishRealtimeDbChange({
            type: "storage_rules_evaluated",
            table: "alerts",
            action: "SYNC",
            relatedTables: ["stock_lots", "stock_summary", "alerts", "system_notifications", "storage_cycle_counts"],
        });
        publishRows(data?.alerts || [], "alerts", "INSERT", null, "storage_alert_created", ["system_notifications"]);
        publishRows(data?.notifications || [], "system_notifications", "INSERT", null, "storage_notification_created");
        publishRows(data?.cycleCounts || [], "storage_cycle_counts", "INSERT", null, "storage_cycle_count_created");
        return { data };
    }
    async moveStock(req, body) {
        const data = await this.storageService.moveStock(body || {}, req.auth?.user || null);
        publishRealtimeDbChange({
            type: "stock_moved",
            table: "stock_movements",
            action: "INSERT",
            rows: [data?.movement].filter(Boolean),
            rowIds: compactIds(data?.movement?.id),
            relatedTables: ["stock_lots", "stock_locations", "stock_summary", "storage_location_movements", "module3-storage-location-movements", "alerts", "system_notifications"],
        });
        publishRows(data?.alerts || [], "alerts", "INSERT", req.auth?.user?.id || null, "storage_alert_created", ["system_notifications"]);
        publishRows(data?.notifications || [], "system_notifications", "INSERT", req.auth?.user?.id || null, "storage_notification_created");
        return { data };
    }
};
__decorate([
    Get("module3/zones"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], StorageController.prototype, "listModule3Zones", null);
__decorate([
    Get("module3/locations"),
    __param(0, Query("storageZoneId")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], StorageController.prototype, "listModule3Locations", null);
__decorate([
    Get("module3/readings"),
    __param(0, Query("limit")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], StorageController.prototype, "listStorageReadings", null);
__decorate([
    Get("module3/location-movements"),
    __param(0, Query("limit")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], StorageController.prototype, "listStorageLocationMovements", null);
__decorate([
    Get("module3/door-events"),
    __param(0, Query("limit")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], StorageController.prototype, "listStorageDoorEvents", null);
__decorate([
    Get("module3/dlc-alerts"),
    __param(0, Query("limit")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], StorageController.prototype, "listStorageDlcAlerts", null);
__decorate([
    Post("module3/seed"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], StorageController.prototype, "seedModule3", null);
__decorate([
    Post("readings"),
    HttpCode(201),
    __param(0, Req()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], StorageController.prototype, "recordReading", null);
__decorate([
    Post("door-events"),
    HttpCode(201),
    __param(0, Req()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], StorageController.prototype, "recordDoorEvent", null);
__decorate([
    Post("suggest-location"),
    __param(0, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], StorageController.prototype, "suggestLocation", null);
__decorate([
    Post("suggest-fefo"),
    __param(0, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], StorageController.prototype, "suggestFefo", null);
__decorate([
    Post("rules/evaluate"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], StorageController.prototype, "evaluateBusinessRules", null);
__decorate([
    Post("move"),
    __param(0, Req()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], StorageController.prototype, "moveStock", null);
StorageController = __decorate([
    Controller("api/storage"),
    UseGuards(RequireAuthGuard, RolesGuard),
    Roles(...STORAGE_ROLES),
    __metadata("design:paramtypes", [StorageService])
], StorageController);
export { StorageController };
