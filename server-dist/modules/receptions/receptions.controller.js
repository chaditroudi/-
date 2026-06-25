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
import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query, Req, UseGuards, } from "@nestjs/common";
import { Roles } from "../../nest/route-metadata.js";
import { RequireAuthGuard, RolesGuard } from "../../nest/route-guards.js";
import { publishRealtimeDbChange } from "../realtime/realtime.bus.js";
import { ReceptionsService } from "./receptions.service.js";
const RECEPTION_READ_ROLES = [
    "responsable_reception", "chef_reception", "operateur_reception",
    "responsable_qualite", "inspecteur_qualite", "responsable_stock", "magasinier_wms",
];
const RECEPTION_WRITE_ROLES = [
    "responsable_reception", "chef_reception", "operateur_reception", "responsable_qualite",
];
const QUALITY_ROLES = [
    "responsable_qualite", "inspecteur_qualite", "resp_management_qualite", "resp_qualite_haccp",
];
const STORAGE_MOVE_ROLES = [
    ...RECEPTION_WRITE_ROLES, "responsable_stock", "magasinier_wms", "responsable_logistique",
];
const compactIds = (...values) => values.map((value) => String(value || "")).filter(Boolean);
let ReceptionsController = class ReceptionsController {
    receptionsService;
    constructor(receptionsService) {
        this.receptionsService = receptionsService;
    }
    async list() {
        const data = await this.receptionsService.listReceptions();
        return { data };
    }
    async rawStorageOverdue() {
        const data = await this.receptionsService.listRawStorageOverdueReceptions();
        return { data };
    }
    async detail(receptionId) {
        const data = await this.receptionsService.getReceptionById(receptionId);
        return { data };
    }
    async listLots(receptionId) {
        const data = await this.receptionsService.listReceptionLots(receptionId);
        return { data };
    }
    async listQcInspections(receptionId) {
        const data = await this.receptionsService.listQcInspections(receptionId);
        return { data };
    }
    async listQcChecklists(receptionType) {
        const data = await this.receptionsService.listQcChecklists(receptionType);
        return { data };
    }
    async listQcChecklistItems(checklistId) {
        const data = await this.receptionsService.listQcChecklistItems(checklistId);
        return { data };
    }
    async lookupLot(scan) {
        const data = await this.receptionsService.findReceptionLotByScan(scan);
        return { data };
    }
    async listUnits(lotId) {
        const data = await this.receptionsService.listReceptionUnits(lotId);
        return { data };
    }
    async listAlerts() {
        const data = await this.receptionsService.listActiveAlerts();
        return { data };
    }
    async acknowledgeAlert(alertId, req, body) {
        const data = await this.receptionsService.updateReceptionAlertStatus(alertId, {
            status: "ACKNOWLEDGED",
            actorName: String(body?.actorName || ""),
        });
        publishRealtimeDbChange({
            type: "reception_alert_acknowledged",
            table: "reception_alerts",
            action: "UPDATE",
            actorId: req.auth?.user?.id || null,
            rowIds: compactIds(data?.id),
            rows: [data].filter(Boolean),
            relatedTables: ["alerts", "notifications"],
        });
        return { data };
    }
    async resolveAlert(alertId, req, body) {
        const data = await this.receptionsService.updateReceptionAlertStatus(alertId, {
            status: "RESOLVED",
            actorName: String(body?.actorName || ""),
        });
        publishRealtimeDbChange({
            type: "reception_alert_resolved",
            table: "reception_alerts",
            action: "UPDATE",
            actorId: req.auth?.user?.id || null,
            rowIds: compactIds(data?.id),
            rows: [data].filter(Boolean),
            relatedTables: ["alerts", "notifications"],
        });
        return { data };
    }
    async calibrationStatus() {
        const data = await this.receptionsService.getCalibrationStatus();
        return { data };
    }
    async intake(req, body) {
        const data = await this.receptionsService.intake(body || {}, req.auth?.user || null);
        publishRealtimeDbChange({
            type: "reception_intake",
            table: "receptions_v2",
            action: "INSERT",
            actorId: req.auth?.user?.id || null,
            rowIds: compactIds(data.reception?.id),
            rows: [data.reception].filter(Boolean),
            relatedTables: ["reception_lots", "reception_units", "stock_lots", "stock_summary", "system_notifications", "reception_alerts"],
        });
        return { data };
    }
    async startQc(req, body) {
        const data = await this.receptionsService.startQcInspection(body || {}, req.auth?.user || null);
        publishRealtimeDbChange({
            type: "qc_started",
            table: "qc_inspections",
            action: "INSERT",
            actorId: req.auth?.user?.id || null,
            rowIds: compactIds(data?.id),
            rows: [data].filter(Boolean),
            relatedTables: ["receptions_v2"],
        });
        return { data };
    }
    async submitQc(req, body) {
        const data = await this.receptionsService.submitQcDecision(body || {}, req.auth?.user || null);
        publishRealtimeDbChange({
            type: "qc_submitted",
            table: "qc_inspections",
            action: "UPDATE",
            actorId: req.auth?.user?.id || null,
            rowIds: compactIds(data?.id),
            rows: [data].filter(Boolean),
            relatedTables: ["qc_check_results", "receptions_v2", "reception_lots", "reception_units", "stock_lots", "stock_summary", "reception_alerts"],
        });
        return { data };
    }
    async markUnitPrinted(req, body) {
        const data = await this.receptionsService.markUnitPrinted(String(body?.unitId || ""), req.auth?.user || null);
        publishRealtimeDbChange({
            type: "label_printed",
            table: "reception_units",
            action: "UPDATE",
            actorId: req.auth?.user?.id || null,
            rowIds: compactIds(data?.id),
            rows: [data].filter(Boolean),
            relatedTables: ["reception_lots"],
        });
        return { data };
    }
    async createUnit(lotId, req, body) {
        const data = await this.receptionsService.createReceptionUnit({ ...(body || {}), lotId }, req.auth?.user || null);
        publishRealtimeDbChange({
            type: "reception_unit_created",
            table: "reception_units",
            action: "INSERT",
            actorId: req.auth?.user?.id || null,
            rowIds: compactIds(data?.id),
            rows: [data].filter(Boolean),
            relatedTables: ["reception_lots", "receptions_v2"],
        });
        return { data };
    }
    async moveLotToStorage(lotId, req, body) {
        const data = await this.receptionsService.moveReceptionLotToStorage({ ...(body || {}), lotId }, req.auth?.user || null);
        publishRealtimeDbChange({
            type: "reception_lot_storage_moved",
            table: "reception_stock_movements",
            action: "INSERT",
            actorId: req.auth?.user?.id || null,
            rowIds: compactIds(data?.movement?.id),
            rows: [data?.movement].filter(Boolean),
            relatedTables: ["reception_lots", "reception_units", "stock_lots", "stock_summary", "reception_audit_logs_v2"],
        });
        return { data };
    }
    // ── T-502 / T-503 — Weighing records ──────────────────────────────────────
    async listWeighings(lotId) {
        const data = await this.receptionsService.listWeighings(lotId);
        return { data };
    }
    async recordWeighing(lotId, req, body) {
        const data = await this.receptionsService.recordWeighing(lotId, body || {}, req.auth?.user || null);
        publishRealtimeDbChange({
            type: "lot_weighing_recorded",
            table: "weighing_records",
            action: "INSERT",
            actorId: req.auth?.user?.id || null,
            rowIds: compactIds(data?.weighing?.id),
            rows: [data?.weighing].filter(Boolean),
            relatedTables: ["reception_lots", "receptions_v2", "reception_audit_logs_v2", "epcis_events"],
        });
        return { data };
    }
    // ── T-201 / T-202 — GS1 label generation ─────────────────────────────────
    async generateLotLabel(lotId, req) {
        const data = await this.receptionsService.generateLotLabel(lotId, req.auth?.user || null);
        publishRealtimeDbChange({
            type: "lot_label_printed",
            table: "reception_lots",
            action: "UPDATE",
            actorId: req.auth?.user?.id || null,
            rowIds: compactIds(lotId),
            rows: [],
            relatedTables: ["reception_audit_logs_v2", "epcis_events"],
        });
        return { data };
    }
};
__decorate([
    Get("receptions"),
    Roles(...RECEPTION_READ_ROLES),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ReceptionsController.prototype, "list", null);
__decorate([
    Get("receptions/raw-storage-overdue"),
    Roles(...RECEPTION_READ_ROLES),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ReceptionsController.prototype, "rawStorageOverdue", null);
__decorate([
    Get("receptions/:receptionId"),
    Roles(...RECEPTION_READ_ROLES),
    __param(0, Param("receptionId")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ReceptionsController.prototype, "detail", null);
__decorate([
    Get("receptions/:receptionId/lots"),
    Roles(...RECEPTION_READ_ROLES),
    __param(0, Param("receptionId")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ReceptionsController.prototype, "listLots", null);
__decorate([
    Get("receptions/:receptionId/qc-inspections"),
    Roles(...RECEPTION_READ_ROLES),
    __param(0, Param("receptionId")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ReceptionsController.prototype, "listQcInspections", null);
__decorate([
    Get("qc-checklists"),
    Roles(...RECEPTION_READ_ROLES),
    __param(0, Query("receptionType")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ReceptionsController.prototype, "listQcChecklists", null);
__decorate([
    Get("qc-checklists/:checklistId/items"),
    Roles(...RECEPTION_READ_ROLES),
    __param(0, Param("checklistId")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ReceptionsController.prototype, "listQcChecklistItems", null);
__decorate([
    Get("reception-lots/lookup"),
    Roles(...RECEPTION_READ_ROLES),
    __param(0, Query("scan")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ReceptionsController.prototype, "lookupLot", null);
__decorate([
    Get("reception-lots/:lotId/units"),
    Roles(...RECEPTION_READ_ROLES),
    __param(0, Param("lotId")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ReceptionsController.prototype, "listUnits", null);
__decorate([
    Get("reception-alerts"),
    Roles(...RECEPTION_READ_ROLES),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ReceptionsController.prototype, "listAlerts", null);
__decorate([
    Patch("reception-alerts/:alertId/acknowledge"),
    Roles(...RECEPTION_READ_ROLES),
    __param(0, Param("alertId")),
    __param(1, Req()),
    __param(2, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], ReceptionsController.prototype, "acknowledgeAlert", null);
__decorate([
    Patch("reception-alerts/:alertId/resolve"),
    Roles(...RECEPTION_READ_ROLES),
    __param(0, Param("alertId")),
    __param(1, Req()),
    __param(2, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], ReceptionsController.prototype, "resolveAlert", null);
__decorate([
    Get("qc/calibration-status"),
    Roles(...RECEPTION_READ_ROLES),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ReceptionsController.prototype, "calibrationStatus", null);
__decorate([
    Post("receptions/intake"),
    HttpCode(201),
    Roles(...RECEPTION_WRITE_ROLES),
    __param(0, Req()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ReceptionsController.prototype, "intake", null);
__decorate([
    Post("qc/start"),
    HttpCode(201),
    Roles(...QUALITY_ROLES),
    __param(0, Req()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ReceptionsController.prototype, "startQc", null);
__decorate([
    Post("qc/submit"),
    Roles(...QUALITY_ROLES),
    __param(0, Req()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ReceptionsController.prototype, "submitQc", null);
__decorate([
    Post("reception-units/mark-printed"),
    Roles(...RECEPTION_WRITE_ROLES),
    __param(0, Req()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ReceptionsController.prototype, "markUnitPrinted", null);
__decorate([
    Post("reception-lots/:lotId/units"),
    HttpCode(201),
    Roles(...RECEPTION_WRITE_ROLES),
    __param(0, Param("lotId")),
    __param(1, Req()),
    __param(2, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], ReceptionsController.prototype, "createUnit", null);
__decorate([
    Post("reception-lots/:lotId/storage-moves"),
    HttpCode(201),
    Roles(...STORAGE_MOVE_ROLES),
    __param(0, Param("lotId")),
    __param(1, Req()),
    __param(2, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], ReceptionsController.prototype, "moveLotToStorage", null);
__decorate([
    Get("reception-lots/:lotId/weighings"),
    Roles(...RECEPTION_READ_ROLES),
    __param(0, Param("lotId")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ReceptionsController.prototype, "listWeighings", null);
__decorate([
    Post("reception-lots/:lotId/weighing"),
    HttpCode(201),
    Roles(...RECEPTION_WRITE_ROLES),
    __param(0, Param("lotId")),
    __param(1, Req()),
    __param(2, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], ReceptionsController.prototype, "recordWeighing", null);
__decorate([
    Post("reception-lots/:lotId/label"),
    HttpCode(201),
    Roles(...RECEPTION_WRITE_ROLES),
    __param(0, Param("lotId")),
    __param(1, Req()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ReceptionsController.prototype, "generateLotLabel", null);
ReceptionsController = __decorate([
    Controller("api"),
    UseGuards(RequireAuthGuard, RolesGuard),
    __metadata("design:paramtypes", [ReceptionsService])
], ReceptionsController);
export { ReceptionsController };
