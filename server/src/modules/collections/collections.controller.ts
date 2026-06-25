import { Body, Controller, Post, Req, UseGuards } from "@nestjs/common";

import { appendActionAudit } from "../../middleware/security-audit.js";
import { DbAction } from "../../nest/route-metadata.js";
import { DbActionGuard, RequireAuthGuard } from "../../nest/route-guards.js";
import { publishRealtimeDbChange } from "../realtime/realtime.bus.js";
import { CollectionsService } from "./collections.service.js";

const readRowIds = (rows: any[]) => rows.map((row) => String(row?.id || "")).filter(Boolean);

const relatedTablesByTable: Record<string, string[]> = {
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

const publishCollectionChange = (
  table: string,
  action: "INSERT" | "UPDATE" | "DELETE",
  rows: any[],
  actorId?: string | null,
  before?: any[],
) => {
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

@Controller("api/db")
@UseGuards(RequireAuthGuard, DbActionGuard)
export class CollectionsController {
  constructor(private readonly collectionsService: CollectionsService) {}

  @Post("query")
  @DbAction("read")
  async query(@Body() body: any) {
    const data = await this.collectionsService.query(body || {});
    return { data };
  }

  @Post("insert")
  @DbAction("write")
  async insert(@Req() req: any, @Body() body: any) {
    const actorId = req.auth?.user?.id || null;
    const table = String(body?.table || "");
    const data = await this.collectionsService.insert({ ...(body || {}), actorId });
    publishCollectionChange(table, "INSERT", data, actorId);
    appendActionAudit(req, "INSERT", table, data).catch(() => {});
    return { data };
  }

  @Post("update")
  @DbAction("write")
  async update(@Req() req: any, @Body() body: any) {
    const actorId = req.auth?.user?.id || null;
    const table = String(body?.table || "");
    const result = await this.collectionsService.update({ ...(body || {}), actorId });
    publishCollectionChange(table, "UPDATE", result.after, actorId, result.before);
    appendActionAudit(req, "UPDATE", table, result.after, result.before).catch(() => {});
    return { data: result.after, before: result.before };
  }

  @Post("delete")
  @DbAction("write")
  async remove(@Req() req: any, @Body() body: any) {
    const table = String(body?.table || "");
    const data = await this.collectionsService.remove(body || {});
    publishCollectionChange(table, "DELETE", data, req.auth?.user?.id || null);
    appendActionAudit(req, "DELETE", table, data).catch(() => {});
    return { data };
  }
}
