import { Body, Controller, Get, HttpCode, Param, Patch, Post, Put, Req } from "@nestjs/common";

import { forbidden } from "../../core/app-error.js";
import { hasAnyRole, STAFF_READ_ROLES, USER_ADMIN_ROLES } from "../../middleware/authorization.js";
import { Public, Roles } from "../../nest/route-metadata.js";
import { redactPublicSettings, SettingsService } from "./settings.service.js";

@Controller("api/settings")
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @Public()
  async getSettings(@Req() req: any) {
    if (!req.auth?.factory) return { data: this.settingsService.getPublicSettings() };
    const data = await this.settingsService.getSettings();
    return { data: req.auth?.user?.id && hasAnyRole(req, STAFF_READ_ROLES) ? data : redactPublicSettings(data) };
  }

  @Put()
  @Roles(...USER_ADMIN_ROLES)
  async updateSettings(@Req() req: any, @Body() body: Record<string, unknown>) {
    const data = await this.settingsService.updateSettings(body, req.auth.user.id);
    return { data };
  }

  @Get("users")
  @Roles(...USER_ADMIN_ROLES)
  async listUsers() {
    const data = await this.settingsService.listUsers();
    return { data };
  }

  @Post("users")
  @HttpCode(201)
  @Roles(...USER_ADMIN_ROLES)
  async createUser(@Req() req: any, @Body() body: Record<string, unknown>) {
    const data = await this.settingsService.createManagedUser(body || {}, req.auth.user.id);
    return { data };
  }

  @Patch("users/:id")
  @Roles(...USER_ADMIN_ROLES)
  async updateUser(
    @Req() req: any,
    @Param("id") id: string,
    @Body() body: {
      is_active?: boolean;
      roles?: string[];
      departments?: string[];
      primary_department?: string | null;
      org_roles?: string[];
      signature_pin?: string | null;
    },
  ) {
    if (id === req.auth.user.id && body.is_active === false) {
      throw forbidden("Cannot deactivate your own account.");
    }
    const data = await this.settingsService.updateUser(id, body);
    return { data };
  }
}
