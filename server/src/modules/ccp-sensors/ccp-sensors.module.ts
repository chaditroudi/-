import { Module } from "@nestjs/common";

import { Phase2Module } from "../phase2/phase2.module.js";
import { StorageModule } from "../storage/storage.module.js";
import { CcpSensorsController } from "./ccp-sensors.controller.js";
import { CcpSensorsService } from "./ccp-sensors.service.js";

@Module({
  imports: [Phase2Module, StorageModule],
  controllers: [CcpSensorsController],
  providers: [CcpSensorsService],
  exports: [CcpSensorsService],
})
export class CcpSensorsModule {}
