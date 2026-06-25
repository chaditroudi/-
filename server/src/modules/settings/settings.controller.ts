import { Body, Controller, Get, Param, Patch, Put, Req, UseGuards } from "@nestjs/common";

import { forbidden } from "../../core/app-error.js";
import { RequireAuthGuard } from "../../nest/route-guards.js";
import { SettingsService } from "./settings.service.js";

const ADMIN_ROLES = ["administrateur_systeme", "directeur_general", "directeur_usine"];

const requireAdminAuth = (req: any) => {
  const roles: string[] = req.auth?.user?.user_metadata?.roles ?? [];
  if (!req.auth?.user?.id || !roles.some((r) => ADMIN_ROLES.includes(r))) {
    throw forbidden("Admin access required.");
  }
};

@Controller("api/settings")
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  async getSettings() {
    const data = await this.settingsService.getSettings();
    return { data };
  }

  @Put()
  @UseGuards(RequireAuthGuard)
  async updateSettings(@Req() req: any, @Body() body: Record<string, unknown>) {
    requireAdminAuth(req);
    const data = await this.settingsService.updateSettings(body, req.auth.user.id);
    return { data };
  }

  @Get("users")
  @UseGuards(RequireAuthGuard)
  async listUsers(@Req() req: any) {
    requireAdminAuth(req);
    const data = await this.settingsService.listUsers();
    return { data };
  }

  @Patch("users/:id")
  @UseGuards(RequireAuthGuard)
  async updateUser(
    @Req() req: any,
    @Param("id") id: string,
    @Body() body: { is_active?: boolean; roles?: string[] },
  ) {
    requireAdminAuth(req);
    if (id === req.auth.user.id && body.is_active === false) {
      throw forbidden("Cannot deactivate your own account.");
    }
    const data = await this.settingsService.updateUser(id, body);
    return { data };
  }
}
