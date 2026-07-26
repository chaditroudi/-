import { Injectable } from "@nestjs/common";

import { badRequest, notFound } from "../../core/app-error.js";
import { getCollectionModel, sanitizeDocument } from "../../db/dynamic-model.js";
import {
  DIRECTION_ROLES,
  QUALITY_ROLES,
  STOCK_ROLES,
} from "../../middleware/authorization.js";
import { emitNotification, type NotificationSeverity } from "../notifications/notification-emitter.js";
import { LotLedgerService, lotLedgerService } from "./lot-ledger.service.js";
import {
  assertCanRecordStage,
  GOLDEN_THREAD_STAGES,
  goldenThreadProgress,
  isGoldenThreadComplete,
  STAGE_EVENT,
  stageFromChain,
  stagesAchieved,
  type GoldenRoute,
  type LotStage,
} from "./lot-state-machine.js";

/** Process-local counter of dual-run ledger stage misses. Resettable for tests. */
let swallowedStageFailures = 0;

export const getSwallowedStageFailureCount = () => swallowedStageFailures;

export const resetSwallowedStageFailureCount = () => {
  swallowedStageFailures = 0;
};

const LEDGER_FAILURE_ROLES = Array.from(
  new Set([...QUALITY_ROLES, ...STOCK_ROLES, ...DIRECTION_ROLES, "administrateur_systeme"]),
);

const readErrorCode = (error: unknown): string => {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === "string" && code.trim() ? code.trim() : "LOT_STAGE_FAILED";
};

const readErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message) return error.message;
  return String(error || "Unknown ledger stage failure");
};

/**
 * Golden-thread stage → notification routing.
 * `space` targets the owning actors (see SPACE_ROLES in authorization.ts);
 * the transition emits a single realtime notification per real state change.
 */
const STAGE_NOTIFICATION: Record<LotStage, { space: string; severity: NotificationSeverity; label: string }> = {
  SUPPLIER_INTAKE: { space: "receptions", severity: "info", label: "Lot réceptionné" },
  WEIGHED: { space: "receptions", severity: "info", label: "Lot pesé" },
  QC_DECIDED: { space: "quality", severity: "warning", label: "Décision qualité enregistrée" },
  COLD_STORE: { space: "stock", severity: "info", label: "Lot placé en stockage" },
  FUMIGATION_CCP: { space: "production", severity: "warning", label: "CCP fumigation complété" },
  TRIAGE: { space: "production", severity: "info", label: "Triage effectué" },
  PACKED: { space: "packaging", severity: "success", label: "Lot conditionné" },
  SHIPPED: { space: "logistics", severity: "success", label: "Lot expédié" },
  REJECTED: { space: "quality", severity: "error", label: "Lot rejeté" },
};

@Injectable()
export class LotLifecycleService {
  constructor(private readonly ledger: LotLedgerService = lotLedgerService) {}

  private async notifyStage(input: {
    lotId: string;
    stage: LotStage;
    actorId?: string | null;
    lotInternal?: unknown;
    payload?: Record<string, unknown>;
  }) {
    const meta = STAGE_NOTIFICATION[input.stage];
    if (!meta) return;
    const lotLabel = String(input.lotInternal || input.lotId);
    await emitNotification({
      notificationType: `LOT_${input.stage}`,
      category: "traceability",
      space: meta.space,
      severity: meta.severity,
      title: meta.label,
      message: `${meta.label} — lot ${lotLabel}`,
      entityType: "reception_lots",
      entityId: input.lotId,
      actionUrl: `/scan?lot=${encodeURIComponent(lotLabel)}`,
      metadata: {
        lot_id: input.lotId,
        lot_internal: input.lotInternal ?? null,
        stage: input.stage,
        ...(input.payload || {}),
      },
      actorId: input.actorId ?? null,
    });
  }

