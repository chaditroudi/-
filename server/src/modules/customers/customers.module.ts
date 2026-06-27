import { Module } from "@nestjs/common";
import { CollectionsModule } from "../collections/collections.module.js";
import { CustomersController } from "./customers.controller.js";

@Module({
  imports: [CollectionsModule],
  controllers: [CustomersController],
})
export class CustomersModule {}
