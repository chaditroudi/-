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
import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { RequireAuthGuard } from "../../nest/route-guards.js";
import { CollectionsService } from "../collections/collections.service.js";
import { TransportService } from "./transport.service.js";
let TransportController = class TransportController {
    cs;
    transportService;
    constructor(cs, transportService) {
        this.cs = cs;
        this.transportService = transportService;
    }
    // ── Vehicles ──────────────────────────────────────────────────────────────
    async listVehicles(status) {
        const filters = [];
        if (status)
            filters.push({ type: "eq", column: "status", value: status });
        const data = await this.cs.query({ table: "transport_vehicles", filters, orderBy: { column: "registration_number", ascending: true } });
        return { data };
    }
    async createVehicle(body) {
        const data = await this.cs.insert({ table: "transport_vehicles", values: body });
        return { data: data[0] };
    }
    async updateVehicle(id, body) {
        const { after } = await this.cs.update({ table: "transport_vehicles", filters: [{ type: "eq", column: "id", value: id }], values: body });
        return { data: after[0] };
    }
    // ── Drivers ───────────────────────────────────────────────────────────────
    async listDrivers(status) {
        const filters = [];
        if (status)
            filters.push({ type: "eq", column: "status", value: status });
        const data = await this.cs.query({ table: "transport_drivers", filters, orderBy: { column: "last_name", ascending: true } });
        return { data };
    }
    async createDriver(body) {
        const data = await this.cs.insert({ table: "transport_drivers", values: body });
        return { data: data[0] };
    }
    async updateDriver(id, body) {
        const { after } = await this.cs.update({ table: "transport_drivers", filters: [{ type: "eq", column: "id", value: id }], values: body });
        return { data: after[0] };
    }
    // ── Missions — summary must be declared before :id ────────────────────────
    async getMissionsSummary() {
        const data = await this.transportService.getSummary();
        return { data };
    }
    async listMissions(status, vehicleId) {
        const filters = [];
        if (status)
            filters.push({ type: "eq", column: "status", value: status });
        if (vehicleId)
            filters.push({ type: "eq", column: "vehicle_id", value: vehicleId });
        const data = await this.cs.query({ table: "transport_missions", filters, orderBy: { column: "created_at", ascending: false } });
        return { data };
    }
    async createMission(body) {
        const data = await this.cs.insert({ table: "transport_missions", values: body });
        return { data: data[0] };
    }
    async updateMission(id, body) {
        const { after } = await this.cs.update({ table: "transport_missions", filters: [{ type: "eq", column: "id", value: id }], values: body });
        return { data: after[0] };
    }
    // ── Business action endpoints ─────────────────────────────────────────────
    async assignMission(id, body) {
        const data = await this.transportService.assignMission(id, body ?? {}, body?.actor ?? null);
        return { data };
    }
    async startMission(id, body) {
        const data = await this.transportService.startMission(id, body?.actor ?? null);
        return { data };
    }
    async completeMission(id, body) {
        const data = await this.transportService.completeMission(id, body ?? {}, body?.actor ?? null);
        return { data };
    }
    async cancelMission(id, body) {
        const data = await this.transportService.cancelMission(id, String(body?.reason ?? "Annulée"), body?.actor ?? null);
        return { data };
    }
    // ── Position Logs ─────────────────────────────────────────────────────────
    async listPositionLogs(missionId, vehicleId) {
        const filters = [];
        if (missionId)
            filters.push({ type: "eq", column: "mission_id", value: missionId });
        if (vehicleId)
            filters.push({ type: "eq", column: "vehicle_id", value: vehicleId });
        const data = await this.cs.query({ table: "transport_position_logs", filters, orderBy: { column: "recorded_at", ascending: false } });
        return { data };
    }
    async createPositionLog(body) {
        const data = await this.cs.insert({ table: "transport_position_logs", values: body });
        return { data: data[0] };
    }
};
__decorate([
    Get("vehicles"),
    __param(0, Query("status")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], TransportController.prototype, "listVehicles", null);
__decorate([
    Post("vehicles"),
    __param(0, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], TransportController.prototype, "createVehicle", null);
__decorate([
    Patch("vehicles/:id"),
    __param(0, Param("id")),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], TransportController.prototype, "updateVehicle", null);
__decorate([
    Get("drivers"),
    __param(0, Query("status")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], TransportController.prototype, "listDrivers", null);
__decorate([
    Post("drivers"),
    __param(0, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], TransportController.prototype, "createDriver", null);
__decorate([
    Patch("drivers/:id"),
    __param(0, Param("id")),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], TransportController.prototype, "updateDriver", null);
__decorate([
    Get("missions/summary"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], TransportController.prototype, "getMissionsSummary", null);
__decorate([
    Get("missions"),
    __param(0, Query("status")),
    __param(1, Query("vehicle_id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], TransportController.prototype, "listMissions", null);
__decorate([
    Post("missions"),
    __param(0, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], TransportController.prototype, "createMission", null);
__decorate([
    Patch("missions/:id"),
    __param(0, Param("id")),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], TransportController.prototype, "updateMission", null);
__decorate([
    Post("missions/:id/assign"),
    __param(0, Param("id")),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], TransportController.prototype, "assignMission", null);
__decorate([
    Post("missions/:id/start"),
    __param(0, Param("id")),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], TransportController.prototype, "startMission", null);
__decorate([
    Post("missions/:id/complete"),
    __param(0, Param("id")),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], TransportController.prototype, "completeMission", null);
__decorate([
    Post("missions/:id/cancel"),
    __param(0, Param("id")),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], TransportController.prototype, "cancelMission", null);
__decorate([
    Get("position-logs"),
    __param(0, Query("mission_id")),
    __param(1, Query("vehicle_id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], TransportController.prototype, "listPositionLogs", null);
__decorate([
    Post("position-logs"),
    __param(0, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], TransportController.prototype, "createPositionLog", null);
TransportController = __decorate([
    Controller("api/transport"),
    UseGuards(RequireAuthGuard),
    __metadata("design:paramtypes", [CollectionsService,
        TransportService])
], TransportController);
export { TransportController };