  async resolveReceptionLotId(ref: {
    lotId?: string | null;
    lotNumber?: string | null;
    receptionId?: string | null;
    sscc?: string | null;
  }): Promise<string | null> {
    if (ref.lotId) {
      const byId = sanitizeDocument(
        await getCollectionModel("reception_lots").findOne({ id: ref.lotId }).lean().exec(),
      );
      if (byId?.id) return String(byId.id);

      const byInternal = sanitizeDocument(
        await getCollectionModel("reception_lots")
          .findOne({ $or: [{ lot_internal: ref.lotId }, { qr_code_payload: ref.lotId }] })
          .lean()
          .exec(),
      );
      if (byInternal?.id) return String(byInternal.id);
    }

    if (ref.sscc) {
      const unit = sanitizeDocument(
        await getCollectionModel("reception_units").findOne({ sscc: ref.sscc }).lean().exec(),
      );
      if (unit?.reception_lot_id) return String(unit.reception_lot_id);

      const palette = sanitizeDocument(
        await getCollectionModel("packaging_palettes").findOne({ sscc: ref.sscc }).lean().exec(),
      );
      if (palette) {
        const order = sanitizeDocument(
          await getCollectionModel("packaging_orders").findOne({ id: palette.order_id }).lean().exec(),
        );
        const fromOrder = await this.resolveReceptionLotId({
          lotNumber: order?.source_lot_number ? String(order.source_lot_number) : null,
        });
        if (fromOrder) return fromOrder;
      }
    }

    if (ref.lotNumber) {
      const byCode = sanitizeDocument(
        await getCollectionModel("reception_lots")
          .findOne({
            $or: [{ lot_internal: ref.lotNumber }, { qr_code_payload: ref.lotNumber }],
            ...(ref.receptionId ? { reception_id: ref.receptionId } : {}),
          })
          .lean()
          .exec(),
      );
      if (byCode?.id) return String(byCode.id);
    }

    return null;
  }

  async getState(lotId: string, route: GoldenRoute = "PREMIUM_WHOLE") {
    const verified = await this.ledger.verify(lotId);
    const progress = goldenThreadProgress(verified.events);
    return {
      ...verified,
      route,
      stage: stageFromChain(verified.events),
      progress,
      goldenThreadComplete: isGoldenThreadComplete(verified.events),
      stages: GOLDEN_THREAD_STAGES,
    };
  }

  /**
   * Record a golden-thread stage on the hash-chained ledger.
   * Idempotent: if the stage is already present, returns the existing tip without error.
   * Bootstraps SUPPLIER_INTAKE when the reception lot exists but has no chain yet (dual-run).
   */
  async recordStage(input: {
    lotId: string;
    toStage: LotStage;
    collection: string;
    actorId?: string | null;
    payload?: Record<string, unknown>;
    relatedIds?: string[];
    route?: GoldenRoute;
  }) {
    if (!input.lotId) {
      throw badRequest("LOT_ID_REQUIRED", "lotId is required to record a golden-thread stage.");
    }

    const route = input.route || "PREMIUM_WHOLE";
    let chain = await this.ledger.getChain(input.lotId);

    if (chain.length === 0 && input.toStage !== "SUPPLIER_INTAKE") {
      const lot = sanitizeDocument(
        await getCollectionModel("reception_lots").findOne({ id: input.lotId }).lean().exec(),
      );
      if (lot?.id) {
        await this.ledger.append({
          lotId: input.lotId,
          eventType: STAGE_EVENT.SUPPLIER_INTAKE,
          collection: "reception_lots",
          action: "GATE",
          actorId: input.actorId,
          payload: {
            stage: "SUPPLIER_INTAKE",
            route,
            bootstrapped: true,
            lot_internal: lot.lot_internal ?? null,
          },
          relatedIds: lot.reception_id ? [String(lot.reception_id)] : [],
        });
        chain = await this.ledger.getChain(input.lotId);
        await this.notifyStage({
          lotId: input.lotId,
          stage: "SUPPLIER_INTAKE",
          actorId: input.actorId,
          lotInternal: lot.lot_internal,
        });
      }
    }

    const decision = assertCanRecordStage(chain, input.toStage, route);

    if (decision === "already") {
      return {
        skipped: true as const,
        stage: input.toStage,
        event: chain[chain.length - 1] || null,
        state: await this.getState(input.lotId, route),
      };
    }

    // Soft-fill optional WEIGHED when jumping QC on lots weighed only at intake.
    if (
      input.toStage === "QC_DECIDED" &&
      !stagesAchieved(chain).has("WEIGHED") &&
      stagesAchieved(chain).has("SUPPLIER_INTAKE")
    ) {
      // weighing optional — do not auto-fill; QC only requires intake
    }

    const event = await this.ledger.append({
      lotId: input.lotId,
      eventType: STAGE_EVENT[input.toStage],
      collection: input.collection,
      action: "GATE",
      actorId: input.actorId,
      payload: {
        stage: input.toStage,
        route,
        ...(input.payload || {}),
      },
      relatedIds: input.relatedIds,
    });

    await this.notifyStage({
      lotId: input.lotId,
      stage: input.toStage,
      actorId: input.actorId,
      lotInternal: (input.payload as Record<string, unknown> | undefined)?.lot_internal,
      payload: input.payload,
    });

    return {
      skipped: false as const,
      stage: input.toStage,
      event,
      state: await this.getState(input.lotId, route),
    };
  }

