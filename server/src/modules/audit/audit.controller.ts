import { Controller, Get, Query, UseGuards } from "@nestjs/common";

import { RequireAuthGuard } from "../../nest/route-guards.js";
import { AuditService } from "./audit.service.js";

@Controller("api/audit")
@UseGuards(RequireAuthGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get("logs")
  async logs(
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
    @Query("userId") userId?: string,
    @Query("module") module?: string,
    @Query("eventType") eventType?: string,
    @Query("table") table?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
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

  @Get("stats")
  async stats(@Query("from") from?: string) {
    return this.auditService.getStats(from ? String(from) : undefined);
  }
}
