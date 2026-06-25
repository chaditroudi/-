import { Module } from "@nestjs/common";
import { FluxController } from "./flux.controller.js";

@Module({ controllers: [FluxController] })
export class FluxModule {}
