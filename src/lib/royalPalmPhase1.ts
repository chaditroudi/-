import type { Supplier } from "@/types/mes";
import type { StorageZone } from "@/types/batch";

export type SupplierStatus =
  | "active"
  | "inactive"
  | "pending_approval"
  | "blocked"
  | "archived";

export type SupplierCertificationName =
  | "GlobalG.A.P."
  | "Bio UE"
  | "Bio Tunisie"
  | "Fair Trade"
  | "Aucune";

export interface SupplierCertification {
  name: SupplierCertificationName;
  validUntil?: string | null;
}

export interface ReceptionDraftSignals {
  declaredWeightGapPercent: number | null;
  declaredWeightAlert: "none" | "warning" | "critical";
  temperatureAlert: "none" | "critical";
  recommendedStatus: "BROUILLON" | "EN_ATTENTE_QC" | "BLOQUE";
  transportDurationHours: number | null;
}

export interface ReceptionTimelineInput {
  gateArrivalAt?: string | null;
  grossWeightCapturedAt?: string | null;
  unloadingStartedAt?: string | null;
  unloadingCompletedAt?: string | null;
  tareWeightCapturedAt?: string | null;
  validatedAt?: string | null;
}

export interface ReceptionTimelineMetrics {
  grossToValidationMinutes: number | null;
  unloadingDurationMinutes: number | null;
  totalReceptionMinutes: number | null;
  delayedOver60Minutes: boolean;
}

export interface QcInspectionDraft {
  humidity: [number, number, number];
  calibers: number[];
  insectsPercent: number;
  moldPercent: number;
  fermentationPercent: number;
  mechanicalDamagePercent: number;
  crystallizationPercent: number;
  discolorationPercent: number;
  tasteScore: number;
  textureScore: number;
  appearanceScore: number;
}

export interface QcScoreBreakdown {
  humidityAverage: number;
  caliberAverage: number;
  caliberStdDev: number;
  organolepticAverage: number;
  humidityScore: number;
  caliberScore: number;
  insectsScore: number;
  moldFermentationScore: number;
  organolepticScore: number;
  otherDefectsScore: number;
  finalScore: number;
  classification: "EXTRA" | "CATEGORIE_I" | "CATEGORIE_II" | "REJETE";
  automaticReject: boolean;
  automaticRejectReasons: string[];
  recommendedDecision: "ACCEPTE" | "QUARANTAINE" | "REJETE";
}

export interface StorageZoneSeed {
  code: string;
  name: string;
  zone_type: StorageZone["zone_type"];
  capacity_kg: number;
  temperature_min: number | null;
  temperature_max: number | null;
  humidity_min: number | null;
  humidity_max: number | null;
  notes: string;
}

const round = (value: number, digits = 1) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const safeDiffMinutes = (from?: string | null, to?: string | null) => {
  if (!from || !to) return null;
  const left = new Date(from);
  const right = new Date(to);
  if (Number.isNaN(left.getTime()) || Number.isNaN(right.getTime())) return null;
  return Math.max(0, round((right.getTime() - left.getTime()) / (1000 * 60), 1));
};

const daysBetween = (from?: string | null, to?: string) => {
  if (!from) return null;
  const left = new Date(from);
  const right = new Date(to || new Date().toISOString());
  if (Number.isNaN(left.getTime()) || Number.isNaN(right.getTime())) return null;
  return Math.floor((right.getTime() - left.getTime()) / (1000 * 60 * 60 * 24));
};

const isCertificationBio = (name: string) => name === "Bio UE" || name === "Bio Tunisie";

export const ROYAL_PALM_REGION_CODES = [
  { value: "Tozeur", code: "TOZ", label: "Tozeur (TOZ)" },
  { value: "Kebili", code: "KEB", label: "Kebili (KEB)" },
  { value: "Gabes", code: "GAB", label: "Gabes (GAB)" },
  { value: "Gafsa", code: "GAF", label: "Gafsa (GAF)" },
];

