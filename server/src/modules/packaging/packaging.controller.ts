import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";

import { Roles } from "../../nest/route-metadata.js";
import { RequireAuthGuard, RolesGuard } from "../../nest/route-guards.js";
import { publishRealtimeDbChange } from "../realtime/realtime.bus.js";
import { PackagingService } from "./packaging.service.js";

const PACKAGING_ROLES = [
  "responsable_production",
  "operateur_conditionnement",
  "operateur_emballage",
  "responsable_qualite",
  "resp_qualite_haccp",
  "responsable_stock",
  "admin",
  "direction",
];

@Controller("api/packaging")
@UseGuards(RequireAuthGuard, RolesGuard)
export class PackagingController {
  constructor(private readonly packagingService: PackagingService) {}

  @Get("boms")
  @Roles(...PACKAGING_ROLES)
  async listBoms() {
    return { data: await this.packagingService.listBoms() };
  }

  @Post("boms")
  @Roles(...PACKAGING_ROLES)
  @HttpCode(201)
  async createBom(@Body() body: any) {
    const data = await this.packagingService.createBom(body || {});
    publishRealtimeDbChange({
      type: "packaging_bom_created",
      table: "packaging_bom",
      action: "INSERT",
      rows: data ? [data] : [],
      rowIds: [String((data as any)?.id || "")].filter(Boolean),
    });
    return { data };
  }

  @Patch("boms/:id")
  @Roles(...PACKAGING_ROLES)
  async updateBom(@Param("id") id: string, @Body() body: any) {
    const data = await this.packagingService.updateBom(id, body || {});
    publishRealtimeDbChange({
      type: "packaging_bom_updated",
      table: "packaging_bom",
      action: "UPDATE",
      rows: data ? [data] : [],
      rowIds: [String((data as any)?.id || id)].filter(Boolean),
    });
    return { data };
  }

  @Post("boms/:id/toggle-active")
  @Roles(...PACKAGING_ROLES)
  async toggleBomActive(@Param("id") id: string, @Body() body: any) {
    const data = await this.packagingService.toggleBomActive(id, Boolean(body?.is_active));
    publishRealtimeDbChange({
      type: "packaging_bom_toggled",
      table: "packaging_bom",
      action: "UPDATE",
      rows: data ? [data] : [],
      rowIds: [String((data as any)?.id || id)].filter(Boolean),
    });
    return { data };
  }

  @Get("label-templates")
  @Roles(...PACKAGING_ROLES)
  async listLabelTemplates(@Query("status") status?: "BROUILLON" | "VALIDE" | "ARCHIVE") {
    return { data: await this.packagingService.listLabelTemplates(status) };
  }

  @Post("label-templates")
  @Roles(...PACKAGING_ROLES)
  @HttpCode(201)
  async createLabelTemplate(@Body() body: any) {
    const data = await this.packagingService.createLabelTemplate(body || {});
    publishRealtimeDbChange({
      type: "label_template_created",
      table: "label_templates",
      action: "INSERT",
      rows: data ? [data] : [],
      rowIds: [String((data as any)?.id || "")].filter(Boolean),
    });
    return { data };
  }

  @Patch("label-templates/:id")
  @Roles(...PACKAGING_ROLES)
  async updateLabelTemplate(@Param("id") id: string, @Body() body: any) {
    const data = await this.packagingService.updateLabelTemplate(id, body || {});
    publishRealtimeDbChange({
      type: "label_template_updated",
      table: "label_templates",
      action: "UPDATE",
      rows: data ? [data] : [],
      rowIds: [String((data as any)?.id || id)].filter(Boolean),
      relatedTables: ["packaging_bom"],
    });
    return { data };
  }

  @Post("label-templates/:id/approve")
  @Roles(...PACKAGING_ROLES)
  async approveLabelTemplate(@Param("id") id: string, @Body() body: any) {
    const data = await this.packagingService.approveLabelTemplate(id, body?.approved_by);
    publishRealtimeDbChange({
      type: "label_template_approved",
      table: "label_templates",
      action: "UPDATE",
      rows: data ? [data] : [],
      rowIds: [String((data as any)?.id || id)].filter(Boolean),
      relatedTables: ["packaging_bom"],
    });
    return { data };
  }

  @Post("label-templates/:id/archive")
  @Roles(...PACKAGING_ROLES)
  async archiveLabelTemplate(@Param("id") id: string) {
    const data = await this.packagingService.archiveLabelTemplate(id);
    publishRealtimeDbChange({
      type: "label_template_archived",
      table: "label_templates",
      action: "UPDATE",
      rows: data ? [data] : [],
      rowIds: [String((data as any)?.id || id)].filter(Boolean),
    });
    return { data };
  }

  @Get("private-label-clients")
  @Roles(...PACKAGING_ROLES)
  async listPrivateLabelClients() {
    return { data: await this.packagingService.listPrivateLabelClients() };
  }

  @Post("private-label-clients")
  @Roles(...PACKAGING_ROLES)
  @HttpCode(201)
  async createPrivateLabelClient(@Body() body: any) {
    const data = await this.packagingService.createPrivateLabelClient(body || {});
    publishRealtimeDbChange({
      type: "private_label_client_created",
      table: "private_label_clients",
      action: "INSERT",
      rows: data ? [data] : [],
      rowIds: [String((data as any)?.id || "")].filter(Boolean),
    });
    return { data };
  }

