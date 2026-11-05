import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from "@nestjs/common";

import { RECALL_ROLES, STAFF_READ_ROLES, STAGE_OVERRIDE_ROLES } from "../../middleware/authorization.js";
import { badRequest } from "../../core/app-error.js";
import { RequireAuthGuard } from "../../nest/route-guards.js";
import { Roles } from "../../nest/route-metadata.js";
import { SiteSettingsModel } from "../../models/site-settings.model.js";
import { LotLedgerService } from "./lot-ledger.service.js";
import { LotLifecycleService } from "./lot-lifecycle.service.js";
import { LotPassportService } from "./lot-passport.service.js";
import { LotRecallService } from "./lot-recall.service.js";
import { ScanService } from "./scan.service.js";
import { getTrustGateStatus } from "./trust-gate-status.js";
import {
  APPEND_ONLY_COLLECTIONS,
  CORE_SCHEMA_COLLECTIONS,
  REGULATED_COLLECTIONS,
} from "./regulated-collections.js";
import type { GoldenRoute, LotStage } from "./lot-state-machine.js";
import { GOLDEN_THREAD_STAGES } from "./lot-state-machine.js";

const QC_OUTCOME_STAGES = new Set(["QC_DECIDED", "REJECTED"]);

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
  @Roles(...STAFF_READ_ROLES)
  health() {
    return {
      data: {
        wave: "B0",
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

  /** B0 readiness — gate modes + GS1 placeholder flag. */
  @Get("gates")
  @Roles(...STAFF_READ_ROLES)
  async getGates() {
    let gs1: string | null = null;
    try {
      const doc = (await SiteSettingsModel.findOne({ id: "global" }).lean().exec()) as {
        documents?: { gs1_company_prefix?: string | null };
      } | null;
      gs1 = doc?.documents?.gs1_company_prefix ?? null;
    } catch {
      gs1 = null;
    }
    return { data: getTrustGateStatus(gs1) };
  }

  @Roles(...STAFF_READ_ROLES)
  @Get("lots/:lotId/passport")
  async getPassport(@Param("lotId") lotId: string) {
    const data = await this.passport.buildPassport(lotId);
    return { data };
  }

  @Post("recall")
  @Roles(...RECALL_ROLES)
  async runRecall(
    @Body() body: { lotId?: string; lotNumber?: string; sscc?: string },
  ) {
    const data = await this.recall.runDrill(body || {});
    return { data };
  }

  @Post("scan/resolve")
  @Roles(...STAFF_READ_ROLES)
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
  @Roles(...STAFF_READ_ROLES)
  async getChain(@Param("lotId") lotId: string) {
    const events = await this.ledger.getChain(lotId);
    return { data: { lotId, events } };
  }

  @Get("lots/:lotId/verify")
  @Roles(...STAFF_READ_ROLES)
  async verify(@Param("lotId") lotId: string) {
    const result = await this.ledger.verify(lotId);
    return { data: result };
  }

  @Get("lots/:lotId/state")
  @Roles(...STAFF_READ_ROLES)
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
  @Roles(...STAGE_OVERRIDE_ROLES)
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

    // A QC outcome needs an inspection behind it, so only /qc/submit records one.
    if (QC_OUTCOME_STAGES.has(String(toStage).toUpperCase())) {
      throw badRequest("STAGE_DOMAIN_ONLY", "Une décision qualité s'enregistre par le contrôle qualité.");
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
  @Roles(...STAFF_READ_ROLES)
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
