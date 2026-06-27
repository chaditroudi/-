import { Module } from "@nestjs/common";
import { CollectionsModule } from "../collections/collections.module.js";
import { ExportOrdersController } from "./export-orders.controller.js";
import { COADocumentsController } from "./coa-documents.controller.js";
import { ExportContractsController } from "./export-contracts.controller.js";

@Module({
  imports: [CollectionsModule],
  controllers: [
    ExportOrdersController,
    COADocumentsController,
    ExportContractsController,
  ],
})
export class ExportModule {}
