import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { RequireAuthGuard } from "../../nest/route-guards.js";
import { CollectionsService } from "../collections/collections.service.js";
import { ProductionService } from "./production.service.js";

@Controller("api/production")
@UseGuards(RequireAuthGuard)
export class ProductionController {
  constructor(
    private readonly cs: CollectionsService,
    private readonly productionService: ProductionService,
  ) {}

  // ── Configuration (flux codes, order & step statuses) ────────────────────

  @Get("config")
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
  async listStepDefinitions() {
    const data = await this.cs.query({ table: "production_step_definitions", filters: [], orderBy: { column: "sequence_order", ascending: true } });
    return { data };
  }

  // ── Quality Checks ────────────────────────────────────────────────────────

  @Get("quality-checks")
  async listQualityChecks(@Query("step_id") stepId?: string) {
    const filters: any[] = [];
    if (stepId) filters.push({ type: "eq", column: "production_step_id", value: stepId });
    const data = await this.cs.query({ table: "quality_checks", filters, orderBy: { column: "created_at", ascending: false } });
    return { data };
  }

  @Post("quality-checks")
  async createQualityCheck(@Body() body: any) {
    const data = await this.cs.insert({ table: "quality_checks", values: body });
    return { data: data[0] };
  }

  // ── Audit Logs ────────────────────────────────────────────────────────────

  @Post("audit-logs")
  async createAuditLog(@Body() body: any) {
    const data = await this.cs.insert({ table: "production_audit_logs", values: body });
    return { data: data[0] };
  }

  // ── Libered Lots (STOCK_LIBERE reception lots) ────────────────────────────

  @Get("libered-lots")
  async listLiberedLots() {
    const data = await this.cs.query({
      table: "reception_lots",
      filters: [{ type: "eq", column: "stock_status", value: "STOCK_LIBERE" }],
      orderBy: { column: "created_at", ascending: false },
    });
    return { data };
  }

  // ── Steps ─────────────────────────────────────────────────────────────────

  @Get("steps")
  async listSteps(@Query("order_id") orderId?: string) {
    const filters: any[] = [];
    if (orderId) filters.push({ type: "eq", column: "production_order_id", value: orderId });
    const data = await this.cs.query({ table: "production_steps", filters, orderBy: { column: "sequence_order", ascending: true } });
    return { data };
  }

  @Post("steps")
  async createStep(@Body() body: any) {
    const data = await this.cs.insert({ table: "production_steps", values: body });
    return { data: data[0] };
  }

  @Patch("steps/:id")
  async updateStep(@Param("id") id: string, @Body() body: any) {
    const { after } = await this.cs.update({ table: "production_steps", filters: [{ type: "eq", column: "id", value: id }], values: body });
    return { data: after[0] };
  }

  // ── Lot Allocations ───────────────────────────────────────────────────────

  @Get("allocations")
  async listAllocations(@Query("order_id") orderId?: string) {
    const filters: any[] = [];
    if (orderId) filters.push({ type: "eq", column: "production_order_id", value: orderId });
    const data = await this.cs.query({ table: "production_lot_allocations", filters, orderBy: { column: "allocated_at", ascending: true } });
    return { data };
  }

  @Delete("allocations/:id")
  async deleteAllocation(@Param("id") id: string) {
    const data = await this.cs.remove({ table: "production_lot_allocations", filters: [{ type: "eq", column: "id", value: id }] });
    return { data: data[0] };
  }

  // ── Output Lots ───────────────────────────────────────────────────────────

  @Get("output-lots")
  async listOutputLots(@Query("order_id") orderId?: string) {
    const filters: any[] = [];
    if (orderId) filters.push({ type: "eq", column: "production_order_id", value: orderId });
    const data = await this.cs.query({ table: "production_output_lots", filters, orderBy: { column: "recorded_at", ascending: true } });
    return { data };
  }

  @Post("output-lots")
  async createOutputLot(@Body() body: any) {
    const data = await this.cs.insert({ table: "production_output_lots", values: body });
    return { data: data[0] };
  }

  // ── Orders — summary must come before :id param route ────────────────────

  @Get("orders/summary")
  async getOrdersSummary() {
    const data = await this.productionService.getSummary();
    return { data };
  }

  @Get("orders/:id")
  async getOrder(@Param("id") id: string) {
    const rows = await this.cs.query({ table: "production_orders", filters: [{ type: "eq", column: "id", value: id }] });
    return { data: rows[0] ?? null };
  }

  @Get("orders")
  async listOrders() {
    const data = await this.cs.query({ table: "production_orders", filters: [], orderBy: { column: "created_at", ascending: false } });
    return { data };
  }

  @Post("orders")
  async createOrder(@Body() body: any) {
    const actor: string | null = body._actor ?? null;
    delete body._actor;
    const data = await this.productionService.createOrder(body, actor);
    return { data };
  }

  @Patch("orders/:id")
  async updateOrder(@Param("id") id: string, @Body() body: any) {
    const { after } = await this.cs.update({ table: "production_orders", filters: [{ type: "eq", column: "id", value: id }], values: body });
    return { data: after[0] };
  }

  // ── Business action endpoints ─────────────────────────────────────────────

  @Post("orders/:id/start")
  async startOrder(@Param("id") id: string, @Body() body: any) {
    const data = await this.productionService.startOrder(id, body?.actor ?? null);
    return { data };
  }

  @Post("orders/:id/complete")
  async completeOrder(@Param("id") id: string, @Body() body: any) {
    const data = await this.productionService.completeOrder(id, body ?? {}, body?.actor ?? null);
    return { data };
  }

  @Post("orders/:id/cancel")
  async cancelOrder(@Param("id") id: string, @Body() body: any) {
    const data = await this.productionService.cancelOrder(
      id,
      String(body?.reason ?? "Annulé"),
      body?.actor ?? null,
    );
    return { data };
  }

  @Post("orders/:id/allocate-lot")
  async allocateLot(@Param("id") id: string, @Body() body: any) {
    const data = await this.productionService.allocateLot(id, body ?? {}, body?.actor ?? null);
    return { data };
  }
}
