import { Module } from "@nestjs/common";
import { CollectionsModule } from "../collections/collections.module.js";
import { TransportController } from "./transport.controller.js";
import { TransportService } from "./transport.service.js";

@Module({
  imports: [CollectionsModule],
  controllers: [TransportController],
  providers: [TransportService],
})
export class TransportMgmtModule {}
