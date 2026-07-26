import { Body, Controller, Get, Headers, Post, Query, UseGuards } from "@nestjs/common";

import { RequireAuthGuard } from "../../nest/route-guards.js";
import { Public } from "../../nest/route-metadata.js";
import { WeighbridgeService, type WeighbridgeReadingInput } from "./weighbridge.service.js";

@Controller("api/weighbridge")
export class WeighbridgeController {
  constructor(private readonly weighbridge: WeighbridgeService) {}

  @Get("health")
  @UseGuards(RequireAuthGuard)
  health() {
    return { data: { wave: "W3", transport: "HTTP_PUSH", simulator: "SIM-01" } };
  }

  @Public()
  @Post("readings")
  async ingest(
    @Body() body: WeighbridgeReadingInput,
    @Headers("x-weighbridge-signature") signature?: string,
  ) {
    return { data: await this.weighbridge.ingest(body || {}, signature) };
  }

  @Get("readings")
  @UseGuards(RequireAuthGuard)
  async readings(@Query("unconsumed") unconsumed?: string) {
    return { data: await this.weighbridge.listReadings(unconsumed === "true") };
  }

  @Get("devices")
  @UseGuards(RequireAuthGuard)
  async devices() {
    return { data: await this.weighbridge.listDevices() };
  }

  @Post("devices")
  @UseGuards(RequireAuthGuard)
  async register(@Body() body: Record<string, unknown>) {
    return { data: await this.weighbridge.registerDevice(body || {}) };
  }
}
