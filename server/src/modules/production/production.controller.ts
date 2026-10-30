import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { badRequest } from "../../core/app-error.js";
import { PRODUCTION_ROLES, STAFF_READ_ROLES } from "../../middleware/authorization.js";
import { Roles } from "../../nest/route-metadata.js";
import { RequireAuthGuard, RolesGuard } from "../../nest/route-guards.js";
import { CollectionsService } from "../collections/collections.service.js";
import { PRODUCTION_LIFECYCLE_FIELDS, ProductionService } from "./production.service.js";

/** The acting user always comes from the session, never from the request body. */
const actorOf = (req: any): string | null => req.auth?.user?.id ?? null;

@Controller("api/production")
@UseGuards(RequireAuthGuard, RolesGuard)
export class ProductionController {
  constructor(
    private readonly cs: CollectionsService,
    private readonly productionService: ProductionService,
  ) {}

  // ── Configuration (flux codes, order & step statuses) ────────────────────

  @Get("config")
  @Roles(...STAFF_READ_ROLES)
  async getConfig() {
    const [fluxCodes, orderStatuses, stepStatuses] = await Promise.all([
      this.cs.query({ table: "production_flux_codes", filters: [], orderBy: { column: "code", ascending: true } }),
      this.cs.query({ table: "production_order_statuses", filters: [], orderBy: { column: "code", ascending: true } }),
      this.cs.query({ table: "production_step_statuses", filters: [], orderBy: { column: "code", ascending: true } }),
    ]);
    return { data: { flux_codes: fluxCodes, order_statuses: orderStatuses, step_statuses: stepStatuses } };
  }

  // ── Step Definitions ──────────────────────────────────────────────────────

  @Get("step-definitions")
  @Roles(...STAFF_READ_ROLES)
  async listStepDefinitions() {
    const data = await this.cs.query({ table: "production_step_definitions", filters: [], orderBy: { column: "sequence_order", ascending: true } });
    return { data };
  }

  // ── Quality Checks ────────────────────────────────────────────────────────

  @Get("quality-checks")
  @Roles(...STAFF_READ_ROLES)
  async listQualityChecks(@Query("step_id") stepId?: string) {
    const filters: any[] = [];
    if (stepId) filters.push({ type: "eq", column: "production_step_id", value: stepId });
    const data = await this.cs.query({ table: "quality_checks", filters, orderBy: { column: "created_at", ascending: false } });
    return { data };
  }

  @Post("quality-checks")
  @Roles(...PRODUCTION_ROLES)
  async createQualityCheck(@Body() body: any) {
    const data = await this.cs.insert({ table: "quality_checks", values: body });
    return { data: data[0] };
  }

  // ── Audit Logs ────────────────────────────────────────────────────────────

  @Post("audit-logs")
  @Roles(...PRODUCTION_ROLES)
  async createAuditLog(@Body() body: any) {
    const data = await this.cs.insert({ table: "production_audit_logs", values: body });
    return { data: data[0] };
  }

  // ── Libered Lots (STOCK_LIBERE reception lots) ────────────────────────────

  @Get("libered-lots")
  @Roles(...STAFF_READ_ROLES)
  async listLiberedLots(@Query("order_id") orderId?: string) {
    return { data: await this.productionService.listAvailableLots(orderId || null) };
  }

  // ── Steps ─────────────────────────────────────────────────────────────────

  @Get("steps")
  @Roles(...STAFF_READ_ROLES)
  async listSteps(@Query("order_id") orderId?: string) {
    const filters: any[] = [];
    if (orderId) filters.push({ type: "eq", column: "production_order_id", value: orderId });
    const data = await this.cs.query({ table: "production_steps", filters, orderBy: { column: "sequence_order", ascending: true } });
    return { data };
  }

  @Post("steps")
  @Roles(...PRODUCTION_ROLES)
  async createStep(@Body() body: any) {
    const data = await this.cs.insert({ table: "production_steps", values: body });
    return { data: data[0] };
  }

  @Patch("steps/:id")
  @Roles(...PRODUCTION_ROLES)
  async updateStep(@Param("id") id: string, @Body() body: any) {
    const { after } = await this.cs.update({ table: "production_steps", filters: [{ type: "eq", column: "id", value: id }], values: body });
    return { data: after[0] };
  }

  // ── Lot Allocations ───────────────────────────────────────────────────────

  @Get("allocations")
  @Roles(...STAFF_READ_ROLES)
  async listAllocations(@Query("order_id") orderId?: string) {
    if (!orderId) throw badRequest("ORDER_REQUIRED", "order_id est requis.");
    return { data: await this.productionService.listAllocations(orderId) };
  }

