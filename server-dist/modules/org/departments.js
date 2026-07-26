/**
 * Canonical plant departments for membership + approval routing.
 * Free-text labels on legacy documents are normalized via `normalizeDepartment`.
 */
export const DEPARTMENTS = [
    "stock",
    "production",
    "quality",
    "maintenance",
    "hr",
    "purchasing",
    "logistics",
    "reception",
    "finance",
    "direction",
];
export const DEPARTMENT_LABELS = {
    stock: "Stock / Magasin",
    production: "Production",
    quality: "Qualité",
    maintenance: "Maintenance",
    hr: "RH",
    purchasing: "Achats",
    logistics: "Logistique",
    reception: "Réception",
    finance: "Finance / DAF",
    direction: "Direction",
};
/** Aliases seen in UI / auto-replenish / ROLE_CONFIG.department. */
const DEPARTMENT_ALIASES = {
    stock: "stock",
    magasin: "stock",
    stockage: "stock",
    warehouse: "stock",
    production: "production",
    qualite: "quality",
    qualité: "quality",
    quality: "quality",
    maintenance: "maintenance",
    hr: "hr",
    rh: "hr",
    purchasing: "purchasing",
    achats: "purchasing",
    logistics: "logistics",
    logistique: "logistics",
    reception: "reception",
    réception: "reception",
    finance: "finance",
    daf: "finance",
    direction: "direction",
};
export const isDepartmentCode = (value) => DEPARTMENTS.includes(value);
export const normalizeDepartment = (value) => {
    if (typeof value !== "string")
        return null;
    const raw = value.trim().toLowerCase();
    if (!raw)
        return null;
    if (isDepartmentCode(raw))
        return raw;
    const compact = raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return DEPARTMENT_ALIASES[compact] ?? DEPARTMENT_ALIASES[raw] ?? null;
};
/** MES actor roles → default department when membership is missing. */
export const ROLE_DEFAULT_DEPARTMENT = {
    responsable_stock: "stock",
    magasinier: "stock",
    magasinier_wms: "stock",
    chef_production: "production",
    responsable_production: "production",
    operateur: "production",
    operateur_production: "production",
    operateur_nettoyage: "production",
    operateur_fumigation: "production",
    operateur_triage_ia: "production",
    operateur_conditionnement: "production",
    operateur_emballage: "production",
    responsable_qualite: "quality",
    controleur_qualite: "quality",
    inspecteur_qualite: "quality",
    resp_management_qualite: "quality",
    resp_qualite_haccp: "quality",
    auditeur_externe: "quality",
    responsable_maintenance: "maintenance",
    technicien_maintenance: "maintenance",
    responsable_rh: "hr",
    responsable_achats: "purchasing",
    directeur_achat: "purchasing",
    acheteur: "purchasing",
    responsable_logistique: "logistics",
    technico_commercial: "logistics",
    responsable_reception: "reception",
    chef_reception: "reception",
    operateur_reception: "reception",
    daf: "finance",
    directeur_financier: "finance",
    directeur_general: "direction",
    directeur_usine: "direction",
    direction: "direction",
    administrateur_systeme: "direction",
    admin: "direction",
};
