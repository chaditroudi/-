export const BUSINESS_ROLES = [
  'achat',
  'reception',
  'qualite',
  'magasin',
  'production',
  'export',
  'maintenance',
  'audit',
  'supplier_portal',
  'client_portal',
  'direction',
  'admin',
];

export const AUTHENTICATED = 'authenticated';

const EXTERNAL_BUSINESS_ROLES = ['audit', 'supplier_portal', 'client_portal'];

export const LEGACY_ROLE_ALIASES = {
  achat: ['achat'],
  achats: ['achat'],
  reception: ['reception'],
  qualite: ['qualite'],
  magasin: ['magasin'],
  production: ['production'],
  export: ['export'],
  maintenance: ['maintenance'],
  audit: ['audit'],
  supplier_portal: ['supplier_portal'],
  client_portal: ['client_portal'],
  direction: ['direction'],
  admin: ['admin'],

  directeur_general: ['direction', 'admin'],
  directeur_usine: ['direction', 'admin'],
  administrateur_systeme: ['admin'],

  responsable_achat: ['achat'],
  responsable_achats: ['achat'],
  directeur_achat: ['achat'],
  directeur_achats: ['achat'],
  technico_commercial: ['achat', 'export'],

  responsable_qualite: ['qualite'],
  inspecteur_qualite: ['qualite'],
  resp_management_qualite: ['qualite'],
  resp_qualite_haccp: ['qualite'],

  chef_reception: ['reception'],
  operateur_reception: ['reception'],
  responsable_reception: ['reception'],

  operateur_nettoyage: ['production'],
  operateur_fumigation: ['production'],
  operateur_triage_ia: ['production'],
  operateur_conditionnement: ['production'],
  operateur_emballage: ['production'],
  responsable_production: ['production'],

  magasinier_wms: ['magasin'],
  responsable_stock: ['magasin'],

  responsable_logistique: ['export', 'magasin'],

  responsable_maintenance: ['maintenance'],
  technicien_maintenance: ['maintenance'],

  fournisseur_externe: ['supplier_portal'],
  client_externe: ['client_portal'],
  partenaire_client_export: ['client_portal'],
  auditeur_externe: ['audit'],
};

const TABLE_ACCESS_RULES = {
  auth_users: { read: ['admin'], write: ['admin'] },
  counters: { read: ['admin'], write: ['admin'] },
  system_audit_logs: { read: ['admin', 'direction'], write: ['admin'] },

  profiles: { read: ['admin', 'direction'], write: ['admin'] },
  user_roles: { read: ['admin', 'direction'], write: ['admin'] },
  employees: { read: ['admin', 'direction', 'production', 'maintenance'], write: ['admin', 'direction'] },
  timesheets: { read: ['admin', 'direction', 'production'], write: ['admin', 'production'] },
  employee_tasks: { read: ['admin', 'direction', 'production'], write: ['admin', 'production'] },
  system_notifications: { read: AUTHENTICATED, write: ['admin'] },

  suppliers: { read: ['admin', 'direction', 'achat', 'reception', 'qualite', 'production', 'magasin', 'export', 'audit', 'supplier_portal', 'client_portal'], write: ['achat', 'admin', 'direction'] },
  materials: { read: ['admin', 'direction', 'achat', 'production', 'reception', 'qualite', 'magasin', 'export'], write: ['achat', 'admin', 'direction'] },
  purchase_requisitions: { read: ['admin', 'direction', 'achat'], write: ['achat', 'admin', 'direction'] },
  purchase_orders: { read: ['admin', 'direction', 'achat', 'supplier_portal'], write: ['achat', 'admin', 'direction'] },
  purchase_order_lines: { read: ['admin', 'direction', 'achat', 'supplier_portal'], write: ['achat', 'admin', 'direction'] },

  material_receptions: { read: ['admin', 'direction', 'reception', 'qualite', 'production'], write: ['reception', 'admin', 'direction'] },
  receptions_v2: { read: ['admin', 'direction', 'reception', 'qualite', 'production', 'audit', 'client_portal'], write: ['reception', 'qualite', 'admin', 'direction'] },
  reception_lots: { read: ['admin', 'direction', 'reception', 'qualite', 'production', 'audit', 'client_portal'], write: ['reception', 'qualite', 'admin', 'direction'] },
  reception_units: { read: ['admin', 'direction', 'reception', 'qualite', 'production', 'audit'], write: ['reception', 'admin', 'direction'] },
  weighbridge_events: { read: ['admin', 'direction', 'reception', 'qualite', 'audit'], write: ['reception', 'admin', 'direction'] },
  reception_alerts: { read: ['admin', 'direction', 'reception', 'qualite', 'production', 'audit'], write: ['reception', 'qualite', 'admin', 'direction'] },
  reception_audit_logs: { read: ['admin', 'direction', 'reception', 'qualite', 'audit'], write: ['admin', 'direction'] },
  reception_audit_logs_v2: { read: ['admin', 'direction', 'reception', 'qualite', 'audit'], write: ['admin', 'direction'] },
  reception_stock_movements: { read: ['admin', 'direction', 'reception', 'magasin', 'audit'], write: ['reception', 'magasin', 'admin', 'direction'] },

  qc_checklists: { read: ['admin', 'direction', 'qualite', 'audit'], write: ['qualite', 'admin', 'direction'] },
  qc_checklist_items: { read: ['admin', 'direction', 'qualite', 'audit'], write: ['qualite', 'admin', 'direction'] },
  qc_inspections: { read: ['admin', 'direction', 'qualite', 'audit', 'client_portal'], write: ['qualite', 'admin', 'direction'] },
  qc_check_results: { read: ['admin', 'direction', 'qualite', 'audit'], write: ['qualite', 'admin', 'direction'] },
  quality_checks: { read: ['admin', 'direction', 'qualite', 'audit'], write: ['qualite', 'admin', 'direction'] },
  quality_inspections: { read: ['admin', 'direction', 'qualite', 'audit'], write: ['qualite', 'admin', 'direction'] },
  non_conformities: { read: ['admin', 'direction', 'qualite', 'audit'], write: ['qualite', 'admin', 'direction'] },
  alerts: { read: ['admin', 'direction', 'qualite', 'production', 'magasin', 'audit', 'achat'], write: ['qualite', 'admin', 'direction'] },

  batches: { read: ['admin', 'direction', 'production', 'qualite', 'audit', 'client_portal'], write: ['production', 'qualite', 'admin', 'direction'] },
  batch_movements: { read: ['admin', 'direction', 'magasin', 'production', 'audit'], write: ['magasin', 'production', 'admin', 'direction'] },
  storage_zones: { read: ['admin', 'direction', 'magasin', 'production', 'reception', 'audit'], write: ['magasin', 'admin', 'direction'] },
  stock_locations: { read: ['admin', 'direction', 'magasin', 'audit'], write: ['magasin', 'admin', 'direction'] },
  stock_lots: { read: ['admin', 'direction', 'magasin', 'qualite', 'production', 'export', 'audit', 'client_portal'], write: ['magasin', 'qualite', 'admin', 'direction'] },
  stock_movements: { read: ['admin', 'direction', 'magasin', 'export', 'audit'], write: ['magasin', 'export', 'admin', 'direction'] },
  stock_alerts: { read: ['admin', 'direction', 'magasin', 'qualite', 'audit'], write: ['magasin', 'qualite', 'admin', 'direction'] },
  inventory_counts: { read: ['admin', 'direction', 'magasin', 'audit'], write: ['magasin', 'admin', 'direction'] },

  products: { read: ['admin', 'direction', 'production', 'magasin', 'export', 'client_portal'], write: ['production', 'magasin', 'admin', 'direction'] },
  production_orders: { read: ['admin', 'direction', 'production', 'qualite', 'audit'], write: ['production', 'admin', 'direction'] },
  production_steps: { read: ['admin', 'direction', 'production', 'qualite', 'audit'], write: ['production', 'admin', 'direction'] },
  production_audit_logs: { read: ['admin', 'direction', 'production', 'qualite', 'audit'], write: ['admin', 'direction'] },
  production_step_definitions: { read: ['admin', 'direction', 'production', 'audit'], write: ['production', 'admin', 'direction'] },

  shipment_preparations: { read: ['admin', 'direction', 'export', 'magasin', 'audit', 'client_portal'], write: ['export', 'magasin', 'admin', 'direction'] },
  shipment_lines: { read: ['admin', 'direction', 'export', 'magasin', 'audit', 'client_portal'], write: ['export', 'magasin', 'admin', 'direction'] },
};

