var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
import { Body, Controller, Get, HttpCode, Post, Req } from "@nestjs/common";
import { appendAuthAudit } from "../../middleware/security-audit.js";
import { AuthService } from "./auth.service.js";
let AuthController = class AuthController {
    authService;
    constructor(authService) {
        this.authService = authService;
    }
    async session(req) {
        const data = await this.authService.getSession(req.auth);
        return { data };
    }
    async signUp(req, body) {
        const data = await this.authService.signUp(body || {});
        const user = data?.user;
        const meta = user?.user_metadata || {};
        appendAuthAudit("AUTH_SIGNUP", user?.id ?? null, user?.email ?? body?.email ?? null, meta?.name ?? null, [], req, `Inscription — ${user?.email ?? body?.email}`).catch(() => { });
        return { data };
    }
    async signIn(req, body) {
        try {
            const data = await this.authService.signIn(body || {});
            const user = data?.user;
            const meta = user?.user_metadata || {};
            const roles = Array.isArray(meta?.roles) ? meta.roles : (meta?.role ? [meta.role] : []);
            appendAuthAudit("AUTH_LOGIN", user?.id ?? null, user?.email ?? body?.email ?? null, meta?.name ?? null, roles, req, `Connexion — ${user?.email ?? body?.email}`).catch(() => { });
            return { data };
        }
        catch (err) {
            appendAuthAudit("AUTH_FAILED", null, body?.email ?? null, null, [], req, `Échec connexion — ${body?.email ?? "inconnu"}`).catch(() => { });
            throw err;
        }
    }
};
__decorate([
    Get("session"),
    __param(0, Req()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "session", null);
__decorate([
    Post("signup"),
    HttpCode(201),
    __param(0, Req()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "signUp", null);
__decorate([
    Post("signin"),
    __param(0, Req()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "signIn", null);
AuthController = __decorate([
    Controller("api/auth"),
    __metadata("design:paramtypes", [AuthService])
], AuthController);
export { AuthController };
