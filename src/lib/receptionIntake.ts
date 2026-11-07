import type { ReceptionIntakePayload } from '@/hooks/useReceptionIntake';

/**
 * The reception form as plain data: the same object is saved locally, shared
 * between devices as a draft, and turned into one intake request. Measurements
 * start empty and stay strings until submitted, so "not measured" never becomes 0.
 */
export type WeighingMode = 'CONNECTED' | 'MANUAL';
export type ManualEvidence = 'SCALE' | 'NO_SCALE';
export type IntakeStage = 1 | 2 | 3;

export interface IntakeLotDraft {
  lot_supplier: string;
  quantity: string;
  rfid_tag?: string;
}

export interface IntakeDraft {
  id: string;
  version: number | null;
  stage: IntakeStage;
  supplier_id: string;
  supplier_label: string;
  purchase_order_id: string;
  purchase_order_line_id: string;
  delivery_note_number: string;
  vehicle_number: string;
  driver_name: string;
  gate_arrival_at: string;
  variety: string;
  manufacturing_route: 'PREMIUM_WHOLE' | 'GENERIC';
  maturity_stage: string;
  harvest_method: string;
  harvest_date: string;
  bio_declared: boolean;
  origin_oasis: string;
  origin_region: string;
  origin_gps: string;
  departure_time: string;
  presentation: string;
  weighing_mode: WeighingMode;
  manual_evidence: ManualEvidence;
  manual_reason: string;
  gross_weight_kg: string;
  tare_weight_kg: string;
  gross_reading_id: string;
  tare_reading_id: string;
  gross_device_code: string;
  tare_device_code: string;
  gross_captured_at: string;
  tare_captured_at: string;
  declared_weight_kg: string;
  unit_count: string;
  unit_type: string;
  lots: IntakeLotDraft[];
  arrival_temperature_c: string;
  transport_condition: string;
  quick_visual_state: string;
  quick_check_notes: string;
  storage_zone_code: string;
  photos: string[];
  remarks: string;
}

export interface IntakePolicy {
  allowSpontaneous: boolean;
  requirePurchaseOrder: boolean;
  requireVehicleNumber: boolean;
  weightGapWarningPct: number;
  weightGapCriticalPct: number;
}

export const DEFAULT_INTAKE_POLICY: IntakePolicy = {
  allowSpontaneous: true,
  requirePurchaseOrder: false,
  requireVehicleNumber: true,
  weightGapWarningPct: 5,
  weightGapCriticalPct: 10,
};

export const MIN_ARRIVAL_PHOTOS = 2;
export const MIN_MANUAL_REASON_LENGTH = 10;
const LOT_SPLIT_TOLERANCE_KG = 0.1;

export const createIntakeDraft = (now = new Date()): IntakeDraft => ({
  id: crypto.randomUUID(),
  version: null,
  stage: 1,
  supplier_id: '',
  supplier_label: '',
  purchase_order_id: '',
  purchase_order_line_id: '',
  delivery_note_number: '',
  vehicle_number: '',
  driver_name: '',
  gate_arrival_at: now.toISOString(),
  variety: '',
  manufacturing_route: 'PREMIUM_WHOLE',
  maturity_stage: '',
  harvest_method: '',
  harvest_date: '',
  bio_declared: false,
  origin_oasis: '',
  origin_region: '',
  origin_gps: '',
  departure_time: '',
  presentation: '',
  weighing_mode: 'MANUAL',
  manual_evidence: 'SCALE',
  manual_reason: '',
  gross_weight_kg: '',
  tare_weight_kg: '',
  gross_reading_id: '',
  tare_reading_id: '',
  gross_device_code: '',
  tare_device_code: '',
  gross_captured_at: '',
  tare_captured_at: '',
  declared_weight_kg: '',
  unit_count: '',
  unit_type: 'PALETTE',
  lots: [{ lot_supplier: '', quantity: '' }],
  arrival_temperature_c: '',
  transport_condition: '',
  quick_visual_state: '',
  quick_check_notes: '',
  storage_zone_code: '',
  photos: [],
  remarks: '',
});

const toNumber = (value: string) => {
  if (value.trim() === '') return null;
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
};

const round3 = (value: number) => Math.round(value * 1000) / 1000;

export const getNetWeightKg = (draft: Pick<IntakeDraft, 'gross_weight_kg' | 'tare_weight_kg'>) => {
  const gross = toNumber(draft.gross_weight_kg);
  const tare = toNumber(draft.tare_weight_kg);
  return gross === null || tare === null ? null : round3(gross - tare);
};

export const getLotsTotalKg = (draft: Pick<IntakeDraft, 'lots'>) =>
  round3(draft.lots.reduce((sum, lot) => sum + (toNumber(lot.quantity) ?? 0), 0));

