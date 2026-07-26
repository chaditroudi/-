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
    stock_alerts: "stock",
    inventory_counts: "stock",
    shipment_preparations: "stock",
    shipment_lines: "stock",
    products: "stock",
    bon_expeditions: "stock",
    scan_events: "stock",
    weighing_records: "receptions",
    weighbridge_readings: "receptions",
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
    lot_events: "batches",
};
const resolveResource = (table, explicitResource) => explicitResource || COLLECTION_TO_RESOURCE[table] || table;
const clientMatchesTarget = (client, targetRoles, targetUserIds) => {
    if (targetRoles.length === 0 && targetUserIds.length === 0)
        return true;
    if (client.seesAll)
        return true;
    if (client.userId && targetUserIds.includes(client.userId))
        return true;
    return client.roles.some((role) => targetRoles.includes(role));
};
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
    const targetRoles = Array.from(new Set((event.targetRoles ?? []).map((r) => String(r || "").toLowerCase()).filter(Boolean)));
    const targetUserIds = Array.from(new Set((event.targetUserIds ?? []).map((u) => String(u || "")).filter(Boolean)));
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
        if (!clientMatchesTarget(client, targetRoles, targetUserIds))
            continue;
        client.write("db-change", payload);
    }
};
