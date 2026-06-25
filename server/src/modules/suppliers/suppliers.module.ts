import { Module } from "@nestjs/common";
import { CollectionsModule } from "../collections/collections.module.js";
import { ReceptionsModule } from "../receptions/receptions.module.js";
import { SuppliersController } from "./suppliers.controller.js";

@Module({
  imports: [CollectionsModule, ReceptionsModule],
  controllers: [SuppliersController],
})
export class SuppliersModule {}
