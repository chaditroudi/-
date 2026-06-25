import { Module } from "@nestjs/common";

import { PackagingController } from "./packaging.controller.js";
import { PackagingService } from "./packaging.service.js";

@Module({
  controllers: [PackagingController],
  providers: [PackagingService],
  exports: [PackagingService],
})
export class PackagingModule {}
