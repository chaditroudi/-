var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Module } from "@nestjs/common";
import { Phase2Controller } from "./phase2.controller.js";
import { Phase2Service } from "./phase2.service.js";
let Phase2Module = class Phase2Module {
};
Phase2Module = __decorate([
    Module({
        controllers: [Phase2Controller],
        providers: [Phase2Service],
        exports: [Phase2Service],
    })
], Phase2Module);
export { Phase2Module };
