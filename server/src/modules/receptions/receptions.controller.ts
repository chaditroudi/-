import { createHash } from "node:crypto";

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";

import { hasAnyRole, STAFF_READ_ROLES } from "../../middleware/authorization.js";
import { Roles } from "../../nest/route-metadata.js";
import { RequireAuthGuard, RolesGuard } from "../../nest/route-guards.js";
import { publishRealtimeDbChange } from "../realtime/realtime.bus.js";
import { IdempotencyService } from "../trust/idempotency.service.js";
import {
  QUALITY_ROLES,
  RECEPTION_CANCEL_ROLES,
  RECEPTION_READ_ROLES,
  RECEPTION_WRITE_ROLES,
  STORAGE_MOVE_ROLES,
} from "./reception-roles.js";
import { ReceptionDraftsService } from "./reception-drafts.service.js";
import { ReceptionsService } from "./receptions.service.js";

/** Plant staff refresh on these events; portal accounts never see them. Events name what changed, never carry the record. */
const RECEPTION_EVENT_ROLES = STAFF_READ_ROLES;

/** What makes two confirmations of one draft the same delivery. Key order is fixed here. */
const intakeFingerprint = (body: any) =>
  createHash("sha256")
    .update(JSON.stringify({
      supplier: body?.supplier_id ?? null,
      order: body?.purchase_order_id ?? null,
      line: body?.purchase_order_line_id ?? null,
      gross: Number(body?.gross_weight_kg ?? 0),
      tare: Number(body?.tare_weight_kg ?? 0),
      readings: [body?.gross_reading_id ?? null, body?.tare_reading_id ?? null],
      lots: (Array.isArray(body?.lots) ? body.lots : []).map((lot: any) => [lot?.lot_supplier ?? null, Number(lot?.quantity ?? 0)]),
    }))
    .digest("hex");

const RECEPTION_CHANGE_TABLES = [
  "receptions_v2", "reception_lots", "reception_units", "stock_lots", "stock_summary",
  "reception_audit_logs_v2", "purchase_orders", "purchase_order_lines",
];

const compactIds = (...values: unknown[]) =>
  values.map((value) => String(value || "")).filter(Boolean);

@Controller("api")
@UseGuards(RequireAuthGuard, RolesGuard)
export class ReceptionsController {
  constructor(
    private readonly receptionsService: ReceptionsService,
    private readonly idempotency: IdempotencyService,
    private readonly drafts: ReceptionDraftsService,
  ) {}

  private publish(event: Parameters<typeof publishRealtimeDbChange>[0]) {
    publishRealtimeDbChange({ ...event, rows: [], targetRoles: RECEPTION_EVENT_ROLES });
  }

  @Get("receptions")
  @Roles(...RECEPTION_READ_ROLES)
  async list() {
    const data = await this.receptionsService.listReceptions();
    return { data };
  }

  @Get("receptions/search")
  @Roles(...RECEPTION_READ_ROLES)
  async search(
    @Query("q") q?: string,
    @Query("status") status?: string,
    @Query("supplierId") supplierId?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("limit") limit?: string,
    @Query("before") before?: string,
  ) {
    const data = await this.receptionsService.searchReceptions({
      q, status, supplierId, from, to, before, limit: Number(limit) || undefined,
    });
    return { data };
  }

  // ── Deliveries in progress ────────────────────────────────────────────────

  @Get("reception-drafts")
  @Roles(...RECEPTION_READ_ROLES)
  async listDrafts() {
    return { data: await this.drafts.listOpen() };
  }

  @Get("reception-drafts/:id")
  @Roles(...RECEPTION_READ_ROLES)
  async getDraft(@Param("id") id: string) {
    return { data: await this.drafts.get(id) };
  }

  @Put("reception-drafts/:id")
  @Roles(...RECEPTION_WRITE_ROLES)
  async saveDraft(@Param("id") id: string, @Req() req: any, @Body() body: any) {
    const data = await this.drafts.save({ ...(body || {}), id }, req.auth?.user?.id || null);
    this.publish({
      type: "reception_draft_saved",
      table: "reception_drafts",
      resource: "receptions",
      action: "UPSERT",
      actorId: req.auth?.user?.id || null,
      rowIds: [id],
    });
    return { data };
  }