/** A connected weighing is only claimed when both signed readings are on the draft. */
export const isVerifiedDeviceWeighing = (draft: IntakeDraft) =>
  draft.weighing_mode === 'CONNECTED' && Boolean(draft.gross_reading_id && draft.tare_reading_id);

export const getWeighingSource = (draft: IntakeDraft): 'SCALE' | 'MANUAL' | undefined => {
  if (draft.weighing_mode === 'CONNECTED') return undefined;
  return draft.manual_evidence === 'NO_SCALE' ? 'MANUAL' : 'SCALE';
};

/** Provenance in one line, from what was recorded. Used before and after confirmation. */
/** Stable id of the weighing source (`weighingSource.<key>`), for screens shown in other languages. */
export const weighingSourceKey = (source?: string | null, verifiedDevice?: boolean | null) =>
  source === 'DEVICE' && verifiedDevice !== false ? 'device' : source === 'MANUAL' ? 'manual' : source === 'SCALE' ? 'scale' : 'unknown';

export const describeWeighingSource = (source?: string | null, verifiedDevice?: boolean | null) => {
  if (source === 'DEVICE' && verifiedDevice !== false) return 'Bascule connectée · lecture signée';
  if (source === 'MANUAL') return 'Saisie manuelle · sans bascule';
  if (source === 'SCALE') return 'Saisie manuelle · lu sur la bascule';
  return 'Provenance non renseignée';
};

export interface WeightGap {
  level: 'none' | 'warning' | 'critical';
  gapKg: number | null;
  gapPercent: number | null;
}

/** Same rule as the server's assessWeightGap; the server's result is the one recorded. */
export const assessWeightGap = (
  actualKg: number | null,
  expectedKg: number | null,
  policy: Pick<IntakePolicy, 'weightGapWarningPct' | 'weightGapCriticalPct'>,
): WeightGap => {
  if (!actualKg || !expectedKg || actualKg <= 0 || expectedKg <= 0) return { level: 'none', gapKg: null, gapPercent: null };
  const gapKg = round3(actualKg - expectedKg);
  const gapPercent = Math.round((gapKg / expectedKg) * 10000) / 100;
  const magnitude = Math.abs(gapPercent);
  const level = magnitude > policy.weightGapCriticalPct ? 'critical' : magnitude > policy.weightGapWarningPct ? 'warning' : 'none';
  return { level, gapKg, gapPercent };
};

export const getDeliveryBlockers = (draft: IntakeDraft, policy: IntakePolicy, context: { hasBioCertification: boolean }) => {
  const blockers: string[] = [];
  if (!draft.supplier_id) blockers.push('Choisissez le fournisseur.');
  if (!draft.purchase_order_id && (policy.requirePurchaseOrder || !policy.allowSpontaneous)) {
    blockers.push('Choisissez le bon de commande : cette usine n\'accepte pas la livraison sans commande.');
  }
  if (draft.purchase_order_id && !draft.purchase_order_line_id) blockers.push('Choisissez la ligne du bon de commande.');
  if (!draft.delivery_note_number.trim()) blockers.push('Saisissez le numéro du bon de livraison.');
  if (policy.requireVehicleNumber && !draft.vehicle_number.trim()) blockers.push('Saisissez l\'immatriculation du véhicule.');
  if (!draft.variety) blockers.push('Choisissez la variété.');
  if (!draft.maturity_stage) blockers.push('Choisissez le stade de maturité.');
  if (!draft.harvest_method) blockers.push('Choisissez la méthode de récolte.');
  if (draft.bio_declared && !context.hasBioCertification) {
    blockers.push('Lot déclaré Bio : le fournisseur n\'a pas de certification Bio valide (RG-R05).');
  }
  return blockers;
};

