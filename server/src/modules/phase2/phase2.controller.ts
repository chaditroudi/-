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

const compactIds = (...values: unknown[]) =>
  values.flat().map((value) => String(value || "")).filter(Boolean);

const publishNotificationRows = (
  rows: unknown[],
  action: "INSERT" | "UPDATE",
  actorId: string | null,
  type: string,
) => {
  if (!Array.isArray(rows) || rows.length === 0) return;
  publishRealtimeDbChange({
    type,
    table: "system_notifications",
    action,
    actorId,
    rowIds: compactIds(rows.map((row: any) => row?.id)),
    rows,
  });
};

@Controller("api/phase2")
@UseGuards(RequireAuthGuard, RolesGuard)
export class Phase2Controller {
  constructor(private readonly phase2Service: Phase2Service) {}

  @Get("available-lots")
  @Roles(...PHASE2_ROLES)
  async listAvailableLots() {
    return { data: await this.phase2Service.listAvailableLots() };
  }

  @Get("fumigation/cycles")
  @Roles(...PHASE2_ROLES)
  async listFumigationCycles(@Query("status") status?: string) {
    return { data: await this.phase2Service.listFumigationCycles(status) };
  }

  @Get("fumigation/cycles/:id")
  @Roles(...PHASE2_ROLES)
  async getFumigationCycle(@Param("id") id: string) {
    return { data: await this.phase2Service.getFumigationCycle(id) };
  }

  @Get("fumigation/cycles/:id/readings")
  @Roles(...PHASE2_ROLES)
  async listFumigationSensorReadings(@Param("id") id: string) {
    return { data: await this.phase2Service.listFumigationSensorReadings(id) };
  }

  @Post("fumigation/cycles")
  @HttpCode(201)
  @Roles(...PHASE2_ROLES)
  async createFumigationCycle(@Req() req: any, @Body() body: any) {
    const data = await this.phase2Service.createFumigationCycle(body || {});
    publishRealtimeDbChange({
      type: "phase2_fumigation_cycle_created",
      table: "fumigation_cycles",
      action: "INSERT",
      actorId: req.auth?.user?.id || null,
      rowIds: compactIds((data as any)?.id),
      rows: [data].filter(Boolean),
    });
    return { data };
  }

