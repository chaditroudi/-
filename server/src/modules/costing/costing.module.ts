import { Module } from "@nestjs/common";

import { CostingController } from "./costing.controller.js";
import { CostingService } from "./costing.service.js";

@Module({
  controllers: [CostingController],
  providers: [CostingService],
  exports: [CostingService],
})
export class CostingModule {}
