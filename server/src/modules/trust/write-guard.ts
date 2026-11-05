import { badRequest, forbidden } from "../../core/app-error.js";
import { validateCoreDocument } from "./core-schemas.js";
import {
  isAppendOnlyCollection,
  isCoreSchemaCollection,
  isRegulatedCollection,
} from "./regulated-collections.js";

export type MutationAction = "insert" | "update" | "delete";

const DOMAIN_ONLY_INSERTS = new Set([
  "lot_events",
  "stock_movements",
  "storage_location_movements",
  "weighing_records",
  "scan_events",
  "weighbridge_readings",
  "idempotency_commands",
  "fumigation_sensor_readings",
  "storage_condition_readings",
  "storage_door_events",
  "qc_inspections",
  "qc_check_results",
]);

const DOMAIN_ONLY_UPDATES = new Set(["qc_inspections", "qc_check_results"]);

/** A QC decision lives on an inspection; a batch has no decision of its own to write. */
const BATCH_QC_FIELDS = ["qc_decision", "qc_decision_date", "qc_decision_by"];

/** Set by QC, reception or stock movements; a stock route can only move and describe a lot. */
const STOCK_LOT_DOMAIN_FIELDS = [
  "status", "initial_quantity", "current_quantity", "reception_lot_id", "entry_lot_id",
  "qc_validated_by", "qc_validated_at", "validated_by", "validated_at", "released_by", "released_at",
];
const STOCK_LOT_LINK_FIELDS = STOCK_LOT_DOMAIN_FIELDS.filter((field) => !["status", "initial_quantity", "current_quantity"].includes(field));

/**
 * Generic /api/db write policy for W0 trust.
 * - Append-only collections: no update, no delete
 * - Regulated collections: no delete
 * - Core collections: schema validation on insert/update
 */
export const assertGenericDbMutationAllowed = (
  table: string,
  action: MutationAction,
  options?: { trustedInternal?: boolean },
) => {
  if (options?.trustedInternal) return;

  if (action === "insert" && DOMAIN_ONLY_INSERTS.has(table)) {
    throw forbidden(`${table} is writable only by its trusted domain service.`);
  }

  if (action === "update" && DOMAIN_ONLY_UPDATES.has(table)) {
    throw forbidden(`${table} is writable only by its trusted domain service.`);
  }

  if (isAppendOnlyCollection(table) && (action === "update" || action === "delete")) {
    throw badRequest(
      "IMMUTABLE_LOG",
      `${table} is an append-only history log and cannot be ${action === "delete" ? "deleted" : "updated"}.`,
    );
  }

  if (isRegulatedCollection(table) && action === "delete") {
    throw badRequest(
      "REGULATED_DELETE_FORBIDDEN",
      `${table} is a regulated MES record and cannot be deleted via the generic API.`,
    );
  }
};

export const assertStockLotWrite = (
  action: "insert" | "update",
  doc: Record<string, unknown>,
  before?: Record<string, unknown>,
) => {
  if (action === "insert") {
    const status = String(doc.status ?? "QUARANTINE");
    const linked = STOCK_LOT_LINK_FIELDS.some((field) => Boolean(doc[field]));
    if (status !== "QUARANTINE" || linked) {
      throw badRequest(
        "STOCK_LOT_DOMAIN_ONLY",
        "Le statut, les quantités et le lien de réception d'un lot de stock se modifient par le contrôle qualité ou un mouvement de stock.",
      );
    }
    const qty = Number(doc.current_quantity ?? doc.initial_quantity ?? 0);
    if (Number.isFinite(qty) && qty > 0) {
      throw badRequest(
        "STOCK_LOT_ORPHAN_QTY",
        "Un lot de stock sans lien de réception ne peut pas être créé avec une quantité. Utilisez la réception / QC.",
      );
    }
    return;
  }

  const changed =
    before !== undefined &&
    STOCK_LOT_DOMAIN_FIELDS.some((field) => String(doc[field] ?? "") !== String(before[field] ?? ""));
  if (changed) {
    throw badRequest(
      "STOCK_LOT_DOMAIN_ONLY",
      "Le statut, les quantités et le lien de réception d'un lot de stock se modifient par le contrôle qualité ou un mouvement de stock.",
    );
  }
};

export const assertBatchWrite = (doc: Record<string, unknown>, before?: Record<string, unknown>) => {
  if (BATCH_QC_FIELDS.some((field) => String(doc[field] ?? "") !== String(before?.[field] ?? ""))) {
    throw badRequest("QC_DECISION_DOMAIN_ONLY", "Une décision qualité s'enregistre par le contrôle qualité.");
  }
};

export const assertCoreSchema = (table: string, docs: Record<string, unknown>[]) => {
  if (!isCoreSchemaCollection(table)) return;

  for (const doc of docs) {
    const result = validateCoreDocument(table, doc);
    if (!result.ok) {
      throw badRequest("CORE_SCHEMA_VIOLATION", `Invalid ${table} document.`, {
        errors: result.errors,
      });
    }
  }
};
