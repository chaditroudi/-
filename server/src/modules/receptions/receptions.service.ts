import mongoose from "mongoose";

import { Injectable } from "@nestjs/common";
import { badRequest, conflict, notFound } from "../../core/app-error.js";
import { getCollectionModel, sanitizeDocument } from "../../db/dynamic-model.js";
import { prepareInsertDocument } from "../../db/defaults.js";
import {
  applyPurchaseOrderQcDecision,
  assertReceiptWithinTolerance,
  registerReceptionAgainstPurchaseOrder,
  resolvePurchaseOrderReceiptTarget,
  reversePurchaseOrderReception,
} from "../purchasing/purchase-order-domain.js";
import { syncReceptionLotsToStock, loadReceptionLots } from "./reception-stock-sync.js";
import { lotLifecycleService } from "../trust/lot-lifecycle.service.js";
import {
  MANUFACTURING_ROUTE_LABEL,
  requireManufacturingRoute,
} from "../trust/lot-state-machine.js";
import { lotLedgerService } from "../trust/lot-ledger.service.js";
import { emitNotification } from "../notifications/notification-emitter.js";
import { scanService } from "../trust/scan.service.js";
import { snapshotPurchaseCost } from "../costing/cost-allocation.js";
import { assertSignaturePin } from "../auth/numeric-signature.js";

// ── Supplier business-rule helpers ────────────────────────────────────────────

const Suppliers = () => getCollectionModel("suppliers");

const gradeQualityScore = (grade: string | null | undefined): number => {
  if (grade === "EXTRA") return 100;
  if (grade === "CATEGORIE_I") return 80;
  if (grade === "CATEGORIE_II") return 60;
  return 0; // REJETE or unknown
};

/**
 * After each QC decision, recompute the supplier's live metrics from
 * the full reception history then enforce RG-F03, RG-F04, RG-F05.
 */
const recalculateSupplierMetrics = async (supplierId: string, actorId: string | null) => {
  const supplier = sanitizeDocument(
    await Suppliers().findOne({ $or: [{ id: supplierId }, { code: supplierId }] }).lean().exec(),
  );
  if (!supplier) return;

  // Pull every closed reception for this supplier
  const allReceptions = sanitizeDocument(
    await getCollectionModel("receptions_v2")
      .find({ supplier_id: supplierId, status: { $in: ["LIBERE", "REJETE", "BLOQUE"] } })
      .lean()
      .exec(),
  ) as Array<Record<string, unknown>>;

  const total = allReceptions.length;
  const rejected = allReceptions.filter((r) => r.status === "REJETE").length;
  const rejectionRate = total > 0 ? Math.round((rejected / total) * 100 * 10) / 10 : 0;

  // Quality score = average of per-lot grade scores (last 12 months)
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1);
  const recentReceptions = allReceptions.filter(
    (r) => r.qc_grade && new Date(String(r.created_at)).getTime() > twelveMonthsAgo.getTime(),
  );
  const qualityScore =
    recentReceptions.length > 0
      ? Math.round(
          recentReceptions.reduce((sum, r) => sum + gradeQualityScore(r.qc_grade as string), 0) /
            recentReceptions.length,
        )
      : Number(supplier.quality_score ?? 0);

  const totalTons = allReceptions.reduce((sum, r) => sum + Number(r.quantity_total ?? 0), 0) / 1000;
  const deliveredLotsCount = total;
  const now = new Date().toISOString();

  // ── RG-F03: auto-block when rejection_rate > 20% ─────────────────────────
  const shouldAutoBlock = rejectionRate > 20;
  const newStatus = shouldAutoBlock ? "blocked" : String(supplier.supplier_status ?? "active");
  const newIsActive = !shouldAutoBlock && supplier.supplier_status === "active";

  await Suppliers().updateOne(
    { $or: [{ id: supplierId }, { code: supplierId }] },
    {
      $set: {
        quality_score: qualityScore,
        rejection_rate: rejectionRate,
        delivered_lots_count: deliveredLotsCount,
        total_delivered_tons: Math.round(totalTons * 100) / 100,
        last_delivery_date: now.slice(0, 10),
        supplier_status: newStatus,
        is_active: newIsActive,
        updated_at: now,
      },
    },
  ).exec();

  const notifs: Array<Record<string, unknown>> = [];

  if (shouldAutoBlock) {
    // RG-F03 notification
    notifs.push({
      notification_type: "SUPPLIER_AUTO_BLOCKED",
      category: "supplier",
      title: `Fournisseur bloqué automatiquement — ${supplier.name}`,
      message: `RG-F03 : taux de rejet ${rejectionRate}% > 20% sur les 6 derniers mois. Fournisseur ${supplier.code} passé en statut Bloqué.`,
      severity: "critical",
      entity_type: "suppliers",
      entity_id: String(supplier.id || supplier._id),
      metadata: { supplier_code: supplier.code, rejection_rate: rejectionRate },
    });
  }

  // ── RG-F04: score alert when quality_score < 60 ───────────────────────────
  if (qualityScore < 60 && Number(supplier.quality_score ?? 100) >= 60) {
    notifs.push({
      notification_type: "SUPPLIER_SCORE_ALERT",
      category: "supplier",
      title: `Alerte score fournisseur — ${supplier.name}`,
      message: `RG-F04 : score qualité ${qualityScore}/100 < 60. Un plan d'amélioration est recommandé pour ${supplier.code}.`,
      severity: "warning",
      entity_type: "suppliers",
      entity_id: String(supplier.id || supplier._id),
      metadata: { supplier_code: supplier.code, quality_score: qualityScore },
    });
  }

  if (notifs.length > 0) {
    await Promise.all(
      notifs.map((n) =>
        emitNotification({
          notificationType: String(n.notification_type),
          category: String(n.category || "supplier"),
          space: "suppliers",
          title: String(n.title),
          message: String(n.message),
          severity: String(n.severity || "warning"),
          entityType: (n.entity_type as string) ?? null,
          entityId: (n.entity_id as string) ?? null,
          metadata: (n.metadata as Record<string, unknown>) ?? null,
        }),
      ),
    );
  }

  console.log(`[RG] Supplier ${supplier.code} metrics updated — score=${qualityScore}, rejection=${rejectionRate}%, status=${newStatus}`);
};

/**
 * RG-F05: scan all suppliers for contracts expiring within 30 days and
 * create a notification if one hasn't been sent this month.
 * Called from /api/suppliers/check-expirations (cron or manual).
 */
export const checkSupplierContractExpirations = async () => {
  const today = new Date();
  const in30Days = new Date(today);
  in30Days.setDate(in30Days.getDate() + 30);
  const todayStr = today.toISOString().slice(0, 10);
  const in30DaysStr = in30Days.toISOString().slice(0, 10);

  const expiring = sanitizeDocument(
    await Suppliers()
      .find({
        contract_expiry_alert_at: { $gte: todayStr, $lte: in30DaysStr },
        supplier_status: "active",
      })
      .lean()
      .exec(),
  ) as Array<Record<string, unknown>>;

  const Notifications = getCollectionModel("system_notifications");
  let sent = 0;

  for (const supplier of expiring) {
    const existing = await Notifications.findOne({
      notification_type: "SUPPLIER_CONTRACT_EXPIRY",
      entity_id: String(supplier.id || supplier._id),
      created_at: { $gte: new Date(today.getFullYear(), today.getMonth(), 1).toISOString() },
    }).lean().exec();
    if (existing) continue;

    await emitNotification({
      notificationType: "SUPPLIER_CONTRACT_EXPIRY",
      category: "supplier",
      space: "suppliers",
      title: `Contrat expirant bientôt — ${supplier.name}`,
      message: `RG-F05 : le contrat du fournisseur ${supplier.code} expire le ${supplier.contract_end_date}. Renouvellement requis.`,
      severity: "warning",
      entityType: "suppliers",
      entityId: String(supplier.id || supplier._id),
      metadata: { supplier_code: supplier.code, contract_end_date: supplier.contract_end_date },
    });
    sent++;
  }

  return { checked: expiring.length, notificationsSent: sent };
};

const Receptions = () => getCollectionModel("receptions_v2");
const ReceptionLots = () => getCollectionModel("reception_lots");
const ReceptionUnits = () => getCollectionModel("reception_units");
const ReceptionAlerts = () => getCollectionModel("reception_alerts");
const Notifications = () => getCollectionModel("system_notifications");
const QCInspections = () => getCollectionModel("qc_inspections");
const QCCheckResults = () => getCollectionModel("qc_check_results");
const QCChecklists = () => getCollectionModel("qc_checklists");
const QCChecklistItems = () => getCollectionModel("qc_checklist_items");
const ReceptionStockMovements = () => getCollectionModel("reception_stock_movements");
const ReceptionAuditLogs = () => getCollectionModel("reception_audit_logs_v2");
const StockLots = () => getCollectionModel("stock_lots");
const StockMovements = () => getCollectionModel("stock_movements");
const WeighingRecords = () => getCollectionModel("weighing_records");
const EpcisEvents = () => getCollectionModel("epcis_events");

// ── EPCIS helper ──────────────────────────────────────────────────────────────
const writeEpcisObjectEvent = async (params: {
  bizStep: string;
  disposition: string;
  epcList: string[];
  readPoint?: string | null;
  bizLocation?: string | null;
  actorId?: string | null;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
}) => {
  const evt = await prepareInsertDocument("epcis_events", {
    event_type: "ObjectEvent",
    event_time: new Date().toISOString(),
    event_time_zone_offset: "+01:00",
    biz_step: params.bizStep,
    disposition: params.disposition,
    epc_list: params.epcList,
    read_point: params.readPoint || null,
    biz_location: params.bizLocation || null,
    actor_id: params.actorId || null,
    entity_type: params.entityType,
    entity_id: params.entityId,
    metadata: params.metadata || {},
  });
  await EpcisEvents().create([evt]);
  return evt;
};

// ── GS1 payload builder ───────────────────────────────────────────────────────
const buildGs1Payload = (lot: Record<string, unknown>) => {
  const lotCode = String(lot.lot_internal || lot.qr_code_payload || lot.id || "");
  const netWeightKg = Number(lot.net_weight_kg ?? 0);
  const weightIn3103 = String(Math.round(netWeightKg * 1000)).padStart(6, "0");
  // AI (01) GTIN-14 — plant-level placeholder (no real GS1 company prefix)
  const rawGtin = lotCode.replace(/[^0-9]/g, "").padEnd(13, "0").slice(0, 13);
  const checkDigit = (10 - ([3, 1, 3, 1, 3, 1, 3, 1, 3, 1, 3, 1, 3]
    .reduce((sum, w, i) => sum + w * Number(rawGtin[i] ?? 0), 0) % 10)) % 10;
  const gtin14 = rawGtin + String(checkDigit);
  // AI (10) lot/batch number
  // AI (3103) net weight in kg, 3 implied decimal places
  // AI (11) production date YYMMDD
  const prodDate = String(lot.production_date || lot.created_at || "").slice(2, 10).replace(/-/g, "");
  const gs1_128 = `(01)${gtin14}(10)${lotCode}(3103)${weightIn3103}${prodDate ? `(11)${prodDate}` : ""}`;
  // GS1 DataMatrix uses FNC1 character (0x1D as GS)
  const GS = "\x1D";
  const datamatrix = `]d201${gtin14}${GS}10${lotCode}${GS}3103${weightIn3103}`;
  return { gtin14, lot_code: lotCode, net_weight_g: Math.round(netWeightKg * 1000), gs1_128, datamatrix, ai_payload: gs1_128 };
};

