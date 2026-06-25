import { Module } from "@nestjs/common";
import { CollectionsModule } from "../collections/collections.module.js";
import { ProductionController } from "./production.controller.js";
import { ProductionService } from "./production.service.js";

@Module({
  imports: [CollectionsModule],
  controllers: [ProductionController],
  providers: [ProductionService],
})
export class ProductionModule {}
