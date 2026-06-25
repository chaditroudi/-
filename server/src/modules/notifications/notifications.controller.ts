import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";

import { RequireAuthGuard } from "../../nest/route-guards.js";
import { publishRealtimeDbChange } from "../realtime/realtime.bus.js";
import { NotificationsService } from "./notifications.service.js";

const compactIds = (...values: unknown[]) =>
  values.flat().map((value) => String(value || "")).filter(Boolean);

const actorNameFromRequest = (req: any, fallback?: string) =>
  String(fallback || req.auth?.user?.email || req.auth?.user?.user_metadata?.name || "operator");

@Controller("api/notifications")
@UseGuards(RequireAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async listNotifications(
    @Query("unreadOnly") unreadOnly?: string,
    @Query("limit") limit?: string,
  ) {
    return {
      data: await this.notificationsService.listNotifications({
        unreadOnly: unreadOnly === "true",
        limit: limit ? Number(limit) : undefined,
      }),
    };
  }

  @Post()
  @HttpCode(201)
  async createNotification(@Req() req: any, @Body() body: any) {
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

  @Patch(":id/read")
  async markNotificationRead(@Req() req: any, @Param("id") id: string, @Body() body: any) {
    const data = await this.notificationsService.markNotificationRead(
      id,
      actorNameFromRequest(req, body?.read_by || body?.readBy),
    );

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

  @Post("mark-all-read")
  @HttpCode(200)
  async markAllNotificationsRead(@Req() req: any, @Body() body: any) {
    const result = await this.notificationsService.markAllNotificationsRead(
      actorNameFromRequest(req, body?.read_by || body?.readBy),
    );

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

  @Get("audit")
  async listAuditLogs(
    @Query("entityType") entityType?: string,
    @Query("entityId") entityId?: string,
    @Query("limit") limit?: string,
  ) {
    return {
      data: await this.notificationsService.listAuditLogs({
        entityType,
        entityId,
        limit: limit ? Number(limit) : undefined,
      }),
    };
  }

  @Post("audit")
  @HttpCode(201)
  async createAuditLog(@Req() req: any, @Body() body: any) {
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
}