type ActorContext = { id?: string | null } | null | undefined;
type ReceptionLotInput = Record<string, unknown> & {
  quantity?: unknown;
  unit?: string;
  origin_country?: string;
  variety?: string;
  maturity_stage?: string;
  article_ref?: string;
  qr_code_payload?: string;
};
type ReceptionIntakePayload = Record<string, unknown> & {
  client_request_id?: string;
  supplier_id?: string;
  purchase_order_id?: string | null;
  purchase_order_line_id?: string | null;
  spontaneous_delivery?: boolean | null;
  material_id?: string | null;
  lots?: ReceptionLotInput[];
  quantity_total?: unknown;
  declared_weight_kg?: unknown;
  declaredWeightKg?: unknown;
  gross_weight_kg?: unknown;
  tare_weight_kg?: unknown;
  gross_reading_id?: string | null;
  tare_reading_id?: string | null;
  unit?: string;
  origin_country?: string;
  variety?: string;
  maturity_stage?: string;
  created_by?: string | null;
  actual_arrival_date?: string;
  unit_count?: unknown;
  unit_type?: string;
  phase1_alerts?: unknown[];
};
type QcResultInput = Record<string, unknown> & {
  checklist_item_id?: string | null;
  check_code?: string;
  check_name?: string;
  category?: string | null;
  severity?: string;
  result?: string;
  note?: string | null;
  measured_value?: string | null;
  expected_value?: string | null;
};
type QcDecisionPayload = Record<string, unknown> & {
  inspection_id?: string;
  inspectionId?: string;
  decision?: string;
  qualitySummary?: Record<string, unknown>;
  checkResults?: QcResultInput[];
};
type ReceptionUnitInput = Record<string, unknown> & {
  reception_lot_id?: string;
  receptionLotId?: string;
  unit_type?: string;
  unitType?: string;
  quantity?: unknown;
  unit?: string;
  gross_weight?: unknown;
  grossWeight?: unknown;
  net_weight?: unknown;
  netWeight?: unknown;
};
type ReceptionStorageMovePayload = Record<string, unknown> & {
  lotId?: string;
  targetZone?: string;
  position?: string | null;
  notes?: string | null;
  performedBy?: string;
  scanProof?: { lotToken?: string | null };
};
type ReceptionAlertStatusPayload = {
  status: "ACKNOWLEDGED" | "RESOLVED";
  actorName: string;
};

const ADMIN_ACTOR_ROLES = new Set([
  "admin",
  "administrateur_systeme",
  "directeur_general",
  "directeur_usine",
]);

const readString = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
};

const uniqueStrings = (values: Array<unknown>) =>
  Array.from(new Set(values.map((value) => String(value || "").trim()).filter(Boolean)));

const getActorRoles = (actor: ActorContext) => {
  const actorRecord = (actor || {}) as Record<string, unknown>;
  const metadataValue = actorRecord.user_metadata;
  const metadata =
    metadataValue && typeof metadataValue === "object"
      ? (metadataValue as Record<string, unknown>)
      : undefined;
  const rawRoles = [
    ...(Array.isArray(metadata?.roles) ? metadata.roles : []),
    ...(Array.isArray(metadata?.domains) ? metadata.domains : []),
    metadata?.role,
  ];

  return rawRoles
    .map((role) => String(role || "").trim().toLowerCase())
    .filter(Boolean);
};

const isAdminActor = (actor: ActorContext) => getActorRoles(actor).some((role) => ADMIN_ACTOR_ROLES.has(role));

const receptionIdentityFilter = (receptionId: string) => {
  const filters: Record<string, unknown>[] = [{ id: receptionId }];

  if (mongoose.Types.ObjectId.isValid(receptionId)) {
    filters.push({ _id: new mongoose.Types.ObjectId(receptionId) });
  }

  return { $or: filters };
};

const ensureSupplierExists = async (supplierId: string) => {
  const Suppliers = getCollectionModel("suppliers");
  const orClauses: Record<string, unknown>[] = [
    { id: supplierId },
    { code: supplierId },
  ];
  if (mongoose.Types.ObjectId.isValid(supplierId)) {
    orClauses.push({ _id: new mongoose.Types.ObjectId(supplierId) });
  }
  const supplier = await Suppliers.findOne({ $or: orClauses }).lean().exec();
  if (!supplier) {
    throw badRequest("SUPPLIER_REQUIRED", "A valid supplier is required.");
  }
  return sanitizeDocument(supplier);
};

const round = (value: number, precision = 2) => {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
};

const QC_DECISIONS = new Set(["ACCEPTE", "QUARANTAINE", "REJETE"]);
/** Receptions that may receive a QC inspection (BLOQUE = re-inspection of a quarantined delivery). */
const QC_OPEN_RECEPTION_STATUSES = new Set(["EN_ATTENTE_QC", "EN_QC", "BLOQUE"]);
/** Cancellation is only possible before any QC decision has released or rejected stock. */
const CANCELLABLE_RECEPTION_STATUSES = new Set(["BROUILLON", "EN_ATTENTE_QC", "EN_QC"]);
/** Same tolerance the intake screens apply between the lot split and the weighbridge net. */
const LOT_SPLIT_TOLERANCE_KG = 0.1;

/** Set by the server only — an intake payload can never choose them. */
const SERVER_OWNED_RECEPTION_FIELDS = [
  "_id", "id", "lots", "reception_number", "status", "created_at", "updated_at",
  "qc_decision", "qc_score", "qc_grade", "qc_auto_reject_reasons", "qc_closed_at", "qc_closed_by",
  "validated_at", "validated_by", "cancelled_at", "cancelled_by", "cancellation_reason",
  "supplier_code_snapshot", "supplier_name_snapshot", "purchase_order_number",
  "weighing_verified_device", "weight_gap_percent",
];
const SERVER_OWNED_LOT_FIELDS = [
  "_id", "id", "reception_id", "lot_internal", "stock_status", "qr_code_payload", "created_at", "updated_at",
  "release_date", "released_by", "release_pin_verified", "quarantine_date", "quarantine_reason",
  "gross_weight_kg", "tare_weight_kg", "net_weight_kg", "label_printed_at", "label_printed_by",
  "purchase_cost_tnd_per_kg", "purchase_cost_tnd", "cost_source", "storage_zone_code",
];

const omitFields = <T extends Record<string, unknown>>(row: T, fields: string[]) =>
  Object.fromEntries(Object.entries(row || {}).filter(([key]) => !fields.includes(key))) as T;

/** null when absent; throws on a value that is present but not a finite number. */
const readOptionalNumber = (value: unknown, field: string) => {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw badRequest("INVALID_NUMBER", `${field} doit être un nombre.`, { field, value });
  }
  return parsed;
};

/** Header status implied by the lots once QC has decided (lot-level release / block). */
const deriveReceptionStatusFromLots = (lots: Array<Record<string, unknown>>, current: string) => {
  const statuses = lots.map((lot) => String(lot.stock_status || ""));
  if (statuses.length === 0) return current;
  if (statuses.some((status) => status === "EN_QUARANTAINE")) return "BLOQUE";
  if (statuses.every((status) => status === "STOCK_REJETE")) return "REJETE";
  if (statuses.some((status) => status === "STOCK_LIBERE")) return "LIBERE";
  return current;
};

const buildReceptionStatusFromDecision = (decision: string) => {
  if (decision === "ACCEPTE") return "LIBERE";
  if (decision === "REJETE") return "REJETE";
  return "BLOQUE";
};

const buildLotStatusFromDecision = (decision: string) => {
  if (decision === "ACCEPTE") return "STOCK_LIBERE";
  if (decision === "REJETE") return "STOCK_REJETE";
  return "EN_QUARANTAINE";
};

const ZONE_STATUS_MAP: Record<string, "NON_STOCKE" | "EN_QUARANTAINE" | "STOCK_LIBERE" | "STOCK_REJETE"> = {
  // ── Legacy semantic zone IDs ──────────────────────────────────────────────
  ZONE_RECEPTION: "NON_STOCKE",
  ZONE_QUARANTAINE: "EN_QUARANTAINE",
  ZONE_MP_LIBEREE: "STOCK_LIBERE",
  ZONE_MP_LIBEREE_BIO: "STOCK_LIBERE",
  ZONE_REJET: "STOCK_REJETE",
};

/** Determine target stock status from zone code using prefix rules — more robust than a fixed map. */
const resolveZoneStatus = (
  zoneCode: string,
  currentStatus: string,
): "NON_STOCKE" | "EN_QUARANTAINE" | "STOCK_LIBERE" | "STOCK_REJETE" => {
  if (ZONE_STATUS_MAP[zoneCode]) return ZONE_STATUS_MAP[zoneCode];
  const up = zoneCode.toUpperCase();
  if (up.startsWith("CF-") || up.startsWith("ZE-")) return "STOCK_LIBERE";
  if (up.startsWith("FU-") || up.includes("QUARAN")) return "EN_QUARANTAINE";
  if (up.startsWith("ZR-") || up.startsWith("SB-")) return "NON_STOCKE";
  if (up.startsWith("ZONE_REJET") || up.includes("REJET")) return "STOCK_REJETE";
  // fallback: preserve current status
  const valid = ["NON_STOCKE", "EN_QUARANTAINE", "STOCK_LIBERE", "STOCK_REJETE"];
  return (valid.includes(currentStatus) ? currentStatus : "NON_STOCKE") as "NON_STOCKE" | "EN_QUARANTAINE" | "STOCK_LIBERE" | "STOCK_REJETE";
};

const buildStockLotStatus = (lotStatus: string) => {
  if (lotStatus === "STOCK_LIBERE") return "VALIDATED";
  if (lotStatus === "STOCK_REJETE") return "BLOCKED";
  return "QUARANTINE";
};

const RAW_ZONE_PREFIX = "SB-";
const TERMINAL_RECEPTION_STATUSES = ["REJETE", "ANNULE", "VALIDE", "ACCEPTE"];

const attachSuppliersToReceptions = async <T extends Record<string, unknown>>(receptions: T[]) => {
  if (receptions.length === 0) return receptions;

  const supplierIds = uniqueStrings(receptions.map((reception) => reception.supplier_id));
  if (supplierIds.length === 0) {
    return receptions.map((reception) => ({ ...reception, supplier: null })) as T[];
  }

  const suppliers = sanitizeDocument(
    await Suppliers().find({ id: { $in: supplierIds } }).lean().exec(),
  ) as Array<Record<string, unknown>>;
  const supplierMap = new Map(suppliers.map((supplier) => [String(supplier.id), supplier]));

  return receptions.map((reception) => ({
    ...reception,
    supplier: supplierMap.get(String(reception.supplier_id || "")) || null,
  })) as T[];
};

