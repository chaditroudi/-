var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Module } from "@nestjs/common";
import { Phase2Module } from "../phase2/phase2.module.js";
import { StorageModule } from "../storage/storage.module.js";
import { CcpSensorsController } from "./ccp-sensors.controller.js";
import { CcpSensorsService } from "./ccp-sensors.service.js";
let CcpSensorsModule = class CcpSensorsModule {
};
CcpSensorsModule = __decorate([
    Module({
        imports: [Phase2Module, StorageModule],
        controllers: [CcpSensorsController],
        providers: [CcpSensorsService],
        exports: [CcpSensorsService],
    })
], CcpSensorsModule);
export { CcpSensorsModule };
