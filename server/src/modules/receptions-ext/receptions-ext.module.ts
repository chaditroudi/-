import { Module } from "@nestjs/common";
import { CollectionsModule } from "../collections/collections.module.js";
import { ReceptionsModule } from "../receptions/receptions.module.js";
import { ReceptionsExtController } from "./receptions-ext.controller.js";

@Module({
  imports: [CollectionsModule, ReceptionsModule],
  controllers: [ReceptionsExtController],
})
export class ReceptionsExtModule {}
