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
import { MaintenanceService } from "./maintenance.service.js";

const MAINTENANCE_ROLES = ["responsable_maintenance", "technicien_maintenance"];

// Any operational role may raise a maintenance request; approvals are enforced
// per-level inside the workflow engine (department manager / maintenance / DAF).
const MAINTENANCE_REQUEST_ROLES = [
  ...MAINTENANCE_ROLES,
  "responsable_production",
  "responsable_qualite",
  "responsable_stock",
  "magasinier_wms",
  "responsable_logistique",
  "responsable_reception",
  "chef_reception",
  "responsable_achats",
  "daf",
  "directeur_financier",
  "directeur_general",
  "directeur_usine",
  "administrateur_systeme",
];

const publish = (type: string, action: "INSERT" | "UPDATE" | "DELETE", data: any, fallbackId?: string) => {
  publishRealtimeDbChange({
    type,
    table: "maintenance_requests",
    action,
    rows: action === "DELETE" ? [] : data ? [data] : [],
    rowIds: [String((data as any)?.id || fallbackId || "")].filter(Boolean),
    relatedTables: ["maintenance_stats"],
  });
};

@Controller("api/maintenance")
@UseGuards(RequireAuthGuard, RolesGuard)
export class MaintenanceController {
  constructor(private readonly maintenanceService: MaintenanceService) {}

  @Get("requests")
  @Roles(...MAINTENANCE_REQUEST_ROLES)
  async listRequests(@Query("status") status?: string) {
    return { data: await this.maintenanceService.listRequests(status) };
  }

  @Get("stats")
  @Roles(...MAINTENANCE_REQUEST_ROLES)
  async getStats() {
    return { data: await this.maintenanceService.getStats() };
  }

  @Get("requests/:id")
  @Roles(...MAINTENANCE_REQUEST_ROLES)
  async getRequest(@Param("id") id: string) {
    return { data: await this.maintenanceService.getRequestById(id) };
  }

  @Post("requests")
  @Roles(...MAINTENANCE_REQUEST_ROLES)
  @HttpCode(201)
  async createRequest(@Req() req: any, @Body() body: any) {
    const data = await this.maintenanceService.createRequest(body || {}, req.auth?.user || null);
    publish("maintenance_request_created", "INSERT", data);
    return { data };
  }

  @Patch("requests/:id")
  @Roles(...MAINTENANCE_REQUEST_ROLES)
  async updateRequest(@Param("id") id: string, @Body() body: any) {
    const data = await this.maintenanceService.updateRequest(id, body || {});
    publish("maintenance_request_updated", "UPDATE", data, id);
    return { data };
  }

  @Post("requests/:id/submit")
  @Roles(...MAINTENANCE_REQUEST_ROLES)
  async submitRequest(@Req() req: any, @Param("id") id: string, @Body() body: any) {
    const data = await this.maintenanceService.submitRequest(id, req.auth?.user || null, body?.reason);
    publish("maintenance_request_submitted", "UPDATE", data, id);
    return { data };
  }

  @Post("requests/:id/approve")
  @Roles(...MAINTENANCE_REQUEST_ROLES)
  async approveRequest(@Req() req: any, @Param("id") id: string, @Body() body: any) {
    const data = await this.maintenanceService.approveRequest(id, req.auth?.user || null, body?.reason);
    publish("maintenance_request_approved", "UPDATE", data, id);
    return { data };
  }

  @Post("requests/:id/reject")
  @Roles(...MAINTENANCE_REQUEST_ROLES)
  async rejectRequest(@Req() req: any, @Param("id") id: string, @Body() body: any) {
    const data = await this.maintenanceService.rejectRequest(id, body?.reason, req.auth?.user || null);
    publish("maintenance_request_rejected", "UPDATE", data, id);
    return { data };
  }

  @Post("requests/:id/return")
  @Roles(...MAINTENANCE_REQUEST_ROLES)
  async returnRequest(@Req() req: any, @Param("id") id: string, @Body() body: any) {
    const data = await this.maintenanceService.returnRequest(id, body?.reason, req.auth?.user || null);
    publish("maintenance_request_returned", "UPDATE", data, id);
    return { data };
  }

  @Post("requests/:id/cancel")
  @Roles(...MAINTENANCE_REQUEST_ROLES)
  async cancelRequest(@Req() req: any, @Param("id") id: string, @Body() body: any) {
    const data = await this.maintenanceService.cancelRequest(id, req.auth?.user || null, body?.reason);
    publish("maintenance_request_cancelled", "UPDATE", data, id);
    return { data };
  }

  @Post("requests/:id/complete")
  @Roles(...MAINTENANCE_REQUEST_ROLES)
  async completeRequest(@Req() req: any, @Param("id") id: string, @Body() body: any) {
    const data = await this.maintenanceService.completeRequest(id, req.auth?.user || null, body?.reason);
    publish("maintenance_request_completed", "UPDATE", data, id);
    return { data };
  }

  @Delete("requests/:id")
  @Roles(...MAINTENANCE_REQUEST_ROLES)
  async deleteRequest(@Param("id") id: string) {
    const data = await this.maintenanceService.deleteRequest(id);
    publish("maintenance_request_deleted", "DELETE", null, id);
    return { data };
  }
}
