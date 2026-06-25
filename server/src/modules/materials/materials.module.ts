import { Module } from "@nestjs/common";
import { CollectionsModule } from "../collections/collections.module.js";
import { MaterialsController } from "./materials.controller.js";

@Module({
  imports: [CollectionsModule],
  controllers: [MaterialsController],
})
export class MaterialsModule {}
