import { Module } from "@nestjs/common";

import { ReceptionsController } from "./receptions.controller.js";
import { ReceptionsService } from "./receptions.service.js";

@Module({
  controllers: [ReceptionsController],
  providers: [ReceptionsService],
  exports: [ReceptionsService],
})
export class ReceptionsModule {}
