import { Body, Controller, Param, Post, UseGuards } from "@nestjs/common";

import { RequireAuthGuard } from "../../nest/route-guards.js";
import { RpcGuard } from "../../nest/route-guards.js";
import { RpcService } from "./rpc.service.js";

@Controller("api/rpc")
@UseGuards(RequireAuthGuard, RpcGuard)
export class RpcController {
  constructor(private readonly rpcService: RpcService) {}

  @Post(":name")
  async execute(@Param("name") name: string, @Body() body: Record<string, unknown>) {
    const data = await this.rpcService.execute(name, body || {});
    return { data };
  }
}
