/**
 * W0 — Regulated collections are the MES system-of-record surface.
 * Generic /api/db must not delete them; mutations append to the lot ledger.
 */

export const CORE_SCHEMA_COLLECTIONS = [
  "receptions_v2",
  "reception_lots",
  "reception_units",
  "qc_inspections",
  "stock_lots",
  "stock_movements",
  "fumigation_cycles",
  "triage_sessions",
  "triage_sublots",
  "production_orders",
  "packaging_palettes",
  "shipment_preparations",
] as const;

export type CoreSchemaCollection = (typeof CORE_SCHEMA_COLLECTIONS)[number];

/** Collections whose history must never be deleted via generic API. */
export const REGULATED_COLLECTIONS = new Set<string>([
  ...CORE_SCHEMA_COLLECTIONS,
  "lot_events",
  "qc_check_results",
  "fumigation_sensor_readings",
  "cleaning_cycles",
  "hydration_cycles",
  "triage_quality_checks",
  "production_steps",
  "production_lot_allocations",
  "production_output_lots",
  "packaging_orders",
  "supplier_settlements",
  "storage_location_movements",
  "weighing_records",
  "scan_events",
  "weighbridge_devices",
  "weighbridge_readings",
  "ccp_sensor_devices",
  "idempotency_commands",
  "storage_condition_readings",
  "storage_door_events",
  "system_audit_logs",
  "reception_audit_logs_v2",
  "epcis_events",
  "non_conformities",
]);

/** Append-only logs — no update, no delete via generic API. */
export const APPEND_ONLY_COLLECTIONS = new Set<string>([
  "lot_events",
  "stock_movements",
  "storage_location_movements",
  "system_audit_logs",
  "reception_audit_logs_v2",
  "fumigation_sensor_readings",
  "epcis_events",
  "weighing_records",
  "scan_events",
  "weighbridge_readings",
  "storage_condition_readings",
  "storage_door_events",
]);

export const isRegulatedCollection = (table: string) => REGULATED_COLLECTIONS.has(table);

export const isAppendOnlyCollection = (table: string) => APPEND_ONLY_COLLECTIONS.has(table);

export const isCoreSchemaCollection = (table: string): table is CoreSchemaCollection =>
  (CORE_SCHEMA_COLLECTIONS as readonly string[]).includes(table);
