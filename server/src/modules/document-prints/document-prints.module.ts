import { Module } from "@nestjs/common";
import { DocumentPrintsController } from "./document-prints.controller.js";
import { DocumentPrintsService } from "./document-prints.service.js";

@Module({
  controllers: [DocumentPrintsController],
  providers: [DocumentPrintsService],
})
export class DocumentPrintsModule {}
