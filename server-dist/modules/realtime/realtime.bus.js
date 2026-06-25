import { randomUUID } from "node:crypto";
// Maps MongoDB collection names → REST API resource names exposed to the frontend.
// The frontend maps resource names to RTK Query tag types — it never sees collection names.
const COLLECTION_TO_RESOURCE = {
    receptions_v2: "receptions",
    reception_lots: "receptions",
    reception_units: "receptions",
    reception_alerts: "receptions",
    reception_stock_movements: "receptions",
    qc_inspections: "receptions",
    qc_checklists: "receptions",
    reception_audit_logs_v2: "receptions",
    suppliers: "suppliers",
    materials: "materials",
    stock_lots: "stock",
    stock_movements: "stock",
    stock_summary: "stock",
    stock_locations: "stock",
    storage_zones: "storage",
    storage_locations: "storage",
    storage_condition_readings: "storage",
    storage_door_events: "storage",
    storage_cycle_counts: "storage",
    "module3-storage-zones": "storage",
    "module3-storage-locations": "storage",
    batches: "batches",
    batch_movements: "batches",
    alerts: "batches",
    non_conformities: "batches",
    storage_inspection_batches: "batches",
    production_orders: "production",
    production_steps: "production",
    fumigation_cycles: "production",
    cleaning_cycles: "production",
    hydration_cycles: "production",
    triage_sessions: "production",
    triage_quality_checks: "production",
    system_notifications: "notifications",
    system_audit_logs: "notifications",
};
const resolveResource = (table, explicitResource) => explicitResource || COLLECTION_TO_RESOURCE[table] || table;
const clients = new Map();
let sequence = 0;
const nextEventId = () => {
    sequence += 1;
    return `${Date.now()}-${sequence}`;
};
export const createRealtimeClientId = () => randomUUID();
export const addRealtimeClient = (client) => {
    clients.set(client.id, client);
};
export const removeRealtimeClient = (clientId) => {
    clients.delete(clientId);
};
export const getRealtimeClientCount = () => clients.size;
export const closeAllClients = () => {
    for (const client of clients.values()) {
        try {
            client.end();
        }
        catch { }
    }
    clients.clear();
};
export const publishRealtimeDbChange = (event) => {
    const resource = resolveResource(event.table, event.resource);
    // relatedResources: deduplicate resource names for all related tables
    const relatedResources = Array.from(new Set((event.relatedTables ?? []).map((t) => resolveResource(t)))).filter((r) => r !== resource);
    const payload = {
        id: nextEventId(),
        type: event.type || "db_change",
        at: event.at || new Date().toISOString(),
        resource,
        relatedResources,
        action: event.action,
        actorId: event.actorId || null,
        rowIds: event.rowIds || [],
        rows: event.rows || [],
    };
    for (const client of clients.values()) {
        client.write("db-change", payload);
    }
};
