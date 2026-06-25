import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { RequireAuthGuard } from "../../nest/route-guards.js";
import { CollectionsService } from "../collections/collections.service.js";
import { BatchesService } from "./batches.service.js";

@Controller("api/batches")
@UseGuards(RequireAuthGuard)
export class BatchesController {
  constructor(
    private readonly cs: CollectionsService,
    private readonly batchesService: BatchesService,
  ) {}

  // ── Storage Zones ─────────────────────────────────────────────────────────

  @Get("storage-zones")
  async listZones() {
    const data = await this.cs.query({ table: "storage_zones", filters: [], orderBy: { column: "name", ascending: true } });
    return { data };
  }

  @Post("storage-zones")
  async createZone(@Body() body: any) {
    const data = await this.cs.insert({ table: "storage_zones", values: body });
    return { data: data[0] };
  }

  @Patch("storage-zones/:id")
  async updateZone(@Param("id") id: string, @Body() body: any) {
    const { after } = await this.cs.update({ table: "storage_zones", filters: [{ type: "eq", column: "id", value: id }], values: body });
    return { data: after[0] };
  }

  // ── Quality Inspections ───────────────────────────────────────────────────

  @Get("quality-inspections")
  async listInspections(@Query("batch_id") batchId?: string) {
    const filters: any[] = [];
    if (batchId) filters.push({ type: "eq", column: "batch_id", value: batchId });
    const data = await this.cs.query({ table: "quality_inspections", filters, orderBy: { column: "created_at", ascending: false } });
    return { data };
  }

  @Post("quality-inspections")
  async createInspection(@Body() body: any) {
    const data = await this.cs.insert({ table: "quality_inspections", values: body });
    return { data: data[0] };
  }

  // ── Non Conformities ──────────────────────────────────────────────────────

  @Get("non-conformities")
  async listNonConformities() {
    const data = await this.cs.query({ table: "non_conformities", filters: [], orderBy: { column: "created_at", ascending: false } });
    return { data };
  }

  @Post("non-conformities")
  async createNonConformity(@Body() body: any) {
    const data = await this.cs.insert({ table: "non_conformities", values: body });
    return { data: data[0] };
  }

  // ── Alerts ────────────────────────────────────────────────────────────────

  @Get("alerts")
  async listAlerts(@Query("batch_id") batchId?: string) {
    const filters: any[] = [];
    if (batchId) filters.push({ type: "eq", column: "batch_id", value: batchId });
    const data = await this.cs.query({ table: "alerts", filters, orderBy: { column: "created_at", ascending: false } });
    return { data };
  }

  @Post("alerts")
  async createAlert(@Body() body: any) {
    const data = await this.cs.insert({ table: "alerts", values: body });
    return { data: data[0] };
  }

  @Patch("alerts/:id")
  async updateAlert(@Param("id") id: string, @Body() body: any) {
    const { after } = await this.cs.update({ table: "alerts", filters: [{ type: "eq", column: "id", value: id }], values: body });
    return { data: after[0] };
  }

  // ── Batch Movements ───────────────────────────────────────────────────────

  @Get("movements")
  async listMovements(@Query("batch_id") batchId?: string) {
    const filters: any[] = [];
    if (batchId) filters.push({ type: "eq", column: "batch_id", value: batchId });
    const data = await this.cs.query({ table: "batch_movements", filters, orderBy: { column: "created_at", ascending: false } });
    return { data };
  }

  @Post("movements")
  async createMovement(@Body() body: any) {
    const data = await this.cs.insert({ table: "batch_movements", values: body });
    return { data: data[0] };
  }

  // ── Batches — summary and :id must be declared before wildcard ───────────

  @Get("summary")
  async getSummary() {
    const data = await this.batchesService.getSummary();
    return { data };
  }

  @Get(":id")
  async getBatch(@Param("id") id: string) {
    const rows = await this.cs.query({ table: "batches", filters: [{ type: "eq", column: "id", value: id }] });
    return { data: rows[0] ?? null };
  }

  @Get()
  async listBatches() {
    const data = await this.cs.query({ table: "batches", filters: [], orderBy: { column: "created_at", ascending: false } });
    return { data };
  }

  @Post()
  async createBatch(@Body() body: any) {
    const data = await this.cs.insert({ table: "batches", values: body });
    return { data: data[0] };
  }

  @Patch(":id")
  async updateBatch(@Param("id") id: string, @Body() body: any) {
    const { after } = await this.cs.update({ table: "batches", filters: [{ type: "eq", column: "id", value: id }], values: body });
    return { data: after[0] };
  }

  // ── Business action endpoints ─────────────────────────────────────────────

  @Post(":id/decide")
  async decideQC(@Param("id") id: string, @Body() body: any) {
    const data = await this.batchesService.decideQC(id, body ?? {}, body?.actor ?? null);
    return { data };
  }

  @Post(":id/inspections")
  async addInspection(@Param("id") id: string, @Body() body: any) {
    const data = await this.batchesService.createInspection(id, body ?? {}, body?.actor ?? null);
    return { data };
  }

  @Post(":id/non-conformities")
  async addNonConformity(@Param("id") id: string, @Body() body: any) {
    const data = await this.batchesService.createNonConformity(id, body ?? {}, body?.actor ?? null);
    return { data };
  }
}
