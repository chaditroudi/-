import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { RequireAuthGuard } from "../../nest/route-guards.js";
import { CollectionsService } from "../collections/collections.service.js";

@Controller("api")
@UseGuards(RequireAuthGuard)
export class QualityExtController {
  constructor(private readonly cs: CollectionsService) {}

  // ── CAPA Tickets ──────────────────────────────────────────────────────────

  @Get("capa-tickets")
  async listCAPATickets(@Query("status") status?: string, @Query("supplier_id") supplierId?: string) {
    const filters: any[] = [];
    if (status) filters.push({ type: "eq", column: "status", value: status });
    if (supplierId) filters.push({ type: "eq", column: "supplier_id", value: supplierId });
    const data = await this.cs.query({ table: "capa_tickets", filters, orderBy: { column: "created_at", ascending: false } });
    return { data };
  }

  @Get("capa-tickets/:id")
  async getCAPATicket(@Param("id") id: string) {
    const rows = await this.cs.query({ table: "capa_tickets", filters: [{ type: "eq", column: "id", value: id }] });
    return { data: rows[0] ?? null };
  }

  @Post("capa-tickets")
  async createCAPATicket(@Body() body: any) {
    const data = await this.cs.insert({ table: "capa_tickets", values: body });
    return { data: data[0] };
  }

  @Patch("capa-tickets/:id")
  async updateCAPATicket(@Param("id") id: string, @Body() body: any) {
    const { after } = await this.cs.update({ table: "capa_tickets", filters: [{ type: "eq", column: "id", value: id }], values: body });
    return { data: after[0] };
  }

  // ── Inbound Notices ───────────────────────────────────────────────────────

  @Get("inbound-notices")
  async listInboundNotices(
    @Query("status") status?: string,
    @Query("date_from") dateFrom?: string,
    @Query("date_to") dateTo?: string,
  ) {
    const filters: any[] = [];
    if (status) filters.push({ type: "eq", column: "status", value: status });
    if (dateFrom) filters.push({ type: "gte", column: "estimated_arrival_at", value: dateFrom });
    if (dateTo) filters.push({ type: "lte", column: "estimated_arrival_at", value: dateTo });
    const data = await this.cs.query({ table: "inbound_notices", filters, orderBy: { column: "estimated_arrival_at", ascending: true } });
    return { data };
  }

  @Post("inbound-notices")
  async createInboundNotice(@Body() body: any) {
    const data = await this.cs.insert({ table: "inbound_notices", values: { ...body, status: "PENDING" } });
    return { data: data[0] };
  }

  @Patch("inbound-notices/:id")
  async updateInboundNotice(@Param("id") id: string, @Body() body: any) {
    const { after } = await this.cs.update({ table: "inbound_notices", filters: [{ type: "eq", column: "id", value: id }], values: body });
    return { data: after[0] };
  }

  // ── QC Lab Results (read qc_inspections with lab filters) ─────────────────

  @Get("qc-lab-results")
  async listQcLabResults() {
    const data = await this.cs.query({
      table: "qc_inspections",
      filters: [{ type: "eq", column: "lab_sample_required", value: true }],
      orderBy: { column: "started_at", ascending: false },
    });
    return { data };
  }
}
