import type { Supplier } from "@/types/mes";
import type { ReceptionV2 } from "@/types/reception";

export interface ReceptionWizardLotDraft {
  lot_supplier: string;
  quantity: number;
  variety: string;
  origin_country: string;
  origin_region: string;
  origin_farm: string;
  harvest_date: string;
  rfid_tag: string;
}

const parseNumeric = (value: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const getSupplierOptionValue = (supplier: Pick<Supplier, "id" | "code" | "name">) =>
  supplier.id || supplier.code || supplier.name;

export const resolveReceptionSupplier = <T extends Pick<Supplier, "id" | "code" | "name">>(
  suppliers: T[],
  value: string,
) => suppliers.find((supplier) => getSupplierOptionValue(supplier) === value) || null;

// ─── LOT-ID format ───────────────────────────────────────────────────────────

/** Royal Palm LOT-ID pattern: RP-{REG}-{FOURN}-{YYYYMMDD}-{SEQ3}  e.g. RP-TOZ-C001-20260611-001 */
const LOT_ID_PATTERN = /^RP-[A-Z]{3}-[A-Z0-9]{1,8}-\d{8}-[A-Z0-9]{3,6}$/;

export const isValidLotInternalFormat = (id: string): boolean =>
  LOT_ID_PATTERN.test(id.trim().toUpperCase());

export const getLotInternalFormatError = (id: string): string | null => {
  const v = id.trim().toUpperCase();
  if (!v) return null; // auto-generated — empty is ok at draft stage
  if (!LOT_ID_PATTERN.test(v)) return `Format attendu: RP-[REG]-[FOURN]-[YYYYMMDD]-[SEQ]  (ex: RP-TOZ-C001-20260611-001)`;
  return null;
};

// ─── RG-R03 — Weight gap alert (>5 % triggers mandatory alert) ───────────────

export const getRGR03WeightGapAlert = (
  netWeightKg: number,
  declaredWeightKg: number | null,
): { level: 'none' | 'warning' | 'critical'; gapPercent: number | null } => {
  if (!declaredWeightKg || declaredWeightKg <= 0 || netWeightKg <= 0) {
    return { level: 'none', gapPercent: null };
  }
  const gap = Math.abs(netWeightKg - declaredWeightKg);
  const gapPercent = Math.round((gap / declaredWeightKg) * 1000) / 10;
  if (gapPercent > 10) return { level: 'critical', gapPercent };
  if (gapPercent > 5) return { level: 'warning', gapPercent };  // RG-R03 threshold
  return { level: 'none', gapPercent };
};

// ─── RG-R09 — Same vehicle same day (warning, not blocker) ───────────────────

/**
 * Returns the number of existing receptions today with the same vehicle plate.
 * Used to show a non-blocking RG-R09 warning in step 1.
 */
export const countSameVehicleToday = (
  vehicleNumber: string,
  todayReceptions: Pick<ReceptionV2, "vehicle_number" | "created_at">[],
): number => {
  const plate = vehicleNumber.trim().toUpperCase();
  if (!plate) return 0;
  const today = new Date().toDateString();
  return todayReceptions.filter((r) => {
    return (
      r.vehicle_number?.trim().toUpperCase() === plate &&
      new Date(r.created_at).toDateString() === today
    );
  }).length;
};

// ─── Step blockers ────────────────────────────────────────────────────────────

export const getReceptionWizardStepBlockers = (input: {
  step: number;
  selectedSupplier: Pick<Supplier, "id" | "code" | "name"> | null;
  deliveryNoteNumber: string;
  vehicleNumber: string;
  gateArrivalAt: string;
  grossWeightValue: number;
  tareWeightValue: number;
  netWeightKg: number;
  unitCountValue: number;
  weighingSource: "SCALE" | "MANUAL" | "PANNE_BASCULE";
  manualReason: string;
  arrivalPhotos: string[];
  variety: string;
  maturityStage: string;
  harvestMethod: string;
  arrivalTemperatureC: string;
  storageZoneCode: string;
  lots: ReceptionWizardLotDraft[];
  lotMismatch: boolean;
  /** RG-R05: true when bio_declared=true and supplier has no valid Bio cert */
  bioDeclaredWithoutCert?: boolean;
}) => {
  const blockers: string[] = [];

  if (input.step === 1) {
    if (!input.selectedSupplier) blockers.push("selectionner un fournisseur actif");
    if (!input.deliveryNoteNumber.trim()) blockers.push("renseigner le bon de livraison");
    if (!input.vehicleNumber.trim()) blockers.push("renseigner l'immatriculation vehicule");
    if (!input.gateArrivalAt) blockers.push("renseigner l'heure arrivee portail");
    return blockers;
  }

  if (input.step === 2) {
    if (input.grossWeightValue <= 0) blockers.push("saisir un poids brut superieur a 0");
    if (input.tareWeightValue < 0) blockers.push("saisir une tare valide");
    if (input.netWeightKg <= 0 || input.grossWeightValue <= input.tareWeightValue) {
      blockers.push("le poids brut doit etre superieur a la tare");
    }
    if (input.unitCountValue <= 0) blockers.push("saisir un nombre de supports valide");
    if (input.weighingSource === "MANUAL" && input.manualReason.trim().length < 10) {
      blockers.push("justifier la saisie manuelle de pesee (10 caracteres min.)");
    }
    if (input.weighingSource === "PANNE_BASCULE" && input.manualReason.trim().length < 20) {
      blockers.push("decrire la panne bascule (20 caracteres min.) — RG-R08");
    }
    return blockers;
  }

  if (input.step === 3) {
    if (input.arrivalPhotos.length < 2) blockers.push("ajouter au moins 2 photos obligatoires (RG-R06)");
    if (!input.variety) blockers.push("selectionner une variete");
    if (!input.maturityStage) blockers.push("selectionner le stade de maturation");
    if (!input.harvestMethod) blockers.push("selectionner la methode de recolte");
    if (parseNumeric(input.arrivalTemperatureC) <= 0) blockers.push("saisir la temperature d'arrivee");
    // RG-R05: Bio declared without valid supplier certification → hard block
    if (input.bioDeclaredWithoutCert) {
      blockers.push("lot declare Bio mais le fournisseur n'a pas de certification Bio valide — blocage RG-R05");
    }
    return blockers;
  }

  if (input.step === 4) {
    if (!input.storageZoneCode) blockers.push("renseigner la zone de stockage");
    if (input.lots.length === 0) blockers.push("ajouter au moins un sous-lot");
    if (!input.lots.every((lot) => lot.lot_supplier.trim().length > 0)) {
      blockers.push("renseigner chaque reference lot fournisseur");
    }
    if (!input.lots.every((lot) => Number(lot.quantity || 0) > 0)) {
      blockers.push("renseigner chaque quantite de sous-lot");
    }
    if (input.lotMismatch) blockers.push("aligner le total des sous-lots avec le poids net");
  }

  return blockers;
};