@Injectable()
export class ReceptionsService {
  async listReceptions() {
    const receptions = sanitizeDocument(
      await Receptions().find({}).sort({ created_at: -1 }).lean().exec(),
    ) as Array<Record<string, unknown>>;

    return attachSuppliersToReceptions(receptions);
  }

  async getReceptionById(receptionId: string) {
    if (!receptionId) return null;

    const reception = sanitizeDocument(
      await Receptions().findOne(receptionIdentityFilter(receptionId)).lean().exec(),
    ) as Record<string, unknown> | null;

    if (!reception) return null;

    const [enrichedReception] = await attachSuppliersToReceptions([reception]);
    return enrichedReception || null;
  }

  async listReceptionLots(receptionId: string) {
    if (!receptionId) {
      throw badRequest("RECEPTION_REQUIRED", "receptionId is required.");
    }

    return sanitizeDocument(
      await ReceptionLots().find({ reception_id: receptionId }).sort({ created_at: 1 }).lean().exec(),
    );
  }

  async listReceptionUnits(lotId: string) {
    if (!lotId) {
      throw badRequest("RECEPTION_LOT_REQUIRED", "lotId is required.");
    }

    return sanitizeDocument(
      await ReceptionUnits().find({ reception_lot_id: lotId }).sort({ created_at: 1 }).lean().exec(),
    );
  }

  /** Audit trail of the reception header and all of its lots, newest first. */
  async listReceptionAuditLogs(receptionId: string) {
    if (!receptionId) {
      throw badRequest("RECEPTION_REQUIRED", "receptionId is required.");
    }
    const lots = await loadReceptionLots(receptionId);
    const entityIds = [receptionId, ...lots.map((lot: Record<string, unknown>) => String(lot.id || ""))].filter(Boolean);
    const logs = sanitizeDocument(
      await ReceptionAuditLogs().find({ entity_id: { $in: entityIds } }).sort({ created_at: -1 }).lean().exec(),
    ) as Array<Record<string, unknown>>;
    // performed_by holds the user id; resolve display names so operators can read the history.
    const actorIds = Array.from(new Set(logs.map((log) => String(log.performed_by || "")).filter(Boolean)));
    const profiles = actorIds.length > 0
      ? sanitizeDocument(
          await getCollectionModel("profiles").find({ user_id: { $in: actorIds } }).lean().exec(),
        ) as Array<Record<string, unknown>>
      : [];
    const names = new Map(profiles.map((profile) => [String(profile.user_id), String(profile.full_name || "")]));
    return logs.map((log) => ({
      ...log,
      performed_by_name: names.get(String(log.performed_by || "")) || null,
    }));
  }

  async listQcInspections(receptionId: string) {
    if (!receptionId) {
      throw badRequest("RECEPTION_REQUIRED", "receptionId is required.");
    }

    return sanitizeDocument(
      await QCInspections().find({ reception_id: receptionId }).sort({ created_at: -1 }).lean().exec(),
    );
  }

  async listQcChecklists(receptionType?: string) {
    const query: Record<string, unknown> = { is_active: true };
    if (receptionType) {
      query.reception_type = receptionType;
    }

    return sanitizeDocument(
      await QCChecklists().find(query).sort({ name: 1 }).lean().exec(),
    );
  }

  async listQcChecklistItems(checklistId: string) {
    if (!checklistId) {
      throw badRequest("CHECKLIST_REQUIRED", "checklistId is required.");
    }

    return sanitizeDocument(
      await QCChecklistItems()
        .find({ checklist_id: checklistId, is_active: true })
        .sort({ sequence_order: 1 })
        .lean()
        .exec(),
    );
  }

  async listActiveAlerts() {
    return sanitizeDocument(
      await ReceptionAlerts().find({ status: "ACTIVE" }).sort({ created_at: -1 }).lean().exec(),
    );
  }

  async updateReceptionAlertStatus(alertId: string, payload: ReceptionAlertStatusPayload) {
    if (!alertId) {
      throw badRequest("ALERT_REQUIRED", "alertId is required.");
    }

    const actorName = readString(payload.actorName);
    if (!actorName) {
      throw badRequest("ACTOR_NAME_REQUIRED", "actorName is required.");
    }

    const now = new Date().toISOString();
    const update =
      payload.status === "RESOLVED"
        ? {
            status: "RESOLVED",
            resolved_at: now,
            resolved_by: actorName,
          }
        : {
            status: "ACKNOWLEDGED",
            acknowledged_at: now,
            acknowledged_by: actorName,
          };

    await ReceptionAlerts().updateOne({ id: alertId }, { $set: update }).exec();
    const updated = sanitizeDocument(await ReceptionAlerts().findOne({ id: alertId }).lean().exec());
    if (!updated) {
      throw notFound("ALERT_NOT_FOUND", "Reception alert not found.");
    }
    return updated;
  }

  async getCalibrationStatus() {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    try {
      const rows = sanitizeDocument(
        await Notifications()
          .find({
            notification_type: "QC_CALIBRATION_OK",
            created_at: { $gte: thirtyDaysAgo },
          })
          .sort({ created_at: -1 })
          .limit(1)
          .lean()
          .exec(),
      ) as Array<Record<string, unknown>>;

      return { calibrated: rows.length > 0 };
    } catch {
      return { calibrated: true };
    }
  }

  async listRawStorageOverdueReceptions() {
    const threshold48h = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const rows = sanitizeDocument(
      await Receptions()
        .find({ actual_arrival_date: { $lte: threshold48h } })
        .sort({ actual_arrival_date: 1 })
        .limit(30)
        .lean()
        .exec(),
    ) as Array<Record<string, unknown>>;

    return rows.filter(
      (row) =>
        String(row.storage_zone_code || "").startsWith(RAW_ZONE_PREFIX) &&
        !TERMINAL_RECEPTION_STATUSES.includes(String(row.status || "")),
    );
  }

  async findReceptionLotByScan(scanValue: string) {
    const normalizedValue = readString(scanValue);
    if (!normalizedValue) return null;

    const lot = sanitizeDocument(
      await ReceptionLots()
        .findOne({
          $or: [
            { lot_internal: normalizedValue },
            { lot_supplier: normalizedValue },
            { qr_code_payload: normalizedValue },
          ],
        })
        .lean()
        .exec(),
    ) as Record<string, unknown> | null;

    if (!lot) return null;

    const reception = await this.getReceptionById(String(lot.reception_id || ""));

    return {
      ...lot,
      reception,
    };
  }

