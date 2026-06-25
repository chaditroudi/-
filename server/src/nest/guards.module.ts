import { Global, Module } from "@nestjs/common";

import { DbActionGuard, RequireAuthGuard, RolesGuard, RpcGuard } from "./route-guards.js";

@Global()
@Module({
  providers: [RequireAuthGuard, RolesGuard, DbActionGuard, RpcGuard],
  exports: [RequireAuthGuard, RolesGuard, DbActionGuard, RpcGuard],
})
export class GuardsModule {}
