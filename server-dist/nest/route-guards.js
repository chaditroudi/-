var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var _a, _b;
import { Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { badRequest, forbidden, unauthorized } from "../core/app-error.js";
import { canAccessRpc, canReadTable, canWriteTable, hasAnyRole } from "../middleware/authorization.js";
import { DB_ACTION_KEY, ROLES_KEY } from "./route-metadata.js";
let RequireAuthGuard = class RequireAuthGuard {
    canActivate(context) {
        const req = context.switchToHttp().getRequest();
        if (!req.auth?.user?.id) {
            throw unauthorized();
        }
        return true;
    }
};
RequireAuthGuard = __decorate([
    Injectable()
], RequireAuthGuard);
export { RequireAuthGuard };
let RolesGuard = class RolesGuard {
    reflector;
    constructor(reflector) {
        this.reflector = reflector;
    }
    canActivate(context) {
        const roles = this.reflector.getAllAndOverride(ROLES_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        if (!roles || roles.length === 0)
            return true;
        const req = context.switchToHttp().getRequest();
        if (!hasAnyRole(req, roles)) {
            throw forbidden("You do not have permission for this operation.");
        }
        return true;
    }
};
RolesGuard = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [typeof (_a = typeof Reflector !== "undefined" && Reflector) === "function" ? _a : Object])
], RolesGuard);
export { RolesGuard };
let DbActionGuard = class DbActionGuard {
    reflector;
    constructor(reflector) {
        this.reflector = reflector;
    }
    canActivate(context) {
        const action = this.reflector.getAllAndOverride(DB_ACTION_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        if (!action)
            return true;
        const req = context.switchToHttp().getRequest();
        const table = String(req.body?.table || "").trim();
        if (!table) {
            throw badRequest("TABLE_REQUIRED", "Table is required.");
        }
        if (action === "read") {
            if (!canReadTable(req, table)) {
                throw forbidden("You do not have permission to read this resource.");
            }
            return true;
        }
        if (!canWriteTable(req, table)) {
            throw forbidden("You do not have permission to modify this resource.");
        }
        return true;
    }
};
DbActionGuard = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [typeof (_b = typeof Reflector !== "undefined" && Reflector) === "function" ? _b : Object])
], DbActionGuard);
export { DbActionGuard };
let RpcGuard = class RpcGuard {
    canActivate(context) {
        const req = context.switchToHttp().getRequest();
        const name = String(req.params?.name || "");
        if (!canAccessRpc(req, name)) {
            throw forbidden("Unknown or unauthorized RPC.");
        }
        return true;
    }
};
RpcGuard = __decorate([
    Injectable()
], RpcGuard);
export { RpcGuard };
