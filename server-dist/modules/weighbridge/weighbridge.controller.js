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
import { Body, Controller, Get, Headers, Post, Query, UseGuards } from "@nestjs/common";
import { RequireAuthGuard } from "../../nest/route-guards.js";
import { Public } from "../../nest/route-metadata.js";
import { WeighbridgeService } from "./weighbridge.service.js";
let WeighbridgeController = class WeighbridgeController {
    weighbridge;
    constructor(weighbridge) {
        this.weighbridge = weighbridge;
    }
    health() {
        return { data: { wave: "W3", transport: "HTTP_PUSH", simulator: "SIM-01" } };
    }
    async ingest(body, signature) {
        return { data: await this.weighbridge.ingest(body || {}, signature) };
    }
    async readings(unconsumed) {
        return { data: await this.weighbridge.listReadings(unconsumed === "true") };
    }
    async devices() {
        return { data: await this.weighbridge.listDevices() };
    }
    async register(body) {
        return { data: await this.weighbridge.registerDevice(body || {}) };
    }
};
__decorate([
    Get("health"),
    UseGuards(RequireAuthGuard),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], WeighbridgeController.prototype, "health", null);
__decorate([
    Public(),
    Post("readings"),
    __param(0, Body()),
    __param(1, Headers("x-weighbridge-signature")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], WeighbridgeController.prototype, "ingest", null);
__decorate([
    Get("readings"),
    UseGuards(RequireAuthGuard),
    __param(0, Query("unconsumed")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], WeighbridgeController.prototype, "readings", null);
__decorate([
    Get("devices"),
    UseGuards(RequireAuthGuard),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], WeighbridgeController.prototype, "devices", null);
__decorate([
    Post("devices"),
    UseGuards(RequireAuthGuard),
    __param(0, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], WeighbridgeController.prototype, "register", null);
WeighbridgeController = __decorate([
    Controller("api/weighbridge"),
    __metadata("design:paramtypes", [WeighbridgeService])
], WeighbridgeController);
export { WeighbridgeController };
