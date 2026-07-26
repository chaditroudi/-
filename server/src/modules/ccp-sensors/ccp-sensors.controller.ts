import { Body, Controller, Get, Headers, Post, UseGuards } from "@nestjs/common";

import { RequireAuthGuard } from "../../nest/route-guards.js";
import { Public } from "../../nest/route-metadata.js";
import { CcpSensorsService, type CcpReadingInput } from "./ccp-sensors.service.js";

@Controller("api/ccp-sensors")
export class CcpSensorsController {
  constructor(private readonly ccpSensors: CcpSensorsService) {}

  @Get("health")
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
  @UseGuards(RequireAuthGuard)
  async devices() {
    return { data: await this.ccpSensors.listDevices() };
  }

  @Post("devices")
  @UseGuards(RequireAuthGuard)
  async register(@Body() body: Record<string, unknown>) {
    return { data: await this.ccpSensors.registerDevice(body || {}) };
  }
}
