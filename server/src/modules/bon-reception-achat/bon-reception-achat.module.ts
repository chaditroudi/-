import { Module } from "@nestjs/common";
import { CollectionsModule } from "../collections/collections.module.js";
import { BonReceptionAchatController } from "./bon-reception-achat.controller.js";

@Module({
  imports: [CollectionsModule],
  controllers: [BonReceptionAchatController],
})
export class BonReceptionAchatModule {}
