import { Module } from "@nestjs/common";

import { GateRulesService } from "./gate-rules.service.js";
import { IdempotencyService } from "./idempotency.service.js";
import { LotLedgerService } from "./lot-ledger.service.js";
import { LotLifecycleService } from "./lot-lifecycle.service.js";
import { LotPassportService } from "./lot-passport.service.js";
import { LotRecallService } from "./lot-recall.service.js";
import { ScanService } from "./scan.service.js";
import { TrustController } from "./trust.controller.js";

@Module({
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
export class TrustModule {}
