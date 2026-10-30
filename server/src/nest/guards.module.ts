import { Global, Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";

import { RequireAuthGuard, RolesGuard, RpcGuard } from "./route-guards.js";

@Global()
@Module({
  providers: [
    RequireAuthGuard,
    RolesGuard,
    RpcGuard,
    { provide: APP_GUARD, useExisting: RequireAuthGuard },
    { provide: APP_GUARD, useExisting: RolesGuard },
  ],
  exports: [RequireAuthGuard, RolesGuard, RpcGuard],
})
export class GuardsModule {}
