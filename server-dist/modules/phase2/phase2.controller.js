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
import { Phase2Service } from "./phase2.service.js";
const PHASE2_ROLES = [
    "responsable_production",
    "operateur_nettoyage",
    "operateur_fumigation",
    "operateur_triage_ia",
    "operateur_conditionnement",
    "operateur_emballage",
    "responsable_qualite",
    "inspecteur_qualite",
    "resp_management_qualite",
    "resp_qualite_haccp",
    "responsable_stock",
    "magasinier_wms",
    "admin",
    "administrateur_systeme",
    "directeur_general",
    "directeur_usine",
    "direction",
];
const compactIds = (...values) => values.flat().map((value) => String(value || "")).filter(Boolean);
const publishNotificationRows = (rows, action, actorId, type) => {
    if (!Array.isArray(rows) || rows.length === 0)
        return;
    publishRealtimeDbChange({
        type,
        table: "system_notifications",
        action,
        actorId,
        rowIds: compactIds(rows.map((row) => row?.id)),
        rows,
    });
};
let Phase2Controller = class Phase2Controller {
    phase2Service;
    constructor(phase2Service) {
        this.phase2Service = phase2Service;
    }
    async listAvailableLots() {
        return { data: await this.phase2Service.listAvailableLots() };
    }
    async listFumigationCycles(status) {
        return { data: await this.phase2Service.listFumigationCycles(status) };
    }
    async getFumigationCycle(id) {
        return { data: await this.phase2Service.getFumigationCycle(id) };
    }
    async listFumigationSensorReadings(id) {
        return { data: await this.phase2Service.listFumigationSensorReadings(id) };
    }
    async createFumigationCycle(req, body) {
        const data = await this.phase2Service.createFumigationCycle(body || {});
        publishRealtimeDbChange({
            type: "phase2_fumigation_cycle_created",
            table: "fumigation_cycles",
            action: "INSERT",
            actorId: req.auth?.user?.id || null,
            rowIds: compactIds(data?.id),
            rows: [data].filter(Boolean),
        });
        return { data };
    }
    async updateFumigationCycle(req, id, body) {
        const data = await this.phase2Service.updateFumigationCycle(id, body || {});
        publishRealtimeDbChange({
            type: "phase2_fumigation_cycle_updated",
            table: "fumigation_cycles",
            action: "UPDATE",
            actorId: req.auth?.user?.id || null,
            rowIds: compactIds(id),
            rows: [data].filter(Boolean),
        });
        return { data };
    }
    async startFumigationCycle(req, id) {
        const data = await this.phase2Service.startFumigationCycle(id);
        publishRealtimeDbChange({
            type: "phase2_fumigation_cycle_started",
            table: "fumigation_cycles",
            action: "UPDATE",
            actorId: req.auth?.user?.id || null,
            rowIds: compactIds(id),
            rows: [data].filter(Boolean),
        });
        return { data };
    }
    async signFumigationCycle(req, id, body) {
        const data = await this.phase2Service.signFumigationCycle(id, body || {});
        publishRealtimeDbChange({
            type: "phase2_fumigation_cycle_signed",
            table: "fumigation_cycles",
            action: "UPDATE",
            actorId: req.auth?.user?.id || null,
            rowIds: compactIds(id),
            rows: [data].filter(Boolean),
        });
        return { data };
    }
    async addFumigationSensorReading(req, body) {
        const result = await this.phase2Service.addFumigationSensorReading(body || {});
        publishRealtimeDbChange({
            type: "phase2_fumigation_reading_created",
            table: "fumigation_sensor_readings",
            action: "INSERT",
            actorId: req.auth?.user?.id || null,
            rowIds: compactIds(result.data?.id),
            rows: [result.data].filter(Boolean),
            relatedTables: ["fumigation_cycles"],
        });
        publishNotificationRows(result.notifications, "INSERT", req.auth?.user?.id || null, "phase2_fumigation_alert_created");
        return { data: result.data };
    }
    async getFumigationKpis() {
        return { data: await this.phase2Service.getFumigationKpis() };
    }
    async listCleaningCycles(status) {
        return { data: await this.phase2Service.listCleaningCycles(status) };
    }
    async getCleaningCycle(id) {
        return { data: await this.phase2Service.getCleaningCycle(id) };
    }
    async createCleaningCycle(req, body) {
        const data = await this.phase2Service.createCleaningCycle(body || {});
        publishRealtimeDbChange({
            type: "phase2_cleaning_cycle_created",
            table: "cleaning_cycles",
            action: "INSERT",
            actorId: req.auth?.user?.id || null,
            rowIds: compactIds(data?.id),
            rows: [data].filter(Boolean),
        });
        return { data };
    }
    async closeCleaningCycle(req, id, body) {
        const result = await this.phase2Service.closeCleaningCycle(id, body || {});
        publishRealtimeDbChange({
            type: "phase2_cleaning_cycle_closed",
            table: "cleaning_cycles",
            action: "UPDATE",
            actorId: req.auth?.user?.id || null,
            rowIds: compactIds(id),
            rows: result.cycle ? [result.cycle] : [],
        });
        publishNotificationRows(result.notifications, "INSERT", req.auth?.user?.id || null, "phase2_cleaning_alert_created");
        return { data: result.data };
    }
    async updateCleaningCycle(req, id, body) {
        const data = await this.phase2Service.updateCleaningCycle(id, body || {});
        publishRealtimeDbChange({
            type: "phase2_cleaning_cycle_updated",
            table: "cleaning_cycles",
            action: "UPDATE",
            actorId: req.auth?.user?.id || null,
            rowIds: compactIds(id),
            rows: [data].filter(Boolean),
        });
        return { data };
    }
    async getCleaningKpis() {
        return { data: await this.phase2Service.getCleaningKpis() };
    }
    async listHydrationCycles(status) {
        return { data: await this.phase2Service.listHydrationCycles(status) };
    }
    async getHydrationCycle(id) {
        return { data: await this.phase2Service.getHydrationCycle(id) };
    }
    async createHydrationCycle(req, body) {
        const data = await this.phase2Service.createHydrationCycle(body || {});
        publishRealtimeDbChange({
            type: "phase2_hydration_cycle_created",
            table: "hydration_cycles",
            action: "INSERT",
            actorId: req.auth?.user?.id || null,
            rowIds: compactIds(data?.id),
            rows: [data].filter(Boolean),
        });
        return { data };
    }
    async recordHydrationExit(req, id, body) {
        const result = await this.phase2Service.recordHydrationExit(id, body || {});
        publishRealtimeDbChange({
            type: "phase2_hydration_exit_recorded",
            table: "hydration_cycles",
            action: "UPDATE",
            actorId: req.auth?.user?.id || null,
            rowIds: compactIds(id),
            rows: result.cycle ? [result.cycle] : [],
        });
        publishNotificationRows(result.notifications, "INSERT", req.auth?.user?.id || null, "phase2_hydration_alert_created");
        return { data: result.data };
    }
    async closeHydrationCycle(req, id, body) {
        const data = await this.phase2Service.closeHydrationCycle(id, body || {});
        publishRealtimeDbChange({
            type: "phase2_hydration_cycle_closed",
            table: "hydration_cycles",
            action: "UPDATE",
            actorId: req.auth?.user?.id || null,
            rowIds: compactIds(id),
            rows: [data].filter(Boolean),
        });
        return { data };
    }
    async updateHydrationSensors(req, id, body) {
        const data = await this.phase2Service.updateHydrationSensors(id, body || {});
        publishRealtimeDbChange({
            type: "phase2_hydration_sensors_updated",
            table: "hydration_cycles",
            action: "UPDATE",
            actorId: req.auth?.user?.id || null,
            rowIds: compactIds(id),
            rows: [data].filter(Boolean),
        });
        return { data };
    }
    async getHydrationKpis() {
        return { data: await this.phase2Service.getHydrationKpis() };
    }
    async listTriageSessions(status) {
        return { data: await this.phase2Service.listTriageSessions(status) };
    }
    async getTriageSession(id) {
        return { data: await this.phase2Service.getTriageSession(id) };
    }
    async listTriageQualityChecks(id) {
        return { data: await this.phase2Service.listTriageQualityChecks(id) };
    }
    async listTriageSublots(id) {
        return { data: await this.phase2Service.listTriageSublots(id) };
    }
    async createTriageSession(req, body) {
        const data = await this.phase2Service.createTriageSession(body || {});
        publishRealtimeDbChange({
            type: "phase2_triage_session_created",
            table: "triage_sessions",
            action: "INSERT",
            actorId: req.auth?.user?.id || null,
            rowIds: compactIds(data?.id),
            rows: [data].filter(Boolean),
        });
        return { data };
    }
    async updateTriageWeights(req, id, body) {
        const result = await this.phase2Service.updateTriageWeights(id, body || {});
        publishRealtimeDbChange({
            type: "phase2_triage_weights_updated",
            table: "triage_sessions",
            action: "UPDATE",
            actorId: req.auth?.user?.id || null,
            rowIds: compactIds(id),
            rows: result.session ? [result.session] : [],
        });
        publishNotificationRows(result.notifications, "INSERT", req.auth?.user?.id || null, "phase2_triage_alert_created");
        return { data: result.data };
    }
    async addTriageQualityCheck(req, id, body) {
        const result = await this.phase2Service.addTriageQualityCheck({ ...(body || {}), session_id: id });
        publishRealtimeDbChange({
            type: "phase2_triage_quality_check_created",
            table: "triage_quality_checks",
            action: "INSERT",
            actorId: req.auth?.user?.id || null,
            rowIds: compactIds(result.data?.id),
            rows: [result.data].filter(Boolean),
            relatedTables: ["triage_sessions"],
        });
        publishNotificationRows(result.notifications, "INSERT", req.auth?.user?.id || null, "phase2_triage_quality_alert_created");
        return { data: result.data };
    }
    async closeTriageSession(req, id) {
        const result = await this.phase2Service.closeTriageSession(id);
        publishRealtimeDbChange({
            type: "phase2_triage_session_closed",
            table: "triage_sessions",
            action: "UPDATE",
            actorId: req.auth?.user?.id || null,
            rowIds: compactIds(id),
            rows: result.session ? [result.session] : [],
            relatedTables: ["triage_sublots", "stock_lots", "stock_movements"],
        });
        return { data: result.data };
    }
    async toggleTriageRunState(req, id, body) {
        const result = await this.phase2Service.toggleTriageRunState(id, body || {});
        publishRealtimeDbChange({
            type: "phase2_triage_run_state_toggled",
            table: "triage_sessions",
            action: "UPDATE",
            actorId: req.auth?.user?.id || null,
            rowIds: compactIds(id),
            rows: result.session ? [result.session] : [],
        });
        return { data: result.data };
    }
    async getTriageKpis() {
        return { data: await this.phase2Service.getTriageKpis() };
    }
    async getLotTraceability(lotNumber) {
        return { data: await this.phase2Service.getLotTraceability(lotNumber) };
    }
    async getLotGenealogy(lotNumber) {
        return { data: await this.phase2Service.getLotGenealogy(lotNumber) };
    }
    async acknowledgePhase2Alert(req, id, body) {
        const data = await this.phase2Service.acknowledgePhase2Alert(id, String(body?.read_by || body?.readBy || req.auth?.user?.email || "operator"));
        publishNotificationRows([data].filter(Boolean), "UPDATE", req.auth?.user?.id || null, "phase2_alert_acknowledged");
        return { data };
    }
    async acknowledgeAllPhase2Alerts(req, body) {
        const result = await this.phase2Service.acknowledgeAllPhase2Alerts(String(body?.read_by || body?.readBy || req.auth?.user?.email || "operator"));
        publishNotificationRows(result.notifications, "UPDATE", req.auth?.user?.id || null, "phase2_alerts_acknowledged_all");
        return { data: result.data };
    }
};
__decorate([
    Get("available-lots"),
    Roles(...PHASE2_ROLES),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], Phase2Controller.prototype, "listAvailableLots", null);
