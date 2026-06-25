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
import { RequireAuthGuard } from "../../nest/route-guards.js";
import { publishRealtimeDbChange } from "../realtime/realtime.bus.js";
import { NotificationsService } from "./notifications.service.js";
const compactIds = (...values) => values.flat().map((value) => String(value || "")).filter(Boolean);
const actorNameFromRequest = (req, fallback) => String(fallback || req.auth?.user?.email || req.auth?.user?.user_metadata?.name || "operator");
let NotificationsController = class NotificationsController {
    notificationsService;
    constructor(notificationsService) {
        this.notificationsService = notificationsService;
    }
    async listNotifications(unreadOnly, limit) {
        return {
            data: await this.notificationsService.listNotifications({
                unreadOnly: unreadOnly === "true",
                limit: limit ? Number(limit) : undefined,
            }),
        };
    }
    async createNotification(req, body) {
        const data = await this.notificationsService.createNotification({
            notificationType: body?.notification_type || body?.notificationType,
            category: body?.category,
            title: body?.title,
            message: body?.message,
            severity: body?.severity,
            entityType: body?.entity_type || body?.entityType,
            entityId: body?.entity_id || body?.entityId,
            actionUrl: body?.action_url || body?.actionUrl,
            status: body?.status,
            metadata: body?.metadata,
            expiresAt: body?.expires_at || body?.expiresAt,
        });
        publishRealtimeDbChange({
            type: "notification_created",
            table: "system_notifications",
            action: "INSERT",
            actorId: req.auth?.user?.id || null,
            rowIds: compactIds(data?.id),
            rows: [data].filter(Boolean),
        });
        return { data };
    }
    async markNotificationRead(req, id, body) {
        const data = await this.notificationsService.markNotificationRead(id, actorNameFromRequest(req, body?.read_by || body?.readBy));
        publishRealtimeDbChange({
            type: "notification_marked_read",
            table: "system_notifications",
            action: "UPDATE",
            actorId: req.auth?.user?.id || null,
            rowIds: compactIds(id),
            rows: [data].filter(Boolean),
        });
        return { data };
    }
    async markAllNotificationsRead(req, body) {
        const result = await this.notificationsService.markAllNotificationsRead(actorNameFromRequest(req, body?.read_by || body?.readBy));
        publishRealtimeDbChange({
            type: "notifications_marked_all_read",
            table: "system_notifications",
            action: "UPDATE",
            actorId: req.auth?.user?.id || null,
            rowIds: result.ids,
            rows: result.notifications,
        });
        return { data: result.notifications };
    }
    async listAuditLogs(entityType, entityId, limit) {
        return {
            data: await this.notificationsService.listAuditLogs({
                entityType,
                entityId,
                limit: limit ? Number(limit) : undefined,
            }),
        };
    }
    async createAuditLog(req, body) {
        const data = await this.notificationsService.createAuditLog(body || {}, {
            id: req.auth?.user?.id || null,
            email: req.auth?.user?.email || null,
            name: req.auth?.user?.user_metadata?.name || null,
        });
        publishRealtimeDbChange({
            type: "notification_audit_log_created",
            table: "system_audit_logs",
            action: "INSERT",
            actorId: req.auth?.user?.id || null,
            rowIds: compactIds(data?.id),
            rows: [data].filter(Boolean),
        });
        return { data };
    }
};
__decorate([
    Get(),
    __param(0, Query("unreadOnly")),
    __param(1, Query("limit")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], NotificationsController.prototype, "listNotifications", null);
__decorate([
    Post(),
    HttpCode(201),
    __param(0, Req()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], NotificationsController.prototype, "createNotification", null);
__decorate([
    Patch(":id/read"),
    __param(0, Req()),
    __param(1, Param("id")),
    __param(2, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], NotificationsController.prototype, "markNotificationRead", null);
__decorate([
    Post("mark-all-read"),
    HttpCode(200),
    __param(0, Req()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], NotificationsController.prototype, "markAllNotificationsRead", null);
__decorate([
    Get("audit"),
    __param(0, Query("entityType")),
    __param(1, Query("entityId")),
    __param(2, Query("limit")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], NotificationsController.prototype, "listAuditLogs", null);
__decorate([
    Post("audit"),
    HttpCode(201),
    __param(0, Req()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], NotificationsController.prototype, "createAuditLog", null);
NotificationsController = __decorate([
    Controller("api/notifications"),
    UseGuards(RequireAuthGuard),
    __metadata("design:paramtypes", [NotificationsService])
], NotificationsController);
export { NotificationsController };