export const ROYAL_PALM_VARIETIES = [
  "Deglet Nour",
  "Allig",
  "Khouat Allig",
  "Kenta",
  "Arechti",
  "Melange",
  "Autre",
];

export const ROYAL_PALM_PRESENTATIONS = [
  "En caisses",
  "En regimes",
  "En vrac",
  "Melange",
];

export const ROYAL_PALM_MATURITY_STAGES = [
  { value: "Khalal", label: "Khalal" },
  { value: "Rutab", label: "Rutab" },
  { value: "Tamar", label: "Tamar" },
];

export const ROYAL_PALM_HARVEST_METHODS = [
  { value: "Manuelle traditionnelle", label: "Manuelle traditionnelle" },
  { value: "Semi-mecanique", label: "Semi-mecanique" },
  { value: "Mecanique", label: "Mecanique" },
];

export const ROYAL_PALM_TRANSPORT_CONDITIONS = ["Bache", "Non bache", "Refrigere"];

export const ROYAL_PALM_VISUAL_STATES = ["Bon", "Moyen", "Mauvais"];

export const ROYAL_PALM_RECEPTION_STEPS = [
  { code: "ARRIVEE_CAMION", label: "Arrivee camion", owner: "Gardien", targetMinutes: 1 },
  { code: "PESEE_BRUT", label: "Pesee brut", owner: "Operateur reception", targetMinutes: 2 },
  { code: "DECHARGEMENT", label: "Dechargement", owner: "Manutentionnaires", targetMinutes: 30 },
  { code: "PESEE_TARE", label: "Pesee tare", owner: "Operateur reception", targetMinutes: 2 },
  { code: "SAISIE_DONNEES", label: "Saisie donnees", owner: "Operateur reception", targetMinutes: 5 },
  { code: "CONTROLE_RAPIDE", label: "Controle rapide", owner: "Operateur reception", targetMinutes: 2 },
  { code: "GENERATION_LOT", label: "Generation LOT-ID", owner: "Systeme", targetMinutes: 1 },
  { code: "ETIQUETAGE", label: "Etiquetage QR/RFID", owner: "Operateur reception", targetMinutes: 3 },
  { code: "AFFECTATION_ZONE", label: "Affectation zone", owner: "Operateur reception", targetMinutes: 1 },
  { code: "NOTIFICATION_QUALITE", label: "Notification qualite", owner: "Systeme", targetMinutes: 0 },
  { code: "VALIDATION", label: "Validation", owner: "Operateur reception", targetMinutes: 1 },
];

export const normalizeSupplierStatus = (supplier: Partial<Supplier>): SupplierStatus => {
  const explicitStatus = supplier.supplier_status;
  if (explicitStatus) return explicitStatus;
  if (supplier.is_active === false) return "inactive";
  return "pending_approval";
};

export const getSupplierStatusLabel = (status: SupplierStatus) =>
  ({
    active: "Actif",
    inactive: "Inactif",
    pending_approval: "En cours d'agrement",
    blocked: "Bloque",
    archived: "Archive",
  })[status];

export const getSupplierStatusClassName = (status: SupplierStatus) =>
  ({
    active: "bg-green-100 text-green-800 border-green-200",
    inactive: "bg-slate-100 text-slate-700 border-slate-200",
    pending_approval: "bg-amber-100 text-amber-800 border-amber-200",
    blocked: "bg-red-100 text-red-800 border-red-200",
    archived: "bg-zinc-100 text-zinc-600 border-zinc-200",
  })[status];

export const getSupplierScoreTone = (score: number) => {
  if (score >= 85) return "excellent";
  if (score >= 60) return "watch";
  return "risk";
};

