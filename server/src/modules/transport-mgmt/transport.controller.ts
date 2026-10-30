import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { SHIPPING_ROLES, STAFF_READ_ROLES } from "../../middleware/authorization.js";
import { Roles } from "../../nest/route-metadata.js";
import { RequireAuthGuard } from "../../nest/route-guards.js";
import { CollectionsService } from "../collections/collections.service.js";
import { TransportService } from "./transport.service.js";

@Controller("api/transport")
@UseGuards(RequireAuthGuard)
export class TransportController {
  constructor(
    private readonly cs: CollectionsService,
    private readonly transportService: TransportService,
  ) {}

  // ── Vehicles ──────────────────────────────────────────────────────────────

  @Get("vehicles")
  @Roles(...STAFF_READ_ROLES)
  async listVehicles(@Query("status") status?: string) {
    const filters: any[] = [];
    if (status) filters.push({ type: "eq", column: "status", value: status });
    const data = await this.cs.query({ table: "transport_vehicles", filters, orderBy: { column: "registration_number", ascending: true } });
    return { data };
  }

  @Post("vehicles")
  @Roles(...SHIPPING_ROLES)
  async createVehicle(@Body() body: any) {
    const data = await this.cs.insert({ table: "transport_vehicles", values: body });
    return { data: data[0] };
  }

  @Patch("vehicles/:id")
  @Roles(...SHIPPING_ROLES)
  async updateVehicle(@Param("id") id: string, @Body() body: any) {
    const { after } = await this.cs.update({ table: "transport_vehicles", filters: [{ type: "eq", column: "id", value: id }], values: body });
    return { data: after[0] };
  }

  // ── Drivers ───────────────────────────────────────────────────────────────

  @Get("drivers")
  @Roles(...STAFF_READ_ROLES)
  async listDrivers(@Query("status") status?: string) {
    const filters: any[] = [];
    if (status) filters.push({ type: "eq", column: "status", value: status });
    const data = await this.cs.query({ table: "transport_drivers", filters, orderBy: { column: "last_name", ascending: true } });
    return { data };
  }

  @Post("drivers")
  @Roles(...SHIPPING_ROLES)
  async createDriver(@Body() body: any) {
    const data = await this.cs.insert({ table: "transport_drivers", values: body });
    return { data: data[0] };
  }

  @Patch("drivers/:id")
  @Roles(...SHIPPING_ROLES)
  async updateDriver(@Param("id") id: string, @Body() body: any) {
    const { after } = await this.cs.update({ table: "transport_drivers", filters: [{ type: "eq", column: "id", value: id }], values: body });
    return { data: after[0] };
  }

  // ── Missions — summary must be declared before :id ────────────────────────

  @Get("missions/summary")
  @Roles(...STAFF_READ_ROLES)
  async getMissionsSummary() {
    const data = await this.transportService.getSummary();
    return { data };
  }

  @Get("missions")
  @Roles(...STAFF_READ_ROLES)
  async listMissions(@Query("status") status?: string, @Query("vehicle_id") vehicleId?: string) {
    const filters: any[] = [];
    if (status) filters.push({ type: "eq", column: "status", value: status });
    if (vehicleId) filters.push({ type: "eq", column: "vehicle_id", value: vehicleId });
    const data = await this.cs.query({ table: "transport_missions", filters, orderBy: { column: "created_at", ascending: false } });
    return { data };
  }

  @Post("missions")
  @Roles(...SHIPPING_ROLES)
  async createMission(@Body() body: any) {
    const data = await this.cs.insert({ table: "transport_missions", values: body });
    return { data: data[0] };
  }

  @Patch("missions/:id")
  @Roles(...SHIPPING_ROLES)
  async updateMission(@Param("id") id: string, @Body() body: any) {
    const { after } = await this.cs.update({ table: "transport_missions", filters: [{ type: "eq", column: "id", value: id }], values: body });
    return { data: after[0] };
  }

  // ── Business action endpoints ─────────────────────────────────────────────

  @Post("missions/:id/assign")
  @Roles(...SHIPPING_ROLES)
  async assignMission(@Param("id") id: string, @Body() body: any) {
    const data = await this.transportService.assignMission(id, body ?? {}, body?.actor ?? null);
    return { data };
  }

  @Post("missions/:id/start")
  @Roles(...SHIPPING_ROLES)
  async startMission(@Param("id") id: string, @Body() body: any) {
    const data = await this.transportService.startMission(id, body?.actor ?? null);
    return { data };
  }

  @Post("missions/:id/complete")
  @Roles(...SHIPPING_ROLES)
  async completeMission(@Param("id") id: string, @Body() body: any) {
    const data = await this.transportService.completeMission(id, body ?? {}, body?.actor ?? null);
    return { data };
  }

  @Post("missions/:id/cancel")
  @Roles(...SHIPPING_ROLES)
  async cancelMission(@Param("id") id: string, @Body() body: any) {
    const data = await this.transportService.cancelMission(
      id,
      String(body?.reason ?? "Annulée"),
      body?.actor ?? null,
    );
    return { data };
  }

  // ── Position Logs ─────────────────────────────────────────────────────────

  @Get("position-logs")
  @Roles(...STAFF_READ_ROLES)
  async listPositionLogs(@Query("mission_id") missionId?: string, @Query("vehicle_id") vehicleId?: string) {
    const filters: any[] = [];
    if (missionId) filters.push({ type: "eq", column: "mission_id", value: missionId });
    if (vehicleId) filters.push({ type: "eq", column: "vehicle_id", value: vehicleId });
    const data = await this.cs.query({ table: "transport_position_logs", filters, orderBy: { column: "recorded_at", ascending: false } });
    return { data };
  }

  @Post("position-logs")
  @Roles(...SHIPPING_ROLES)
  async createPositionLog(@Body() body: any) {
    const data = await this.cs.insert({ table: "transport_position_logs", values: body });
    return { data: data[0] };
  }
}