  async intake(payload: ReceptionIntakePayload, actor: ActorContext) {
    const clientRequestId = readString(payload?.client_request_id);
    if (clientRequestId) {
      const existingReception = sanitizeDocument(
        await Receptions().findOne({ client_request_id: clientRequestId }).lean().exec(),
      ) as Record<string, unknown> | null;

      if (existingReception?.id) {
        const receptionId = String(existingReception.id);
        const existingLots = sanitizeDocument(
          await ReceptionLots().find({ reception_id: receptionId }).lean().exec(),
        ) as Array<Record<string, unknown>>;
        const lotIds = existingLots.map((row) => String(row.id || "")).filter(Boolean);
        const [existingUnits, existingAlerts, existingNotifications] = await Promise.all([
          ReceptionUnits().find({ reception_lot_id: { $in: lotIds } }).lean().exec(),
          ReceptionAlerts().find({ reception_id: receptionId }).lean().exec(),
          Notifications().find({ entity_id: receptionId }).lean().exec(),
        ]);
        return {
          reception: existingReception,
          lots: existingLots,
          units: sanitizeDocument(existingUnits),
          alerts: sanitizeDocument(existingAlerts),
          notifications: sanitizeDocument(existingNotifications),
        };
      }
    }

    if (!payload?.supplier_id) {
      throw badRequest("SUPPLIER_REQUIRED", "supplier_id is required.");
    }
    if (!Array.isArray(payload?.lots) || payload.lots.length === 0) {
      throw badRequest("LOTS_REQUIRED", "At least one lot is required.");
    }
    const lots = payload.lots.map((lot) => omitFields(lot, SERVER_OWNED_LOT_FIELDS));
    if (lots.some((lot) => !(Number(lot.quantity) > 0) || !Number.isFinite(Number(lot.quantity)))) {
      throw badRequest("INVALID_LOT_QUANTITY", "All lots must have a quantity greater than 0.");
    }

    const supplier = await ensureSupplierExists(String(payload.supplier_id));
    if (
      ["blocked", "archived"].includes(String(supplier.supplier_status || ""))
      || supplier.qualification_status === "blacklisted"
    ) {
      throw badRequest(
        "SUPPLIER_BLOCKED",
        `Le fournisseur ${supplier.code || supplier.name || ""} est bloqué : aucune réception ne peut être enregistrée.`,
      );
    }
    const purchaseOrderId = readString(payload.purchase_order_id);
    const purchaseOrderLineId = readString(payload.purchase_order_line_id);
    const materialId = readString(payload.material_id);
    if (purchaseOrderLineId && !purchaseOrderId) {
      throw badRequest(
        "PURCHASE_ORDER_REQUIRED",
        "purchase_order_id is required when purchase_order_line_id is provided.",
      );
    }

    const receiptResolution = purchaseOrderId
      ? await resolvePurchaseOrderReceiptTarget({
          purchaseOrderId,
          purchaseOrderLineId: purchaseOrderLineId || null,
          supplierId: String(supplier.id || payload.supplier_id),
          materialId: materialId || null,
        })
      : null;
    const now = new Date().toISOString();
    const grossReadingId = readString(payload.gross_reading_id);
    const tareReadingId = readString(payload.tare_reading_id);
    if ((grossReadingId || tareReadingId) && (!grossReadingId || !tareReadingId || lots.length !== 1)) {
      throw badRequest(
        "DEVICE_WEIGHING_PAIR_REQUIRED",
        "Verified device intake requires gross and tare reading IDs and exactly one intake lot.",
      );
    }
    const readingRows = grossReadingId && tareReadingId
      ? sanitizeDocument(
          await getCollectionModel("weighbridge_readings").find({
            reading_id: { $in: [grossReadingId, tareReadingId] },
            consumed: { $ne: true },
            stable: true,
            signature_verified: true,
          }).lean().exec(),
        ) as Array<Record<string, unknown>>
      : [];
    if (grossReadingId && readingRows.length !== 2) {
      throw badRequest("WEIGHBRIDGE_READING_UNAVAILABLE", "Gross or tare reading is unavailable or unverified.");
    }
    const grossReading = readingRows.find((row) => String(row.reading_id) === grossReadingId);
    const tareReading = readingRows.find((row) => String(row.reading_id) === tareReadingId);
    const grossWeight = grossReading
      ? Number(grossReading.weight_kg)
      : readOptionalNumber(payload.gross_weight_kg, "gross_weight_kg") ?? 0;
    const tareWeight = tareReading
      ? Number(tareReading.weight_kg)
      : readOptionalNumber(payload.tare_weight_kg, "tare_weight_kg") ?? 0;
    if (grossWeight < 0 || tareWeight < 0) {
      throw badRequest("INVALID_WEIGHT", "Les poids brut et tare doivent être positifs.");
    }
    const manufacturingRoute = requireManufacturingRoute(payload.manufacturing_route);

    // Quantities are compared at gram precision (3 decimals) to avoid float drift.
    const lotsTotal = round(lots.reduce((sum, lot) => sum + Number(lot.quantity), 0), 3);
    const quantityTotal = readOptionalNumber(payload.quantity_total, "quantity_total") ?? lotsTotal;
    if (Math.abs(quantityTotal - lotsTotal) > 0.001) {
      throw badRequest(
        "QUANTITY_TOTAL_MISMATCH",
        `La quantité totale (${quantityTotal} kg) ne correspond pas à la somme des lots (${lotsTotal} kg).`,
      );
    }
    const netWeight = round(grossWeight - tareWeight, 3);
    const weighed = grossWeight > 0 || tareWeight > 0;
    if (weighed && netWeight <= 0) {
      throw badRequest(
        "NET_WEIGHT_NOT_POSITIVE",
        `Poids net (${netWeight} kg) ≤ 0. Vérifiez brut (${grossWeight} kg) et tare (${tareWeight} kg).`,
      );
    }
    if (weighed && Math.abs(lotsTotal - netWeight) > LOT_SPLIT_TOLERANCE_KG) {
      throw badRequest(
        "LOT_QUANTITY_MISMATCH",
        `La somme des lots (${lotsTotal} kg) doit correspondre au poids net pesé (${netWeight} kg).`,
      );
    }
    const declaredWeightKg = readOptionalNumber(payload.declared_weight_kg ?? payload.declaredWeightKg, "declared_weight_kg");
    const weightGapPercent =
      weighed && declaredWeightKg && declaredWeightKg > 0
        ? round(((netWeight - declaredWeightKg) / declaredWeightKg) * 100)
        : null;

    // Refuse an over-delivery before anything is written, so a rejected
    // delivery never leaves a reception, lots or stock behind.
    if (receiptResolution) assertReceiptWithinTolerance(receiptResolution, quantityTotal);

    const reception = await prepareInsertDocument("receptions_v2", {
      ...omitFields(payload, SERVER_OWNED_RECEPTION_FIELDS),
      client_request_id: clientRequestId || null,
      supplier_id: supplier.id || payload.supplier_id,
      purchase_order_id: purchaseOrderId || null,
      purchase_order_number: receiptResolution?.order?.order_number || null,
      purchase_order_line_id: receiptResolution?.line?.id || purchaseOrderLineId || null,
      spontaneous_delivery: purchaseOrderId ? false : payload.spontaneous_delivery ?? true,
      supplier_code_snapshot: supplier.code || null,
      supplier_name_snapshot: supplier.name || null,
      material_id: materialId || receiptResolution?.line?.material_id || payload.material_id || null,
      quantity_total: quantityTotal,
      unit: payload.unit || "kg",
      declared_weight_kg: declaredWeightKg,
      gross_weight_kg: grossWeight,
      tare_weight_kg: tareWeight,
      gross_reading_id: grossReadingId || null,
      tare_reading_id: tareReadingId || null,
      manufacturing_route: manufacturingRoute,
      weighing_verified_device: Boolean(grossReading && tareReading),
      weight_gap_percent: weightGapPercent,
      status: "EN_ATTENTE_QC",
      created_by: actor?.id || payload.created_by || null,
      actual_arrival_date: payload.actual_arrival_date || now,
    });

    await Receptions().create([reception]);

    const agreedPrice = Number((supplier as Record<string, unknown>).agreed_price_tnd_per_kg);
    const lotInputs = lots.map((lot, index) => {
      const quantity = Number(lot.quantity || 0);
      const costSnapshot = snapshotPurchaseCost({
        quantityKg: quantity,
        agreedPriceTndPerKg: Number.isFinite(agreedPrice) ? agreedPrice : null,
      });
      return {
        ...lot,
        reception_id: reception.id,
        quantity,
        unit: payload.unit || lot.unit || "kg",
        stock_status: "EN_QUARANTAINE",
        origin_country: lot.origin_country || payload.origin_country || "Tunisie",
        variety: lot.variety || payload.variety || null,
        manufacturing_route: manufacturingRoute,
        maturity_stage: lot.maturity_stage || payload.maturity_stage || null,
        article_ref: lot.article_ref || null,
        qr_code_payload: lot.qr_code_payload || `passport:${reception.reception_number}-LOT-${index + 1}`,
        ...costSnapshot,
      };
    });

    const createdLots = [];
    for (const lotInput of lotInputs) {
      const prepared = await prepareInsertDocument("reception_lots", lotInput);
      // W2: buyer QR points at public digital passport (HashRouter).
      const passportCode = String(prepared.lot_internal || prepared.id);
      prepared.qr_code_payload = `/#/passport/${encodeURIComponent(passportCode)}`;
      createdLots.push(prepared);
    }
    await ReceptionLots().insertMany(createdLots);

    const totalUnits = Math.max(1, Number(payload.unit_count || createdLots.length || 1));
    const createdUnits = [];
    for (let index = 0; index < totalUnits; index += 1) {
      const lot = createdLots[index % createdLots.length];
      const prepared = await prepareInsertDocument("reception_units", {
        reception_lot_id: lot.id,
        unit_type: payload.unit_type || "PALETTE",
        quantity: round(quantityTotal / totalUnits, 3),
        unit: payload.unit || "kg",
        gross_weight: null,
        net_weight: null,
        tare_weight: null,
        unit_status: "EN_QUARANTAINE",
      });
      createdUnits.push(prepared);
    }
    await ReceptionUnits().insertMany(createdUnits);

    await syncReceptionLotsToStock(createdLots, {
      reception,
      actorId: actor?.id || null,
    });

    for (const lot of createdLots) {
      await lotLifecycleService.recordStageSafe({
        lotId: String(lot.id),
        toStage: "SUPPLIER_INTAKE",
        collection: "reception_lots",
        actorId: actor?.id || null,
        payload: {
          lot_internal: lot.lot_internal ?? null,
          variety: lot.variety ?? null,
          quantity: lot.quantity ?? null,
          route_product: MANUFACTURING_ROUTE_LABEL[manufacturingRoute],
        },
        relatedIds: [String(reception.id)],
        route: manufacturingRoute,
      });
    }

    if (grossReadingId && tareReadingId && createdLots[0]?.id) {
      const linkedLotId = String(createdLots[0].id);
      await this.recordWeighing(linkedLotId, {
        type: "GROSS",
        weight_kg: grossWeight,
        source: "DEVICE",
        reading_id: grossReadingId,
        supervisor: readString(payload.weighing_supervisor) || null,
      }, actor);
      await this.recordWeighing(linkedLotId, {
        type: "TARE",
        weight_kg: tareWeight,
        source: "DEVICE",
        reading_id: tareReadingId,
        supervisor: readString(payload.weighing_supervisor) || null,
      }, actor);
    }

    if (receiptResolution) {
      try {
        await registerReceptionAgainstPurchaseOrder({
          resolution: receiptResolution,
          reception,
          lots: createdLots,
          quantityTotal,
          actorId: actor?.id || null,
        });
      } catch (error) {
        // The order line changed between the pre-check and the booking (another
        // delivery was received meanwhile). Void this intake so its stock is never
        // counted, and free the request id so a corrected retry starts clean.
        const reason = `Réservation sur le bon de commande impossible : ${error instanceof Error ? error.message : String(error)}`;
        await this.voidReceptionLots(reception, createdLots, reason, actor?.id || null);
        await Receptions().updateOne(
          { id: reception.id },
          {
            $set: {
              status: "ANNULE",
              cancelled_at: new Date().toISOString(),
              cancelled_by: actor?.id || null,
              cancellation_reason: reason,
              client_request_id: null,
              voided_client_request_id: clientRequestId || null,
              updated_at: new Date().toISOString(),
            },
          },
        ).exec();
        throw error;
      }
    }

    const alerts = [];
    const alertMessages = Array.isArray(payload.phase1_alerts) ? payload.phase1_alerts : [];
    for (const message of alertMessages) {
      alerts.push(
        await prepareInsertDocument("reception_alerts", {
          alert_type: "PHASE1_RECEPTION_ALERT",
          severity: "MAJEUR",
          reception_id: reception.id,
          supplier_id: reception.supplier_id,
          title: "Alerte reception",
          message,
          status: "ACTIVE",
        }),
      );
    }
    if (alerts.length > 0) {
      await ReceptionAlerts().insertMany(alerts);
    }

    const notification = await emitNotification({
      notificationType: "RECEPTION_CREATED",
      category: "reception",
      space: "receptions",
      title: `Nouvelle reception ${reception.reception_number}`,
      message: `Reception ${reception.reception_number} enregistree et en attente QC.`,
      severity: "info",
      entityType: "receptions_v2",
      entityId: String(reception.id),
      metadata: {
        supplier_id: reception.supplier_id,
      },
    });

    return {
      reception: sanitizeDocument(reception),
      lots: sanitizeDocument(createdLots),
      units: sanitizeDocument(createdUnits),
      alerts: sanitizeDocument(alerts),
      notifications: [notification].filter(Boolean),
    };
  }

  async startQcInspection(payload: Record<string, unknown>, actor: ActorContext) {
    const receptionId = readString(payload?.reception_id, payload?.receptionId, payload?.id);

    if (!receptionId) {
      throw badRequest("RECEPTION_REQUIRED", "reception_id is required.");
    }

    const reception = sanitizeDocument(await Receptions().findOne(receptionIdentityFilter(receptionId)).lean().exec());
    if (!reception) {
      throw notFound("RECEPTION_NOT_FOUND", "Reception not found.");
    }

    const receptionStatus = String(reception.status || "");
    if (!QC_OPEN_RECEPTION_STATUSES.has(receptionStatus)) {
      throw conflict(
        "RECEPTION_NOT_INSPECTABLE",
        `La réception ${reception.reception_number || receptionId} est au statut ${receptionStatus} : aucune inspection QC ne peut être ouverte.`,
      );
    }

    if (reception.created_by && actor?.id && reception.created_by === actor.id && !isAdminActor(actor)) {
      throw badRequest(
        "QC_ROLE_SEPARATION",
        "Reception operator cannot inspect the same lot.",
      );
    }

    // One open inspection per reception: a double click or a reopened dialog
    // resumes it instead of creating a parallel inspection.
    const canonicalReceptionId = String(reception.id || receptionId);
    const openInspection = sanitizeDocument(
      await QCInspections().findOne({ reception_id: canonicalReceptionId, decision: null }).lean().exec(),
    ) as Record<string, unknown> | null;

    const inspection = openInspection || await prepareInsertDocument("qc_inspections", {
      ...omitFields(payload, ["_id", "id", "decision", "ended_at", "inspection_number", "release_pin_verified", "decided_by"]),
      reception_id: canonicalReceptionId,
      inspector_id: actor?.id || null,
      started_at: new Date().toISOString(),
      decision: null,
    });
    if (!openInspection) await QCInspections().create([inspection]);

    await Receptions().updateOne(
      receptionIdentityFilter(receptionId),
      {
        $set: {
          status: "EN_QC",
          updated_at: new Date().toISOString(),
        },
      },
    ).exec();

    return sanitizeDocument(inspection);
  }

