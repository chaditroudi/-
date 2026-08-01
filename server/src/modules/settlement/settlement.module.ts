import { Module } from "@nestjs/common";

import { ExportMarginService } from "./export-margin.service.js";
import { SettlementController } from "./settlement.controller.js";
import { SettlementService } from "./settlement.service.js";

@Module({
  controllers: [SettlementController],
  providers: [SettlementService, ExportMarginService],
  exports: [SettlementService, ExportMarginService],
})
export class SettlementModule {}
