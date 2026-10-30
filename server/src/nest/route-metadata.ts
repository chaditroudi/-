import { SetMetadata } from "@nestjs/common";

export const ROLES_KEY = "route_roles";
export const IS_PUBLIC_KEY = "is_public";
export const ANY_ROLE_KEY = "route_any_role";
export const PASSWORD_CHANGE_PENDING_KEY = "route_password_change_pending";

export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
/** Any signed-in account. A deliberate decision: a route with neither this nor @Roles is refused. */
export const Authenticated = () => SetMetadata(ANY_ROLE_KEY, true);
/** Stays reachable while the account must change its password. */
export const AllowPasswordChangePending = () => SetMetadata(PASSWORD_CHANGE_PENDING_KEY, true);
