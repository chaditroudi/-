import { hasAnyRole, normalizeRolesFromMetadata } from "./authorization.js";

const WORKER_ROLES = ["operateur_reception", "operateur_nettoyage", "operateur_fumigation", "operateur_triage_ia", "operateur_conditionnement", "operateur_emballage", "magasinier_wms", "technicien_maintenance", "inspecteur_qualite"];
const SUPERVISOR_ROLES = ["administrateur_systeme", "directeur_general", "directeur_usine", "responsable_production", "responsable_qualite", "responsable_stock", "responsable_logistique", "responsable_achats", "directeur_achat", "technico_commercial", "responsable_reception", "chef_reception", "responsable_maintenance"];
const financialKey = (key: string) => {
  const normalized = key.replace(/([a-z0-9])([A-Z])/g, "$1_$2");
  return /(^|_)(costs?|costing|pricing|prices?|prix|amounts?|subtotal|discount|tax|vat|tva|ht|ttc|payable|receivable|margins?|marge|profit|profitability|revenue|salary|salaire|budget|montant|valuation|tariff|tarif|financial|finance|tnd|eur|usd|sar|fx)(_|$)/i.test(normalized)
    || /^(line|grand)_total$/i.test(normalized);
};

export const redactWorkerFinancials = (value: unknown): any => {
  if (Array.isArray(value)) return value.map(redactWorkerFinancials);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).filter(([key]) => !financialKey(key)).map(([key, entry]) => [key, redactWorkerFinancials(entry)]));
};

/** Projection at the HTTP boundary covers nested DTOs and native controllers consistently. */
export const financialVisibilityMiddleware = (req: any, res: any, next: any) => {
  const json = res.json.bind(res);
  res.json = (body: unknown) => {
    const roles = normalizeRolesFromMetadata(req.auth?.user?.user_metadata);
    return json(roles.some((role) => WORKER_ROLES.includes(role)) && !hasAnyRole(req, SUPERVISOR_ROLES)
      ? redactWorkerFinancials(body) : body);
  };
  next();
};
