import { Body, Controller, Get, Headers, Post, Query, Req, UseGuards } from "@nestjs/common";
import { issueFactoryDeviceToken } from "../../db/factory-device-token.js";
import { unauthorized } from "../../core/app-error.js";

import { DEVICE_ADMIN_ROLES, STAFF_READ_ROLES } from "../../middleware/authorization.js";
import { RequireAuthGuard } from "../../nest/route-guards.js";
import { Public, Roles } from "../../nest/route-metadata.js";
import { WeighbridgeService, type WeighbridgeReadingInput } from "./weighbridge.service.js";

@Controller("api/weighbridge")
export class WeighbridgeController {
  constructor(private readonly weighbridge: WeighbridgeService) {}

  @Get("health")
  @Roles(...STAFF_READ_ROLES)
  @UseGuards(RequireAuthGuard)
  health() {
    return { data: { wave: "W3", transport: "HTTP_PUSH", simulator: "SIM-01" } };
  }

  @Public()
  @Post("readings")
  async ingest(
    @Req() req: any,
    @Body() body: WeighbridgeReadingInput,
    @Headers("x-weighbridge-signature") signature?: string,
  ) {
    if (!req.auth && req.deviceFactory?.deviceCode !== body?.deviceCode) throw unauthorized("Factory device credential required.");
    return { data: await this.weighbridge.ingest(body || {}, signature) };
  }

  @Get("readings")
  @Roles(...STAFF_READ_ROLES)
  @UseGuards(RequireAuthGuard)
  async readings(@Query("unconsumed") unconsumed?: string) {
    return { data: await this.weighbridge.listReadings(unconsumed === "true") };
  }

  @Get("devices")
  @Roles(...DEVICE_ADMIN_ROLES)
  @UseGuards(RequireAuthGuard)
  async devices() {
    return { data: await this.weighbridge.listDevices() };
  }

  @Post("devices")
  @Roles(...DEVICE_ADMIN_ROLES)
  @UseGuards(RequireAuthGuard)
  async register(@Body() body: Record<string, unknown>) {
    const data = await this.weighbridge.registerDevice(body || {});
    return { data: { ...data, factory_token: issueFactoryDeviceToken("weighbridge", String(data.device_code)) } };
  }
}
