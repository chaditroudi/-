import { SetMetadata } from "@nestjs/common";
export const ROLES_KEY = "route_roles";
export const DB_ACTION_KEY = "route_db_action";
export const Roles = (...roles) => SetMetadata(ROLES_KEY, roles);
export const DbAction = (action) => SetMetadata(DB_ACTION_KEY, action);
