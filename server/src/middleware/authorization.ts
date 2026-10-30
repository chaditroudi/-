const ADMIN_ROLES = new Set([
  "admin",
  "administrateur_systeme",
  "directeur_general",
  "directeur_usine",
]);

// Business/domain aliases → concrete application roles.
// Kept in sync with the frontend BUSINESS_ROLE_TO_APP_ROLES (src/hooks/useAuth.ts)
// so a token minted from either side resolves to the same effective roles.
const ROLE_ALIASES: Record<string, string[]> = {
  achat: ["responsable_achats", "directeur_achat"],
  achats: ["responsable_achats", "directeur_achat"],
  responsable_achat: ["responsable_achats", "directeur_achat"],
  directeur_achats: ["directeur_achat"],
  reception: ["responsable_reception", "chef_reception", "operateur_reception"],
  qualite: ["responsable_qualite", "inspecteur_qualite", "resp_management_qualite", "resp_qualite_haccp"],
  quality: ["responsable_qualite", "inspecteur_qualite", "resp_management_qualite", "resp_qualite_haccp"],
  magasin: ["responsable_stock", "magasinier_wms"],
  stock: ["responsable_stock", "magasinier_wms"],
  production: ["responsable_production"],
  export: ["responsable_logistique", "partenaire_client_export"],
  logistique: ["responsable_logistique", "partenaire_client_export"],
  logistics: ["responsable_logistique", "partenaire_client_export"],
  maintenance: ["responsable_maintenance", "technicien_maintenance"],
  direction: ["directeur_general", "directeur_usine"],
  direction_usine: ["directeur_usine"],
  direction_generale: ["directeur_general"],
  dg: ["directeur_general"],
  du: ["directeur_usine"],
  admin: ["administrateur_systeme", "admin"],
  administrateur: ["administrateur_systeme", "admin"],
  audit: ["auditeur_externe"],
  supplier_portal: ["fournisseur_externe"],
  client_portal: ["client_externe"],
  // Legacy accounts created with the generic operator role: reception intake.
  operateur: ["operateur_reception"],
};

export const RECEPTION_ROLES = [
  "responsable_reception",
  "chef_reception",
  "operateur_reception",
  "responsable_qualite",
  "inspecteur_qualite",
];

export const QUALITY_ROLES = [
  "responsable_qualite",
  "inspecteur_qualite",
  "resp_management_qualite",
  "resp_qualite_haccp",
];

export const STOCK_ROLES = [
  "responsable_stock",
  "magasinier_wms",
  "responsable_logistique",
];

export const PURCHASING_ROLES = [
  "responsable_achats",
  "directeur_achat",
];

export const PRODUCTION_ROLES = [
  "responsable_production",
  "operateur_nettoyage",
  "operateur_fumigation",
  "operateur_triage_ia",
  "operateur_conditionnement",
  "operateur_emballage",
];

export const LOGISTICS_ROLES = [
  "responsable_logistique",
  "technico_commercial",
  "partenaire_client_export",
];

export const DIRECTION_ROLES = [
  "directeur_general",
  "directeur_usine",
];

export const HR_ROLES = [
  "directeur_general",
  "directeur_usine",
  "administrateur_systeme",
];

export const MAINTENANCE_ROLES = [
  "responsable_maintenance",
  "technicien_maintenance",
];

/** Every role an account can hold. User management rejects anything else. */
export const ALL_ROLES = [
  "admin",
  "administrateur_systeme",
  "directeur_general",
  "directeur_usine",
  "responsable_production",
  "responsable_qualite",
  "inspecteur_qualite",
  "chef_reception",
  "operateur_reception",
  "operateur_nettoyage",
  "operateur_fumigation",
  "operateur_triage_ia",
  "operateur_conditionnement",
  "operateur_emballage",
  "magasinier_wms",
  "responsable_logistique",
  "responsable_achats",
  "responsable_maintenance",
  "technicien_maintenance",
  "fournisseur_externe",
  "client_externe",
  "auditeur_externe",
  "technico_commercial",
  "directeur_achat",
  "resp_management_qualite",
  "resp_qualite_haccp",
  "responsable_reception",
  "responsable_stock",
  "partenaire_client_export",
];

const NON_STAFF_ROLES = new Set([
  "fournisseur_externe",
  "client_externe",
  "partenaire_client_export",
  "auditeur_externe",
]);

/** Plant employees. External portal and audit accounts are not staff. */
export const STAFF_ROLES = ALL_ROLES.filter((role) => !NON_STAFF_ROLES.has(role));
/** The auditor reads what staff read and writes nothing. */
export const STAFF_READ_ROLES = [...STAFF_ROLES, "auditeur_externe"];

export const SUPPLIER_PORTAL_ROLE = "fournisseur_externe";

