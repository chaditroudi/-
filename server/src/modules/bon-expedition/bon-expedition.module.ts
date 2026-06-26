import { Module } from "@nestjs/common";
import { CollectionsModule } from "../collections/collections.module.js";
import { BonExpeditionController } from "./bon-expedition.controller.js";

@Module({
  imports: [CollectionsModule],
  controllers: [BonExpeditionController],
})
export class BonExpeditionModule {}