  async submitQcDecision(payload: QcDecisionPayload, actor: ActorContext) {
    const inspectionId = readString(payload.inspectionId, payload.inspection_id);
    const decision = readString(payload.decision).toUpperCase();

    if (!inspectionId) {
      throw badRequest("INSPECTION_REQUIRED", "inspectionId is required.");
    }
    if (!decision) {
      throw badRequest("DECISION_REQUIRED", "decision is required.");
    }
    if (!QC_DECISIONS.has(decision)) {
      throw badRequest("INVALID_QC_DECISION", "decision must be ACCEPTE, QUARANTAINE or REJETE.");
    }

    const inspection = sanitizeDocument(await QCInspections().findOne({ id: inspectionId }).lean().exec());
    if (!inspection) {
      throw notFound("INSPECTION_NOT_FOUND", "QC inspection not found.");
    }
    if (inspection.decision) {
      return this.replayQcDecision(inspection, decision, payload, actor);
    }

    const reception = sanitizeDocument(
      await Receptions().findOne(receptionIdentityFilter(String(inspection.reception_id || ""))).lean().exec(),
    ) as Record<string, unknown> | null;
    if (!reception) {
      throw notFound("RECEPTION_NOT_FOUND", "Reception not found.");
    }
    if (!QC_OPEN_RECEPTION_STATUSES.has(String(reception.status || ""))) {
      throw conflict(
        "RECEPTION_NOT_INSPECTABLE",
        `La réception ${reception.reception_number || inspection.reception_id} est au statut ${reception.status} : la décision QC ne peut plus être enregistrée.`,
      );
    }

    // Signature numérique — la libération QC (ACCEPTE → STOCK_LIBERE) est la
    // transition à plus fort risque légal: on ré-authentifie le signataire.
    const releasePinResult = decision === "ACCEPTE"
      ? await assertSignaturePin(
          String(actor?.id || ""),
          readString(payload.pin, payload.signature_pin) || null,
          { action: "qc_release", entityId: inspectionId },
        )
      : null;

    const now = new Date().toISOString();
    const qualitySummary = payload.qualitySummary || {};
    const checkResults = Array.isArray(payload.checkResults) ? payload.checkResults : [];

    const inspectionUpdate = {
      decision,
      comment: payload.comment || null,
      ended_at: now,
      updated_at: now,
      decided_by: releasePinResult?.userId || actor?.id || null,
      lab_sample_required: Boolean(payload.labSampleRequired),
      lab_analyses: payload.labAnalyses || [],
      lab_storage_location: payload.labStorageLocation || null,
      lab_sample_code: payload.labSampleRequired ? `LAB-${Date.now()}` : null,
      secondary_inspector_name: payload.secondaryInspectorName || null,
      recommended_decision: payload.recommendedDecision || null,
      override_justification: payload.overrideJustification || null,
      rqc: payload.rqc || null,
      release_pin_verified: releasePinResult ? releasePinResult.verified === true : null,
    };

    // Atomic claim: only one submit records the decision. A concurrent double
    // click lands in the replay path instead of writing a second set of results.
    const claim = await QCInspections().updateOne(
      { id: inspectionId, decision: null },
      { $set: inspectionUpdate },
    ).exec();
    if (Number(claim?.modifiedCount ?? 0) !== 1) {
      const current = sanitizeDocument(await QCInspections().findOne({ id: inspectionId }).lean().exec());
      return this.replayQcDecision(current, decision, payload, actor);
    }

    // Results are written once per inspection; a revision needs a new inspection,
    // so the recorded evidence is never overwritten.
    const preparedResults = [];
    for (const result of checkResults) {
      preparedResults.push(
        await prepareInsertDocument("qc_check_results", {
          inspection_id: inspectionId,
          checklist_item_id: result.checklist_item_id || null,
          check_code: result.check_code,
          check_name: result.check_name,
          category: result.category || null,
          severity: result.severity || "MAJEUR",
          result: result.result || "NA",
          note: result.note || null,
          measured_value: result.measured_value || null,
          expected_value: result.expected_value || null,
          checked_at: now,
          checked_by: actor?.id || null,
        }),
      );
    }
    if (preparedResults.length > 0) {
      await QCCheckResults().insertMany(preparedResults);
    }

    const updatedReception = await this.applyQcDecisionToReception({
      inspection: { ...inspection, ...inspectionUpdate },
      decision,
      qualitySummary,
      actor,
      now,
    });

    const storedInspection = sanitizeDocument(await QCInspections().findOne({ id: inspectionId }).lean().exec());

    // ── RG-F03/F04: update supplier metrics + trigger business rules ─────────
    if (updatedReception?.supplier_id) {
      recalculateSupplierMetrics(String(updatedReception.supplier_id), actor?.id ?? null).catch((err) =>
        console.error("[RG] supplier metric recalc failed:", err),
      );
    }

    // ── RG-R07: notify QC inspector that a new lot awaits inspection ─────────
    await emitNotification({
      notificationType: "QC_DECISION_RECORDED",
      category: "quality",
      space: "quality",
      title: `Décision QC enregistrée — ${updatedReception?.reception_number ?? inspectionId}`,
      message: `Décision ${decision} enregistrée pour la réception ${updatedReception?.reception_number ?? ""}. Grade: ${(payload.qualitySummary as Record<string, unknown>)?.grade ?? "—"}.`,
      severity: decision === "REJETE" ? "error" : decision === "QUARANTAINE" ? "warning" : "info",
      entityType: "receptions_v2",
      entityId: String(inspection.reception_id),
      metadata: { decision, grade: (payload.qualitySummary as Record<string, unknown>)?.grade ?? null },
    });

    return storedInspection;
  }

  /**
   * The same decision sent again (double submit, or a retry after the stock or
   * purchase-order sync failed) re-applies the idempotent projections while the
   * reception is still in QC. A different decision is a revision and needs a new
   * inspection, so the recorded one is never overwritten.
   */
  private async replayQcDecision(
    inspection: Record<string, unknown>,
    decision: string,
    payload: QcDecisionPayload,
    actor: ActorContext,
  ) {
    if (inspection.decision !== decision) {
      throw conflict(
        "QC_ALREADY_DECIDED",
        `L'inspection ${inspection.inspection_number || inspection.id} est déjà clôturée avec la décision ${inspection.decision}. Ouvrez une nouvelle inspection pour la réviser.`,
      );
    }

    const reception = sanitizeDocument(
      await Receptions().findOne(receptionIdentityFilter(String(inspection.reception_id || ""))).lean().exec(),
    ) as Record<string, unknown> | null;
    if (reception && ["EN_ATTENTE_QC", "EN_QC"].includes(String(reception.status || ""))) {
      await this.applyQcDecisionToReception({
        inspection,
        decision,
        qualitySummary: payload.qualitySummary || {},
        actor,
        now: String(inspection.ended_at || new Date().toISOString()),
      });
    }

    return sanitizeDocument(await QCInspections().findOne({ id: inspection.id }).lean().exec());
  }

  /**
   * Projects a recorded QC decision onto lots, units, stock and the purchase
   * order, then closes the reception header. The header is written last so a
   * failed sync leaves the reception in QC and a retry can complete it.
   */
  private async applyQcDecisionToReception(input: {
    inspection: Record<string, unknown>;
    decision: string;
    qualitySummary: Record<string, unknown>;
    actor: ActorContext;
    now: string;
  }) {
    const { inspection, decision, qualitySummary, actor, now } = input;
    const receptionId = String(inspection.reception_id || "");
    const inspectionId = String(inspection.id || "");
    const lotStatus = buildLotStatusFromDecision(decision);
    const comment = (inspection.comment as string | null) || null;

    await ReceptionLots().updateMany(
      { reception_id: receptionId },
      {
        $set: {
          stock_status: lotStatus,
          quarantine_reason: decision === "QUARANTAINE" || decision === "REJETE" ? comment : null,
          quarantine_date: decision === "QUARANTAINE" ? now : null,
          release_date: decision === "ACCEPTE" ? now : null,
          released_by: decision === "ACCEPTE" ? (inspection.decided_by || actor?.id || null) : null,
          release_pin_verified: decision === "ACCEPTE" ? inspection.release_pin_verified === true : null,
          updated_at: now,
        },
      },
    ).exec();

    const lots = await loadReceptionLots(receptionId);
    await ReceptionUnits().updateMany(
      { reception_lot_id: { $in: lots.map((lot: { id?: string }) => lot.id) } },
      { $set: { unit_status: lotStatus, updated_at: now } },
    ).exec();

    const reception = sanitizeDocument(
      await Receptions().findOne(receptionIdentityFilter(receptionId)).lean().exec(),
    ) as Record<string, unknown> | null;
    try {
      await syncReceptionLotsToStock(lots, { reception, actorId: actor?.id || null });
    } catch (syncError) {
      console.error("[QC] syncReceptionLotsToStock failed — stock_lots may be out of sync:", syncError);
      throw new Error("La synchronisation du stock a échoué. Renvoyez la décision QC pour terminer la mise à jour.");
    }

    if (reception?.purchase_order_id) {
      try {
        await applyPurchaseOrderQcDecision({
          purchaseOrderId: String(reception.purchase_order_id),
          receptionId,
          decision,
        });
      } catch (purchaseOrderError) {
        console.error("[QC] purchase order sync failed:", purchaseOrderError);
        throw new Error("La synchronisation du bon de commande a échoué. Renvoyez la décision QC pour terminer la mise à jour.");
      }
    }

    await Receptions().updateOne(
      receptionIdentityFilter(receptionId),
      {
        $set: {
          status: buildReceptionStatusFromDecision(decision),
          qc_decision: decision,
          qc_score: qualitySummary.score ?? null,
          qc_grade: qualitySummary.grade ?? null,
          qc_auto_reject_reasons: qualitySummary.automaticRejectReasons || [],
          qc_closed_at: now,
          qc_closed_by: actor?.id || null,
          updated_at: now,
        },
      },
    ).exec();

    for (const lot of lots) {
      const lotId = String(lot.id || "");
      if (!lotId) continue;
      if (decision === "REJETE") {
        await lotLifecycleService.recordStageSafe({
          lotId,
          toStage: "REJECTED",
          collection: "qc_inspections",
          actorId: actor?.id || null,
          payload: { decision, inspection_id: inspectionId, rejected: true },
          route: "PREMIUM_WHOLE",
        });
      } else if (decision === "ACCEPTE") {
        await lotLifecycleService.recordStageSafe({
          lotId,
          toStage: "QC_DECIDED",
          collection: "qc_inspections",
          actorId: actor?.id || null,
          payload: { decision, inspection_id: inspectionId },
          route: "PREMIUM_WHOLE",
        });
      }
    }

    return sanitizeDocument(
      await Receptions().findOne(receptionIdentityFilter(receptionId)).lean().exec(),
    ) as Record<string, unknown> | null;
  }

