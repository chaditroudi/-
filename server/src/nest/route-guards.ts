import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import { badRequest, forbidden, unauthorized } from "../core/app-error.js";
import { canAccessRpc, canReadTable, canWriteTable, hasAnyRole } from "../middleware/authorization.js";
import { DB_ACTION_KEY, type DbAction, ROLES_KEY } from "./route-metadata.js";

@Injectable()
export class RequireAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    if (!req.auth?.user?.id) {
      throw unauthorized();
    }
    return true;
  }
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    const roles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!roles || roles.length === 0) return true;

    const req = context.switchToHttp().getRequest();
    if (!hasAnyRole(req, roles)) {
      throw forbidden("You do not have permission for this operation.");
    }

    return true;
  }
}

@Injectable()
export class DbActionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    const action = this.reflector.getAllAndOverride<DbAction>(DB_ACTION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!action) return true;

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
}

@Injectable()
export class RpcGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    const name = String(req.params?.name || "");

    if (!canAccessRpc(req, name)) {
      throw forbidden("Unknown or unauthorized RPC.");
    }

    return true;
  }
}
