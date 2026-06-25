import { Module } from "@nestjs/common";
import { CollectionsModule } from "../collections/collections.module.js";
import { QualityExtController } from "./quality-ext.controller.js";

@Module({
  imports: [CollectionsModule],
  controllers: [QualityExtController],
})
export class QualityExtModule {}
