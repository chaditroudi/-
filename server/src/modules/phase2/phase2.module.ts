import { Module } from "@nestjs/common";

import { SettlementModule } from "../settlement/settlement.module.js";
import { Phase2Controller } from "./phase2.controller.js";
import { Phase2Service } from "./phase2.service.js";

@Module({
  imports: [SettlementModule],
  controllers: [Phase2Controller],
  providers: [Phase2Service],
  exports: [Phase2Service],
})
export class Phase2Module {}
