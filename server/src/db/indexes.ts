import mongoose from "mongoose";

type IndexDefinition = {
  collection: string;
  keys: Record<string, 1 | -1>;
  options: Record<string, unknown>;
  /** Older index on the same keys, dropped only once this one exists. */
  replaces?: string;
};

const INDEXES: IndexDefinition[] = [
  { collection: "site_settings", keys: { id: 1 }, options: { unique: true, name: "id_1" } },
  {
    collection: "idempotency_commands",
    keys: { scope: 1, key: 1 },
    options: { unique: true, name: "scope_key_unique" },
  },
  {
    collection: "receptions_v2",
    keys: { client_request_id: 1 },
    // sparse still indexes null: a second row with client_request_id: null is a
    // duplicate key. Only real keys are unique; historical rows keep their null.
    options: {
      unique: true,
      name: "client_request_id_string_unique",
      partialFilterExpression: { client_request_id: { $type: "string" } },
    },
    replaces: "client_request_id_unique",
  },
  {
    collection: "receptions_v2",
    keys: { created_at: -1 },
    options: { name: "created_at_desc" },
  },
  {
    collection: "receptions_v2",
    keys: { status: 1, created_at: -1 },
    options: { name: "status_created_at" },
  },
  {
    collection: "receptions_v2",
    keys: { supplier_id: 1, created_at: -1 },
    options: { name: "supplier_created_at" },
  },
  {
    collection: "reception_lots",
    keys: { reception_id: 1 },
    options: { name: "reception_id" },
  },
  {
    collection: "stock_lots",
    keys: { reception_lot_id: 1 },
    options: { name: "reception_lot_id" },
  },
  {
    collection: "weighing_records",
    keys: { lot_id: 1, created_at: 1 },
    options: { name: "lot_created_at" },
  },
  {
    collection: "reception_drafts",
    keys: { status: 1, updated_at: -1 },
    options: { name: "status_updated_at" },
  },
  {
    collection: "scan_events",
    keys: { scan_token: 1 },
    options: { unique: true, name: "scan_token_unique" },
  },
  {
    collection: "weighbridge_readings",
    keys: { reading_key: 1 },
    options: { unique: true, name: "reading_key_unique" },
  },
  {
    collection: "lot_events",
    keys: { lot_id: 1, sequence: 1 },
    options: { unique: true, name: "lot_sequence_unique" },
  },
  {
    collection: "storage_location_movements",
    keys: { request_id: 1 },
    options: { unique: true, sparse: true, name: "request_id_unique" },
  },
  {
    collection: "stock_movements",
    keys: { request_id: 1 },
    options: { unique: true, sparse: true, name: "request_id_unique" },
  },
  {
    collection: "fumigation_sensor_readings",
    keys: { reading_key: 1 },
    options: { unique: true, sparse: true, name: "reading_key_unique" },
  },
  {
    collection: "storage_condition_readings",
    keys: { reading_key: 1 },
    options: { unique: true, sparse: true, name: "reading_key_unique" },
  },
];

/**
 * Dynamic Mongoose schemas only create a non-unique `id` index. W3 command,
 * scan and device replay protection requires real database-level uniqueness.
 *
 * Index creation is best-effort per index so one legacy duplicate does not
 * prevent the API from connecting. The affected feature will still fail safe
 * when it attempts an atomic claim.
 */
const ready = new WeakMap<object, Promise<void>>();
export const ensureTrustIndexes = async (db = mongoose.connection.db, failClosed = false) => {
  if (!db) throw new Error("MongoDB connection is not ready for index creation.");
  if (failClosed) {
    const existing = ready.get(db);
    if (existing) return existing;
    const initialization = createTrustIndexes(db, true).catch((error) => { ready.delete(db); throw error; });
    ready.set(db, initialization);
    return initialization;
  }
  return createTrustIndexes(db, false);
};

const createTrustIndexes = async (db: NonNullable<typeof mongoose.connection.db>, failClosed: boolean) => {

  for (const definition of INDEXES) {
    try {
      await db.collection(definition.collection).createIndex(
        definition.keys,
        definition.options,
      );
      if (definition.replaces) {
        await db.collection(definition.collection).dropIndex(definition.replaces).catch((error: { codeName?: string }) => {
          if (error?.codeName !== "IndexNotFound" && error?.codeName !== "NamespaceNotFound") throw error;
        });
      }
    } catch (error) {
      if (failClosed) throw error;
      const message = error instanceof Error ? error.message : String(error);
      console.error(
        `[indexes] Failed ${definition.collection}.${String(definition.options.name)}: ${message}`,
      );
    }
  }
};
