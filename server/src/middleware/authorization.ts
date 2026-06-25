import { badRequest, forbidden } from "../core/app-error.js";

type DbAction = "read" | "write";

const ADMIN_ROLES = new Set([
  "admin",
  "administrateur_systeme",
  "directeur_general",
  "directeur_usine",
]);

const ROLE_ALIASES: Record<string, string[]> = {
  achat: ["responsable_achats", "directeur_achat"],
  achats: ["responsable_achats", "directeur_achat"],
  responsable_achat: ["responsable_achats", "directeur_achat"],
  reception: ["responsable_reception", "chef_reception", "operateur_reception"],
  qualite: ["responsable_qualite", "inspecteur_qualite", "resp_management_qualite", "resp_qualite_haccp"],
  magasin: ["responsable_stock", "magasinier_wms"],
  stock: ["responsable_stock", "magasinier_wms"],
  production: ["responsable_production"],
  export: ["responsable_logistique", "partenaire_client_export"],
  maintenance: ["responsable_maintenance", "technicien_maintenance"],
  direction: ["directeur_general", "directeur_usine"],
  admin: ["administrateur_systeme", "admin"],
};

const RECEPTION_ROLES = [
  "responsable_reception",
  "chef_reception",
  "operateur_reception",
  "responsable_qualite",
  "inspecteur_qualite",
];

const QUALITY_ROLES = [
  "responsable_qualite",
  "inspecteur_qualite",
  "resp_management_qualite",
  "resp_qualite_haccp",
];

const STOCK_ROLES = [
  "responsable_stock",
  "magasinier_wms",
  "responsable_logistique",
];

const PURCHASING_ROLES = [
  "responsable_achats",
  "directeur_achat",
];

const PRODUCTION_ROLES = [
  "responsable_production",
  "operateur_nettoyage",
  "operateur_fumigation",
  "operateur_triage_ia",
  "operateur_conditionnement",
  "operateur_emballage",
];

const HR_ROLES = [
  "directeur_general",
  "directeur_usine",
  "administrateur_systeme",
];

export const tableWritePolicy: Record<string, string[]> = {
  suppliers: [...PURCHASING_ROLES, ...RECEPTION_ROLES],
  materials: [...PURCHASING_ROLES],
  purchase_requisitions: [...PURCHASING_ROLES, "responsable_stock"],
  purchase_orders: [...PURCHASING_ROLES],
  purchase_order_lines: [...PURCHASING_ROLES],
  purchase_order_receiving_lots: [...PURCHASING_ROLES, ...RECEPTION_ROLES, ...QUALITY_ROLES],

  receptions_v2: [...RECEPTION_ROLES],
  reception_lots: [...RECEPTION_ROLES],
  reception_units: [...RECEPTION_ROLES],
  reception_alerts: [...RECEPTION_ROLES, ...QUALITY_ROLES],
  reception_stock_movements: [...RECEPTION_ROLES, ...STOCK_ROLES],
  reception_audit_logs: [...RECEPTION_ROLES, ...QUALITY_ROLES],
  reception_audit_logs_v2: [...RECEPTION_ROLES, ...QUALITY_ROLES],
  qc_checklists: [...QUALITY_ROLES],
  qc_checklist_items: [...QUALITY_ROLES],
  qc_inspections: [...QUALITY_ROLES],
  qc_check_results: [...QUALITY_ROLES],

  stock_locations: [...STOCK_ROLES],
  stock_lots: [...STOCK_ROLES, ...QUALITY_ROLES],
  stock_movements: [...STOCK_ROLES],
  stock_alerts: [...STOCK_ROLES, ...QUALITY_ROLES],
  inventory_counts: [...STOCK_ROLES],
  shipment_preparations: [...STOCK_ROLES],
  shipment_lines: [...STOCK_ROLES],
  transport_vehicles: [...STOCK_ROLES],
  transport_drivers: [...STOCK_ROLES],
  transport_missions: [...STOCK_ROLES],
  transport_position_logs: [...STOCK_ROLES],
  products: [...STOCK_ROLES, ...PURCHASING_ROLES],
  storage_locations: [...STOCK_ROLES],
  storage_condition_readings: [...STOCK_ROLES, "responsable_maintenance", "technicien_maintenance"],
  storage_location_movements: [...STOCK_ROLES],
  storage_door_events: [...STOCK_ROLES, "responsable_maintenance", "technicien_maintenance"],
  storage_cycle_counts: [...STOCK_ROLES],

  production_orders: [...PRODUCTION_ROLES],
  production_steps: [...PRODUCTION_ROLES],
  production_step_definitions: [...PRODUCTION_ROLES],
  production_audit_logs: [...PRODUCTION_ROLES],
  quality_checks: [...QUALITY_ROLES, ...PRODUCTION_ROLES],
  quality_inspections: [...QUALITY_ROLES],
  fumigation_cycles: [...PRODUCTION_ROLES, ...QUALITY_ROLES],
  fumigation_sensor_readings: [...PRODUCTION_ROLES, ...QUALITY_ROLES],
  cleaning_cycles: [...PRODUCTION_ROLES, ...QUALITY_ROLES],
  hydration_cycles: [...PRODUCTION_ROLES, ...QUALITY_ROLES],
  triage_sessions: [...PRODUCTION_ROLES, ...QUALITY_ROLES],
  triage_quality_checks: [...PRODUCTION_ROLES, ...QUALITY_ROLES],
  triage_sublots: [...PRODUCTION_ROLES, ...QUALITY_ROLES, ...STOCK_ROLES],
  packaging_bom: [...PRODUCTION_ROLES, ...QUALITY_ROLES],
  label_templates: [...PRODUCTION_ROLES, ...QUALITY_ROLES],
  private_label_clients: [...PRODUCTION_ROLES],
  packaging_orders: [...PRODUCTION_ROLES],
  packaging_palettes: [...PRODUCTION_ROLES, ...STOCK_ROLES],
  batches: [...PRODUCTION_ROLES, ...QUALITY_ROLES],
  batch_movements: [...PRODUCTION_ROLES, ...STOCK_ROLES],
  non_conformities: [...QUALITY_ROLES],
  alerts: [...QUALITY_ROLES, ...PRODUCTION_ROLES],
  storage_zones: [...PRODUCTION_ROLES, ...STOCK_ROLES],

  employees: [...HR_ROLES],
  timesheets: [...HR_ROLES],
  employee_tasks: [...HR_ROLES, "responsable_maintenance", "responsable_production"],
  profiles: [...HR_ROLES],
  user_roles: [...HR_ROLES],
  auth_users: [...HR_ROLES],

  system_notifications: [...HR_ROLES, ...QUALITY_ROLES, ...RECEPTION_ROLES, ...STOCK_ROLES],
  system_audit_logs: [...HR_ROLES],
  counters: [...HR_ROLES],
};