export const computeSupplierAlerts = (supplier: Partial<Supplier>) => {
  const alerts: string[] = [];
  const score = Number(supplier.quality_score ?? supplier.rating ?? 0);
  const deliveryScore = Number(supplier.delivery_reliability_score ?? 0);
  const traceabilityScore = Number(supplier.traceability_score ?? 0);
  const rejectionRate = Number(supplier.rejection_rate ?? 0);
  const contractDaysLeft = daysBetween(new Date().toISOString(), supplier.contract_end_date);
  const daysSinceLastDelivery = daysBetween(supplier.last_delivery_date);
  const nextEvaluationDays = daysBetween(new Date().toISOString(), supplier.next_evaluation_date);

  if (score > 0 && score < 60) {
    alerts.push("Score fournisseur sous 60/100");
  }

  if (deliveryScore > 0 && deliveryScore < 60) {
    alerts.push("Fiabilite livraison sous 60/100");
  }

  if (traceabilityScore > 0 && traceabilityScore < 60) {
    alerts.push("Tracabilite fournisseur insuffisante");
  }

  if (rejectionRate > 20) {
    alerts.push("Taux de rejet superieur a 20%");
  }

  if (contractDaysLeft !== null && contractDaysLeft <= 30 && contractDaysLeft >= 0) {
    alerts.push(`Contrat expire dans ${contractDaysLeft} jour(s)`);
  }

  if (daysSinceLastDelivery !== null && daysSinceLastDelivery > 18 * 30) {
    alerts.push("Aucune livraison depuis plus de 18 mois");
  }

  if (supplier.identification_status && supplier.identification_status !== "verified") {
    alerts.push("Identification fournisseur non verifiee");
  }

  if (supplier.compliance_status === "non_compliant") {
    alerts.push("Conformite fournisseur non valide");
  }

  if (nextEvaluationDays !== null && nextEvaluationDays <= 14 && nextEvaluationDays >= 0) {
    alerts.push(`Evaluation fournisseur attendue dans ${nextEvaluationDays} jour(s)`);
  }

  return alerts;
};

export const getSupplierQualificationLabel = (status?: Supplier["qualification_status"]) =>
  ({
    prospect: "Prospect",
    qualified: "Qualifie",
    approved: "Agreé",
    suspended: "Suspendu",
    blacklisted: "Liste noire",
  })[status || "prospect"];

export const getSupplierComplianceLabel = (status?: Supplier["compliance_status"]) =>
  ({
    compliant: "Conforme",
    warning: "A surveiller",
    non_compliant: "Non conforme",
  })[status || "warning"];

export const getSupplierComplianceClassName = (status?: Supplier["compliance_status"]) =>
  ({
    compliant: "bg-emerald-100 text-emerald-800 border-emerald-200",
    warning: "bg-amber-100 text-amber-800 border-amber-200",
    non_compliant: "bg-red-100 text-red-800 border-red-200",
  })[status || "warning"];

/** Legacy composite score — kept for backwards compat. Prefer computeSupplierScoreM1. */
export const computeSupplierCompositeScore = (supplier: Partial<Supplier>) => {
  const quality = Number(supplier.quality_score ?? supplier.rating ?? 0);
  const delivery = Number(supplier.delivery_reliability_score ?? quality);
  const traceability = Number(supplier.traceability_score ?? quality);
  const rejectionPenalty = Math.min(100, Number(supplier.rejection_rate ?? 0) * 2);
  return round(Math.max(0, quality * 0.45 + delivery * 0.25 + traceability * 0.2 + (100 - rejectionPenalty) * 0.1), 1);
};

// ─── M1 Royal Palm scoring — exact §1.2 formula ────────────────────────────

export interface SupplierScoreM1Breakdown {
  /** 40% — qualité des lots (Extra=100, Cat.I=80, Cat.II=60, Rejeté=0) */
  qualityScore: number;
  /** 20% — (1 - taux_rejet/100) × 100 */
  rejectionScore: number;
  /** 15% — respect des quantités annoncées */
  quantityScore: number;
  /** 15% — % livraisons dans le délai ±1 jour */
  punctualityScore: number;
  /** 10% — % livraisons avec BL complet */
  documentScore: number;
  finalScore: number;
  /** excellent ≥85 · good 70-84 · watch 60-69 · risk <60 */
  grade: "excellent" | "good" | "watch" | "risk";
  /** true when rejection_rate > 20 % — triggers RG-F03 auto-block */
  autoBlockTriggered: boolean;
}