  async markUnitPrinted(unitId: string, actor: ActorContext) {
    if (!unitId) {
      throw badRequest("UNIT_REQUIRED", "unitId is required.");
    }

    await ReceptionUnits().updateOne(
      { id: unitId },
      {
        $set: {
          label_printed_at: new Date().toISOString(),
          label_printed_by: actor?.id || null,
          updated_at: new Date().toISOString(),
        },
      },
    ).exec();

    const updatedUnit = sanitizeDocument(await ReceptionUnits().findOne({ id: unitId }).lean().exec());
    if (!updatedUnit) {
      throw notFound("UNIT_NOT_FOUND", "Reception unit not found.");
    }
    return updatedUnit;
  }

  async createReceptionUnit(payload: ReceptionUnitInput, actor: ActorContext) {
    const receptionLotId = readString(payload.reception_lot_id, payload.receptionLotId);
    if (!receptionLotId) {
      throw badRequest("RECEPTION_LOT_REQUIRED", "reception_lot_id is required.");
    }

    const quantity = Number(payload.quantity ?? 0);
    if (quantity <= 0) {
      throw badRequest("INVALID_UNIT_QUANTITY", "quantity must be greater than 0.");
    }

    const lot = sanitizeDocument(
      await ReceptionLots().findOne({ id: receptionLotId }).lean().exec(),
    ) as Record<string, unknown> | null;
    if (!lot) {
      throw notFound("RECEPTION_LOT_NOT_FOUND", "Reception lot not found.");
    }

    const unit = await prepareInsertDocument("reception_units", {
      reception_lot_id: receptionLotId,
      unit_type: readString(payload.unit_type, payload.unitType) || "PALETTE",
      quantity,
      unit: readString(payload.unit) || String(lot.unit || "kg"),
      gross_weight: payload.gross_weight ?? payload.grossWeight ?? null,
      net_weight: payload.net_weight ?? payload.netWeight ?? null,
      unit_status: lot.stock_status || "NON_STOCKE",
      created_by: actor?.id || null,
    });

    await ReceptionUnits().create([unit]);
    return sanitizeDocument(unit);
  }

  async moveReceptionLotToStorage(payload: ReceptionStorageMovePayload, actor: ActorContext) {
    const lotId = readString(payload.lotId);
    const targetZone = readString(payload.targetZone);
    const performedBy = readString(actor?.id);

    if (!lotId) {
      throw badRequest("RECEPTION_LOT_REQUIRED", "lotId is required.");
    }
    if (!targetZone) {
      throw badRequest("TARGET_ZONE_REQUIRED", "targetZone is required.");
    }
    if (!performedBy) {
      throw badRequest("PERFORMED_BY_REQUIRED", "An authenticated actor is required.");
    }

    const lot = sanitizeDocument(
      await ReceptionLots().findOne({ id: lotId }).lean().exec(),
    ) as Record<string, unknown> | null;
    if (!lot) {
      throw notFound("RECEPTION_LOT_NOT_FOUND", "Reception lot not found.");
    }

    // A storage move changes where a lot sits, never its QC verdict: a zone can
    // only confirm a release QC already granted, and a rejected lot stays rejected.
    const currentStatus = String(lot.stock_status || "NON_STOCKE");
    let nextStatus = resolveZoneStatus(targetZone, currentStatus);
    if (currentStatus === "STOCK_REJETE") {
      if (nextStatus === "STOCK_LIBERE") {
        throw conflict(
          "LOT_REJECTED",
          `Le lot ${lot.lot_internal || lotId} est rejeté : il ne peut pas entrer dans une zone de stock libéré.`,
        );
      }
      nextStatus = "STOCK_REJETE";
    } else if (nextStatus === "STOCK_LIBERE" && currentStatus !== "STOCK_LIBERE") {
      throw conflict(
        "QC_RELEASE_REQUIRED",
        `Le lot ${lot.lot_internal || lotId} n'est pas libéré par le contrôle qualité : seule une zone de quarantaine ou de réception est autorisée.`,
      );
    }

    const stockLot = sanitizeDocument(
      await StockLots().findOne({ reception_lot_id: lotId }).lean().exec(),
    ) as Record<string, unknown> | null;
    await scanService.consumeMoveProof({
      token: payload.scanProof?.lotToken,
      actorId: performedBy,
      expectedStockLotId: stockLot?.id ? String(stockLot.id) : null,
      collection: "reception_stock_movements",
    });
    const now = new Date().toISOString();
    const notes = readString(payload.notes);
    const position = readString(payload.position);

    const movement = await prepareInsertDocument("reception_stock_movements", {
      reception_id: lot.reception_id || null,
      reception_lot_id: lot.id,
      movement_type: "MISE_EN_STOCK",
      to_location_id: targetZone,
      quantity: Number(lot.quantity || 0),
      unit: lot.unit || "kg",
      performed_by: performedBy,
      notes: notes || null,
    });
    await ReceptionStockMovements().create([movement]);

    const lotUpdate: Record<string, unknown> = {
      stock_status: nextStatus,
      storage_zone_code: targetZone,
      updated_at: now,
    };

    // Release fields belong to the QC decision and are left untouched here.
    if (nextStatus === "EN_QUARANTAINE" && currentStatus !== "EN_QUARANTAINE") {
      lotUpdate.quarantine_date = now;
      if (notes) {
        lotUpdate.quarantine_reason = notes;
      }
    }

    await ReceptionLots().updateOne({ id: lotId }, { $set: lotUpdate }).exec();

    await ReceptionUnits().updateMany(
      { reception_lot_id: lotId },
      {
        $set: {
          location_id: targetZone,
          position: position || null,
          unit_status: nextStatus,
          updated_at: now,
        },
      },
    ).exec();

    const stockLotUpdate: Record<string, unknown> = {
      status: buildStockLotStatus(nextStatus),
      source_status: nextStatus,
      location_id: targetZone,
      updated_at: now,
    };

    if (position) {
      stockLotUpdate.position = position;
    }

    await StockLots().updateMany({ reception_lot_id: lotId }, { $set: stockLotUpdate }).exec();

    const auditLog = await prepareInsertDocument("reception_audit_logs_v2", {
      entity_type: "LOT",
      entity_id: lotId,
      action: "STOCK_MOVE",
      new_state: { zone: targetZone, position: position || null, stock_status: nextStatus },
      performed_by: performedBy,
    });
    await ReceptionAuditLogs().create([auditLog]);

    if (nextStatus === "STOCK_LIBERE") {
      await lotLifecycleService.recordStageSafe({
        lotId,
        toStage: "COLD_STORE",
        collection: "reception_stock_movements",
        actorId: performedBy,
        payload: { zone: targetZone, position: position || null },
        route: "PREMIUM_WHOLE",
      });
    }

    const updatedLot = sanitizeDocument(
      await ReceptionLots().findOne({ id: lotId }).lean().exec(),
    );

    return {
      movement: sanitizeDocument(movement),
      lot: updatedLot,
      auditLog: sanitizeDocument(auditLog),
    };
  }

  // ── Cancellation & lot-level quality status ─────────────────────────────────

  /**
   * Takes lots out of usable stock without deleting any record: lots are
   * flagged rejected, their stock projection is blocked and emptied through an
   * AJUSTEMENT movement, and the ledger marks them so they cannot advance.
   */
  private async voidReceptionLots(
    reception: Record<string, unknown>,
    lots: Array<Record<string, unknown>>,
    reason: string,
    actorId: string | null,
  ) {
    const lotIds = lots.map((lot) => String(lot.id || "")).filter(Boolean);
    if (lotIds.length === 0) return;
    const now = new Date().toISOString();

    await ReceptionLots().updateMany(
      { id: { $in: lotIds } },
      { $set: { stock_status: "STOCK_REJETE", quarantine_reason: reason, cancelled_at: now, updated_at: now } },
    ).exec();
    await ReceptionUnits().updateMany(
      { reception_lot_id: { $in: lotIds } },
      { $set: { unit_status: "STOCK_REJETE", updated_at: now } },
    ).exec();

    const voidedLots = (await loadReceptionLots(String(reception.id))).filter((lot: Record<string, unknown>) =>
      lotIds.includes(String(lot.id)),
    );
    await syncReceptionLotsToStock(voidedLots, { reception, actorId });

    const stockLots = sanitizeDocument(
      await StockLots().find({ reception_lot_id: { $in: lotIds } }).lean().exec(),
    ) as Array<Record<string, unknown>>;
    for (const stockLot of stockLots) {
      if (stockLot.cancelled_at) continue;
      const quantity = Number(stockLot.current_quantity || 0);
      if (quantity > 0) {
        const movement = await prepareInsertDocument("stock_movements", {
          movement_type: "AJUSTEMENT",
          adjustment_direction: "OUT",
          lot_id: stockLot.id,
          product_id: stockLot.product_id ?? null,
          quantity,
          unit: stockLot.unit || "kg",
          document_type: "RECEPTION_CANCEL",
          document_reference: reception.reception_number || reception.id,
          performed_by: actorId,
          notes: `Annulation réception ${reception.reception_number || reception.id} — ${reason}`,
          created_at: now,
        });
        await StockMovements().create([movement]);
      }
      await StockLots().updateOne(
        { id: stockLot.id },
        { $set: { current_quantity: 0, cancelled_at: now, cancellation_reason: reason, updated_at: now } },
      ).exec();
    }

    for (const lotId of lotIds) {
      await lotLifecycleService.recordStageSafe({
        lotId,
        toStage: "REJECTED",
        collection: "receptions_v2",
        actorId,
        payload: { cancelled: true, rejected: true, reason },
        relatedIds: [String(reception.id)],
        route: "PREMIUM_WHOLE",
      });
    }
  }

