import { Body, Controller, Get, Headers, Post, UseGuards } from "@nestjs/common";

import { DEVICE_ADMIN_ROLES, STAFF_READ_ROLES } from "../../middleware/authorization.js";
import { RequireAuthGuard } from "../../nest/route-guards.js";
import { Public, Roles } from "../../nest/route-metadata.js";
import { CcpSensorsService, type CcpReadingInput } from "./ccp-sensors.service.js";

@Controller("api/ccp-sensors")
export class CcpSensorsController {
  constructor(private readonly ccpSensors: CcpSensorsService) {}

  @Get("health")
  @Roles(...STAFF_READ_ROLES)
  @UseGuards(RequireAuthGuard)
  health() {
    return {
      data: {
        wave: "A",
        transport: "HTTP_PUSH",
        simulators: ["CCP-FUM-SIM-01", "CCP-COLD-SIM-01"],
      },
    };
  }

  @Public()
  @Post("readings")
  async ingest(
    @Body() body: CcpReadingInput,
    @Headers("x-ccp-signature") signature?: string,
  ) {
    return { data: await this.ccpSensors.ingest(body || {}, signature) };
  }

  @Get("devices")
  @Roles(...DEVICE_ADMIN_ROLES)
  @UseGuards(RequireAuthGuard)
  async devices() {
    return { data: await this.ccpSensors.listDevices() };
  }

  @Post("devices")
  @Roles(...DEVICE_ADMIN_ROLES)
  @UseGuards(RequireAuthGuard)
  async register(@Body() body: Record<string, unknown>) {
    return { data: await this.ccpSensors.registerDevice(body || {}) };
  }
}