/**
 * Implements the Royal Palm Phase-1 §1.2 supplier scoring algorithm.
 *
 * The five criteria map to existing supplier fields:
 *   quality_score       → qualité lots (40 %)
 *   rejection_rate      → taux de rejet (20 %)
 *   delivery_reliability_score → quantités + ponctualité (15 % + 15 %)
 *   traceability_score  → documents complets (10 %)
 */
export const computeSupplierScoreM1 = (supplier: Partial<Supplier>): SupplierScoreM1Breakdown => {
  const rawQuality    = Math.min(100, Math.max(0, Number(supplier.quality_score ?? supplier.rating ?? 0)));
  const rejectionRate = Math.min(100, Math.max(0, Number(supplier.rejection_rate ?? 0)));
  const reliability   = Math.min(100, Math.max(0, Number(supplier.delivery_reliability_score ?? rawQuality)));
  const traceability  = Math.min(100, Math.max(0, Number(supplier.traceability_score ?? rawQuality)));

  const qualityScore     = rawQuality;
  const rejectionScore   = (1 - rejectionRate / 100) * 100;
  const quantityScore    = reliability;
  const punctualityScore = reliability;
  const documentScore    = traceability;

  const finalScore = round(
    qualityScore     * 0.40 +
    rejectionScore   * 0.20 +
    quantityScore    * 0.15 +
    punctualityScore * 0.15 +
    documentScore    * 0.10,
    1,
  );

  const grade: SupplierScoreM1Breakdown["grade"] =
    finalScore >= 85 ? "excellent" :
    finalScore >= 70 ? "good" :
    finalScore >= 60 ? "watch" : "risk";

  return {
    qualityScore,
    rejectionScore,
    quantityScore,
    punctualityScore,
    documentScore,
    finalScore,
    grade,
    autoBlockTriggered: rejectionRate > 20,
  };
};

export const getActiveSupplierContract = (supplier: Partial<Supplier>) => {
  const contracts = supplier.contract_records || [];
  const now = new Date().setHours(0, 0, 0, 0);
  return contracts.find((contract) => {
    if (contract.status !== "active") return false;
    if (!contract.end_date) return true;
    return new Date(contract.end_date).getTime() >= now;
  });
};

export const hasValidBioCertification = (supplier?: Partial<Supplier> | null) => {
  if (!supplier?.certifications?.length) return false;
  return supplier.certifications.some((certification) => {
    if (!isCertificationBio(certification.name)) return false;
    if (!certification.validUntil) return true;
    return new Date(certification.validUntil).getTime() >= new Date().setHours(0, 0, 0, 0);
  });
};

