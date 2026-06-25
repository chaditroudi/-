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
import { ReceptionsService } from "./receptions.service.js";

const RECEPTION_READ_ROLES = [
  "responsable_reception", "chef_reception", "operateur_reception",
  "responsable_qualite", "inspecteur_qualite", "responsable_stock", "magasinier_wms",
];
const RECEPTION_WRITE_ROLES = [
  "responsable_reception", "chef_reception", "operateur_reception", "responsable_qualite",
];
const QUALITY_ROLES = [
  "responsable_qualite", "inspecteur_qualite", "resp_management_qualite", "resp_qualite_haccp",
];
const STORAGE_MOVE_ROLES = [
  ...RECEPTION_WRITE_ROLES, "responsable_stock", "magasinier_wms", "responsable_logistique",
];

const compactIds = (...values: unknown[]) =>
  values.map((value) => String(value || "")).filter(Boolean);

@Controller("api")
@UseGuards(RequireAuthGuard, RolesGuard)
export class ReceptionsController {
  constructor(private readonly receptionsService: ReceptionsService) {}

  @Get("receptions")
  @Roles(...RECEPTION_READ_ROLES)
  async list() {
    const data = await this.receptionsService.listReceptions();
    return { data };
  }

  @Get("receptions/raw-storage-overdue")
  @Roles(...RECEPTION_READ_ROLES)
  async rawStorageOverdue() {
    const data = await this.receptionsService.listRawStorageOverdueReceptions();
    return { data };
  }

  @Get("receptions/:receptionId")
  @Roles(...RECEPTION_READ_ROLES)
  async detail(@Param("receptionId") receptionId: string) {
    const data = await this.receptionsService.getReceptionById(receptionId);
    return { data };
  }

  @Get("receptions/:receptionId/lots")
  @Roles(...RECEPTION_READ_ROLES)
  async listLots(@Param("receptionId") receptionId: string) {
    const data = await this.receptionsService.listReceptionLots(receptionId);
    return { data };
  }

  @Get("receptions/:receptionId/qc-inspections")
  @Roles(...RECEPTION_READ_ROLES)
  async listQcInspections(@Param("receptionId") receptionId: string) {
    const data = await this.receptionsService.listQcInspections(receptionId);
    return { data };
  }

  @Get("qc-checklists")
  @Roles(...RECEPTION_READ_ROLES)
  async listQcChecklists(@Query("receptionType") receptionType?: string) {
    const data = await this.receptionsService.listQcChecklists(receptionType);
    return { data };
  }

  @Get("qc-checklists/:checklistId/items")
  @Roles(...RECEPTION_READ_ROLES)
  async listQcChecklistItems(@Param("checklistId") checklistId: string) {
    const data = await this.receptionsService.listQcChecklistItems(checklistId);
    return { data };
  }

  @Get("reception-lots/lookup")
  @Roles(...RECEPTION_READ_ROLES)
  async lookupLot(@Query("scan") scan: string) {
    const data = await this.receptionsService.findReceptionLotByScan(scan);
    return { data };
  }

  @Get("reception-lots/:lotId/units")
  @Roles(...RECEPTION_READ_ROLES)
  async listUnits(@Param("lotId") lotId: string) {
    const data = await this.receptionsService.listReceptionUnits(lotId);
    return { data };
  }

  @Get("reception-alerts")
  @Roles(...RECEPTION_READ_ROLES)
  async listAlerts() {
    const data = await this.receptionsService.listActiveAlerts();
    return { data };
  }

  @Patch("reception-alerts/:alertId/acknowledge")
  @Roles(...RECEPTION_READ_ROLES)
  async acknowledgeAlert(
    @Param("alertId") alertId: string,
    @Req() req: any,
    @Body() body: any,
  ) {
    const data = await this.receptionsService.updateReceptionAlertStatus(alertId, {
      status: "ACKNOWLEDGED",
      actorName: String(body?.actorName || ""),
    });
    publishRealtimeDbChange({
      type: "reception_alert_acknowledged",
      table: "reception_alerts",
      action: "UPDATE",
      actorId: req.auth?.user?.id || null,
      rowIds: compactIds((data as any)?.id),
      rows: [data].filter(Boolean),
      relatedTables: ["alerts", "notifications"],
    });
    return { data };
  }

  @Patch("reception-alerts/:alertId/resolve")
  @Roles(...RECEPTION_READ_ROLES)
  async resolveAlert(
    @Param("alertId") alertId: string,
    @Req() req: any,
    @Body() body: any,
  ) {
    const data = await this.receptionsService.updateReceptionAlertStatus(alertId, {
      status: "RESOLVED",
      actorName: String(body?.actorName || ""),
    });
    publishRealtimeDbChange({
      type: "reception_alert_resolved",
      table: "reception_alerts",
      action: "UPDATE",
      actorId: req.auth?.user?.id || null,
      rowIds: compactIds((data as any)?.id),
      rows: [data].filter(Boolean),
      relatedTables: ["alerts", "notifications"],
    });
    return { data };
  }

  @Get("qc/calibration-status")
  @Roles(...RECEPTION_READ_ROLES)
  async calibrationStatus() {
    const data = await this.receptionsService.getCalibrationStatus();
    return { data };
  }

  @Post("receptions/intake")
  @HttpCode(201)
  @Roles(...RECEPTION_WRITE_ROLES)
  async intake(@Req() req: any, @Body() body: any) {
    const data = await this.receptionsService.intake(body || {}, req.auth?.user || null);
    publishRealtimeDbChange({
      type: "reception_intake",
      table: "receptions_v2",
      action: "INSERT",
      actorId: req.auth?.user?.id || null,
      rowIds: compactIds((data as any).reception?.id),
      rows: [(data as any).reception].filter(Boolean),
      relatedTables: ["reception_lots", "reception_units", "stock_lots", "stock_summary", "system_notifications", "reception_alerts"],
    });
    return { data };
  }

