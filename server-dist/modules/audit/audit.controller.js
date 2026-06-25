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
import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { RequireAuthGuard } from "../../nest/route-guards.js";
import { AuditService } from "./audit.service.js";
let AuditController = class AuditController {
    auditService;
    constructor(auditService) {
        this.auditService = auditService;
    }
    async logs(limit, offset, userId, module, eventType, table, from, to) {
        return this.auditService.getLogs({
            limit: limit ? Number(limit) : 100,
            offset: offset ? Number(offset) : 0,
            userId: userId ? String(userId) : undefined,
            module: module ? String(module) : undefined,
            eventType: eventType ? String(eventType) : undefined,
            table: table ? String(table) : undefined,
            from: from ? String(from) : undefined,
            to: to ? String(to) : undefined,
        });
    }
    async stats(from) {
        return this.auditService.getStats(from ? String(from) : undefined);
    }
};
__decorate([
    Get("logs"),
    __param(0, Query("limit")),
    __param(1, Query("offset")),
    __param(2, Query("userId")),
    __param(3, Query("module")),
    __param(4, Query("eventType")),
    __param(5, Query("table")),
    __param(6, Query("from")),
    __param(7, Query("to")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], AuditController.prototype, "logs", null);
__decorate([
    Get("stats"),
    __param(0, Query("from")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AuditController.prototype, "stats", null);
AuditController = __decorate([
    Controller("api/audit"),
    UseGuards(RequireAuthGuard),
    __metadata("design:paramtypes", [AuditService])
], AuditController);
export { AuditController };
