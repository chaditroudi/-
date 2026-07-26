import type { LotEventRecord, LotEventType } from "./lot-ledger.js";
import { badRequest } from "../../core/app-error.js";

/** W1 golden-thread stages for Deglet Nour premium whole. */
export type LotStage =
  | "SUPPLIER_INTAKE"
  | "WEIGHED"
  | "QC_DECIDED"
  | "COLD_STORE"
  | "FUMIGATION_CCP"
  | "TRIAGE"
  | "PACKED"
  | "SHIPPED"
  | "REJECTED";

export type GoldenRoute = "PREMIUM_WHOLE" | "GENERIC";

export const GOLDEN_THREAD_STAGES: LotStage[] = [
  "SUPPLIER_INTAKE",
  "WEIGHED",
  "QC_DECIDED",
  "COLD_STORE",
  "FUMIGATION_CCP",
  "TRIAGE",
  "PACKED",
  "SHIPPED",
];

export const STAGE_EVENT: Record<LotStage, LotEventType> = {
  SUPPLIER_INTAKE: "LOT_CREATED",
  WEIGHED: "LOT_WEIGHED",
  QC_DECIDED: "QC_DECIDED",
  COLD_STORE: "STOCK_MOVED",
  FUMIGATION_CCP: "CCP_COMPLETED",
  TRIAGE: "TRANSFORMED",
  PACKED: "PACKAGED",
  SHIPPED: "SHIPPED",
  REJECTED: "STATUS_CHANGED",
};

export const EVENT_TO_STAGE: Partial<Record<LotEventType, LotStage>> = {
  LOT_CREATED: "SUPPLIER_INTAKE",
  LOT_WEIGHED: "WEIGHED",
  QC_DECIDED: "QC_DECIDED",
  STOCK_MOVED: "COLD_STORE",
  STOCK_SYNCED: "COLD_STORE",
  CCP_COMPLETED: "FUMIGATION_CCP",
  CCP_SENSOR_ATTESTED: "FUMIGATION_CCP",
  COLD_CHAIN_ATTESTED: "COLD_STORE",
  TRANSFORMED: "TRIAGE",
  PACKAGED: "PACKED",
  SHIPPED: "SHIPPED",
};

const STAGE_INDEX = Object.fromEntries(GOLDEN_THREAD_STAGES.map((stage, index) => [stage, index])) as Record<
  LotStage,
  number
>;

export const stageFromChain = (events: LotEventRecord[]): LotStage | null => {
  if (!events.length) return null;

  let latest: LotStage | null = null;
  let latestIndex = -1;

  for (const event of events) {
    if (event.event_type === "STATUS_CHANGED" && event.payload?.rejected) {
      return "REJECTED";
    }
    const stage = EVENT_TO_STAGE[event.event_type as LotEventType];
    if (!stage || stage === "REJECTED") continue;
    const index = STAGE_INDEX[stage] ?? -1;
    if (index > latestIndex) {
      latestIndex = index;
      latest = stage;
    }
  }

  const rejected = events.some(
    (event) =>
      event.event_type === "STATUS_CHANGED" &&
      (event.payload?.decision === "REJETE" || event.payload?.rejected === true),
  );
  if (rejected && latestIndex < STAGE_INDEX.QC_DECIDED) return "REJECTED";

  return latest;
};

export const stagesAchieved = (events: LotEventRecord[]): Set<LotStage> => {
  const achieved = new Set<LotStage>();
  for (const event of events) {
    if (event.event_type === "STATUS_CHANGED" && (event.payload?.decision === "REJETE" || event.payload?.rejected)) {
      achieved.add("REJECTED");
      continue;
    }
    const stage = EVENT_TO_STAGE[event.event_type as LotEventType];
    if (stage) achieved.add(stage);
  }
  return achieved;
};

export const goldenThreadProgress = (events: LotEventRecord[]) => {
  const achieved = stagesAchieved(events);
  const completed = GOLDEN_THREAD_STAGES.filter((stage) => achieved.has(stage));
  const current = stageFromChain(events);
  const percent = Math.round((completed.length / GOLDEN_THREAD_STAGES.length) * 100);
  return {
    current,
    completed,
    missing: GOLDEN_THREAD_STAGES.filter((stage) => !achieved.has(stage)),
    percent,
    rejected: achieved.has("REJECTED"),
  };
};

/**
 * Soft gate: record a stage if prerequisites are met.
 * Returns "already" when the stage is already on the chain (idempotent).
 */
export const assertCanRecordStage = (
  events: LotEventRecord[],
  nextStage: LotStage,
  route: GoldenRoute = "PREMIUM_WHOLE",
): "ok" | "already" => {
  const achieved = stagesAchieved(events);

  if (achieved.has(nextStage)) return "already";
  if (achieved.has("REJECTED") && nextStage !== "REJECTED") {
    throw badRequest("LOT_REJECTED", "Rejected lots cannot advance on the golden thread.");
  }

  const require = (stage: LotStage, code: string, message: string) => {
    if (!achieved.has(stage)) throw badRequest(code, message, { required: stage, nextStage });
  };

  switch (nextStage) {
    case "SUPPLIER_INTAKE":
      return "ok";
    case "WEIGHED":
      require("SUPPLIER_INTAKE", "LOT_NOT_INTAKEN", "Weighing requires supplier intake first.");
      return "ok";
    case "QC_DECIDED":
      require("SUPPLIER_INTAKE", "LOT_NOT_INTAKEN", "QC decision requires supplier intake first.");
      return "ok";
    case "COLD_STORE":
      require("QC_DECIDED", "LOT_QC_REQUIRED", "Cold store placement requires a QC release decision.");
      return "ok";
    case "FUMIGATION_CCP":
      require("QC_DECIDED", "LOT_QC_REQUIRED", "Fumigation CCP requires a QC release decision.");
      return "ok";
    case "TRIAGE":
      if (route === "PREMIUM_WHOLE") {
        require("FUMIGATION_CCP", "LOT_CCP_REQUIRED", "Premium Deglet Nour triage requires fumigation CCP completion.");
      } else {
        require("QC_DECIDED", "LOT_QC_REQUIRED", "Triage requires a QC decision.");
      }
      return "ok";
    case "PACKED":
      require("TRIAGE", "LOT_TRIAGE_REQUIRED", "Packaging requires triage completion.");
      if (route === "PREMIUM_WHOLE") {
        require("FUMIGATION_CCP", "LOT_CCP_REQUIRED", "Premium packaging requires fumigation CCP.");
      }
      return "ok";
    case "SHIPPED":
      require("PACKED", "LOT_PACK_REQUIRED", "Shipment requires a sealed/packed palette.");
      return "ok";
    case "REJECTED":
      require("SUPPLIER_INTAKE", "LOT_NOT_INTAKEN", "Reject requires an existing intake lot.");
      return "ok";
    default:
      throw badRequest("LOT_UNKNOWN_STAGE", `Unknown lot stage: ${String(nextStage)}`);
  }
};

export const isGoldenThreadComplete = (events: LotEventRecord[]) => {
  const achieved = stagesAchieved(events);
  return GOLDEN_THREAD_STAGES.every((stage) => achieved.has(stage));
};
