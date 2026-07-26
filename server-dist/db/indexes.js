import mongoose from "mongoose";
const INDEXES = [
    {
        collection: "idempotency_commands",
        keys: { scope: 1, key: 1 },
        options: { unique: true, name: "scope_key_unique" },
    },
    {
        collection: "receptions_v2",
        keys: { client_request_id: 1 },
        options: { unique: true, sparse: true, name: "client_request_id_unique" },
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
export const ensureTrustIndexes = async () => {
    const db = mongoose.connection.db;
    if (!db)
        throw new Error("MongoDB connection is not ready for index creation.");
    for (const definition of INDEXES) {
        try {
            await db.collection(definition.collection).createIndex(definition.keys, definition.options);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.error(`[indexes] Failed ${definition.collection}.${String(definition.options.name)}: ${message}`);
        }
    }
};
