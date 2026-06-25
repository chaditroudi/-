import { Body, Controller, Get, HttpCode, Post, Req } from "@nestjs/common";

import { appendAuthAudit } from "../../middleware/security-audit.js";
import { AuthService } from "./auth.service.js";

@Controller("api/auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get("session")
  async session(@Req() req: any) {
    const data = await this.authService.getSession(req.auth);
    return { data };
  }

  @Post("signup")
  @HttpCode(201)
  async signUp(@Req() req: any, @Body() body: any) {
    const data = await this.authService.signUp(body || {});
    const user = data?.user;
    const meta = user?.user_metadata || {};
    appendAuthAudit("AUTH_SIGNUP", user?.id ?? null, user?.email ?? body?.email ?? null,
      (meta as any)?.name ?? null, [], req, `Inscription — ${user?.email ?? body?.email}`).catch(() => {});
    return { data };
  }

  @Post("signin")
  async signIn(@Req() req: any, @Body() body: any) {
    try {
      const data = await this.authService.signIn(body || {});
      const user = data?.user;
      const meta = user?.user_metadata || {};
      const roles: string[] = Array.isArray((meta as any)?.roles) ? (meta as any).roles : ((meta as any)?.role ? [(meta as any).role] : []);
      appendAuthAudit("AUTH_LOGIN", user?.id ?? null, user?.email ?? body?.email ?? null,
        (meta as any)?.name ?? null, roles, req, `Connexion — ${user?.email ?? body?.email}`).catch(() => {});
      return { data };
    } catch (err: any) {
      appendAuthAudit("AUTH_FAILED", null, body?.email ?? null, null, [], req,
        `Échec connexion — ${body?.email ?? "inconnu"}`).catch(() => {});
      throw err;
    }
  }
}