  @Patch("fumigation/cycles/:id")
  @Roles(...PHASE2_ROLES)
  async updateFumigationCycle(@Req() req: any, @Param("id") id: string, @Body() body: any) {
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

  @Post("fumigation/cycles/:id/start")
  @Roles(...PHASE2_ROLES)
  async startFumigationCycle(@Req() req: any, @Param("id") id: string) {
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

  @Post("fumigation/cycles/:id/sign")
  @Roles(...PHASE2_ROLES)
  async signFumigationCycle(@Req() req: any, @Param("id") id: string, @Body() body: any) {
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

  @Post("fumigation/readings")
  @HttpCode(201)
  @Roles(...PHASE2_ROLES)
  async addFumigationSensorReading(@Req() req: any, @Body() body: any) {
    const result = await this.phase2Service.addFumigationSensorReading(body || {});
    publishRealtimeDbChange({
      type: "phase2_fumigation_reading_created",
      table: "fumigation_sensor_readings",
      action: "INSERT",
      actorId: req.auth?.user?.id || null,
      rowIds: compactIds((result.data as any)?.id),
      rows: [result.data].filter(Boolean),
      relatedTables: ["fumigation_cycles"],
    });
    publishNotificationRows(
      result.notifications,
      "INSERT",
      req.auth?.user?.id || null,
      "phase2_fumigation_alert_created",
    );
    return { data: result.data };
  }

  @Get("fumigation/kpis")
  @Roles(...PHASE2_ROLES)
  async getFumigationKpis() {
    return { data: await this.phase2Service.getFumigationKpis() };
  }

  @Get("cleaning/cycles")
  @Roles(...PHASE2_ROLES)
  async listCleaningCycles(@Query("status") status?: string) {
    return { data: await this.phase2Service.listCleaningCycles(status) };
  }

  @Get("cleaning/cycles/:id")
  @Roles(...PHASE2_ROLES)
  async getCleaningCycle(@Param("id") id: string) {
    return { data: await this.phase2Service.getCleaningCycle(id) };
  }

  @Post("cleaning/cycles")
  @HttpCode(201)
  @Roles(...PHASE2_ROLES)
  async createCleaningCycle(@Req() req: any, @Body() body: any) {
    const data = await this.phase2Service.createCleaningCycle(body || {});
    publishRealtimeDbChange({
      type: "phase2_cleaning_cycle_created",
      table: "cleaning_cycles",
      action: "INSERT",
      actorId: req.auth?.user?.id || null,
      rowIds: compactIds((data as any)?.id),
      rows: [data].filter(Boolean),
    });
    return { data };
  }

  @Post("cleaning/cycles/:id/close")
  @Roles(...PHASE2_ROLES)
  async closeCleaningCycle(@Req() req: any, @Param("id") id: string, @Body() body: any) {
    const result = await this.phase2Service.closeCleaningCycle(id, body || {});
    publishRealtimeDbChange({
      type: "phase2_cleaning_cycle_closed",
      table: "cleaning_cycles",
      action: "UPDATE",
      actorId: req.auth?.user?.id || null,
      rowIds: compactIds(id),
      rows: result.cycle ? [result.cycle] : [],
    });
    publishNotificationRows(
      result.notifications,
      "INSERT",
      req.auth?.user?.id || null,
      "phase2_cleaning_alert_created",
    );
    return { data: result.data };
  }

  @Patch("cleaning/cycles/:id")
  @Roles(...PHASE2_ROLES)
  async updateCleaningCycle(@Req() req: any, @Param("id") id: string, @Body() body: any) {
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

  @Get("cleaning/kpis")
  @Roles(...PHASE2_ROLES)
  async getCleaningKpis() {
    return { data: await this.phase2Service.getCleaningKpis() };
  }

  @Get("hydration/cycles")
  @Roles(...PHASE2_ROLES)
  async listHydrationCycles(@Query("status") status?: string) {
    return { data: await this.phase2Service.listHydrationCycles(status) };
  }

  @Get("hydration/cycles/:id")
  @Roles(...PHASE2_ROLES)
  async getHydrationCycle(@Param("id") id: string) {
    return { data: await this.phase2Service.getHydrationCycle(id) };
  }

  @Post("hydration/cycles")
  @HttpCode(201)
  @Roles(...PHASE2_ROLES)
  async createHydrationCycle(@Req() req: any, @Body() body: any) {
    const data = await this.phase2Service.createHydrationCycle(body || {});
    publishRealtimeDbChange({
      type: "phase2_hydration_cycle_created",
      table: "hydration_cycles",
      action: "INSERT",
      actorId: req.auth?.user?.id || null,
      rowIds: compactIds((data as any)?.id),
      rows: [data].filter(Boolean),
    });
    return { data };
  }

  @Post("hydration/cycles/:id/record-exit")
  @Roles(...PHASE2_ROLES)
  async recordHydrationExit(@Req() req: any, @Param("id") id: string, @Body() body: any) {
    const result = await this.phase2Service.recordHydrationExit(id, body || {});
    publishRealtimeDbChange({
      type: "phase2_hydration_exit_recorded",
      table: "hydration_cycles",
      action: "UPDATE",
      actorId: req.auth?.user?.id || null,
      rowIds: compactIds(id),
      rows: result.cycle ? [result.cycle] : [],
    });
    publishNotificationRows(
      result.notifications,
      "INSERT",
      req.auth?.user?.id || null,
      "phase2_hydration_alert_created",
    );
    return { data: result.data };
  }

  @Post("hydration/cycles/:id/close")
  @Roles(...PHASE2_ROLES)
  async closeHydrationCycle(@Req() req: any, @Param("id") id: string, @Body() body: any) {
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

  @Patch("hydration/cycles/:id/sensors")
  @Roles(...PHASE2_ROLES)
  async updateHydrationSensors(@Req() req: any, @Param("id") id: string, @Body() body: any) {
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

  @Get("hydration/kpis")
  @Roles(...PHASE2_ROLES)
  async getHydrationKpis() {
    return { data: await this.phase2Service.getHydrationKpis() };
  }

  @Get("triage/sessions")
  @Roles(...PHASE2_ROLES)
  async listTriageSessions(@Query("status") status?: string) {
    return { data: await this.phase2Service.listTriageSessions(status) };
  }

  @Get("triage/sessions/:id")
  @Roles(...PHASE2_ROLES)
  async getTriageSession(@Param("id") id: string) {
    return { data: await this.phase2Service.getTriageSession(id) };
  }

  @Get("triage/sessions/:id/quality-checks")
  @Roles(...PHASE2_ROLES)
  async listTriageQualityChecks(@Param("id") id: string) {
    return { data: await this.phase2Service.listTriageQualityChecks(id) };
  }

  @Get("triage/sessions/:id/sub-lots")
  @Roles(...PHASE2_ROLES)
  async listTriageSublots(@Param("id") id: string) {
    return { data: await this.phase2Service.listTriageSublots(id) };
  }

  @Post("triage/sessions")
  @HttpCode(201)
  @Roles(...PHASE2_ROLES)
  async createTriageSession(@Req() req: any, @Body() body: any) {
    const data = await this.phase2Service.createTriageSession(body || {});
    publishRealtimeDbChange({
      type: "phase2_triage_session_created",
      table: "triage_sessions",
      action: "INSERT",
      actorId: req.auth?.user?.id || null,
      rowIds: compactIds((data as any)?.id),
      rows: [data].filter(Boolean),
    });
    return { data };
  }

  @Patch("triage/sessions/:id/weights")
  @Roles(...PHASE2_ROLES)
  async updateTriageWeights(@Req() req: any, @Param("id") id: string, @Body() body: any) {
    const result = await this.phase2Service.updateTriageWeights(id, body || {});
    publishRealtimeDbChange({
      type: "phase2_triage_weights_updated",
      table: "triage_sessions",
      action: "UPDATE",
      actorId: req.auth?.user?.id || null,
      rowIds: compactIds(id),
      rows: result.session ? [result.session] : [],
    });
    publishNotificationRows(
      result.notifications,
      "INSERT",
      req.auth?.user?.id || null,
      "phase2_triage_alert_created",
    );
    return { data: result.data };
  }

  @Post("triage/sessions/:id/quality-checks")
  @HttpCode(201)
  @Roles(...PHASE2_ROLES)
  async addTriageQualityCheck(@Req() req: any, @Param("id") id: string, @Body() body: any) {
    const result = await this.phase2Service.addTriageQualityCheck({ ...(body || {}), session_id: id });
    publishRealtimeDbChange({
      type: "phase2_triage_quality_check_created",
      table: "triage_quality_checks",
      action: "INSERT",
      actorId: req.auth?.user?.id || null,
      rowIds: compactIds((result.data as any)?.id),
      rows: [result.data].filter(Boolean),
      relatedTables: ["triage_sessions"],
    });
    publishNotificationRows(
      result.notifications,
      "INSERT",
      req.auth?.user?.id || null,
      "phase2_triage_quality_alert_created",
    );
    return { data: result.data };
  }

  @Post("triage/sessions/:id/close")
  @Roles(...PHASE2_ROLES)
  async closeTriageSession(@Req() req: any, @Param("id") id: string) {
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

  @Post("triage/sessions/:id/toggle-run")
  @Roles(...PHASE2_ROLES)
  async toggleTriageRunState(@Req() req: any, @Param("id") id: string, @Body() body: any) {
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

  @Get("triage/kpis")
  @Roles(...PHASE2_ROLES)
  async getTriageKpis() {
    return { data: await this.phase2Service.getTriageKpis() };
  }

  @Get("traceability/:lotNumber")
  @Roles(...PHASE2_ROLES)
  async getLotTraceability(@Param("lotNumber") lotNumber: string) {
    return { data: await this.phase2Service.getLotTraceability(lotNumber) };
  }

  @Get("traceability/:lotNumber/genealogy")
  @Roles(...PHASE2_ROLES)
  async getLotGenealogy(@Param("lotNumber") lotNumber: string) {
    return { data: await this.phase2Service.getLotGenealogy(lotNumber) };
  }

  @Post("alerts/:id/acknowledge")
  @Roles(...PHASE2_ROLES)
  async acknowledgePhase2Alert(@Req() req: any, @Param("id") id: string, @Body() body: any) {
    const data = await this.phase2Service.acknowledgePhase2Alert(
      id,
      String(body?.read_by || body?.readBy || req.auth?.user?.email || "operator"),
    );
    publishNotificationRows(
      [data].filter(Boolean),
      "UPDATE",
      req.auth?.user?.id || null,
      "phase2_alert_acknowledged",
    );
    return { data };
  }

  @Post("alerts/acknowledge-all")
  @Roles(...PHASE2_ROLES)
  async acknowledgeAllPhase2Alerts(@Req() req: any, @Body() body: any) {
    const result = await this.phase2Service.acknowledgeAllPhase2Alerts(
      String(body?.read_by || body?.readBy || req.auth?.user?.email || "operator"),
    );
    publishNotificationRows(
      result.notifications,
      "UPDATE",
      req.auth?.user?.id || null,
      "phase2_alerts_acknowledged_all",
    );
    return { data: result.data };
  }
}