export const computeReceptionDraftSignals = (input: {
  netWeightKg: number;
  declaredWeightKg?: number | null;
  arrivalTemperatureC?: number | null;
  departureTime?: string | null;
  actualArrivalDate?: string | null;
  bioDeclared?: boolean;
  supplier?: Partial<Supplier> | null;
}): ReceptionDraftSignals => {
  const declaredWeightGapPercent =
    input.declaredWeightKg && input.declaredWeightKg > 0
      ? round((Math.abs(input.netWeightKg - input.declaredWeightKg) / input.declaredWeightKg) * 100, 1)
      : null;

  const declaredWeightAlert =
    declaredWeightGapPercent === null
      ? "none"
      : declaredWeightGapPercent > 10
        ? "critical"
        : declaredWeightGapPercent > 3
          ? "warning"
          : "none";

  const temperatureAlert =
    typeof input.arrivalTemperatureC === "number" && input.arrivalTemperatureC > 35 ? "critical" : "none";

  let transportDurationHours: number | null = null;
  if (input.departureTime && input.actualArrivalDate) {
    const arrivalDate = new Date(input.actualArrivalDate);
    const [hours, minutes] = input.departureTime.split(":").map(Number);
    if (!Number.isNaN(arrivalDate.getTime()) && !Number.isNaN(hours) && !Number.isNaN(minutes)) {
      const departureDate = new Date(arrivalDate);
      departureDate.setHours(hours, minutes, 0, 0);
      if (departureDate.getTime() > arrivalDate.getTime()) {
        departureDate.setDate(departureDate.getDate() - 1);
      }
      transportDurationHours = round((arrivalDate.getTime() - departureDate.getTime()) / (1000 * 60 * 60), 1);
    }
  }

  const hasBioMismatch = Boolean(input.bioDeclared && !hasValidBioCertification(input.supplier));
  const recommendedStatus =
    declaredWeightAlert === "critical" || temperatureAlert === "critical" || hasBioMismatch
      ? "BLOQUE"
      : "EN_ATTENTE_QC";

  return {
    declaredWeightGapPercent,
    declaredWeightAlert,
    temperatureAlert,
    recommendedStatus,
    transportDurationHours,
  };
};

export const getRoyalPalmRegionCode = (region?: string | null) => {
  const normalized = String(region || "").trim().toLowerCase();
  const match = ROYAL_PALM_REGION_CODES.find(({ value }) => value.toLowerCase() === normalized);
  return match?.code || "OTH";
};

