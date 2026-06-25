import { SetMetadata } from "@nestjs/common";

export const ROLES_KEY = "route_roles";
export const DB_ACTION_KEY = "route_db_action";

export type DbAction = "read" | "write";

export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
export const DbAction = (action: DbAction) => SetMetadata(DB_ACTION_KEY, action);