  @Post("private-label-clients/:id/toggle-active")
  @Roles(...PACKAGING_ROLES)
  async togglePrivateLabelClient(@Param("id") id: string, @Body() body: any) {
    const data = await this.packagingService.togglePrivateLabelClient(id, Boolean(body?.active));
    publishRealtimeDbChange({
      type: "private_label_client_toggled",
      table: "private_label_clients",
      action: "UPDATE",
      rows: data ? [data] : [],
      rowIds: [String((data as any)?.id || id)].filter(Boolean),
    });
    return { data };
  }

  @Get("available-sublots")
  @Roles(...PACKAGING_ROLES)
  async listAvailableSublots() {
    return { data: await this.packagingService.listAvailableSublots() };
  }

  @Get("orders")
  @Roles(...PACKAGING_ROLES)
  async listOrders(@Query("status") status?: "PLANIFIE" | "EN_COURS" | "PAUSE" | "TERMINE" | "ANNULE") {
    return { data: await this.packagingService.listOrders(status) };
  }

  @Post("orders")
  @Roles(...PACKAGING_ROLES)
  @HttpCode(201)
  async createOrder(@Body() body: any) {
    const data = await this.packagingService.createOrder(body || {});
    publishRealtimeDbChange({
      type: "packaging_order_created",
      table: "packaging_orders",
      action: "INSERT",
      rows: data ? [data] : [],
      rowIds: [String((data as any)?.id || "")].filter(Boolean),
      relatedTables: ["stock_lots", "stock_movements"],
    });
    return { data };
  }

  @Post("orders/:id/start")
  @Roles(...PACKAGING_ROLES)
  async startOrder(@Param("id") id: string, @Body() body: any) {
    const data = await this.packagingService.startOrder(id, body?.label_status);
    publishRealtimeDbChange({
      type: "packaging_order_started",
      table: "packaging_orders",
      action: "UPDATE",
      rows: data ? [data] : [],
      rowIds: [String((data as any)?.id || id)].filter(Boolean),
      relatedTables: ["system_notifications"],
    });
    return { data };
  }

  @Patch("orders/:id/progress")
  @Roles(...PACKAGING_ROLES)
  async updateProgress(@Param("id") id: string, @Body() body: any) {
    const data = await this.packagingService.updateProgress(id, body || {});
    publishRealtimeDbChange({
      type: "packaging_order_progress_updated",
      table: "packaging_orders",
      action: "UPDATE",
      rows: data ? [data] : [],
      rowIds: [String((data as any)?.id || id)].filter(Boolean),
      relatedTables: ["system_notifications"],
    });
    return { data };
  }

  @Post("orders/:id/toggle-run")
  @Roles(...PACKAGING_ROLES)
  async toggleRunState(@Param("id") id: string, @Body() body: any) {
    const data = await this.packagingService.toggleRunState(id, body?.current_status);
    publishRealtimeDbChange({
      type: "packaging_order_run_state_toggled",
      table: "packaging_orders",
      action: "UPDATE",
      rowIds: [id],
    });
    return { data };
  }

  @Post("orders/:id/close")
  @Roles(...PACKAGING_ROLES)
  async closeOrder(@Param("id") id: string, @Body() body: any) {
    const data = await this.packagingService.closeOrder(id, body || {});
    publishRealtimeDbChange({
      type: "packaging_order_closed",
      table: "packaging_orders",
      action: "UPDATE",
      rows: data ? [data] : [],
      rowIds: [String((data as any)?.id || id)].filter(Boolean),
      relatedTables: ["system_notifications"],
    });
    return { data };
  }

  @Get("orders/:id/palettes")
  @Roles(...PACKAGING_ROLES)
  async listOrderPalettes(@Param("id") id: string) {
    return { data: await this.packagingService.listPalettes(id) };
  }

  @Get("palettes")
  @Roles(...PACKAGING_ROLES)
  async listPalettes() {
    return { data: await this.packagingService.listPalettes() };
  }

  @Post("palettes")
  @Roles(...PACKAGING_ROLES)
  @HttpCode(201)
  async createPalette(@Body() body: any) {
    const data = await this.packagingService.createPalette(body || {});
    publishRealtimeDbChange({
      type: "packaging_palette_created",
      table: "packaging_palettes",
      action: "INSERT",
      rows: data ? [data] : [],
      rowIds: [String((data as any)?.id || "")].filter(Boolean),
    });
    return { data };
  }

  @Post("palettes/:id/seal")
  @Roles(...PACKAGING_ROLES)
  async sealPalette(@Param("id") id: string, @Body() body: any) {
    const data = await this.packagingService.sealPalette(id, body || {});
    publishRealtimeDbChange({
      type: "packaging_palette_sealed",
      table: "packaging_palettes",
      action: "UPDATE",
      rowIds: [id],
      relatedTables: ["stock_lots", "stock_movements", "system_notifications"],
    });
    return { data };
  }
}
