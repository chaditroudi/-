import { Module } from "@nestjs/common";
import { CollectionsModule } from "../collections/collections.module.js";
import { HrController } from "./hr.controller.js";
import { HrService } from "./hr.service.js";

@Module({
  imports: [CollectionsModule],
  controllers: [HrController],
  providers: [HrService],
})
export class HrModule {}
