import { Module } from "@nestjs/common";
import { CollectionsModule } from "../collections/collections.module.js";
import { ReceptionsExtController } from "./receptions-ext.controller.js";

@Module({
  imports: [CollectionsModule],
  controllers: [ReceptionsExtController],
})
export class ReceptionsExtModule {}
