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
]);

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