  async cancelReception(receptionId: string, payload: { reason?: unknown }, actor: ActorContext) {
    const reason = readString(payload?.reason);
    if (!reason) {
      throw badRequest("CANCELLATION_REASON_REQUIRED", "Le motif d'annulation est obligatoire.");
    }

    const reception = sanitizeDocument(
      await Receptions().findOne(receptionIdentityFilter(receptionId)).lean().exec(),
    ) as Record<string, unknown> | null;
    if (!reception) throw notFound("RECEPTION_NOT_FOUND", "Reception not found.");

    const canonicalId = String(reception.id);
    // Retrying a completed cancellation is harmless.
    if (reception.status === "ANNULE") {
      return { reception, lots: await loadReceptionLots(canonicalId) };
    }
    if (!CANCELLABLE_RECEPTION_STATUSES.has(String(reception.status || ""))) {
      throw conflict(
        "RECEPTION_NOT_CANCELLABLE",
        `La réception ${reception.reception_number} a une décision QC (${reception.status}) : elle ne peut plus être annulée. Utilisez le blocage qualité ou une réclamation fournisseur.`,
      );
    }

    const lots = await loadReceptionLots(canonicalId);
    const lotIds = lots.map((lot: Record<string, unknown>) => String(lot.id || "")).filter(Boolean);
    const stockLots = sanitizeDocument(
      await StockLots().find({ reception_lot_id: { $in: lotIds } }).lean().exec(),
    ) as Array<Record<string, unknown>>;
    const consumed = stockLots.filter(
      (stockLot) =>
        !stockLot.cancelled_at
        && Math.abs(Number(stockLot.current_quantity ?? 0) - Number(stockLot.initial_quantity ?? 0)) > 0.001,
    );
    if (consumed.length > 0) {
      throw conflict(
        "RECEPTION_STOCK_CONSUMED",
        "Une partie du stock de cette réception a déjà été mouvementée : l'annulation n'est plus possible.",
        { stock_lot_ids: consumed.map((stockLot) => stockLot.id) },
      );
    }

    const actorId = actor?.id || null;
    const cancelReason = `Réception annulée : ${reason}`;
    await this.voidReceptionLots(reception, lots, cancelReason, actorId);

    if (reception.purchase_order_id) {
      await reversePurchaseOrderReception({
        purchaseOrderId: String(reception.purchase_order_id),
        receptionId: canonicalId,
        reason: cancelReason,
      });
    }

    // Header last: if a step above fails the reception stays cancellable and
    // the retry completes the reversal (every step skips what is already done).
    const now = new Date().toISOString();
    await Receptions().updateOne(
      receptionIdentityFilter(canonicalId),
      {
        $set: {
          status: "ANNULE",
          cancelled_at: now,
          cancelled_by: actorId,
          cancellation_reason: reason,
          updated_at: now,
        },
      },
    ).exec();

    const auditLog = await prepareInsertDocument("reception_audit_logs_v2", {
      entity_type: "RECEPTION",
      entity_id: canonicalId,
      action: "CANCELLED",
      actor_id: actorId,
      previous_state: { status: reception.status },
      new_state: { status: "ANNULE", reason, lot_ids: lotIds },
      performed_by: actorId || "system",
    });
    await ReceptionAuditLogs().create([auditLog]);

    await emitNotification({
      notificationType: "RECEPTION_CANCELLED",
      category: "reception",
      space: "receptions",
      title: `Réception annulée — ${reception.reception_number}`,
      message: `Réception ${reception.reception_number} annulée : ${reason}. Stock retiré${reception.purchase_order_id ? " et bon de commande réouvert" : ""}.`,
      severity: "warning",
      entityType: "receptions_v2",
      entityId: canonicalId,
      metadata: { reason, purchase_order_id: reception.purchase_order_id ?? null },
    });

    return {
      reception: sanitizeDocument(await Receptions().findOne(receptionIdentityFilter(canonicalId)).lean().exec()),
      lots: await loadReceptionLots(canonicalId),
    };
  }

  /**
   * Lot-level quality change after the QC decision: release a quarantined lot
   * (signed, like the QC release) or put a released lot back in quarantine.
   * Stock, purchase order and reception header follow.
   */
  private async applyLotQualityChange(input: {
    reception: Record<string, unknown>;
    lotIds: string[];
    nextStatus: "STOCK_LIBERE" | "EN_QUARANTAINE";
    reason: string | null;
    actorId: string | null;
    releasePinVerified?: boolean;
    auditAction: string;
    headerOverrides?: Record<string, unknown>;
  }) {
    const { reception, lotIds, nextStatus, reason, actorId } = input;
    const receptionId = String(reception.id);
    const releasing = nextStatus === "STOCK_LIBERE";
    const now = new Date().toISOString();

    if (lotIds.length > 0) {
      await ReceptionLots().updateMany(
        { id: { $in: lotIds } },
        {
          $set: releasing
            ? {
                stock_status: nextStatus,
                quarantine_reason: null,
                quarantine_date: null,
                release_date: now,
                released_by: actorId,
                release_pin_verified: input.releasePinVerified === true,
                release_reason: reason,
                updated_at: now,
              }
            : {
                stock_status: nextStatus,
                quarantine_reason: reason,
                quarantine_date: now,
                release_date: null,
                released_by: null,
                release_pin_verified: null,
                updated_at: now,
              },
        },
      ).exec();
      await ReceptionUnits().updateMany(
        { reception_lot_id: { $in: lotIds } },
        { $set: { unit_status: nextStatus, updated_at: now } },
      ).exec();
    }

    const lots = await loadReceptionLots(receptionId);
    const changedLots = lots.filter((lot: Record<string, unknown>) => lotIds.includes(String(lot.id)));
    if (changedLots.length > 0) {
      await syncReceptionLotsToStock(changedLots, { reception, actorId });
      if (reception.purchase_order_id) {
        await applyPurchaseOrderQcDecision({
          purchaseOrderId: String(reception.purchase_order_id),
          receptionId,
          decision: releasing ? "ACCEPTE" : "QUARANTAINE",
          receptionLotIds: lotIds,
        });
      }
    }

    await Receptions().updateOne(
      receptionIdentityFilter(receptionId),
      {
        $set: {
          status: deriveReceptionStatusFromLots(lots, String(reception.status || "")),
          ...input.headerOverrides,
          updated_at: now,
        },
      },
    ).exec();

    const auditLogs = [];
    for (const lot of changedLots) {
      auditLogs.push(
        await prepareInsertDocument("reception_audit_logs_v2", {
          entity_type: "LOT",
          entity_id: lot.id,
          action: input.auditAction,
          actor_id: actorId,
          new_state: { stock_status: nextStatus, reason, release_pin_verified: releasing ? input.releasePinVerified === true : null },
          performed_by: actorId || "system",
        }),
      );
      if (releasing) {
        await lotLifecycleService.recordStageSafe({
          lotId: String(lot.id),
          toStage: "QC_DECIDED",
          collection: "reception_lots",
          actorId,
          payload: { decision: "ACCEPTE", released_from_quarantine: true, reason },
          route: "PREMIUM_WHOLE",
        });
      }
    }
    if (auditLogs.length > 0) await ReceptionAuditLogs().insertMany(auditLogs);

    return {
      reception: sanitizeDocument(await Receptions().findOne(receptionIdentityFilter(receptionId)).lean().exec()),
      lots,
    };
  }

  async changeLotQualityStatus(
    lotId: string,
    payload: { action?: unknown; reason?: unknown; pin?: unknown },
    actor: ActorContext,
  ) {
    const action = readString(payload?.action).toUpperCase();
    if (action !== "RELEASE" && action !== "QUARANTINE") {
      throw badRequest("INVALID_QUALITY_ACTION", "action must be RELEASE or QUARANTINE.");
    }
    const reason = readString(payload?.reason) || null;
    const actorId = readString(actor?.id);
    if (!actorId) throw badRequest("PERFORMED_BY_REQUIRED", "An authenticated actor is required.");

    const lot = sanitizeDocument(
      await ReceptionLots().findOne({ id: lotId }).lean().exec(),
    ) as Record<string, unknown> | null;
    if (!lot) throw notFound("RECEPTION_LOT_NOT_FOUND", "Reception lot not found.");
    const reception = sanitizeDocument(
      await Receptions().findOne(receptionIdentityFilter(String(lot.reception_id || ""))).lean().exec(),
    ) as Record<string, unknown> | null;
    if (!reception) throw notFound("RECEPTION_NOT_FOUND", "Reception not found.");
    if (reception.status === "ANNULE") {
      throw conflict("RECEPTION_CANCELLED", `La réception ${reception.reception_number} est annulée.`);
    }

    const currentStatus = String(lot.stock_status || "");
    if (currentStatus === "STOCK_REJETE") {
      throw conflict("LOT_REJECTED", `Le lot ${lot.lot_internal || lotId} est rejeté : son statut qualité ne peut plus changer.`);
    }

    if (action === "RELEASE") {
      if (currentStatus === "STOCK_LIBERE") return { reception, lots: await loadReceptionLots(String(reception.id)) };
      if (!reception.qc_decision) {
        throw conflict(
          "QC_INSPECTION_REQUIRED",
          `Le lot ${lot.lot_internal || lotId} n'a pas encore été inspecté : lancez le contrôle qualité de la réception.`,
        );
      }
      if (currentStatus !== "EN_QUARANTAINE") {
        throw conflict("LOT_NOT_QUARANTINED", `Seul un lot en quarantaine peut être libéré (statut actuel : ${currentStatus}).`);
      }
      const pinResult = await assertSignaturePin(actorId, readString(payload?.pin) || null, {
        action: "qc_release",
        entityId: lotId,
      });
      return this.applyLotQualityChange({
        reception,
        lotIds: [lotId],
        nextStatus: "STOCK_LIBERE",
        reason,
        actorId: pinResult.userId || actorId,
        releasePinVerified: pinResult.verified === true,
        auditAction: "LOT_RELEASED",
      });
    }

    if (!reason) {
      throw badRequest("QUARANTINE_REASON_REQUIRED", "Le motif de mise en quarantaine est obligatoire.");
    }
    if (currentStatus === "EN_QUARANTAINE") return { reception, lots: await loadReceptionLots(String(reception.id)) };
    return this.applyLotQualityChange({
      reception,
      lotIds: [lotId],
      nextStatus: "EN_QUARANTAINE",
      reason,
      actorId,
      auditAction: "LOT_QUARANTINED",
    });
  }

  /** RG-Q07 — non-conforming lab results block every lot still usable. */
  async blockReceptionForLab(receptionId: string, payload: { reason?: unknown }, actor: ActorContext) {
    const reason = readString(payload?.reason);
    if (!reason) throw badRequest("BLOCK_REASON_REQUIRED", "Le motif de blocage est obligatoire.");

    const reception = sanitizeDocument(
      await Receptions().findOne(receptionIdentityFilter(receptionId)).lean().exec(),
    ) as Record<string, unknown> | null;
    if (!reception) throw notFound("RECEPTION_NOT_FOUND", "Reception not found.");
    if (["ANNULE", "REJETE"].includes(String(reception.status || ""))) {
      throw conflict("RECEPTION_CLOSED", `La réception ${reception.reception_number} est ${reception.status === "ANNULE" ? "annulée" : "rejetée"}.`);
    }
    if (!reception.qc_decision) {
      throw conflict("QC_INSPECTION_REQUIRED", "Aucune décision QC enregistrée : les lots sont déjà en quarantaine.");
    }

    const lots = await loadReceptionLots(String(reception.id));
    const usableLotIds = lots
      .filter((lot: Record<string, unknown>) => ["STOCK_LIBERE", "NON_STOCKE"].includes(String(lot.stock_status || "")))
      .map((lot: Record<string, unknown>) => String(lot.id));

    return this.applyLotQualityChange({
      reception,
      lotIds: usableLotIds,
      nextStatus: "EN_QUARANTAINE",
      reason: `RG-Q07 résultats labo non conformes : ${reason}`,
      actorId: actor?.id || null,
      auditAction: "LAB_RETROACTIVE_BLOCK",
      headerOverrides: { qc_decision: "QUARANTAINE", lab_blocked_at: new Date().toISOString(), lab_block_reason: reason },
    });
  }