export const buildRoyalPalmLotPreview = (input: {
  supplierCode?: string | null;
  region?: string | null;
  date?: string | null;
  sequence?: string | null;
}) => {
  const supplierCode = String(input.supplierCode || "C000")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 4) || "C000";
  const date = input.date ? new Date(input.date) : new Date();
  const dateKey = Number.isNaN(date.getTime())
    ? "AAAAMMJJ"
    : `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;

  return `RP-${getRoyalPalmRegionCode(input.region)}-${supplierCode}-${dateKey}-${input.sequence || "XXX"}`;
};

export const recommendReceptionStorageZone = (input: {
  arrivalTemperatureC?: number | null;
  activeReceptions?: Array<{ status?: string | null; storage_zone_code?: string | null }>;
  requestedZone?: string | null;
}) => {
  if (input.requestedZone) return input.requestedZone;
  if (typeof input.arrivalTemperatureC === "number" && input.arrivalTemperatureC > 35) {
    return "ZONE_QUARANTAINE";
  }

  const candidateZones = ["ZR-01", "ZR-07", "SB-01"];
  const loads = candidateZones.map((zone) => ({
    zone,
    load: (input.activeReceptions || []).filter((reception) => {
      return reception.storage_zone_code === zone && ["BROUILLON", "EN_ATTENTE_QC", "EN_QC", "BLOQUE"].includes(String(reception.status || ""));
    }).length,
  }));

  loads.sort((left, right) => left.load - right.load);
  return loads[0]?.zone || "ZR-01";
};

export const computeReceptionTimelineMetrics = (
  input: ReceptionTimelineInput,
): ReceptionTimelineMetrics => {
  const grossToValidationMinutes = safeDiffMinutes(input.grossWeightCapturedAt, input.validatedAt);
  const unloadingDurationMinutes = safeDiffMinutes(input.unloadingStartedAt, input.unloadingCompletedAt);
  const totalReceptionMinutes = safeDiffMinutes(input.gateArrivalAt, input.validatedAt);

  return {
    grossToValidationMinutes,
    unloadingDurationMinutes,
    totalReceptionMinutes,
    delayedOver60Minutes: typeof grossToValidationMinutes === "number" && grossToValidationMinutes > 60,
  };
};

const average = (values: number[]) => {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const standardDeviation = (values: number[]) => {
  if (values.length === 0) return 0;
  const mean = average(values);
  return Math.sqrt(average(values.map((value) => (value - mean) ** 2)));
};

export const computeQcScore = (draft: QcInspectionDraft): QcScoreBreakdown => {
  const humidityAverage = round(average(draft.humidity), 1);
  const caliberAverage = round(average(draft.calibers), 1);
  const caliberStdDev = round(standardDeviation(draft.calibers), 2);
  const organolepticAverage = round(
    average([draft.tasteScore, draft.textureScore, draft.appearanceScore]),
    1,
  );

  const humidityScore =
    humidityAverage >= 20 && humidityAverage <= 24
      ? 100
      : humidityAverage > 24 && humidityAverage <= 26
        ? 85
        : (humidityAverage >= 18 && humidityAverage < 20) || (humidityAverage > 26 && humidityAverage <= 28)
          ? 60
          : 0;

  const caliberScore =
    caliberAverage >= 45
      ? 100
      : caliberAverage >= 42
        ? 90
        : caliberAverage >= 40
          ? 80
          : caliberAverage >= 38
            ? 60
            : caliberAverage >= 35
              ? 40
              : 20;

  const insectsScore = Math.max(0, 100 - draft.insectsPercent * 20);
  const moldFermentationScore = Math.max(
    0,
    100 - draft.moldPercent * 50 - draft.fermentationPercent * 100,
  );
  const organolepticScore =
    organolepticAverage >= 3 ? round((organolepticAverage / 5) * 100, 1) : 40;
  const otherDefectsScore = Math.max(
    0,
    100 -
      draft.mechanicalDamagePercent * 5 -
      draft.crystallizationPercent * 3 -
      draft.discolorationPercent * 5,
  );

  const weighted =
    humidityScore * 0.25 +
    caliberScore * 0.2 +
    insectsScore * 0.2 +
    moldFermentationScore * 0.15 +
    organolepticScore * 0.1 +
    otherDefectsScore * 0.1;
  const finalScore = round(weighted, 1);

  const automaticRejectReasons: string[] = [];
  if (draft.moldPercent > 2) automaticRejectReasons.push("Moisissure > 2%");
  if (draft.fermentationPercent > 1) automaticRejectReasons.push("Fermentation > 1%");
  if (draft.insectsPercent > 5) automaticRejectReasons.push("Insectes > 5%");
  if (humidityAverage > 32 || humidityAverage < 14) automaticRejectReasons.push("Humidite hors seuil critique");

  const automaticReject = automaticRejectReasons.length > 0;

  const classification = automaticReject
    ? "REJETE"
    : finalScore >= 85
      ? "EXTRA"
      : finalScore >= 70
        ? "CATEGORIE_I"
        : finalScore >= 55
          ? "CATEGORIE_II"
          : "REJETE";

  const recommendedDecision =
    classification === "REJETE"
      ? "REJETE"
      : classification === "CATEGORIE_II"
        ? "QUARANTAINE"
        : "ACCEPTE";

  return {
    humidityAverage,
    caliberAverage,
    caliberStdDev,
    organolepticAverage,
    humidityScore,
    caliberScore,
    insectsScore,
    moldFermentationScore,
    organolepticScore,
    otherDefectsScore,
    finalScore,
    classification,
    automaticReject,
    automaticRejectReasons,
    recommendedDecision,
  };
};

export const getQcClassificationLabel = (classification: QcScoreBreakdown["classification"]) =>
  ({
    EXTRA: "Extra",
    CATEGORIE_I: "Categorie I",
    CATEGORIE_II: "Categorie II",
    REJETE: "Rejete",
  })[classification];

export const getQcDecisionLabel = (decision: QcScoreBreakdown["recommendedDecision"]) =>
  ({
    ACCEPTE: "Accepter",
    QUARANTAINE: "Quarantaine",
    REJETE: "Rejeter",
  })[decision];

export const ROYAL_PALM_STORAGE_ZONES: StorageZoneSeed[] = [
  {
    code: "ZR-01",
    name: "Zone Reception 1",
    zone_type: "ventilated",
    capacity_kg: 18000,
    temperature_min: null,
    temperature_max: 30,
    humidity_min: null,
    humidity_max: 75,
    notes: "Zone reception palettee et ventilee",
  },
  {
    code: "ZR-07",
    name: "Zone Reception 7",
    zone_type: "ventilated",
    capacity_kg: 12000,
    temperature_min: null,
    temperature_max: 30,
    humidity_min: null,
    humidity_max: 75,
    notes: "Zone reception secondaire",
  },
  {
    code: "SB-01",
    name: "Stockage Brut 1",
    zone_type: "ventilated",
    capacity_kg: 30000,
    temperature_min: null,
    temperature_max: 30,
    humidity_min: null,
    humidity_max: 70,
    notes: "Attente traitement / fumigation",
  },
  {
    code: "CF-A1",
    name: "Chambre Froide A1",
    zone_type: "cold_room",
    capacity_kg: 120000,
    temperature_min: 2,
    temperature_max: 4,
    humidity_min: 55,
    humidity_max: 70,
    notes: "Froid positif 2-4C",
  },
  {
    code: "CF-A2",
    name: "Chambre Froide A2",
    zone_type: "cold_room",
    capacity_kg: 120000,
    temperature_min: 2,
    temperature_max: 4,
    humidity_min: 55,
    humidity_max: 70,
    notes: "Froid positif 2-4C",
  },
  {
    code: "CF-A3",
    name: "Chambre Froide A3",
    zone_type: "cold_room",
    capacity_kg: 90000,
    temperature_min: 4,
    temperature_max: 6,
    humidity_min: 55,
    humidity_max: 70,
    notes: "Froid positif 4-6C",
  },
  {
    code: "CF-B1",
    name: "Chambre Froide B1",
    zone_type: "cold_room",
    capacity_kg: 150000,
    temperature_min: 2,
    temperature_max: 4,
    humidity_min: 55,
    humidity_max: 70,
    notes: "Froid positif 2-4C",
  },
  {
    code: "CF-B2",
    name: "Chambre Froide B2",
    zone_type: "cold_room",
    capacity_kg: 150000,
    temperature_min: 2,
    temperature_max: 4,
    humidity_min: 55,
    humidity_max: 70,
    notes: "Froid positif 2-4C",
  },
  {
    code: "CF-B3",
    name: "Chambre Froide B3",
    zone_type: "cold_room",
    capacity_kg: 90000,
    temperature_min: 4,
    temperature_max: 6,
    humidity_min: 55,
    humidity_max: 70,
    notes: "Froid positif 4-6C",
  },
  {
    code: "FU-01",
    name: "Fumigation 1",
    zone_type: "processing",
    capacity_kg: 25000,
    temperature_min: null,
    temperature_max: 30,
    humidity_min: null,
    humidity_max: null,
    notes: "Chambre hermetique fumigation",
  },
  {
    code: "FU-02",
    name: "Fumigation 2",
    zone_type: "processing",
    capacity_kg: 25000,
    temperature_min: null,
    temperature_max: 30,
    humidity_min: null,
    humidity_max: null,
    notes: "Chambre hermetique fumigation",
  },
  {
    code: "ZE-01",
    name: "Zone Export",
    zone_type: "processing",
    capacity_kg: 18000,
    temperature_min: null,
    temperature_max: 30,
    humidity_min: null,
    humidity_max: null,
    notes: "Preparation expedition / export",
  },
];

export const computeStorageAlerts = (zone: StorageZone) => {
  const alerts: string[] = [];
  const occupancy = zone.capacity_kg > 0 ? (zone.current_load_kg / zone.capacity_kg) * 100 : 0;

  if (occupancy > 85) {
    alerts.push("Occupation > 85%");
  }

  if (
    zone.zone_type === "cold_room" &&
    typeof zone.temperature_max === "number" &&
    zone.temperature_max > 8
  ) {
    alerts.push("Temperature max configuree au-dessus du seuil d'alerte 8C");
  }

  return alerts;
};
