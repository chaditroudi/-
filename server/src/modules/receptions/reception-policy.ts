import { badRequest } from "../../core/app-error.js";
import { getCollectionModel } from "../../db/dynamic-model.js";

export type ReceptionPolicy = {
  allowSpontaneous: boolean;
  requirePurchaseOrder: boolean;
  requireVehicleNumber: boolean;
  weightGapWarningPct: number;
  weightGapCriticalPct: number;
};

export type WeightGap = {
  level: "none" | "warning" | "critical";
  gapKg: number | null;
  gapPercent: number | null;
};

const round = (value: number, precision: number) => Number(value.toFixed(precision));

const readBoolean = (value: unknown, fallback: boolean) => (typeof value === "boolean" ? value : fallback);

const readPercent = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

/** Site configuration from Paramètres. The defaults are the documented RG-R03 thresholds. */
export const loadReceptionPolicy = async (): Promise<ReceptionPolicy> => {
  const settings = (await getCollectionModel("site_settings").findOne({ id: "global" }).lean().exec()) as
    | { operations?: Record<string, unknown> }
    | null;
  const operations = settings?.operations ?? {};
  return {
    allowSpontaneous: readBoolean(operations.allow_spontaneous_reception, true),
    requirePurchaseOrder: readBoolean(operations.require_purchase_order_for_reception, false),
    requireVehicleNumber: readBoolean(operations.require_vehicle_number_on_reception, true),
    weightGapWarningPct: readPercent(operations.reception_weight_gap_warning_pct, 5),
    weightGapCriticalPct: readPercent(operations.reception_weight_gap_critical_pct, 10),
  };
};

/** Actual minus expected. The caller keeps both values: nothing here replaces either. */
export const assessWeightGap = (
  actualKg: number,
  expectedKg: number | null,
  policy: Pick<ReceptionPolicy, "weightGapWarningPct" | "weightGapCriticalPct">,
): WeightGap => {
  if (!expectedKg || expectedKg <= 0 || actualKg <= 0) return { level: "none", gapKg: null, gapPercent: null };
  const gapKg = round(actualKg - expectedKg, 3);
  const gapPercent = round((gapKg / expectedKg) * 100, 2);
  const magnitude = Math.abs(gapPercent);
  const level =
    magnitude > policy.weightGapCriticalPct ? "critical" : magnitude > policy.weightGapWarningPct ? "warning" : "none";
  return { level, gapKg, gapPercent };
};

const BIO_CERTIFICATIONS = new Set(["Bio UE", "Bio Tunisie"]);

/** RG-R05: same rule as hasValidBioCertification on the client. */
export const hasValidBioCertification = (supplier: Record<string, unknown>) => {
  const certifications = Array.isArray(supplier.certifications) ? supplier.certifications : [];
  const today = new Date().setHours(0, 0, 0, 0);
  return certifications.some((certification: { name?: unknown; validUntil?: unknown }) => {
    if (!BIO_CERTIFICATIONS.has(String(certification?.name ?? ""))) return false;
    if (!certification.validUntil) return true;
    return new Date(String(certification.validUntil)).getTime() >= today;
  });
};

const isBlank = (value: unknown) => value === undefined || value === null || String(value).trim() === "";

export const MIN_MANUAL_WEIGHING_REASON_LENGTH = 10;
export const MIN_ARRIVAL_PHOTOS = 2;

/**
 * Required for a date delivery, in the employee's words. The screens run the
 * same list; this is the one that counts. Measurements have no default.
 */
export const listIntakeBlockers = (
  payload: Record<string, unknown>,
  lots: Array<Record<string, unknown>>,
  policy: Pick<ReceptionPolicy, "requireVehicleNumber">,
  verifiedDeviceWeighing: boolean,
) => {
  const missing: string[] = [];
  if (isBlank(payload.delivery_note_number)) missing.push("numéro du bon de livraison");
  if (policy.requireVehicleNumber && isBlank(payload.vehicle_number)) missing.push("immatriculation du véhicule");
  if (isBlank(payload.variety)) missing.push("variété");
  if (isBlank(payload.maturity_stage)) missing.push("stade de maturité");
  if (isBlank(payload.harvest_method)) missing.push("méthode de récolte");
  if (isBlank(payload.arrival_temperature_c) || !Number.isFinite(Number(payload.arrival_temperature_c))) {
    missing.push("température à l'arrivée");
  }
  if (isBlank(payload.storage_zone_code)) missing.push("zone de stockage temporaire");
  if (!(Number(payload.unit_count) > 0)) missing.push("nombre de supports");
  if (!(Number(payload.gross_weight_kg) > 0) && !verifiedDeviceWeighing) missing.push("poids brut");
  if (isBlank(payload.tare_weight_kg) && !verifiedDeviceWeighing) missing.push("tare");
  const photos = Array.isArray(payload.delivery_note_photos) ? payload.delivery_note_photos : [];
  if (photos.length < MIN_ARRIVAL_PHOTOS) missing.push(`au moins ${MIN_ARRIVAL_PHOTOS} photos (RG-R06)`);
  if (lots.some((lot) => isBlank(lot.lot_supplier))) missing.push("référence du lot fournisseur");
  return missing;
};

export const assertSpontaneousAllowed = (hasPurchaseOrder: boolean, policy: ReceptionPolicy) => {
  if (hasPurchaseOrder) return;
  if (policy.requirePurchaseOrder || !policy.allowSpontaneous) {
    throw badRequest(
      "PURCHASE_ORDER_REQUIRED",
      "Cette usine n'autorise pas la réception sans bon de commande : sélectionnez le bon de commande de la livraison.",
    );
  }
};
