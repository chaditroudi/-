import { Module } from "@nestjs/common";
import { CollectionsModule } from "../collections/collections.module.js";
import { MaterialReceptionsController } from "./material-receptions.controller.js";

@Module({
  imports: [CollectionsModule],
  controllers: [MaterialReceptionsController],
})
export class MaterialReceptionsModule {}