  @Delete("reception-drafts/:id")
  @Roles(...RECEPTION_WRITE_ROLES)
  async abandonDraft(@Param("id") id: string, @Req() req: any) {
    const data = await this.drafts.abandon(id, req.auth?.user?.id || null);
    this.publish({
      type: "reception_draft_abandoned",
      table: "reception_drafts",
      resource: "receptions",
      action: "UPDATE",
      actorId: req.auth?.user?.id || null,
      rowIds: [id],
    });
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

  @Get("receptions/:receptionId/audit-logs")
  @Roles(...RECEPTION_READ_ROLES)
  async listAuditLogs(@Param("receptionId") receptionId: string) {
    const data = await this.receptionsService.listReceptionAuditLogs(receptionId);
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
  @Roles(...RECEPTION_WRITE_ROLES, ...QUALITY_ROLES)
  async acknowledgeAlert(
    @Param("alertId") alertId: string,
    @Req() req: any,
  ) {
    const data = await this.receptionsService.updateReceptionAlertStatus(
      alertId,
      { status: "ACKNOWLEDGED" },
      req.auth?.user || null,
    );
    this.publish({
      type: "reception_alert_acknowledged",
      table: "reception_alerts",
      action: "UPDATE",
      actorId: req.auth?.user?.id || null,
      rowIds: compactIds((data as any)?.id),
      relatedTables: ["alerts", "notifications"],
    });
    return { data };
  }

  @Patch("reception-alerts/:alertId/resolve")
  @Roles(...RECEPTION_CANCEL_ROLES, ...QUALITY_ROLES)
  async resolveAlert(
    @Param("alertId") alertId: string,
    @Req() req: any,
  ) {
    const data = await this.receptionsService.updateReceptionAlertStatus(
      alertId,
      { status: "RESOLVED" },
      req.auth?.user || null,
    );
    this.publish({
      type: "reception_alert_resolved",
      table: "reception_alerts",
      action: "UPDATE",
      actorId: req.auth?.user?.id || null,
      rowIds: compactIds((data as any)?.id),
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
    const result = await this.idempotency.execute({
      scope: "reception_intake",
      key: body?.client_request_id,
      actorId: req.auth?.user?.id || null,
      fingerprint: intakeFingerprint(body),
      run: () => this.receptionsService.intake(body || {}, req.auth?.user || null),
    });
    const data = result.data;
    if (result.replayed) return { data, meta: { replayed: true } };

    this.publish({
      type: "reception_intake",
      table: "receptions_v2",
      action: "INSERT",
      actorId: req.auth?.user?.id || null,
      rowIds: compactIds((data as any).reception?.id),
      relatedTables: [
        "reception_lots", "reception_units", "stock_lots", "stock_summary", "reception_alerts",
        "purchase_orders", "purchase_order_lines",
      ],
    });
    return { data };
  }

  @Post("receptions/:receptionId/corrections")
  @HttpCode(200)
  @Roles(...RECEPTION_CANCEL_ROLES)
  async correct(
    @Param("receptionId") receptionId: string,
    @Req() req: any,
    @Body() body: any,
  ) {
    const data = await this.receptionsService.correctReception(receptionId, body || {}, req.auth?.user || null);
    this.publish({
      type: "reception_corrected",
      table: "receptions_v2",
      action: "UPDATE",
      actorId: req.auth?.user?.id || null,
      rowIds: compactIds(receptionId),
      relatedTables: ["reception_audit_logs_v2"],
    });
    return { data };
  }

  @Post("qc/start")
  @HttpCode(201)
  @Roles(...QUALITY_ROLES)
  async startQc(@Req() req: any, @Body() body: any) {
    const data = await this.receptionsService.startQcInspection(body || {}, req.auth?.user || null);
    this.publish({
      type: "qc_started",
      table: "qc_inspections",
      action: "INSERT",
      actorId: req.auth?.user?.id || null,
      rowIds: compactIds((data as any)?.id),
      relatedTables: ["receptions_v2"],
    });
    return { data };
  }

  @Post("qc/submit")
  @Roles(...QUALITY_ROLES)
  async submitQc(@Req() req: any, @Body() body: any) {
    const data = await this.receptionsService.submitQcDecision(body || {}, req.auth?.user || null);
    this.publish({
      type: "qc_submitted",
      table: "qc_inspections",
      action: "UPDATE",
      actorId: req.auth?.user?.id || null,
      rowIds: compactIds((data as any)?.id),
      relatedTables: ["qc_check_results", "receptions_v2", "reception_lots", "reception_units", "stock_lots", "stock_summary", "reception_alerts"],
    });
    return { data };
  }

  @Post("reception-units/mark-printed")
  @Roles(...RECEPTION_WRITE_ROLES)
  async markUnitPrinted(@Req() req: any, @Body() body: any) {
    const data = await this.receptionsService.markUnitPrinted(String(body?.unitId || ""), req.auth?.user || null);
    this.publish({
      type: "label_printed",
      table: "reception_units",
      action: "UPDATE",
      actorId: req.auth?.user?.id || null,
      rowIds: compactIds((data as any)?.id),
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
    this.publish({
      type: "reception_unit_created",
      table: "reception_units",
      action: "INSERT",
      actorId: req.auth?.user?.id || null,
      rowIds: compactIds((data as any)?.id),
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
    this.publish({
      type: "reception_lot_storage_moved",
      table: "reception_stock_movements",
      action: "INSERT",
      actorId: req.auth?.user?.id || null,
      rowIds: compactIds((data as any)?.movement?.id),
      relatedTables: ["reception_lots", "reception_units", "stock_lots", "stock_summary", "reception_audit_logs_v2"],
    });
    return { data };
  }

  @Post("receptions/:receptionId/cancel")
  @HttpCode(200)
  @Roles(...RECEPTION_CANCEL_ROLES)
  async cancel(
    @Param("receptionId") receptionId: string,
    @Req() req: any,
    @Body() body: any,
  ) {
    const data = await this.receptionsService.cancelReception(receptionId, body || {}, req.auth?.user || null);
    this.publish({
      type: "reception_cancelled",
      table: "receptions_v2",
      action: "UPDATE",
      actorId: req.auth?.user?.id || null,
      rowIds: compactIds((data as any)?.reception?.id),
      relatedTables: RECEPTION_CHANGE_TABLES,
    });
    return { data };
  }

  @Post("receptions/:receptionId/quality-block")
  @HttpCode(200)
  @Roles(...QUALITY_ROLES)
  async qualityBlock(
    @Param("receptionId") receptionId: string,
    @Req() req: any,
    @Body() body: any,
  ) {
    const data = await this.receptionsService.blockReceptionForLab(receptionId, body || {}, req.auth?.user || null);
    this.publish({
      type: "reception_quality_blocked",
      table: "receptions_v2",
      action: "UPDATE",
      actorId: req.auth?.user?.id || null,
      rowIds: compactIds((data as any)?.reception?.id),
      relatedTables: RECEPTION_CHANGE_TABLES,
    });
    return { data };
  }

  @Post("reception-lots/:lotId/quality-status")
  @HttpCode(200)
  @Roles(...QUALITY_ROLES)
  async changeLotQualityStatus(
    @Param("lotId") lotId: string,
    @Req() req: any,
    @Body() body: any,
  ) {
    const data = await this.receptionsService.changeLotQualityStatus(lotId, body || {}, req.auth?.user || null);
    this.publish({
      type: "reception_lot_quality_changed",
      table: "reception_lots",
      action: "UPDATE",
      actorId: req.auth?.user?.id || null,
      rowIds: compactIds(lotId),
      relatedTables: RECEPTION_CHANGE_TABLES,
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
    const data = await this.receptionsService.recordWeighing(lotId, body || {}, req.auth?.user || null, {
      canAmend: hasAnyRole(req, RECEPTION_CANCEL_ROLES),
    });
    this.publish({
      type: "lot_weighing_recorded",
      table: "weighing_records",
      action: "INSERT",
      actorId: req.auth?.user?.id || null,
      rowIds: compactIds((data as any)?.weighing?.id),
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
    this.publish({
      type: "lot_label_printed",
      table: "reception_lots",
      action: "UPDATE",
      actorId: req.auth?.user?.id || null,
      rowIds: compactIds(lotId),
      relatedTables: ["reception_audit_logs_v2", "epcis_events"],
    });
    return { data };
  }
}