  @Post("qc/start")
  @HttpCode(201)
  @Roles(...QUALITY_ROLES)
  async startQc(@Req() req: any, @Body() body: any) {
    const data = await this.receptionsService.startQcInspection(body || {}, req.auth?.user || null);
    publishRealtimeDbChange({
      type: "qc_started",
      table: "qc_inspections",
      action: "INSERT",
      actorId: req.auth?.user?.id || null,
      rowIds: compactIds((data as any)?.id),
      rows: [data].filter(Boolean),
      relatedTables: ["receptions_v2"],
    });
    return { data };
  }

  @Post("qc/submit")
  @Roles(...QUALITY_ROLES)
  async submitQc(@Req() req: any, @Body() body: any) {
    const data = await this.receptionsService.submitQcDecision(body || {}, req.auth?.user || null);
    publishRealtimeDbChange({
      type: "qc_submitted",
      table: "qc_inspections",
      action: "UPDATE",
      actorId: req.auth?.user?.id || null,
      rowIds: compactIds((data as any)?.id),
      rows: [data].filter(Boolean),
      relatedTables: ["qc_check_results", "receptions_v2", "reception_lots", "reception_units", "stock_lots", "stock_summary", "reception_alerts"],
    });
    return { data };
  }

  @Post("reception-units/mark-printed")
  @Roles(...RECEPTION_WRITE_ROLES)
  async markUnitPrinted(@Req() req: any, @Body() body: any) {
    const data = await this.receptionsService.markUnitPrinted(String(body?.unitId || ""), req.auth?.user || null);
    publishRealtimeDbChange({
      type: "label_printed",
      table: "reception_units",
      action: "UPDATE",
      actorId: req.auth?.user?.id || null,
      rowIds: compactIds((data as any)?.id),
      rows: [data].filter(Boolean),
      relatedTables: ["reception_lots"],
    });
    return { data };
  }

  @Post("reception-lots/:lotId/units")
  @HttpCode(201)
  @Roles(...RECEPTION_WRITE_ROLES)
  async createUnit(
    @Param("lotId") lotId: string,
    @Req() req: any,
    @Body() body: any,
  ) {
    const data = await this.receptionsService.createReceptionUnit({ ...(body || {}), lotId }, req.auth?.user || null);
    publishRealtimeDbChange({
      type: "reception_unit_created",
      table: "reception_units",
      action: "INSERT",
      actorId: req.auth?.user?.id || null,
      rowIds: compactIds((data as any)?.id),
      rows: [data].filter(Boolean),
      relatedTables: ["reception_lots", "receptions_v2"],
    });
    return { data };
  }

  @Post("reception-lots/:lotId/storage-moves")
  @HttpCode(201)
  @Roles(...STORAGE_MOVE_ROLES)
  async moveLotToStorage(
    @Param("lotId") lotId: string,
    @Req() req: any,
    @Body() body: any,
  ) {
    const data = await this.receptionsService.moveReceptionLotToStorage(
      { ...(body || {}), lotId },
      req.auth?.user || null,
    );
    publishRealtimeDbChange({
      type: "reception_lot_storage_moved",
      table: "reception_stock_movements",
      action: "INSERT",
      actorId: req.auth?.user?.id || null,
      rowIds: compactIds((data as any)?.movement?.id),
      rows: [(data as any)?.movement].filter(Boolean),
      relatedTables: ["reception_lots", "reception_units", "stock_lots", "stock_summary", "reception_audit_logs_v2"],
    });
    return { data };
  }

  // ── T-502 / T-503 — Weighing records ──────────────────────────────────────

  @Get("reception-lots/:lotId/weighings")
  @Roles(...RECEPTION_READ_ROLES)
  async listWeighings(@Param("lotId") lotId: string) {
    const data = await this.receptionsService.listWeighings(lotId);
    return { data };
  }

  @Post("reception-lots/:lotId/weighing")
  @HttpCode(201)
  @Roles(...RECEPTION_WRITE_ROLES)
  async recordWeighing(
    @Param("lotId") lotId: string,
    @Req() req: any,
    @Body() body: any,
  ) {
    const data = await this.receptionsService.recordWeighing(lotId, body || {}, req.auth?.user || null);
    publishRealtimeDbChange({
      type: "lot_weighing_recorded",
      table: "weighing_records",
      action: "INSERT",
      actorId: req.auth?.user?.id || null,
      rowIds: compactIds((data as any)?.weighing?.id),
      rows: [(data as any)?.weighing].filter(Boolean),
      relatedTables: ["reception_lots", "receptions_v2", "reception_audit_logs_v2", "epcis_events"],
    });
    return { data };
  }

  // ── T-201 / T-202 — GS1 label generation ─────────────────────────────────

  @Post("reception-lots/:lotId/label")
  @HttpCode(201)
  @Roles(...RECEPTION_WRITE_ROLES)
  async generateLotLabel(
    @Param("lotId") lotId: string,
    @Req() req: any,
  ) {
    const data = await this.receptionsService.generateLotLabel(lotId, req.auth?.user || null);
    publishRealtimeDbChange({
      type: "lot_label_printed",
      table: "reception_lots",
      action: "UPDATE",
      actorId: req.auth?.user?.id || null,
      rowIds: compactIds(lotId),
      rows: [],
      relatedTables: ["reception_audit_logs_v2", "epcis_events"],
    });
    return { data };
  }
}
