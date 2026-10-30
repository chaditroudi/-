import { Module } from "@nestjs/common";

import { CollectionsService } from "./collections.service.js";

@Module({
  providers: [CollectionsService],
  exports: [CollectionsService],
})
export class CollectionsModule {}