  // ── T-502 / T-503 — Record weighing + compute net + transition state ────────

  async listWeighings(lotId: string) {
    if (!lotId) throw badRequest("LOT_REQUIRED", "lotId is required.");
    const records = sanitizeDocument(
      await WeighingRecords().find({ lot_id: lotId }).sort({ created_at: 1 }).lean().exec(),
    );
    return records;
  }

  async recordWeighing(
    lotId: string,
    payload: {
      type: "GROSS" | "TARE";
      weight_kg: number;
      source?: "MANUAL" | "SCALE" | "DEVICE";
      device_ref?: string | null;
      reading_id?: string | null;
      supervisor?: string | null;
      notes?: string | null;
      manual_reason?: string | null;
    },
    actor: ActorContext,
  ) {
    if (!lotId) throw badRequest("LOT_REQUIRED", "lotId is required.");

    const weighType = payload.type === "TARE" ? "TARE" : "GROSS";
    let weightKg = Number(payload.weight_kg);
    let source = payload.source || "MANUAL";
    let deviceReading: Record<string, unknown> | null = null;

    if (payload.reading_id) {
      deviceReading = sanitizeDocument(
        await getCollectionModel("weighbridge_readings")
          .findOne({ reading_id: String(payload.reading_id) })
          .lean()
          .exec(),
      ) as Record<string, unknown> | null;
      if (!deviceReading) throw notFound("WEIGHBRIDGE_READING_NOT_FOUND", "Weighbridge reading not found.");
      if (deviceReading.consumed) throw badRequest("WEIGHBRIDGE_READING_CONSUMED", "Weighbridge reading was already consumed.");
      if (!deviceReading.stable || !deviceReading.signature_verified) {
        throw badRequest("WEIGHBRIDGE_READING_UNVERIFIED", "Weighbridge reading is not stable and signature-verified.");
      }
      if (
        deviceReading.calibration_valid_until
        && String(deviceReading.calibration_valid_until) < new Date().toISOString()
      ) {
        throw badRequest("WEIGHBRIDGE_CALIBRATION_EXPIRED", "Weighbridge calibration has expired.");
      }
      weightKg = Number(deviceReading.weight_kg);
      source = "DEVICE";
    }
    if (isNaN(weightKg) || weightKg < 0) {
      throw badRequest("INVALID_WEIGHT", "weight_kg must be ≥ 0.");
    }

    const lot = sanitizeDocument(
      await ReceptionLots().findOne({ id: lotId }).lean().exec(),
    ) as Record<string, unknown> | null;
    if (!lot) throw notFound("RECEPTION_LOT_NOT_FOUND", "Reception lot not found.");

    const reception = sanitizeDocument(
      await Receptions().findOne({ id: lot.reception_id }).lean().exec(),
    ) as Record<string, unknown> | null;
    if (reception && ["ANNULE", "REJETE"].includes(String(reception.status || ""))) {
      throw conflict(
        "RECEPTION_CLOSED",
        `La réception ${reception.reception_number || lot.reception_id} est ${reception.status === "ANNULE" ? "annulée" : "rejetée"} : aucune pesée ne peut être ajoutée.`,
      );
    }

    // Validate the resulting net before anything is persisted or a scale
    // reading is consumed: the other side is the latest recorded weighing.
    const previousWeighings = sanitizeDocument(
      await WeighingRecords().find({ lot_id: lotId }).lean().exec(),
    ) as Array<Record<string, unknown>>;
    const latestOfType = (type: string) =>
      previousWeighings
        .filter((w) => w.type === type)
        .sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")))[0];
    const grossKg = weighType === "GROSS" ? weightKg : latestOfType("GROSS") ? Number(latestOfType("GROSS")!.weight_kg) : null;
    const tareKg = weighType === "TARE" ? weightKg : latestOfType("TARE") ? Number(latestOfType("TARE")!.weight_kg) : null;
    const netKg = grossKg != null && tareKg != null ? round(grossKg - tareKg, 3) : null;
    if (netKg != null && netKg <= 0) {
      throw badRequest(
        "NET_WEIGHT_NOT_POSITIVE",
        `Poids net (${netKg} kg) ≤ 0. Vérifiez brut (${grossKg} kg) et tare (${tareKg} kg).`,
      );
    }

    // Persist weighing record
    const weighing = await prepareInsertDocument("weighing_records", {
      lot_id: lotId,
      reception_id: lot.reception_id || null,
      type: weighType,
      weight_kg: weightKg,
      source,
      device_ref: deviceReading?.device_code || payload.device_ref || null,
      reading_id: deviceReading?.reading_id || null,
      device_id: deviceReading?.device_id || null,
      stable: deviceReading?.stable ?? null,
      captured_at: deviceReading?.captured_at || null,
      calibration_valid_until: deviceReading?.calibration_valid_until || null,
      signature_verified: deviceReading?.signature_verified === true,
      supervisor: payload.supervisor || null,
      recorded_by: actor?.id || null,
      notes: payload.notes || null,
      manual_reason: payload.manual_reason || null,
    });

    if (deviceReading) {
      const claimed = await getCollectionModel("weighbridge_readings").updateOne(
        { id: deviceReading.id, consumed: { $ne: true } },
        {
          $set: {
            consumed: true,
            consumed_by_weighing_id: weighing.id,
            lot_id: lotId,
            updated_at: new Date().toISOString(),
          },
        },
      ).exec();
      if (Number(claimed.modifiedCount || 0) !== 1) {
        throw badRequest("WEIGHBRIDGE_READING_CONSUMED", "Weighbridge reading was consumed concurrently.");
      }
    }
    await WeighingRecords().create([weighing]);

    const now = new Date().toISOString();
    const lotUpdate: Record<string, unknown> = { updated_at: now };
    if (weighType === "GROSS") lotUpdate.gross_weight_kg = weightKg;
    if (weighType === "TARE") lotUpdate.tare_weight_kg = weightKg;

    if (netKg != null) {
      lotUpdate.gross_weight_kg = grossKg;
      lotUpdate.tare_weight_kg = tareKg;
      lotUpdate.net_weight_kg = netKg;
      // T-503: a draft becomes ready for QC once weighed. Any later status is
      // kept — a re-weighing is an amendment, not a return to QC.
      if (reception?.status === "BROUILLON") {
        await Receptions().updateOne(
          { id: lot.reception_id },
          { $set: { status: "EN_ATTENTE_QC", updated_at: now } },
        ).exec();
      }
    }

    await ReceptionLots().updateOne({ id: lotId }, { $set: lotUpdate }).exec();

    // Audit log
    const auditLog = await prepareInsertDocument("reception_audit_logs_v2", {
      entity_type: "LOT",
      entity_id: lotId,
      action: `WEIGHING_${weighType}`,
      actor_id: actor?.id || null,
      new_state: { weight_kg: weightKg, type: weighType, source, reading_id: deviceReading?.reading_id || null },
      performed_by: actor?.id || "system",
    });
    await ReceptionAuditLogs().create([auditLog]);

    if (netKg != null) {
      const provenance = {
        gross_kg: grossKg,
        tare_kg: tareKg,
        net_kg: netKg,
        source,
        device_code: deviceReading?.device_code ?? null,
        reading_id: deviceReading?.reading_id ?? null,
        calibration_valid_until: deviceReading?.calibration_valid_until ?? null,
        signature_verified: deviceReading?.signature_verified === true,
      };
      const chain = await lotLedgerService.getChain(lotId);
      if (chain.some((event) => event.event_type === "LOT_WEIGHED")) {
        await lotLedgerService.append({
          lotId,
          eventType: "WEIGHING_AMENDED",
          collection: "weighing_records",
          action: "INSERT",
          actorId: actor?.id || null,
          payload: provenance,
          relatedIds: [String(weighing.id)],
        });
      } else {
        await lotLifecycleService.recordStageSafe({
          lotId,
          toStage: "WEIGHED",
          collection: "weighing_records",
          actorId: actor?.id || null,
          payload: provenance,
          route: "PREMIUM_WHOLE",
        });
      }
    }

    // EPCIS ObjectEvent
    await writeEpcisObjectEvent({
      bizStep: "urn:epcglobal:cbv:bizstep:receiving",
      disposition: "urn:epcglobal:cbv:disp:in_progress",
      epcList: [String(lot.lot_internal || lot.qr_code_payload || lot.id)],
      actorId: actor?.id || null,
      entityType: "reception_lots",
      entityId: lotId,
      metadata: { weighing_type: weighType, weight_kg: weightKg, source, reading_id: deviceReading?.reading_id || null },
    });

    const updatedLot = sanitizeDocument(await ReceptionLots().findOne({ id: lotId }).lean().exec());
    return { weighing: sanitizeDocument(weighing), lot: updatedLot };
  }

  // ── T-201 / T-202 — Generate GS1 label payload + mark printed ───────────────

  async generateLotLabel(lotId: string, actor: ActorContext) {
    if (!lotId) throw badRequest("LOT_REQUIRED", "lotId is required.");

    const lot = sanitizeDocument(
      await ReceptionLots().findOne({ id: lotId }).lean().exec(),
    ) as Record<string, unknown> | null;
    if (!lot) throw notFound("RECEPTION_LOT_NOT_FOUND", "Reception lot not found.");

    const gs1 = buildGs1Payload(lot);
    const now = new Date().toISOString();

    // Mark lot label printed
    await ReceptionLots().updateOne(
      { id: lotId },
      { $set: { label_printed_at: now, label_printed_by: actor?.id || null, updated_at: now } },
    ).exec();

    // Audit
    const auditLog = await prepareInsertDocument("reception_audit_logs_v2", {
      entity_type: "LOT",
      entity_id: lotId,
      action: "LABEL_PRINTED",
      actor_id: actor?.id || null,
      new_state: { gs1_128: gs1.gs1_128, gtin14: gs1.gtin14 },
      performed_by: actor?.id || "system",
    });
    await ReceptionAuditLogs().create([auditLog]);

    // EPCIS
    await writeEpcisObjectEvent({
      bizStep: "urn:epcglobal:cbv:bizstep:receiving",
      disposition: "urn:epcglobal:cbv:disp:active",
      epcList: [`urn:epc:id:sgtin:0.${gs1.gtin14}.${gs1.lot_code}`],
      actorId: actor?.id || null,
      entityType: "reception_lots",
      entityId: lotId,
      metadata: { label_type: "GS1-128", ai_payload: gs1.ai_payload, net_weight_g: gs1.net_weight_g },
    });

    return { ...gs1, lot_id: lotId, printed_at: now };
  }

  async checkSupplierContractExpirations() {
    return checkSupplierContractExpirations();
  }
}

export const receptionsService = new ReceptionsService();
