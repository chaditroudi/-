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
import { Body, Controller, Get, Param, Patch, Put, Req, UseGuards } from "@nestjs/common";
import { forbidden } from "../../core/app-error.js";
import { RequireAuthGuard } from "../../nest/route-guards.js";
import { SettingsService } from "./settings.service.js";
const ADMIN_ROLES = ["administrateur_systeme", "directeur_general", "directeur_usine"];
const requireAdminAuth = (req) => {
    const roles = req.auth?.user?.user_metadata?.roles ?? [];
    if (!req.auth?.user?.id || !roles.some((r) => ADMIN_ROLES.includes(r))) {
        throw forbidden("Admin access required.");
    }
};
let SettingsController = class SettingsController {
    settingsService;
    constructor(settingsService) {
        this.settingsService = settingsService;
    }
    async getSettings() {
        const data = await this.settingsService.getSettings();
        return { data };
    }
    async updateSettings(req, body) {
        requireAdminAuth(req);
        const data = await this.settingsService.updateSettings(body, req.auth.user.id);
        return { data };
    }
    async listUsers(req) {
        requireAdminAuth(req);
        const data = await this.settingsService.listUsers();
        return { data };
    }
    async updateUser(req, id, body) {
        requireAdminAuth(req);
        if (id === req.auth.user.id && body.is_active === false) {
            throw forbidden("Cannot deactivate your own account.");
        }
        const data = await this.settingsService.updateUser(id, body);
        return { data };
    }
};
__decorate([
    Get(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "getSettings", null);
__decorate([
    Put(),
    UseGuards(RequireAuthGuard),
    __param(0, Req()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "updateSettings", null);
__decorate([
    Get("users"),
    UseGuards(RequireAuthGuard),
    __param(0, Req()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "listUsers", null);
__decorate([
    Patch("users/:id"),
    UseGuards(RequireAuthGuard),
    __param(0, Req()),
    __param(1, Param("id")),
    __param(2, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "updateUser", null);
SettingsController = __decorate([
    Controller("api/settings"),
    __metadata("design:paramtypes", [SettingsService])
], SettingsController);
export { SettingsController };
