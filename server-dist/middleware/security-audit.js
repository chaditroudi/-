import { prepareInsertDocument } from "../db/defaults.js";
import { getCollectionModel, sanitizeDocument } from "../db/dynamic-model.js";
// Collections excluded from audit logging (internal/sensitive)
const SKIP_AUDIT = new Set([
    "system_audit_logs",
    "counters",
    "sessions",
    "refresh_tokens",
]);
// Map collection names to readable module labels
const TABLE_MODULE = {
    receptions_v2: "Réception",
    reception_lots: "Réception",
    reception_units: "Réception",
    reception_stock_movements: "Réception",
    qc_inspections: "Contrôle Qualité",
    qc_check_results: "Contrôle Qualité",
    qc_checklists: "Contrôle Qualité",
    fumigation_cycles: "Phase 2 · Fumigation",
    cleaning_cycles: "Phase 2 · Nettoyage",
    hydration_cycles: "Phase 2 · Hydratation",
    triage_sessions: "Phase 2 · Triage",
    triage_sublots: "Phase 2 · Triage",
    triage_quality_checks: "Phase 2 · Triage",
    packaging_orders: "Conditionnement",
    packaging_palettes: "Conditionnement",
    packaging_bom: "Conditionnement",
    stock_lots: "Stock",
    stock_movements: "Stock",
    stock_alerts: "Stock",
    stock_locations: "Stock",
    storage_zones: "Stockage",
    storage_locations: "Stockage",
    storage_location_movements: "Stockage",
    storage_condition_readings: "Stockage",
    storage_door_events: "Stockage",
    storage_cycle_counts: "Stockage",
    suppliers: "Fournisseurs",
    purchase_orders: "Achats",
    purchase_requisitions: "Achats",
    purchase_order_lines: "Achats",
    purchase_order_receiving_lots: "Achats",
    material_receptions: "Achats",
    employees: "RH",
    timesheets: "RH",
    employee_tasks: "RH",
    shipment_preparations: "Logistique",
    shipment_lines: "Logistique",
    transport_vehicles: "Transport",
    transport_drivers: "Transport",
    transport_missions: "Transport",
    transport_position_logs: "Transport",
    system_notifications: "Alertes",
    production_orders: "Production",
    production_steps: "Production",
    products: "Catalogue",
    materials: "Matières",
    batches: "Lots",
    batch_movements: "Lots",
    non_conformities: "Non-Conformités",
    inventory_counts: "Inventaire",
    site_settings: "Paramètres",
    profiles: "Utilisateurs",
};
const inferDbAction = (req) => {
    const path = String(req.path || req.originalUrl || "").toLowerCase();
    if (path.includes("/db/query"))
        return "read";
    if (path.includes("/db/insert") || path.includes("/db/update") || path.includes("/db/delete"))
        return "write";
    return null;
};
const extractRoles = (req) => {
    const metadata = req.auth?.user?.user_metadata || {};
    const roles = Array.isArray(metadata.roles) ? metadata.roles : [];
    const domains = Array.isArray(metadata.domains) ? metadata.domains : [];
    const role = metadata.role ? [metadata.role] : [];
    return sanitizeDocument([...roles, ...domains, ...role].map((entry) => String(entry || "")));
};
const extractUserRolesFromMetadata = (metadata) => {
    const roles = Array.isArray(metadata?.roles) ? metadata.roles : [];
    const role = metadata?.role ? [metadata.role] : [];
    return [...roles, ...role].map(String).filter(Boolean);
};
// Extract a compact snapshot (key identifiers only, never passwords/tokens)
const toSnapshot = (rows) => {
    if (!Array.isArray(rows))
        return [];
    return rows.slice(0, 10).map((r) => ({
        id: r?.id ?? null,
        status: r?.status ?? r?.qc_decision ?? null,
        label: r?.number ?? r?.order_number ?? r?.reception_number ?? r?.lot_number ??
            r?.session_number ?? r?.cycle_number ?? r?.name ?? r?.code ?? null,
    }));
};
const writeAuditEntry = async (entry) => {
    try {
        const model = getCollectionModel("system_audit_logs");
        const doc = await prepareInsertDocument("system_audit_logs", entry);
        await model.create([doc]);
    }
    catch {
        // Fire-and-forget — audit failure must never break the main operation
    }
};
export const appendDeniedAccessAudit = async (req, error) => {
    await writeAuditEntry({
        event_type: "SECURITY_DENIED",
        severity: "warning",
        action: "AUTHZ_DENIED",
        module: TABLE_MODULE[req.body?.table ?? ""] ?? "Système",
        message: error?.message || "Access denied by policy.",
        request_id: req.requestId || null,
        method: req.method || null,
        route: req.originalUrl || req.path || null,
        ip_address: req.ip || null,
        user_agent: req.headers?.["user-agent"] || null,
        user_id: req.auth?.user?.id || null,
        user_email: req.auth?.user?.email || null,
        user_name: req.auth?.user?.user_metadata?.name || null,
        user_roles: extractRoles(req),
        table: req.body?.table || null,
        affected_ids: [],
        policy_context: {
            table: req.body?.table || null,
            rpc: req.params?.name || null,
            db_action: inferDbAction(req),
        },
    });
};
export const appendActionAudit = async (req, action, table, after, before) => {
    if (SKIP_AUDIT.has(table))
        return;
    const metadata = req.auth?.user?.user_metadata || {};
    await writeAuditEntry({
        event_type: "DATA_CHANGE",
        severity: "info",
        action,
        module: TABLE_MODULE[table] ?? table,
        table,
        message: `${action} on ${table} (${after?.length ?? 0} record${(after?.length ?? 0) !== 1 ? "s" : ""})`,
        request_id: req.requestId || null,
        method: req.method || null,
        route: req.originalUrl || req.path || null,
        ip_address: req.ip || null,
        user_agent: req.headers?.["user-agent"] || null,
        user_id: req.auth?.user?.id || null,
        user_email: req.auth?.user?.email || null,
        user_name: metadata?.name || null,
        user_roles: extractUserRolesFromMetadata(metadata),
        affected_ids: (after ?? []).map((r) => r?.id).filter(Boolean),
        after_snapshot: toSnapshot(after ?? []),
        before_snapshot: before ? toSnapshot(before) : null,
    });
};
export const appendAuthAudit = async (event_type, userId, email, name, roles, req, message) => {
    await writeAuditEntry({
        event_type,
        severity: event_type === "AUTH_FAILED" ? "warning" : "info",
        action: event_type,
        module: "Authentification",
        table: null,
        message: message ?? `${event_type} — ${email ?? "inconnu"}`,
        request_id: req?.requestId || null,
        method: req?.method || null,
        route: req?.originalUrl || req?.path || null,
        ip_address: req?.ip || null,
        user_agent: req?.headers?.["user-agent"] || null,
        user_id: userId,
        user_email: email,
        user_name: name,
        user_roles: roles,
        affected_ids: [],
        after_snapshot: null,
        before_snapshot: null,
    });
};
