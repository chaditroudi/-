import {
  Body,
  Controller,
  Delete,
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
import { PurchasingService } from "./purchasing.service.js";

const PURCHASING_ROLES = ["responsable_achats", "directeur_achat", "admin", "direction"];
const REQUISITION_ROLES = [...PURCHASING_ROLES, "responsable_stock"];
const PURCHASING_READ_ROLES = [
  ...PURCHASING_ROLES,
  "responsable_stock",
  "responsable_reception",
  "chef_reception",
  "operateur_reception",
  "directeur_general",
  "directeur_usine",
  "administrateur_systeme",
];

@Controller("api/purchasing")
@UseGuards(RequireAuthGuard, RolesGuard)
export class PurchasingController {
  constructor(private readonly purchasingService: PurchasingService) {}

  @Get("requisitions")
  @Roles(...REQUISITION_ROLES)
  async listRequisitions(@Query("status") status?: string) {
    return { data: await this.purchasingService.listRequisitions(status) };
  }

  @Get("requisitions/:id")
  @Roles(...REQUISITION_ROLES)
  async getRequisition(@Param("id") id: string) {
    return { data: await this.purchasingService.getRequisitionById(id) };
  }

  @Post("requisitions")
  @Roles(...REQUISITION_ROLES)
  @HttpCode(201)
  async createRequisition(@Req() req: any, @Body() body: any) {
    const data = await this.purchasingService.createRequisition(body || {}, req.auth?.user || null);
    publishRealtimeDbChange({
      type: "purchase_requisition_created",
      table: "purchase_requisitions",
      action: "INSERT",
      rows: data ? [data] : [],
      rowIds: [String((data as any)?.id || "")].filter(Boolean),
      relatedTables: ["purchasing_stats"],
    });
    return { data };
  }

  @Patch("requisitions/:id")
  @Roles(...REQUISITION_ROLES)
  async updateRequisition(@Param("id") id: string, @Body() body: any) {
    const data = await this.purchasingService.updateRequisition(id, body || {});
    publishRealtimeDbChange({
      type: "purchase_requisition_updated",
      table: "purchase_requisitions",
      action: "UPDATE",
      rows: data ? [data] : [],
      rowIds: [String((data as any)?.id || id)].filter(Boolean),
      relatedTables: ["purchasing_stats"],
    });
    return { data };
  }

  @Post("requisitions/:id/approve")
  @Roles(...REQUISITION_ROLES)
  async approveRequisition(@Param("id") id: string, @Body() body: any) {
    const data = await this.purchasingService.approveRequisition(id, body?.approverName);
    publishRealtimeDbChange({
      type: "purchase_requisition_approved",
      table: "purchase_requisitions",
      action: "UPDATE",
      rows: data ? [data] : [],
      rowIds: [String((data as any)?.id || id)].filter(Boolean),
      relatedTables: ["purchasing_stats"],
    });
    return { data };
  }

  @Post("requisitions/:id/reject")
  @Roles(...REQUISITION_ROLES)
  async rejectRequisition(@Param("id") id: string, @Body() body: any) {
    const data = await this.purchasingService.rejectRequisition(id, body?.reason, body?.rejectorName);
    publishRealtimeDbChange({
      type: "purchase_requisition_rejected",
      table: "purchase_requisitions",
      action: "UPDATE",
      rows: data ? [data] : [],
      rowIds: [String((data as any)?.id || id)].filter(Boolean),
      relatedTables: ["purchasing_stats"],
    });
    return { data };
  }

  @Delete("requisitions/:id")
  @Roles(...REQUISITION_ROLES)
  async deleteRequisition(@Param("id") id: string) {
    const data = await this.purchasingService.deleteRequisition(id);
    publishRealtimeDbChange({
      type: "purchase_requisition_deleted",
      table: "purchase_requisitions",
      action: "DELETE",
      rowIds: [id],
      relatedTables: ["purchasing_stats"],
    });
    return { data };
  }

  @Get("orders")
  @Roles(...PURCHASING_READ_ROLES)
  async listOrders(@Query("status") status?: string) {
    return { data: await this.purchasingService.listOrders(status) };
  }

  @Get("orders/:id")
  @Roles(...PURCHASING_READ_ROLES)
  async getOrder(@Param("id") id: string) {
    return { data: await this.purchasingService.getOrderById(id) };
  }

  @Post("orders")
  @Roles(...PURCHASING_ROLES)
  @HttpCode(201)
  async createOrder(@Req() req: any, @Body() body: any) {
    const data = await this.purchasingService.createOrder(body || {}, req.auth?.user || null);
    publishRealtimeDbChange({
      type: "purchase_order_created",
      table: "purchase_orders",
      action: "INSERT",
      rows: data ? [data] : [],
      rowIds: [String((data as any)?.id || "")].filter(Boolean),
      relatedTables: ["purchase_order_lines", "purchase_requisitions", "purchasing_stats"],
    });
    return { data };
  }

  @Patch("orders/:id")
  @Roles(...PURCHASING_ROLES)
  async updateOrder(@Param("id") id: string, @Body() body: any) {
    const data = await this.purchasingService.updateOrder(id, body || {});
    publishRealtimeDbChange({
      type: "purchase_order_updated",
      table: "purchase_orders",
      action: "UPDATE",
      rows: data ? [data] : [],
      rowIds: [String((data as any)?.id || id)].filter(Boolean),
      relatedTables: ["purchase_order_lines", "purchase_requisitions", "purchasing_stats"],
    });
    return { data };
  }

  @Post("orders/:id/send")
  @Roles(...PURCHASING_ROLES)
  async sendOrder(@Param("id") id: string) {
    const data = await this.purchasingService.sendOrder(id);
    publishRealtimeDbChange({
      type: "purchase_order_sent",
      table: "purchase_orders",
      action: "UPDATE",
      rows: data ? [data] : [],
      rowIds: [String((data as any)?.id || id)].filter(Boolean),
      relatedTables: ["purchasing_stats"],
    });
    return { data };
  }

  @Post("orders/:id/confirm")
  @Roles(...PURCHASING_ROLES)
  async confirmOrder(@Param("id") id: string, @Body() body: any) {
    const data = await this.purchasingService.confirmOrder(id, body?.expectedDate);
    publishRealtimeDbChange({
      type: "purchase_order_confirmed",
      table: "purchase_orders",
      action: "UPDATE",
      rows: data ? [data] : [],
      rowIds: [String((data as any)?.id || id)].filter(Boolean),
      relatedTables: ["purchasing_stats"],
    });
    return { data };
  }

  @Post("orders/:id/approve")
  @Roles(...PURCHASING_ROLES)
  async approveOrder(@Param("id") id: string, @Body() body: any) {
    const data = await this.purchasingService.approveOrder(id, body?.approverName);
    publishRealtimeDbChange({
      type: "purchase_order_approved",
      table: "purchase_orders",
      action: "UPDATE",
      rows: data ? [data] : [],
      rowIds: [String((data as any)?.id || id)].filter(Boolean),
      relatedTables: ["purchasing_stats"],
    });
    return { data };
  }

  @Post("orders/:id/receive-line")
  @Roles(...PURCHASING_ROLES)
  async receiveOrderLine(@Param("id") id: string, @Body() body: any) {
    const data = await this.purchasingService.receiveOrderLine(id, body || {});
    publishRealtimeDbChange({
      type: "purchase_order_line_received",
      table: "purchase_order_lines",
      action: "UPDATE",
      rowIds: [String(body?.lineId || body?.line_id || "")].filter(Boolean),
      relatedTables: ["purchase_orders", "purchasing_stats"],
    });
    return { data };
  }

  @Post("orders/:id/three-way-match")
  @Roles(...PURCHASING_ROLES)
  async saveThreeWayMatch(@Param("id") id: string, @Body() body: any) {
    const data = await this.purchasingService.saveThreeWayMatch(id, body || {});
    publishRealtimeDbChange({
      type: "purchase_order_three_way_match_saved",
      table: "purchase_orders",
      action: "UPDATE",
      rows: data ? [data] : [],
      rowIds: [String((data as any)?.id || id)].filter(Boolean),
      relatedTables: ["purchasing_stats"],
    });
    return { data };
  }

  @Get("orders/:id/receipt-logs")
  @Roles(...PURCHASING_READ_ROLES)
  async getReceiptLogs(@Param("id") id: string) {
    const data = await this.purchasingService.getReceiptLogs(id);
    return { data };
  }

  @Get("orders/:id/linked-receptions")
  @Roles(...PURCHASING_READ_ROLES)
  async getLinkedReceptions(@Param("id") id: string) {
    const data = await this.purchasingService.getLinkedReceptions(id);
    return { data };
  }

  @Delete("orders/:id")
  @Roles(...PURCHASING_ROLES)
  async deleteOrder(@Param("id") id: string) {
    const data = await this.purchasingService.deleteOrder(id);
    publishRealtimeDbChange({
      type: "purchase_order_deleted",
      table: "purchase_orders",
      action: "DELETE",
      rowIds: [id],
      relatedTables: ["purchase_order_lines", "purchasing_stats"],
    });
    return { data };
  }

  @Post("order-lines")
  @Roles(...PURCHASING_ROLES)
  @HttpCode(201)
  async addOrderLine(@Body() body: any) {
    const data = await this.purchasingService.addOrderLine(body || {});
    publishRealtimeDbChange({
      type: "purchase_order_line_created",
      table: "purchase_order_lines",
      action: "INSERT",
      rows: data ? [data] : [],
      rowIds: [String((data as any)?.id || "")].filter(Boolean),
      relatedTables: ["purchase_orders", "purchasing_stats"],
    });
    return { data };
  }

  @Patch("order-lines/:id")
  @Roles(...PURCHASING_ROLES)
  async updateOrderLine(@Param("id") id: string, @Body() body: any) {
    const data = await this.purchasingService.updateOrderLine(id, body || {});
    publishRealtimeDbChange({
      type: "purchase_order_line_updated",
      table: "purchase_order_lines",
      action: "UPDATE",
      rows: data ? [data] : [],
      rowIds: [String((data as any)?.id || id)].filter(Boolean),
      relatedTables: ["purchase_orders", "purchasing_stats"],
    });
    return { data };
  }

  @Delete("order-lines/:id")
  @Roles(...PURCHASING_ROLES)
  async deleteOrderLine(@Param("id") id: string) {
    const data = await this.purchasingService.deleteOrderLine(id);
    publishRealtimeDbChange({
      type: "purchase_order_line_deleted",
      table: "purchase_order_lines",
      action: "DELETE",
      rowIds: [id],
      relatedTables: ["purchase_orders", "purchasing_stats"],
    });
    return { data };
  }

  @Get("stats")
  @Roles(...PURCHASING_READ_ROLES)
  async getStats() {
    return { data: await this.purchasingService.getStats() };
  }
}
