import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";

import { Roles } from "../../nest/route-metadata.js";
import { RequireAuthGuard, RolesGuard } from "../../nest/route-guards.js";
import { publishRealtimeDbChange, type RealtimeDbAction } from "../realtime/realtime.bus.js";
import { P2PService } from "./p2p.service.js";

const PURCHASING_ROLES = [
  "responsable_achats",
  "acheteur",
  "gestionnaire_approvisionnement",
  "daf",
  "directeur_general",
  "administrateur_systeme",
];

const pub = (table: string, action: RealtimeDbAction, row: Record<string, unknown>) =>
  publishRealtimeDbChange({
    type: `${table}_${action.toLowerCase()}`,
    table,
    action,
    rows: [row],
    rowIds: [String(row.id || "")].filter(Boolean),
  });

@Controller("api/p2p")
@UseGuards(RequireAuthGuard, RolesGuard)
export class P2PController {
  constructor(private readonly service: P2PService) {}

  // ── RFQ ────────────────────────────────────────────────────────────────────
  @Get("rfq")
  @Roles(...PURCHASING_ROLES)
  async listRFQs(@Query("status") status?: string) {
    return { data: await this.service.listRFQs(status) };
  }

  @Post("rfq")
  @Roles(...PURCHASING_ROLES)
  async createRFQ(@Body() body: Record<string, unknown>) {
    const result = await this.service.createRFQ(body);
    pub("p2p_rfq", "INSERT", result as Record<string, unknown> ?? {});
    return { data: result };
  }

  @Get("rfq/:id")
  @Roles(...PURCHASING_ROLES)
  async getRFQ(@Param("id") id: string) {
    return { data: await this.service.getRFQById(id) };
  }

  @Patch("rfq/:id")
  @Roles(...PURCHASING_ROLES)
  async updateRFQ(@Param("id") id: string, @Body() body: Record<string, unknown>) {
    const result = await this.service.updateRFQ(id, body);
    pub("p2p_rfq", "UPDATE", result as Record<string, unknown> ?? {});
    return { data: result };
  }

  @Get("rfq/:id/responses")
  @Roles(...PURCHASING_ROLES)
  async getRFQResponses(@Param("id") rfqId: string) {
    return { data: await this.service.getRFQResponses(rfqId) };
  }

  @Post("rfq/:id/responses")
  @Roles(...PURCHASING_ROLES)
  async addRFQResponse(
    @Param("id") rfqId: string,
    @Body() body: Record<string, unknown>,
  ) {
    const result = await this.service.addRFQResponse(rfqId, body);
    pub("p2p_rfq_responses", "INSERT", result as Record<string, unknown> ?? {});
    return { data: result };
  }

  @Post("rfq/:id/select")
  @Roles(...PURCHASING_ROLES)
  async selectRFQWinner(
    @Param("id") rfqId: string,
    @Body() body: { supplier_id?: string; supplierId?: string; reason: string },
  ) {
    const result = await this.service.selectRFQWinner(
      rfqId,
      body.supplier_id ?? body.supplierId ?? "",
      body.reason,
    );
    pub("p2p_rfq", "UPDATE", result as Record<string, unknown> ?? {});
    return { data: result };
  }

  // ── Goods Receipts ──────────────────────────────────────────────────────────
  @Get("goods-receipts")
  @Roles(...PURCHASING_ROLES)
  async listGoodsReceipts(
    @Query("status") status?: string,
    @Query("supplier_id") supplier_id?: string,
  ) {
    return { data: await this.service.listGoodsReceipts({ status, supplier_id }) };
  }

  @Post("goods-receipts")
  @Roles(...PURCHASING_ROLES)
  async createGoodsReceipt(@Body() body: Record<string, unknown>) {
    const result = await this.service.createGoodsReceipt(body);
    pub("p2p_goods_receipts", "INSERT", result as Record<string, unknown> ?? {});
    return { data: result };
  }

  @Get("goods-receipts/:id")
  @Roles(...PURCHASING_ROLES)
  async getGoodsReceipt(@Param("id") id: string) {
    return { data: await this.service.getGoodsReceiptById(id) };
  }

  @Patch("goods-receipts/:id")
  @Roles(...PURCHASING_ROLES)
  async updateGoodsReceipt(
    @Param("id") id: string,
    @Body() body: Record<string, unknown>,
  ) {
    const result = await this.service.updateGoodsReceipt(id, body);
    pub("p2p_goods_receipts", "UPDATE", result as Record<string, unknown> ?? {});
    return { data: result };
  }

  @Post("goods-receipts/:id/release")
  @Roles(...PURCHASING_ROLES)
  async releaseQuarantine(
    @Param("id") id: string,
    @Body() body: { decision: string; by: string; notes?: string },
  ) {
    const result = await this.service.releaseQuarantine(id, body.decision, body.by, body.notes);
    pub("p2p_goods_receipts", "UPDATE", result as Record<string, unknown> ?? {});
    return { data: result };
  }