export const getWeighingBlockers = (draft: IntakeDraft) => {
  const blockers: string[] = [];
  const gross = toNumber(draft.gross_weight_kg);
  const tare = toNumber(draft.tare_weight_kg);
  const net = getNetWeightKg(draft);

  if (draft.weighing_mode === 'CONNECTED') {
    if (!draft.gross_reading_id) blockers.push('Capturez le poids brut sur la bascule.');
    if (!draft.tare_reading_id) blockers.push('Capturez la tare sur la bascule, après déchargement.');
    if (draft.lots.length > 1) blockers.push('Une pesée connectée ne couvre qu\'un seul lot.');
  } else {
    if (gross === null || gross <= 0) blockers.push('Saisissez le poids brut.');
    if (tare === null || tare < 0) blockers.push('Saisissez la tare.');
    if (draft.manual_evidence === 'NO_SCALE' && draft.manual_reason.trim().length < MIN_MANUAL_REASON_LENGTH) {
      blockers.push(`Expliquez pourquoi la bascule n'a pas servi (${MIN_MANUAL_REASON_LENGTH} caractères minimum).`);
    }
  }
  if (net !== null && net <= 0) blockers.push('Le poids net doit être positif : vérifiez le brut et la tare.');
  if (!(Number(draft.unit_count) > 0)) blockers.push('Comptez les supports (palettes, caisses…).');
  if (draft.lots.some((lot) => !lot.lot_supplier.trim())) blockers.push('Renseignez la référence du lot fournisseur.');
  if (draft.lots.some((lot) => !((toNumber(lot.quantity) ?? 0) > 0))) blockers.push('Renseignez la quantité de chaque lot.');
  if (net !== null && net > 0 && Math.abs(getLotsTotalKg(draft) - net) > LOT_SPLIT_TOLERANCE_KG) {
    blockers.push(`La somme des lots (${getLotsTotalKg(draft)} kg) doit égaler le poids net (${net} kg).`);
  }
  if (toNumber(draft.arrival_temperature_c) === null) blockers.push('Mesurez la température à l\'arrivée.');
  if (!draft.storage_zone_code) blockers.push('Choisissez la zone de stockage temporaire.');
  if (draft.photos.length < MIN_ARRIVAL_PHOTOS) blockers.push(`Ajoutez au moins ${MIN_ARRIVAL_PHOTOS} photos (RG-R06).`);
  return blockers;
};

/** Where a draft stands, in the words of the En attente list. */
export const getDraftWaitingFor = (draft: Pick<IntakeDraft, 'gross_weight_kg' | 'tare_weight_kg' | 'supplier_id'>) => {
  if (!draft.supplier_id) return 'Fournisseur à choisir';
  if (!draft.gross_weight_kg) return 'En attente de pesée brute';
  if (!draft.tare_weight_kg) return 'En attente de la tare';
  return 'À vérifier et confirmer';
};

export const buildIntakePayload = (draft: IntakeDraft, alerts: string[] = []): ReceptionIntakePayload => {
  const device = isVerifiedDeviceWeighing(draft);
  const source = getWeighingSource(draft);
  return {
    client_request_id: draft.id,
    ...(draft.version !== null ? { draft_version: draft.version } : {}),
    supplier_id: draft.supplier_id,
    purchase_order_id: draft.purchase_order_id || null,
    purchase_order_line_id: draft.purchase_order_line_id || null,
    reception_type: 'DATTE',
    unit: 'kg',
    presentation: (draft.presentation || undefined) as ReceptionIntakePayload['presentation'],
    delivery_note_number: draft.delivery_note_number.trim(),
    delivery_note_photos: draft.photos,
    vehicle_number: draft.vehicle_number.trim(),
    driver_name: draft.driver_name.trim() || null,
    remarks: draft.remarks.trim() || null,
    gross_weight_kg: device ? 0 : Number(toNumber(draft.gross_weight_kg)),
    tare_weight_kg: device ? 0 : Number(toNumber(draft.tare_weight_kg)),
    gross_reading_id: device ? draft.gross_reading_id : null,
    tare_reading_id: device ? draft.tare_reading_id : null,
    declared_weight_kg: toNumber(draft.declared_weight_kg),
    variety: draft.variety,
    manufacturing_route: draft.manufacturing_route,
    maturity_stage: draft.maturity_stage,
    harvest_method: draft.harvest_method,
    estimated_harvest_date: draft.harvest_date || null,
    bio_declared: draft.bio_declared,
    arrival_temperature_c: Number(toNumber(draft.arrival_temperature_c)),
    transport_condition: draft.transport_condition || null,
    quick_visual_state: draft.quick_visual_state || null,
    quick_check_notes: draft.quick_check_notes.trim() || null,
    storage_zone_code: draft.storage_zone_code,
    origin_oasis: draft.origin_oasis.trim() || null,
    origin_gps: draft.origin_gps.trim() || null,
    departure_time: draft.departure_time || null,
    phase1_alerts: alerts,
    gate_arrival_at: draft.gate_arrival_at || null,
    gross_weight_captured_at: draft.gross_captured_at || null,
    tare_weight_captured_at: draft.tare_captured_at || null,
    unit_count: Number(draft.unit_count),
    unit_type: draft.unit_type as ReceptionIntakePayload['unit_type'],
    weighing_source: source,
    weighing_manual_reason: source === 'MANUAL' ? draft.manual_reason.trim() : null,
    lots: draft.lots.map((lot) => ({
      lot_supplier: lot.lot_supplier.trim(),
      quantity: Number(toNumber(lot.quantity)),
      rfid_tag: lot.rfid_tag?.trim() || null,
      origin_region: draft.origin_region || undefined,
      origin_farm: draft.origin_oasis.trim() || undefined,
      harvest_date: draft.harvest_date || null,
      maturity_stage: draft.maturity_stage,
      variety: draft.variety,
    })),
  };
};

