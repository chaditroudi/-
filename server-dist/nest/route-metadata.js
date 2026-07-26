import { SetMetadata } from "@nestjs/common";
export const ROLES_KEY = "route_roles";
export const DB_ACTION_KEY = "route_db_action";
export const IS_PUBLIC_KEY = "is_public";
export const Roles = (...roles) => SetMetadata(ROLES_KEY, roles);
export const DbAction = (action) => SetMetadata(DB_ACTION_KEY, action);
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
