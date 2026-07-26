var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Module } from "@nestjs/common";
import { GateRulesService } from "./gate-rules.service.js";
import { IdempotencyService } from "./idempotency.service.js";
import { LotLedgerService } from "./lot-ledger.service.js";
import { LotLifecycleService } from "./lot-lifecycle.service.js";
import { LotPassportService } from "./lot-passport.service.js";
import { LotRecallService } from "./lot-recall.service.js";
import { ScanService } from "./scan.service.js";
import { TrustController } from "./trust.controller.js";
let TrustModule = class TrustModule {
};
TrustModule = __decorate([
    Module({
        controllers: [TrustController],
        providers: [
            LotLedgerService,
            IdempotencyService,
            GateRulesService,
            LotLifecycleService,
            LotPassportService,
            LotRecallService,
            ScanService,
        ],
        exports: [
            LotLedgerService,
            IdempotencyService,
            GateRulesService,
            LotLifecycleService,
            LotPassportService,
            LotRecallService,
            ScanService,
        ],
    })
], TrustModule);
export { TrustModule };