  async recordStageSafe(input: Parameters<LotLifecycleService["recordStage"]>[0]) {
    try {
      return await this.recordStage(input);
    } catch (error) {
      // Never block shop-floor writes on ledger/FSM failures during dual-run —
      // log, surface a warn notification, and continue. Hard gates still live
      // in gate-rules for production/shipment; flip TRUST_*_GATE=enforce only
      // after these warnings go quiet for a shift.
      swallowedStageFailures += 1;
      const code = readErrorCode(error);
      const message = readErrorMessage(error);
      console.error("[W1] lot lifecycle recordStage failed:", {
        lotId: input.lotId,
        stage: input.toStage,
        collection: input.collection,
        code,
        message,
        failures: swallowedStageFailures,
        error,
      });
      await emitNotification({
        notificationType: "LOT_LEDGER_STAGE_FAILED",
        category: "traceability",
        space: "alerts",
        severity: "warning",
        title: `Étape ledger manquante — ${input.toStage}`,
        message: `Lot ${input.lotId}: ${message}`,
        entityType: "reception_lots",
        entityId: input.lotId,
        actionUrl: `/scan?lot=${encodeURIComponent(input.lotId)}`,
        targetRoles: LEDGER_FAILURE_ROLES,
        actorId: input.actorId,
        metadata: {
          stage: input.toStage,
          collection: input.collection,
          code,
          dual_run: true,
          swallowed_count: swallowedStageFailures,
        },
      });

      // Leave an auditable GATE_BLOCKED tip so passport/recall show the attempt.
      try {
        await this.ledger.append({
          lotId: input.lotId,
          eventType: "GATE_BLOCKED",
          collection: input.collection,
          action: "GATE",
          actorId: input.actorId,
          payload: {
            attempted_stage: input.toStage,
            code,
            message,
            dual_run: true,
          },
          relatedIds: input.relatedIds,
        });
      } catch (appendError) {
        console.error("[W1] GATE_BLOCKED append failed:", appendError);
      }

      return { skipped: true as const, stage: input.toStage, event: null, error };
    }
  }

  async listGoldenThreadLots(limit = 50) {
    const tipEvents = sanitizeDocument(
      await getCollectionModel("lot_events")
        .find({ "payload.route": "PREMIUM_WHOLE" })
        .sort({ at: -1 })
        .limit(500)
        .lean()
        .exec(),
    ) as Array<{ lot_id?: string }>;

    const lotIds = Array.from(new Set(tipEvents.map((row) => String(row.lot_id || "")).filter(Boolean))).slice(
      0,
      limit,
    );

    const states = [];
    for (const lotId of lotIds) {
      states.push(await this.getState(lotId));
    }
    return states;
  }

  async requireLot(lotId: string) {
    const lot = sanitizeDocument(
      await getCollectionModel("reception_lots").findOne({ id: lotId }).lean().exec(),
    );
    if (!lot) throw notFound("RECEPTION_LOT_NOT_FOUND", `Reception lot ${lotId} not found.`);
    return lot;
  }
}

export const lotLifecycleService = new LotLifecycleService(lotLedgerService);