__decorate([
    Get("fumigation/cycles"),
    Roles(...PHASE2_ROLES),
    __param(0, Query("status")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], Phase2Controller.prototype, "listFumigationCycles", null);
__decorate([
    Get("fumigation/cycles/:id"),
    Roles(...PHASE2_ROLES),
    __param(0, Param("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], Phase2Controller.prototype, "getFumigationCycle", null);
__decorate([
    Get("fumigation/cycles/:id/readings"),
    Roles(...PHASE2_ROLES),
    __param(0, Param("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], Phase2Controller.prototype, "listFumigationSensorReadings", null);
__decorate([
    Post("fumigation/cycles"),
    HttpCode(201),
    Roles(...PHASE2_ROLES),
    __param(0, Req()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Phase2Controller.prototype, "createFumigationCycle", null);
__decorate([
    Patch("fumigation/cycles/:id"),
    Roles(...PHASE2_ROLES),
    __param(0, Req()),
    __param(1, Param("id")),
    __param(2, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], Phase2Controller.prototype, "updateFumigationCycle", null);
__decorate([
    Post("fumigation/cycles/:id/start"),
    Roles(...PHASE2_ROLES),
    __param(0, Req()),
    __param(1, Param("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], Phase2Controller.prototype, "startFumigationCycle", null);
__decorate([
    Post("fumigation/cycles/:id/sign"),
    Roles(...PHASE2_ROLES),
    __param(0, Req()),
    __param(1, Param("id")),
    __param(2, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], Phase2Controller.prototype, "signFumigationCycle", null);
__decorate([
    Post("fumigation/readings"),
    HttpCode(201),
    Roles(...PHASE2_ROLES),
    __param(0, Req()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Phase2Controller.prototype, "addFumigationSensorReading", null);
__decorate([
    Get("fumigation/kpis"),
    Roles(...PHASE2_ROLES),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], Phase2Controller.prototype, "getFumigationKpis", null);
__decorate([
    Get("cleaning/cycles"),
    Roles(...PHASE2_ROLES),
    __param(0, Query("status")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], Phase2Controller.prototype, "listCleaningCycles", null);
__decorate([
    Get("cleaning/cycles/:id"),
    Roles(...PHASE2_ROLES),
    __param(0, Param("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], Phase2Controller.prototype, "getCleaningCycle", null);
__decorate([
    Post("cleaning/cycles"),
    HttpCode(201),
    Roles(...PHASE2_ROLES),
    __param(0, Req()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Phase2Controller.prototype, "createCleaningCycle", null);
__decorate([
    Post("cleaning/cycles/:id/close"),
    Roles(...PHASE2_ROLES),
    __param(0, Req()),
    __param(1, Param("id")),
    __param(2, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], Phase2Controller.prototype, "closeCleaningCycle", null);
__decorate([
    Patch("cleaning/cycles/:id"),
    Roles(...PHASE2_ROLES),
    __param(0, Req()),
    __param(1, Param("id")),
    __param(2, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], Phase2Controller.prototype, "updateCleaningCycle", null);
__decorate([
    Get("cleaning/kpis"),
    Roles(...PHASE2_ROLES),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], Phase2Controller.prototype, "getCleaningKpis", null);
__decorate([
    Get("hydration/cycles"),
    Roles(...PHASE2_ROLES),
    __param(0, Query("status")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], Phase2Controller.prototype, "listHydrationCycles", null);
__decorate([
    Get("hydration/cycles/:id"),
    Roles(...PHASE2_ROLES),
    __param(0, Param("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], Phase2Controller.prototype, "getHydrationCycle", null);
__decorate([
    Post("hydration/cycles"),
    HttpCode(201),
    Roles(...PHASE2_ROLES),
    __param(0, Req()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Phase2Controller.prototype, "createHydrationCycle", null);
__decorate([
    Post("hydration/cycles/:id/record-exit"),
    Roles(...PHASE2_ROLES),
    __param(0, Req()),
    __param(1, Param("id")),
    __param(2, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], Phase2Controller.prototype, "recordHydrationExit", null);
__decorate([
    Post("hydration/cycles/:id/close"),
    Roles(...PHASE2_ROLES),
    __param(0, Req()),
    __param(1, Param("id")),
    __param(2, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], Phase2Controller.prototype, "closeHydrationCycle", null);
__decorate([
    Patch("hydration/cycles/:id/sensors"),
    Roles(...PHASE2_ROLES),
    __param(0, Req()),
    __param(1, Param("id")),
    __param(2, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], Phase2Controller.prototype, "updateHydrationSensors", null);
__decorate([
    Get("hydration/kpis"),
    Roles(...PHASE2_ROLES),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], Phase2Controller.prototype, "getHydrationKpis", null);
__decorate([
    Get("triage/sessions"),
    Roles(...PHASE2_ROLES),
    __param(0, Query("status")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], Phase2Controller.prototype, "listTriageSessions", null);
__decorate([
    Get("triage/sessions/:id"),
    Roles(...PHASE2_ROLES),
    __param(0, Param("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], Phase2Controller.prototype, "getTriageSession", null);
__decorate([
    Get("triage/sessions/:id/quality-checks"),
    Roles(...PHASE2_ROLES),
    __param(0, Param("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], Phase2Controller.prototype, "listTriageQualityChecks", null);
__decorate([
    Get("triage/sessions/:id/sub-lots"),
    Roles(...PHASE2_ROLES),
    __param(0, Param("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], Phase2Controller.prototype, "listTriageSublots", null);
__decorate([
    Post("triage/sessions"),
    HttpCode(201),
    Roles(...PHASE2_ROLES),
    __param(0, Req()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Phase2Controller.prototype, "createTriageSession", null);
__decorate([
    Patch("triage/sessions/:id/weights"),
    Roles(...PHASE2_ROLES),
    __param(0, Req()),
    __param(1, Param("id")),
    __param(2, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], Phase2Controller.prototype, "updateTriageWeights", null);
__decorate([
    Post("triage/sessions/:id/quality-checks"),
    HttpCode(201),
    Roles(...PHASE2_ROLES),
    __param(0, Req()),
    __param(1, Param("id")),
    __param(2, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], Phase2Controller.prototype, "addTriageQualityCheck", null);
__decorate([
    Post("triage/sessions/:id/close"),
    Roles(...PHASE2_ROLES),
    __param(0, Req()),
    __param(1, Param("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], Phase2Controller.prototype, "closeTriageSession", null);
__decorate([
    Post("triage/sessions/:id/toggle-run"),
    Roles(...PHASE2_ROLES),
    __param(0, Req()),
    __param(1, Param("id")),
    __param(2, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], Phase2Controller.prototype, "toggleTriageRunState", null);
__decorate([
    Get("triage/kpis"),
    Roles(...PHASE2_ROLES),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], Phase2Controller.prototype, "getTriageKpis", null);
__decorate([
    Get("traceability/:lotNumber"),
    Roles(...PHASE2_ROLES),
    __param(0, Param("lotNumber")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], Phase2Controller.prototype, "getLotTraceability", null);
__decorate([
    Get("traceability/:lotNumber/genealogy"),
    Roles(...PHASE2_ROLES),
    __param(0, Param("lotNumber")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], Phase2Controller.prototype, "getLotGenealogy", null);
__decorate([
    Post("alerts/:id/acknowledge"),
    Roles(...PHASE2_ROLES),
    __param(0, Req()),
    __param(1, Param("id")),
    __param(2, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], Phase2Controller.prototype, "acknowledgePhase2Alert", null);
__decorate([
    Post("alerts/acknowledge-all"),
    Roles(...PHASE2_ROLES),
    __param(0, Req()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Phase2Controller.prototype, "acknowledgeAllPhase2Alerts", null);
Phase2Controller = __decorate([
    Controller("api/phase2"),
    UseGuards(RequireAuthGuard, RolesGuard),
    __metadata("design:paramtypes", [Phase2Service])
], Phase2Controller);
export { Phase2Controller };
