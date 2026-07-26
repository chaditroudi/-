import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from "@nestjs/common";

import { RequireAuthGuard } from "../../nest/route-guards.js";
import { Public } from "../../nest/route-metadata.js";
import { LotLedgerService } from "./lot-ledger.service.js";
import { LotLifecycleService } from "./lot-lifecycle.service.js";
import { LotPassportService } from "./lot-passport.service.js";
import { LotRecallService } from "./lot-recall.service.js";
import { ScanService } from "./scan.service.js";
import {
  APPEND_ONLY_COLLECTIONS,
  CORE_SCHEMA_COLLECTIONS,
  REGULATED_COLLECTIONS,
} from "./regulated-collections.js";
import type { GoldenRoute, LotStage } from "./lot-state-machine.js";
import { GOLDEN_THREAD_STAGES } from "./lot-state-machine.js";

@Controller("api/trust")
@UseGuards(RequireAuthGuard)
export class TrustController {
  constructor(
    private readonly ledger: LotLedgerService,
    private readonly lifecycle: LotLifecycleService,
    private readonly passport: LotPassportService,
    private readonly recall: LotRecallService,
    private readonly scans: ScanService,
  ) {}

  @Get("health")
  health() {
    return {
      data: {
        wave: "W2",
        trust: "enabled",
        goldenThread: "PREMIUM_WHOLE",
        passport: "enabled",
        recallDrill: "enabled",
        stages: GOLDEN_THREAD_STAGES,
        coreSchemaCollections: CORE_SCHEMA_COLLECTIONS,
        regulatedCount: REGULATED_COLLECTIONS.size,
        appendOnlyCount: APPEND_ONLY_COLLECTIONS.size,
      },
    };
  }

  @Public()
  @Get("lots/:lotId/passport")
  async getPassport(@Param("lotId") lotId: string) {
    const data = await this.passport.buildPassport(lotId);
    return { data };
  }

  @Post("recall")
  async runRecall(
    @Body() body: { lotId?: string; lotNumber?: string; sscc?: string },
  ) {
    const data = await this.recall.runDrill(body || {});
    return { data };
  }

  @Post("scan/resolve")
  async resolveScan(
    @Body() body: { rawValue?: string; scannerKind?: string; deviceId?: string | null },
    @Req() req: any,
  ) {
    const data = await this.scans.resolve({
      ...body,
      actorId: String(req.auth?.user?.id || ""),
    });
    return { data };
  }

  @Get("lots/:lotId/chain")
  async getChain(@Param("lotId") lotId: string) {
    const events = await this.ledger.getChain(lotId);
    return { data: { lotId, events } };
  }

  @Get("lots/:lotId/verify")
  async verify(@Param("lotId") lotId: string) {
    const result = await this.ledger.verify(lotId);
    return { data: result };
  }

  @Get("lots/:lotId/state")
  async getState(
    @Param("lotId") lotId: string,
    @Query("route") route?: string,
  ) {
    const data = await this.lifecycle.getState(
      lotId,
      route === "GENERIC" ? "GENERIC" : "PREMIUM_WHOLE",
    );
    return { data };
  }

  @Post("lots/:lotId/advance")
  async advance(
    @Param("lotId") lotId: string,
    @Body() body: { toStage?: LotStage; payload?: Record<string, unknown>; relatedIds?: string[]; route?: GoldenRoute; collection?: string },
    @Req() req: any,
  ) {
    const toStage = body?.toStage;
    if (!toStage) {
      return {
        error: { code: "STAGE_REQUIRED", message: "toStage is required." },
      };
    }

    const data = await this.lifecycle.recordStage({
      lotId,
      toStage,
      collection: body.collection || "trust_advance",
      actorId: req.auth?.user?.id || null,
      payload: body.payload,
      relatedIds: body.relatedIds,
      route: body.route || "PREMIUM_WHOLE",
    });
    return { data };
  }

  @Get("golden-thread")
  async goldenThread(@Query("limit") limit?: string) {
    const states = await this.lifecycle.listGoldenThreadLots(Number(limit) || 40);
    const complete = states.filter((row) => row.goldenThreadComplete).length;
    const broken = states.filter((row) => !row.valid).length;
    return {
      data: {
        route: "PREMIUM_WHOLE",
        stages: GOLDEN_THREAD_STAGES,
        totalTracked: states.length,
        complete,
        broken,
        inProgress: states.length - complete,
        lots: states,
      },
    };
  }
}