export const MASTER_DATA_ROLES = [...PURCHASING_ROLES, "technico_commercial"];
export const SUPPLIER_WRITE_ROLES = [...MASTER_DATA_ROLES, ...RECEPTION_ROLES];
export const COMMERCIAL_ROLES = ["technico_commercial", "responsable_logistique"];
export const COA_WRITE_ROLES = [...COMMERCIAL_ROLES, ...QUALITY_ROLES];
export const SHIPPING_ROLES = [...STOCK_ROLES, "technico_commercial"];
export const BRA_WRITE_ROLES = [...RECEPTION_ROLES, ...PURCHASING_ROLES];
export const MATERIAL_RECEIPT_ROLES = [...RECEPTION_ROLES, ...PURCHASING_ROLES, ...STOCK_ROLES, ...QUALITY_ROLES];
export const BATCH_WRITE_ROLES = [...PRODUCTION_ROLES, ...QUALITY_ROLES];
export const BATCH_MOVEMENT_ROLES = [...PRODUCTION_ROLES, ...STOCK_ROLES];
/** Supervisors who have the RH tab and record their team's attendance. */
export const HR_READ_ROLES = [
  ...HR_ROLES,
  "responsable_production",
  "responsable_qualite",
  "chef_reception",
  "responsable_logistique",
  "responsable_achats",
  "responsable_maintenance",
  "directeur_achat",
  "resp_management_qualite",
  "resp_qualite_haccp",
  "responsable_reception",
  "responsable_stock",
];
export const TASK_WRITE_ROLES = [...HR_ROLES, "responsable_maintenance", "responsable_production"];
export const RECALL_ROLES = [...QUALITY_ROLES, "responsable_logistique", "responsable_production"];
/** Recording a golden-thread stage by hand is a quality decision, not an operator action. */
export const STAGE_OVERRIDE_ROLES = ["responsable_qualite", "resp_qualite_haccp"];
export const AUDIT_READ_ROLES = [...HR_ROLES, "auditeur_externe"];
export const DEVICE_ADMIN_ROLES = ["responsable_maintenance"];
export const USER_ADMIN_ROLES = ["administrateur_systeme", "directeur_general", "directeur_usine"];

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

/**
 * Resolve effective roles from a decoded JWT `user_metadata` object.
 * Single source of truth used by both the HTTP request path (getRequestRoles)
 * and the SSE handshake (realtime.controller) so alias expansion never drifts.
 */
export const normalizeRolesFromMetadata = (metadata: any) => {
  const meta = metadata || {};
  const rawRoles = [
    ...(Array.isArray(meta.roles) ? meta.roles : []),
    meta.role,
  ].filter(Boolean);
  return normalizeRoles(rawRoles);
};

export const getRequestRoles = (req: any) =>
  normalizeRolesFromMetadata(req.auth?.user?.user_metadata);

/**
 * Notification "spaces" (aligned with the frontend AppTab espaces) → the roles
 * that own that space. Used to target realtime notifications to the right actors.
 * An empty list means "broadcast to everyone".
 */
export const SPACE_ROLES: Record<string, string[]> = {
  receptions: Array.from(new Set([...RECEPTION_ROLES, ...QUALITY_ROLES])),
  quality: [...QUALITY_ROLES],
  stock: [...STOCK_ROLES],
  storage: Array.from(new Set([...STOCK_ROLES, "responsable_maintenance", "technicien_maintenance"])),
  logistics: [...LOGISTICS_ROLES],
  export: Array.from(new Set([...LOGISTICS_ROLES, "technico_commercial"])),
  production: Array.from(new Set([...PRODUCTION_ROLES, ...QUALITY_ROLES])),
  packaging: Array.from(new Set([...PRODUCTION_ROLES, ...STOCK_ROLES])),
  purchasing: [...PURCHASING_ROLES],
  suppliers: Array.from(new Set([...PURCHASING_ROLES, ...RECEPTION_ROLES])),
  maintenance: Array.from(new Set([...MAINTENANCE_ROLES, ...PRODUCTION_ROLES])),
  hr: [...HR_ROLES],
  alerts: [],
  system: [],
};

export const rolesForSpace = (space?: string | null): string[] => {
  if (!space) return [];
  return SPACE_ROLES[space] ?? [];
};

/**
 * Directors, factory managers and admins have oversight of every space, so they
 * receive/see all notifications regardless of targeting.
 */
export const notificationSeesAll = (roles: string[]) =>
  roles.some((role) => ADMIN_ROLES.has(role) || DIRECTION_ROLES.includes(role));

export const isAdmin = (req: any) => {
  const roles = getRequestRoles(req);
  return roles.some((role) => ADMIN_ROLES.has(role));
};

export const hasAnyRole = (req: any, expectedRoles: string[]) => {
  if (isAdmin(req)) return true;
  const userRoles = new Set(getRequestRoles(req));
  return expectedRoles.some((role) => userRoles.has(role.toLowerCase()));
};

export const canAccessRpc = (req: any, name: string) => {
  if (isAdmin(req)) return true;

  if (name === "suggest_lots_for_picking") {
    return hasAnyRole(req, [...STOCK_ROLES, ...RECEPTION_ROLES]);
  }

  return false;
};
