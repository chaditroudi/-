import { CanActivate, ExecutionContext, Inject, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import { AppError, forbidden, sessionRequired } from "../core/app-error.js";
import { canAccessRpc, hasAnyRole } from "../middleware/authorization.js";
import { ANY_ROLE_KEY, IS_PUBLIC_KEY, PASSWORD_CHANGE_PENDING_KEY, ROLES_KEY } from "./route-metadata.js";

const routeMetadata = <T>(reflector: Reflector, key: string, context: ExecutionContext) =>
  reflector.getAllAndOverride<T>(key, [context.getHandler(), context.getClass()]);

@Injectable()
export class RequireAuthGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    if (routeMetadata<boolean>(this.reflector, IS_PUBLIC_KEY, context)) return true;

    const req = context.switchToHttp().getRequest();
    if (!req.auth?.user?.id) {
      throw sessionRequired();
    }
    if (req.auth.mustChangePassword && !routeMetadata<boolean>(this.reflector, PASSWORD_CHANGE_PENDING_KEY, context)) {
      throw new AppError(403, "PASSWORD_CHANGE_REQUIRED", "Changez votre mot de passe pour continuer.");
    }
    return true;
  }
}

/** Default deny: a route is refused until it declares @Public, @Authenticated or @Roles. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    if (routeMetadata<boolean>(this.reflector, IS_PUBLIC_KEY, context)) return true;
    if (routeMetadata<boolean>(this.reflector, ANY_ROLE_KEY, context)) return true;

    const roles = routeMetadata<string[]>(this.reflector, ROLES_KEY, context);
    const req = context.switchToHttp().getRequest();
    if (!roles?.length || !hasAnyRole(req, roles)) {
      throw forbidden("You do not have permission for this operation.");
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