  @Delete("allocations/:id")
  @Roles(...PRODUCTION_ROLES)
  async deleteAllocation(@Param("id") id: string, @Req() req: any) {
    return { data: await this.productionService.removeAllocation(id, actorOf(req)) };
  }

  // ── Output Lots ───────────────────────────────────────────────────────────

  @Get("output-lots")
  @Roles(...STAFF_READ_ROLES)
  async listOutputLots(@Query("order_id") orderId?: string) {
    const filters: any[] = [];
    if (orderId) filters.push({ type: "eq", column: "production_order_id", value: orderId });
    const data = await this.cs.query({ table: "production_output_lots", filters, orderBy: { column: "recorded_at", ascending: true } });
    return { data };
  }

  @Post("output-lots")
  @Roles(...PRODUCTION_ROLES)
  async createOutputLot(@Body() body: any) {
    const data = await this.cs.insert({ table: "production_output_lots", values: body });
    return { data: data[0] };
  }

  // ── Orders — summary must come before :id param route ────────────────────

  @Get("orders/summary")
  @Roles(...STAFF_READ_ROLES)
  async getOrdersSummary() {
    const data = await this.productionService.getSummary();
    return { data };
  }

  @Get("orders/:id")
  @Roles(...STAFF_READ_ROLES)
  async getOrder(@Param("id") id: string) {
    const rows = await this.cs.query({ table: "production_orders", filters: [{ type: "eq", column: "id", value: id }] });
    return { data: rows[0] ?? null };
  }

  @Get("orders")
  @Roles(...STAFF_READ_ROLES)
  async listOrders() {
    const data = await this.cs.query({ table: "production_orders", filters: [], orderBy: { column: "created_at", ascending: false } });
    return { data };
  }

  @Post("orders")
  @Roles(...PRODUCTION_ROLES)
  async createOrder(@Body() body: any, @Req() req: any) {
    const { _actor: _ignored, ...values } = body || {};
    const data = await this.productionService.createOrder(values, actorOf(req));
    return { data };
  }

  /** Descriptive edits only: status, consumption and yield change through the lifecycle actions below. */
  @Patch("orders/:id")
  @Roles(...PRODUCTION_ROLES)
  async updateOrder(@Param("id") id: string, @Body() body: any) {
    const locked = Object.keys(body || {}).filter((key) => PRODUCTION_LIFECYCLE_FIELDS.includes(key));
    if (locked.length > 0) {
      throw badRequest(
        "PRODUCTION_STATUS_DOMAIN_ONLY",
        `Champs pilotés par le cycle de l'ordre (planifier, démarrer, terminer, annuler) : ${locked.join(", ")}.`,
      );
    }
    const { after } = await this.cs.update({ table: "production_orders", filters: [{ type: "eq", column: "id", value: id }], values: body });
    return { data: after[0] };
  }

  // ── Business action endpoints ─────────────────────────────────────────────

  @Post("orders/:id/plan")
  @Roles(...PRODUCTION_ROLES)
  async planOrder(@Param("id") id: string) {
    return { data: await this.productionService.planOrder(id) };
  }

  @Post("orders/:id/start")
  @Roles(...PRODUCTION_ROLES)
  async startOrder(@Param("id") id: string, @Req() req: any) {
    return { data: await this.productionService.startOrder(id, actorOf(req)) };
  }

  @Post("orders/:id/complete")
  @Roles(...PRODUCTION_ROLES)
  async completeOrder(@Param("id") id: string, @Body() body: any, @Req() req: any) {
    const { actual_output_kg, waste_kg, notes } = body || {};
    return { data: await this.productionService.completeOrder(id, { actual_output_kg, waste_kg, notes }, actorOf(req)) };
  }

  @Post("orders/:id/cancel")
  @Roles(...PRODUCTION_ROLES)
  async cancelOrder(@Param("id") id: string, @Body() body: any, @Req() req: any) {
    return { data: await this.productionService.cancelOrder(id, String(body?.reason ?? ""), actorOf(req)) };
  }

  @Post("orders/:id/allocate-lot")
  @Roles(...PRODUCTION_ROLES)
  async allocateLot(@Param("id") id: string, @Body() body: any, @Req() req: any) {
    const { lot_id, allocated_kg } = body || {};
    return { data: await this.productionService.allocateLot(id, { lot_id, allocated_kg }, actorOf(req)) };
  }
}
