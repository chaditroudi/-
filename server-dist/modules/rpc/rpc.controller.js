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
var _a;
import { Body, Controller, Param, Post, UseGuards } from "@nestjs/common";
import { RequireAuthGuard } from "../../nest/route-guards.js";
import { RpcGuard } from "../../nest/route-guards.js";
import { RpcService } from "./rpc.service.js";
let RpcController = class RpcController {
    rpcService;
    constructor(rpcService) {
        this.rpcService = rpcService;
    }
    async execute(name, body) {
        const data = await this.rpcService.execute(name, body || {});
        return { data };
    }
};
__decorate([
    Post(":name"),
    __param(0, Param("name")),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, typeof (_a = typeof Record !== "undefined" && Record) === "function" ? _a : Object]),
    __metadata("design:returntype", Promise)
], RpcController.prototype, "execute", null);
RpcController = __decorate([
    Controller("api/rpc"),
    UseGuards(RequireAuthGuard, RpcGuard),
    __metadata("design:paramtypes", [RpcService])
], RpcController);
export { RpcController };
