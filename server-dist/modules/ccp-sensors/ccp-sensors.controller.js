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
import { Body, Controller, Get, Headers, Post, UseGuards } from "@nestjs/common";
import { RequireAuthGuard } from "../../nest/route-guards.js";
import { Public } from "../../nest/route-metadata.js";
import { CcpSensorsService } from "./ccp-sensors.service.js";
let CcpSensorsController = class CcpSensorsController {
    ccpSensors;
    constructor(ccpSensors) {
        this.ccpSensors = ccpSensors;
    }
    health() {
        return {
            data: {
                wave: "A",
                transport: "HTTP_PUSH",
                simulators: ["CCP-FUM-SIM-01", "CCP-COLD-SIM-01"],
            },
        };
    }
    async ingest(body, signature) {
        return { data: await this.ccpSensors.ingest(body || {}, signature) };
    }
    async devices() {
        return { data: await this.ccpSensors.listDevices() };
    }
    async register(body) {
        return { data: await this.ccpSensors.registerDevice(body || {}) };
    }
};
__decorate([
    Get("health"),
    UseGuards(RequireAuthGuard),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], CcpSensorsController.prototype, "health", null);
__decorate([
    Public(),
    Post("readings"),
    __param(0, Body()),
    __param(1, Headers("x-ccp-signature")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], CcpSensorsController.prototype, "ingest", null);
__decorate([
    Get("devices"),
    UseGuards(RequireAuthGuard),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], CcpSensorsController.prototype, "devices", null);
__decorate([
    Post("devices"),
    UseGuards(RequireAuthGuard),
    __param(0, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], CcpSensorsController.prototype, "register", null);
CcpSensorsController = __decorate([
    Controller("api/ccp-sensors"),
    __metadata("design:paramtypes", [CcpSensorsService])
], CcpSensorsController);
export { CcpSensorsController };
