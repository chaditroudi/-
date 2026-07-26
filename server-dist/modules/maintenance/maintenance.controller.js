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
import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, Req, UseGuards, } from "@nestjs/common";
import { Roles } from "../../nest/route-metadata.js";
import { RequireAuthGuard, RolesGuard } from "../../nest/route-guards.js";
import { publishRealtimeDbChange } from "../realtime/realtime.bus.js";
import { MaintenanceService } from "./maintenance.service.js";
const MAINTENANCE_ROLES = ["responsable_maintenance", "technicien_maintenance"];
// Any operational role may raise a maintenance request; approvals are enforced
// per-level inside the workflow engine (department manager / maintenance / DAF).
const MAINTENANCE_REQUEST_ROLES = [
    ...MAINTENANCE_ROLES,
    "responsable_production",
    "responsable_qualite",
    "responsable_stock",
    "magasinier_wms",
    "responsable_logistique",
    "responsable_reception",
    "chef_reception",
    "responsable_achats",
    "daf",
    "directeur_financier",
    "directeur_general",
    "directeur_usine",
    "administrateur_systeme",
];
const publish = (type, action, data, fallbackId) => {
    publishRealtimeDbChange({
        type,
        table: "maintenance_requests",
        action,
        rows: action === "DELETE" ? [] : data ? [data] : [],
        rowIds: [String(data?.id || fallbackId || "")].filter(Boolean),
        relatedTables: ["maintenance_stats"],
    });
};
let MaintenanceController = class MaintenanceController {
    maintenanceService;
    constructor(maintenanceService) {
        this.maintenanceService = maintenanceService;
    }
    async listRequests(status) {
        return { data: await this.maintenanceService.listRequests(status) };
    }
    async getStats() {
        return { data: await this.maintenanceService.getStats() };
    }
    async getRequest(id) {
        return { data: await this.maintenanceService.getRequestById(id) };
    }
    async createRequest(req, body) {
        const data = await this.maintenanceService.createRequest(body || {}, req.auth?.user || null);
        publish("maintenance_request_created", "INSERT", data);
        return { data };
    }
    async updateRequest(id, body) {
        const data = await this.maintenanceService.updateRequest(id, body || {});
        publish("maintenance_request_updated", "UPDATE", data, id);
        return { data };
    }
    async submitRequest(req, id, body) {
        const data = await this.maintenanceService.submitRequest(id, req.auth?.user || null, body?.reason);
        publish("maintenance_request_submitted", "UPDATE", data, id);
        return { data };
    }
    async approveRequest(req, id, body) {
        const data = await this.maintenanceService.approveRequest(id, req.auth?.user || null, body?.reason);
        publish("maintenance_request_approved", "UPDATE", data, id);
        return { data };
    }
    async rejectRequest(req, id, body) {
        const data = await this.maintenanceService.rejectRequest(id, body?.reason, req.auth?.user || null);
        publish("maintenance_request_rejected", "UPDATE", data, id);
        return { data };
    }
    async returnRequest(req, id, body) {
        const data = await this.maintenanceService.returnRequest(id, body?.reason, req.auth?.user || null);
        publish("maintenance_request_returned", "UPDATE", data, id);
        return { data };
    }
    async cancelRequest(req, id, body) {
        const data = await this.maintenanceService.cancelRequest(id, req.auth?.user || null, body?.reason);
        publish("maintenance_request_cancelled", "UPDATE", data, id);
        return { data };
    }
    async completeRequest(req, id, body) {
        const data = await this.maintenanceService.completeRequest(id, req.auth?.user || null, body?.reason);
        publish("maintenance_request_completed", "UPDATE", data, id);
        return { data };
    }
    async deleteRequest(id) {
        const data = await this.maintenanceService.deleteRequest(id);
        publish("maintenance_request_deleted", "DELETE", null, id);
        return { data };
    }
};
__decorate([
    Get("requests"),
    Roles(...MAINTENANCE_REQUEST_ROLES),
    __param(0, Query("status")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], MaintenanceController.prototype, "listRequests", null);
__decorate([
    Get("stats"),
    Roles(...MAINTENANCE_REQUEST_ROLES),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], MaintenanceController.prototype, "getStats", null);
__decorate([
    Get("requests/:id"),
    Roles(...MAINTENANCE_REQUEST_ROLES),
    __param(0, Param("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], MaintenanceController.prototype, "getRequest", null);
__decorate([
    Post("requests"),
    Roles(...MAINTENANCE_REQUEST_ROLES),
    HttpCode(201),
    __param(0, Req()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], MaintenanceController.prototype, "createRequest", null);
__decorate([
    Patch("requests/:id"),
    Roles(...MAINTENANCE_REQUEST_ROLES),
    __param(0, Param("id")),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], MaintenanceController.prototype, "updateRequest", null);
__decorate([
    Post("requests/:id/submit"),
    Roles(...MAINTENANCE_REQUEST_ROLES),
    __param(0, Req()),
    __param(1, Param("id")),
    __param(2, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], MaintenanceController.prototype, "submitRequest", null);
__decorate([
    Post("requests/:id/approve"),
    Roles(...MAINTENANCE_REQUEST_ROLES),
    __param(0, Req()),
    __param(1, Param("id")),
    __param(2, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], MaintenanceController.prototype, "approveRequest", null);
__decorate([
    Post("requests/:id/reject"),
    Roles(...MAINTENANCE_REQUEST_ROLES),
    __param(0, Req()),
    __param(1, Param("id")),
    __param(2, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], MaintenanceController.prototype, "rejectRequest", null);
__decorate([
    Post("requests/:id/return"),
    Roles(...MAINTENANCE_REQUEST_ROLES),
    __param(0, Req()),
    __param(1, Param("id")),
    __param(2, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], MaintenanceController.prototype, "returnRequest", null);
__decorate([
    Post("requests/:id/cancel"),
    Roles(...MAINTENANCE_REQUEST_ROLES),
    __param(0, Req()),
    __param(1, Param("id")),
    __param(2, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], MaintenanceController.prototype, "cancelRequest", null);
__decorate([
    Post("requests/:id/complete"),
    Roles(...MAINTENANCE_REQUEST_ROLES),
    __param(0, Req()),
    __param(1, Param("id")),
    __param(2, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], MaintenanceController.prototype, "completeRequest", null);
__decorate([
    Delete("requests/:id"),
    Roles(...MAINTENANCE_REQUEST_ROLES),
    __param(0, Param("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], MaintenanceController.prototype, "deleteRequest", null);
MaintenanceController = __decorate([
    Controller("api/maintenance"),
    UseGuards(RequireAuthGuard, RolesGuard),
    __metadata("design:paramtypes", [MaintenanceService])
], MaintenanceController);
export { MaintenanceController };
