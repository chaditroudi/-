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

/**
 * Built-in manufacturing routes.
 * PREMIUM_WHOLE is the default Deglet Nour path and still requires fumigation
 * before triage and packaging. GENERIC is an explicit opt-in for a product
 * whose site control plan does not treat fumigation as a prerequisite.
 * It is never inferred from variety.
 */
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

export const MANUFACTURING_ROUTE_LABEL: Record<GoldenRoute, string> = {
  PREMIUM_WHOLE: "Deglet Nour premium whole",
  GENERIC: "Explicit route without fumigation prerequisite",
};

export const parseManufacturingRoute = (value: unknown): GoldenRoute | null => {
  const raw = String(value ?? "").trim().toUpperCase();
  if (raw === "PREMIUM_WHOLE" || raw === "GENERIC") return raw;
  return null;
};

/** Missing route stays on the premium path. An unknown value is rejected. */
export const requireManufacturingRoute = (
  value: unknown,
  fallback: GoldenRoute = "PREMIUM_WHOLE",
): GoldenRoute => {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = parseManufacturingRoute(value);
  if (!parsed) {
    throw badRequest(
      "MANUFACTURING_ROUTE_INVALID",
      "manufacturing_route must be PREMIUM_WHOLE or GENERIC.",
      { value },
    );
  }
  return parsed;
};

export const routeFromChain = (events: LotEventRecord[]): GoldenRoute | null => {
  for (const event of events) {
    const parsed = parseManufacturingRoute(event.payload?.route);
    if (parsed) return parsed;
  }
  return null;
};

/**
 * The route stamped on the first ledger event wins.
 * A later caller cannot downgrade PREMIUM_WHOLE to GENERIC.
 */
export const resolveStickyRoute = (events: LotEventRecord[], requested?: unknown): GoldenRoute =>
  routeFromChain(events) || parseManufacturingRoute(requested) || "PREMIUM_WHOLE";

export const routeRequiresFumigationCcp = (route: GoldenRoute) => route === "PREMIUM_WHOLE";

export const stagesForRoute = (route: GoldenRoute): LotStage[] =>
  routeRequiresFumigationCcp(route)
    ? GOLDEN_THREAD_STAGES
    : GOLDEN_THREAD_STAGES.filter((stage) => stage !== "FUMIGATION_CCP");

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
  // STOCK_SYNCED is a warehouse projection sync — it must NOT advance COLD_STORE.
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

export const goldenThreadProgress = (events: LotEventRecord[], requested?: GoldenRoute) => {
  const route = resolveStickyRoute(events, requested);
  const required = stagesForRoute(route);
  const achieved = stagesAchieved(events);
  const completed = required.filter((stage) => achieved.has(stage));
  const current = stageFromChain(events);
  const percent = required.length === 0 ? 0 : Math.round((completed.length / required.length) * 100);
  return {
    route,
    current,
    completed,
    missing: required.filter((stage) => !achieved.has(stage)),
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
      if (routeRequiresFumigationCcp(route)) {
        require("FUMIGATION_CCP", "LOT_CCP_REQUIRED", "Premium Deglet Nour triage requires fumigation CCP completion.");
      } else {
        require("QC_DECIDED", "LOT_QC_REQUIRED", "Triage requires a QC decision.");
      }
      return "ok";
    case "PACKED":
      require("TRIAGE", "LOT_TRIAGE_REQUIRED", "Packaging requires triage completion.");
      if (routeRequiresFumigationCcp(route)) {
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

export const isGoldenThreadComplete = (events: LotEventRecord[], requested?: GoldenRoute) => {
  const required = stagesForRoute(resolveStickyRoute(events, requested));
  const achieved = stagesAchieved(events);
  return required.every((stage) => achieved.has(stage));
};
