import { Module } from "@nestjs/common";

import { WeighbridgeController } from "./weighbridge.controller.js";
import { WeighbridgeService } from "./weighbridge.service.js";

@Module({
  controllers: [WeighbridgeController],
  providers: [WeighbridgeService],
  exports: [WeighbridgeService],
})
export class WeighbridgeModule {}
