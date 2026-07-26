import { Module } from "@nestjs/common";

import { TrustModule } from "../trust/trust.module.js";
import { ReceptionsController } from "./receptions.controller.js";
import { ReceptionsService } from "./receptions.service.js";

@Module({
  imports: [TrustModule],
  controllers: [ReceptionsController],
  providers: [ReceptionsService],
  exports: [ReceptionsService],
})
export class ReceptionsModule {}