  // ── Supplier Invoices ────────────────────────────────────────────────────────
  @Get("invoices")
  @Roles(...PURCHASING_ROLES)
  async listInvoices(
    @Query("status") status?: string,
    @Query("supplier_id") supplier_id?: string,
  ) {
    return { data: await this.service.listInvoices({ status, supplier_id }) };
  }

  @Post("invoices")
  @Roles(...PURCHASING_ROLES)
  async createInvoice(@Body() body: Record<string, unknown>) {
    const result = await this.service.createInvoice(body);
    pub("p2p_invoices", "INSERT", result as Record<string, unknown> ?? {});
    return { data: result };
  }

  @Get("invoices/:id")
  @Roles(...PURCHASING_ROLES)
  async getInvoice(@Param("id") id: string) {
    return { data: await this.service.getInvoiceById(id) };
  }

  @Patch("invoices/:id")
  @Roles(...PURCHASING_ROLES)
  async updateInvoice(
    @Param("id") id: string,
    @Body() body: Record<string, unknown>,
  ) {
    const result = await this.service.updateInvoice(id, body);
    pub("p2p_invoices", "UPDATE", result as Record<string, unknown> ?? {});
    return { data: result };
  }

  @Post("invoices/:id/three-way-match")
  @Roles(...PURCHASING_ROLES)
  async runThreeWayMatch(
    @Param("id") id: string,
    @Body() body: { tolerance_pct?: number; tolerancePct?: number },
  ) {
    const result = await this.service.runThreeWayMatch(id, body.tolerance_pct ?? body.tolerancePct);
    pub("p2p_invoices", "UPDATE", result as Record<string, unknown> ?? {});
    return { data: result };
  }

  @Post("invoices/:id/approve-payment")
  @Roles(...PURCHASING_ROLES)
  async approvePayment(
    @Param("id") id: string,
    @Body() body: { by: string },
  ) {
    const result = await this.service.approvePayment(id, body.by);
    pub("p2p_invoices", "UPDATE", result as Record<string, unknown> ?? {});
    return { data: result };
  }

  @Post("invoices/:id/mark-paid")
  @Roles(...PURCHASING_ROLES)
  async markPaid(
    @Param("id") id: string,
    @Body() body: { payment_reference?: string; paymentRef?: string; by: string },
  ) {
    const result = await this.service.markPaid(id, body.payment_reference ?? body.paymentRef ?? "", body.by);
    pub("p2p_invoices", "UPDATE", result as Record<string, unknown> ?? {});
    return { data: result };
  }

  // ── Supplier Certificates ────────────────────────────────────────────────────
  @Get("certificates")
  @Roles(...PURCHASING_ROLES, "responsable_qualite", "resp_management_qualite")
  async listCertificates(
    @Query("supplier_id") supplier_id?: string,
    @Query("type") type?: string,
  ) {
    return { data: await this.service.listCertificates({ supplier_id, type }) };
  }

  @Post("certificates")
  @Roles(...PURCHASING_ROLES)
  async createCertificate(@Body() body: Record<string, unknown>) {
    const result = await this.service.createCertificate(body);
    pub("p2p_certificates", "INSERT", result as Record<string, unknown> ?? {});
    return { data: result };
  }

  @Patch("certificates/:id")
  @Roles(...PURCHASING_ROLES)
  async updateCertificate(
    @Param("id") id: string,
    @Body() body: Record<string, unknown>,
  ) {
    const result = await this.service.updateCertificate(id, body);
    pub("p2p_certificates", "UPDATE", result as Record<string, unknown> ?? {});
    return { data: result };
  }

  @Delete("certificates/:id")
  @Roles(...PURCHASING_ROLES)
  async deleteCertificate(@Param("id") id: string) {
    const result = await this.service.deleteCertificate(id);
    pub("p2p_certificates", "DELETE", { id });
    return { data: result };
  }

  // ── Budget Centers ───────────────────────────────────────────────────────────
  @Get("budget-centers")
  @Roles(...PURCHASING_ROLES)
  async listBudgetCenters(@Query("site") site?: string) {
    return { data: await this.service.listBudgetCenters(site) };
  }

  @Post("budget-centers")
  @Roles(...PURCHASING_ROLES)
  async createBudgetCenter(@Body() body: Record<string, unknown>) {
    const result = await this.service.createBudgetCenter(body);
    pub("p2p_budget_centers", "INSERT", result as Record<string, unknown> ?? {});
    return { data: result };
  }

  @Patch("budget-centers/:id")
  @Roles(...PURCHASING_ROLES)
  async updateBudgetCenter(
    @Param("id") id: string,
    @Body() body: Record<string, unknown>,
  ) {
    const result = await this.service.updateBudgetCenter(id, body);
    pub("p2p_budget_centers", "UPDATE", result as Record<string, unknown> ?? {});
    return { data: result };
  }
}
