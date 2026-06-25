import { Module } from "@nestjs/common";
import { CollectionsModule } from "../collections/collections.module.js";
import { BatchesController } from "./batches.controller.js";
import { BatchesService } from "./batches.service.js";

@Module({
  imports: [CollectionsModule],
  controllers: [BatchesController],
  providers: [BatchesService],
})
export class BatchesModule {}
