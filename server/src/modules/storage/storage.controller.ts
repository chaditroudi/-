import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query, Req, UseGuards } from "@nestjs/common";

import { Roles } from "../../nest/route-metadata.js";
import { RequireAuthGuard, RolesGuard } from "../../nest/route-guards.js";
import { publishRealtimeDbChange } from "../realtime/realtime.bus.js";
import { StorageService } from "./storage.service.js";

const STORAGE_ROLES = [
  "responsable_stock", "magasinier_wms", "responsable_logistique",
  "responsable_reception", "chef_reception", "operateur_reception",
  "responsable_maintenance", "technicien_maintenance",
];

const compactIds = (...values: unknown[]) =>
  values.flat().map((value) => String(value || "")).filter(Boolean);

const publishRows = (
  rows: unknown[],
  table: string,
  action: "INSERT" | "UPDATE" | "DELETE" | "UPSERT" | "SYNC",
  actorId: string | null,
  type: string,
  relatedTables?: string[],
) => {
  if (!Array.isArray(rows) || rows.length === 0) return;
  publishRealtimeDbChange({
    type,
    table,
    action,
    actorId,
    rows,
    rowIds: compactIds(rows.map((row: any) => row?.id)),
    relatedTables,
  });
};

@Controller("api/storage")
@UseGuards(RequireAuthGuard, RolesGuard)
@Roles(...STORAGE_ROLES)
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Get("module3/zones")
  async listModule3Zones() {
    return { data: await this.storageService.listModule3Zones() };
  }

  @Get("module3/locations")
  async listModule3Locations(@Query("storageZoneId") storageZoneId?: string) {
    return { data: await this.storageService.listModule3Locations(storageZoneId ? String(storageZoneId) : undefined) };
  }

  @Get("module3/readings")
  async listStorageReadings(@Query("limit") limit?: string) {
    return { data: await this.storageService.listStorageConditionReadings(limit ? Number(limit) : undefined) };
  }

  @Get("module3/location-movements")
  async listStorageLocationMovements(@Query("limit") limit?: string) {
    return { data: await this.storageService.listStorageLocationMovements(limit ? Number(limit) : undefined) };
  }

  @Get("module3/door-events")
  async listStorageDoorEvents(@Query("limit") limit?: string) {
    return { data: await this.storageService.listStorageDoorEvents(limit ? Number(limit) : undefined) };
  }

  @Get("module3/dlc-alerts")
  async listStorageDlcAlerts(@Query("limit") limit?: string) {
    return { data: await this.storageService.listStorageDlcAlerts(limit ? Number(limit) : undefined) };
  }

  @Post("module3/zones")
  @HttpCode(201)
  async createZone(@Req() req: any, @Body() body: any) {
    const data = await this.storageService.createZone(body || {});
    publishRows([data], "storage_zones", "INSERT", req.auth?.user?.id || null, "storage_zone_created");
    return { data };
  }

  @Put("module3/zones/:id")
  async updateZone(@Req() req: any, @Param("id") id: string, @Body() body: any) {
    const data = await this.storageService.updateZone(id, body || {});
    publishRows([data], "storage_zones", "UPDATE", req.auth?.user?.id || null, "storage_zone_updated");
    return { data };
  }

  @Delete("module3/zones/:id")
  async deleteZone(@Req() req: any, @Param("id") id: string) {
    const data = await this.storageService.deleteZone(id);
    publishRealtimeDbChange({ type: "storage_zone_deleted", table: "storage_zones", action: "DELETE", actorId: req.auth?.user?.id || null, rows: [data], rowIds: [id], relatedTables: ["storage_locations"] });
    return { data };
  }

  @Post("module3/locations")
  @HttpCode(201)
  async createLocation(@Req() req: any, @Body() body: any) {
    const data = await this.storageService.createLocation(body || {});
    publishRows([data], "storage_locations", "INSERT", req.auth?.user?.id || null, "storage_location_created");
    return { data };
  }

  @Put("module3/locations/:id")
  async updateLocation(@Req() req: any, @Param("id") id: string, @Body() body: any) {
    const data = await this.storageService.updateLocation(id, body || {});
    publishRows([data], "storage_locations", "UPDATE", req.auth?.user?.id || null, "storage_location_updated");
    return { data };
  }

  @Delete("module3/locations/:id")
  async deleteLocation(@Req() req: any, @Param("id") id: string) {
    const data = await this.storageService.deleteLocation(id);
    publishRealtimeDbChange({ type: "storage_location_deleted", table: "storage_locations", action: "DELETE", actorId: req.auth?.user?.id || null, rows: [data], rowIds: [id] });
    return { data };
  }

  @Post("module3/seed")
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

  @Post("readings")
  @HttpCode(201)
  async recordReading(@Req() req: any, @Body() body: any) {
    const data = await this.storageService.recordReading(body || {}, req.auth?.user || null);
    publishRealtimeDbChange({
      type: "storage_reading",
      table: "storage_condition_readings",
      action: "INSERT",
      rows: [(data as any)?.reading].filter(Boolean),
      rowIds: compactIds((data as any)?.reading?.id),
      relatedTables: ["storage_zones", "module3-storage-readings", "alerts", "system_notifications"],
    });
    publishRows((data as any)?.alerts || [], "alerts", "INSERT", req.auth?.user?.id || null, "storage_alert_created", ["system_notifications"]);
    publishRows((data as any)?.notifications || [], "system_notifications", "INSERT", req.auth?.user?.id || null, "storage_notification_created");
    return { data };
  }

  @Post("door-events")
  @HttpCode(201)
  async recordDoorEvent(@Req() req: any, @Body() body: any) {
    const data = await this.storageService.recordDoorEvent(body || {}, req.auth?.user || null);
    publishRealtimeDbChange({
      type: "storage_door_event",
      table: "storage_door_events",
      action: "INSERT",
      rows: [(data as any)?.event].filter(Boolean),
      rowIds: compactIds((data as any)?.event?.id),
      relatedTables: ["storage_zones", "module3-storage-door-events", "alerts", "system_notifications"],
    });
    publishRows((data as any)?.alerts || [], "alerts", "INSERT", req.auth?.user?.id || null, "storage_alert_created", ["system_notifications"]);
    publishRows((data as any)?.notifications || [], "system_notifications", "INSERT", req.auth?.user?.id || null, "storage_notification_created");
    return { data };
  }

  @Post("suggest-location")
  async suggestLocation(@Body() body: any) {
    const data = await this.storageService.suggestLocation(body || {});
    return { data };
  }

  @Post("suggest-fefo")
  async suggestFefo(@Body() body: any) {
    const data = await this.storageService.suggestFefo(body || {});
    return { data };
  }

  @Post("rules/evaluate")
  async evaluateBusinessRules() {
    const data = await this.storageService.evaluateBusinessRules();
    publishRealtimeDbChange({
      type: "storage_rules_evaluated",
      table: "alerts",
      action: "SYNC",
      relatedTables: ["stock_lots", "stock_summary", "alerts", "system_notifications", "storage_cycle_counts"],
    });
    publishRows((data as any)?.alerts || [], "alerts", "INSERT", null, "storage_alert_created", ["system_notifications"]);
    publishRows((data as any)?.notifications || [], "system_notifications", "INSERT", null, "storage_notification_created");
    publishRows((data as any)?.cycleCounts || [], "storage_cycle_counts", "INSERT", null, "storage_cycle_count_created");
    return { data };
  }

  @Post("move")
  async moveStock(@Req() req: any, @Body() body: any) {
    const data = await this.storageService.moveStock(body || {}, req.auth?.user || null);
    publishRealtimeDbChange({
      type: "stock_moved",
      table: "stock_movements",
      action: "INSERT",
      rows: [(data as any)?.movement].filter(Boolean),
      rowIds: compactIds((data as any)?.movement?.id),
      relatedTables: ["stock_lots", "stock_locations", "stock_summary", "storage_location_movements", "module3-storage-location-movements", "alerts", "system_notifications"],
    });
    publishRows((data as any)?.alerts || [], "alerts", "INSERT", req.auth?.user?.id || null, "storage_alert_created", ["system_notifications"]);
    publishRows((data as any)?.notifications || [], "system_notifications", "INSERT", req.auth?.user?.id || null, "storage_notification_created");
    return { data };
  }
}
