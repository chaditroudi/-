import { Body, Controller, Delete, Get, HttpCode, Post, Req } from "@nestjs/common";

import { assertLoginAllowed, clearLoginFailures, recordLoginFailure } from "../../middleware/login-throttle.js";
import { appendAuthAudit } from "../../middleware/security-audit.js";
import { AllowPasswordChangePending, Authenticated, Public } from "../../nest/route-metadata.js";
import { AuthService } from "./auth.service.js";
import { factoryFromAccount, runWithFactory } from "../../db/factory-context.js";

@Controller("api/auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get("session")
  @Public()
  async session(@Req() req: any) {
    const data = await this.authService.getSession(req.auth);
    return { data };
  }

  @Post("signature-pin")
  @Authenticated()
  async setSignaturePin(@Req() req: any, @Body() body: any) {
    const data = await this.authService.setOwnSignaturePin(req.auth, body || {});
    return { data };
  }

  @Delete("signature-pin")
  @Authenticated()
  async clearSignaturePin(@Req() req: any, @Body() body: any) {
    const data = await this.authService.clearOwnSignaturePin(req.auth, body || {});
    return { data };
  }

  @Post("change-password")
  @HttpCode(200)
  @Authenticated()
  @AllowPasswordChangePending()
  async changePassword(@Req() req: any, @Body() body: any) {
    const data = await this.authService.changePassword(req.auth, body || {});
    return { data };
  }

  @Post("logout")
  @HttpCode(200)
  @Authenticated()
  @AllowPasswordChangePending()
  async logout(@Req() req: any) {
    await this.authService.logout(req.auth);
    const { id = null, email = null } = req.auth?.user ?? {};
    appendAuthAudit("AUTH_LOGOUT", id, email, null, [], req, `Déconnexion — ${email}`).catch(() => {});
    return { data: { ok: true } };
  }

  @Post("signin")
  @Public()
  async signIn(@Req() req: any, @Body() body: any) {
    const throttleKey = `${req.ip}|${String(body?.email || "").trim().toLowerCase()}`;
    assertLoginAllowed(throttleKey);
    try {
      const data = await this.authService.signIn(body || {});
      clearLoginFailures(throttleKey);
      const user = data?.user;
      const meta = user?.user_metadata || {};
      const roles: string[] = Array.isArray((meta as any)?.roles) ? (meta as any).roles : ((meta as any)?.role ? [(meta as any).role] : []);
      void runWithFactory(factoryFromAccount(user)!, () => appendAuthAudit("AUTH_LOGIN", user?.id ?? null, user?.email ?? body?.email ?? null,
        (meta as any)?.name ?? null, roles, req, `Connexion — ${user?.email ?? body?.email}`));
      return { data };
    } catch (err: any) {
      recordLoginFailure(throttleKey);
      appendAuthAudit("AUTH_FAILED", null, body?.email ?? null, null, [], req,
        `Échec connexion — ${body?.email ?? "inconnu"}`).catch(() => {});
      throw err;
    }
  }
}
