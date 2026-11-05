import { Body, Controller, Get, Headers, Post, Req, UseGuards } from "@nestjs/common";
import { issueFactoryDeviceToken } from "../../db/factory-device-token.js";
import { unauthorized } from "../../core/app-error.js";

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
    @Req() req: any,
    @Body() body: CcpReadingInput,
    @Headers("x-ccp-signature") signature?: string,
  ) {
    if (!req.auth && req.deviceFactory?.deviceCode !== body?.deviceCode) throw unauthorized("Factory device credential required.");
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
    const data = await this.ccpSensors.registerDevice(body || {});
    return { data: { ...data, factory_token: issueFactoryDeviceToken("ccp-sensors", String(data.device_code)) } };
  }
}