export const restrictedReadTables = new Set([
  "auth_users",
  "user_roles",
  "system_audit_logs",
  "counters",
]);

const normalizeRoles = (rawRoles: unknown[]) => {
  const normalized = new Set<string>();

  rawRoles
    .map((entry) => String(entry || "").trim().toLowerCase())
    .filter(Boolean)
    .forEach((role) => {
      normalized.add(role);
      const aliases = ROLE_ALIASES[role] || [];
      aliases.forEach((aliasRole) => normalized.add(aliasRole.toLowerCase()));
    });

  return Array.from(normalized);
};

export const getRequestRoles = (req: any) => {
  const metadata = req.auth?.user?.user_metadata || {};
  const rawRoles = [
    ...(Array.isArray(metadata.roles) ? metadata.roles : []),
    ...(Array.isArray(metadata.domains) ? metadata.domains : []),
    metadata.role,
  ].filter(Boolean);
  return normalizeRoles(rawRoles);
};

export const isAdmin = (req: any) => {
  const roles = getRequestRoles(req);
  return roles.some((role) => ADMIN_ROLES.has(role));
};

export const hasAnyRole = (req: any, expectedRoles: string[]) => {
  if (isAdmin(req)) return true;
  const userRoles = new Set(getRequestRoles(req));
  return expectedRoles.some((role) => userRoles.has(role.toLowerCase()));
};

export const canReadTable = (req: any, table: string) => {
  if (isAdmin(req)) return true;
  if (!restrictedReadTables.has(table)) return true;
  return hasAnyRole(req, HR_ROLES);
};

export const canWriteTable = (req: any, table: string) => {
  if (isAdmin(req)) return true;
  const allowedRoles = tableWritePolicy[table];
  if (!allowedRoles) return false;
  return hasAnyRole(req, allowedRoles);
};

export const canAccessRpc = (req: any, name: string) => {
  if (isAdmin(req)) return true;

  if (name === "suggest_lots_for_picking") {
    return hasAnyRole(req, [...STOCK_ROLES, ...RECEPTION_ROLES]);
  }

  return false;
};

export const requireRoles = (roles: string[]) => (req: any, _res: any, next: any) => {
  if (!hasAnyRole(req, roles)) {
    return next(forbidden("You do not have permission for this operation."));
  }
  return next();
};

export const authorizeDbAction = (action: DbAction) => (req: any, _res: any, next: any) => {
  const table = String(req.body?.table || "").trim();
  if (!table) {
    return next(badRequest("TABLE_REQUIRED", "Table is required."));
  }

  if (action === "read") {
    if (!canReadTable(req, table)) {
      return next(forbidden("You do not have permission to read this resource."));
    }
    return next();
  }

  if (!canWriteTable(req, table)) {
    return next(forbidden("You do not have permission to modify this resource."));
  }
  return next();
};

export const authorizeRpc = (req: any, _res: any, next: any) => {
  const name = String(req.params?.name || "");
  if (canAccessRpc(req, name)) return next();

  return next(forbidden("Unknown or unauthorized RPC."));
};
