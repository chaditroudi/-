import { Module } from "@nestjs/common";
import { CollectionsModule } from "../collections/collections.module.js";
import { StockController } from "./stock.controller.js";

@Module({
  imports: [CollectionsModule],
  controllers: [StockController],
})
export class StockModule {}
