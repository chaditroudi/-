import { Module } from "@nestjs/common";

import { AtpController } from "./atp.controller.js";
import { AtpService } from "./atp.service.js";

@Module({
  controllers: [AtpController],
  providers: [AtpService],
  exports: [AtpService],
})
export class AtpModule {}