const RPC_ACCESS_RULES = {
  suggest_lots_for_picking: ['magasin', 'export', 'production', 'admin', 'direction'],
};

const normalizeRole = (role) => String(role || '').trim();

export const normalizeRoles = (roles = []) => {
  const normalized = new Set();

  roles
    .map(normalizeRole)
    .filter(Boolean)
    .forEach((role) => {
      const aliases = LEGACY_ROLE_ALIASES[role] || [];
      if (BUSINESS_ROLES.includes(role)) {
        normalized.add(role);
      }
      aliases.forEach((alias) => normalized.add(alias));
    });

  return Array.from(normalized);
};

export const hasAnyRole = (userRoles = [], allowedRoles = []) => {
  const normalizedUserRoles = normalizeRoles(userRoles);
  return allowedRoles.some((role) => normalizedUserRoles.includes(role));
};

export const isAdminRole = (roles = []) => hasAnyRole(roles, ['admin']);

const isAuthenticatedInternalUser = (roles = []) => {
  const normalized = normalizeRoles(roles);
  return normalized.some((role) => !EXTERNAL_BUSINESS_ROLES.includes(role));
};

export const getTableAccessRule = (table) => TABLE_ACCESS_RULES[table] || { read: ['admin'], write: ['admin'] };

export const canAccessTable = (roles = [], table, action) => {
  const rule = getTableAccessRule(table);
  const allowedRoles = rule[action];
  if (!allowedRoles) return false;
  if (allowedRoles === AUTHENTICATED) {
    return isAuthenticatedInternalUser(roles);
  }
  return hasAnyRole(roles, allowedRoles);
};

export const canAccessRpc = (roles = [], rpcName) => {
  const allowedRoles = RPC_ACCESS_RULES[rpcName] || ['admin'];
  return hasAnyRole(roles, allowedRoles);
};

export const isSelfServiceRoleAllowed = (role) => {
  const normalized = normalizeRoles([role]);
  if (normalized.length === 0) return false;
  if (normalized.includes('admin') || normalized.includes('direction')) return false;
  if (normalized.includes('audit') || normalized.includes('supplier_portal') || normalized.includes('client_portal')) return false;
  return true;
};

export { TABLE_ACCESS_RULES, RPC_ACCESS_RULES };
