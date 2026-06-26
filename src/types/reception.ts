import { Supplier } from './mes';

// Enums
export type ReceptionHeaderStatus = 'BROUILLON' | 'EN_ATTENTE_QC' | 'EN_QC' | 'LIBERE' | 'BLOQUE' | 'REJETE' | 'ANNULE';
export type ReceptionType = 'DATTE' | 'EMBALLAGE' | 'AUTRE';
export type StockLotStatus = 'NON_STOCKE' | 'EN_QUARANTAINE' | 'STOCK_LIBERE' | 'STOCK_REJETE';
export type ReceptionUnitType = 'PALETTE' | 'CAISSE' | 'VRAC' | 'PL' | 'GC' | 'PLOX' | 'LAMME';
export type QCDecisionType = 'ACCEPTE' | 'QUARANTAINE' | 'REJETE';
export type CheckResult = 'CONFORME' | 'NON_CONFORME' | 'NA';
export type CheckSeverity = 'CRITIQUE' | 'MAJEUR' | 'MINEUR';
export type ReceptionMovementType = 'RECEPTION' | 'MISE_EN_STOCK' | 'TRANSFERT' | 'RETOUR' | 'DESTRUCTION';
export type RoyalPalmPresentation = 'En caisses' | 'En regimes' | 'En vrac' | 'Melange';
export type RoyalPalmMaturityStage = 'Khalal' | 'Rutab' | 'Tamar';
export type RoyalPalmHarvestMethod = 'Manuelle traditionnelle' | 'Semi-mecanique' | 'Mecanique';
export type RoyalPalmTransportCondition = 'Bache' | 'Non bache' | 'Refrigere';
export type RoyalPalmVisualState = 'Bon' | 'Moyen' | 'Mauvais';

// Main Reception Header
export interface ReceptionV2 {
  id: string;
  reception_number: string;
  site_id: string;
  supplier_id: string;
  supplier_code_snapshot?: string | null;
  supplier_name_snapshot?: string | null;
  purchase_order_id?: string | null;
  purchase_order_line_id?: string | null;
  spontaneous_delivery?: boolean | null;
  reception_type: ReceptionType;
  product_id: string | null;
  material_id: string | null;
  quantity_total: number;
  unit: string;
  packaging_type: string | null;
  delivery_note_number: string | null;
  delivery_note_file_url: string | null;
  delivery_note_photos: string[] | null;
  status: ReceptionHeaderStatus;
  qc_decision: QCDecisionType | null;
  qc_score?: number | null;
  qc_grade?: 'EXTRA' | 'CATEGORIE_I' | 'CATEGORIE_II' | 'REJETE' | null;
  qc_auto_reject_reasons?: string[] | null;
  qc_closed_at: string | null;
  qc_closed_by: string | null;
  expected_arrival_date: string | null;
  actual_arrival_date: string;
  vehicle_number: string | null;
  driver_name: string | null;
  gross_weight_kg?: number | null;
  tare_weight_kg?: number | null;
  declared_weight_kg?: number | null;
  weight_gap_percent?: number | null;
  crate_count?: number | null;
  pallet_count?: number | null;
  average_weight_per_crate?: number | null;
  variety?: string | null;
  presentation?: RoyalPalmPresentation | null;
  maturity_stage?: RoyalPalmMaturityStage | string | null;
  harvest_method?: RoyalPalmHarvestMethod | string | null;
  estimated_harvest_date?: string | null;
  bio_declared?: boolean | null;
  arrival_temperature_c?: number | null;
  departure_time?: string | null;
  transport_condition?: RoyalPalmTransportCondition | string | null;
  quick_visual_state?: RoyalPalmVisualState | string | null;
  quick_check_notes?: string | null;
  storage_zone_code?: string | null;
  transport_duration_hours?: number | null;
  region_code?: string | null;
  origin_oasis?: string | null;
  origin_gps?: string | null;
  gate_arrival_at?: string | null;
  gross_weight_captured_at?: string | null;
  unloading_started_at?: string | null;
  unloading_completed_at?: string | null;
  tare_weight_captured_at?: string | null;
  reception_duration_minutes?: number | null;
  phase1_alerts?: string[] | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
  cancellation_reason: string | null;
  remarks: string | null;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  validated_at: string | null;
  validated_by: string | null;
  // Joined
  supplier?: Supplier;
  lots?: ReceptionLot[];
}

// Reception Lot
export interface ReceptionLot {
  id: string;
  reception_id: string;
  lot_supplier: string;
  lot_internal: string | null;
  qr_code_payload?: string | null;
  rfid_tag?: string | null;
  parent_lot_id?: string | null;
  child_lot_ids?: string[] | null;
  production_date: string | null;
  expiry_date: string | null;
  harvest_date: string | null;
  maturity_stage?: string | null;
  article_ref?: string | null;
  infestation_rate?: number | null;
  variety?: string | null;
  origin_country: string;
  origin_region: string | null;
  origin_farm: string | null;
  quantity: number;
  unit: string;
  stock_status: StockLotStatus;
  quarantine_reason: string | null;
  quarantine_date: string | null;
  release_date: string | null;
  released_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  units?: ReceptionUnit[];
}

// Reception Unit (Palette/Caisse)
export interface ReceptionUnit {
  id: string;
  reception_lot_id: string;
  unit_type: ReceptionUnitType;
  barcode: string;
  qr_code_payload?: string | null;
  qr_label_text?: string | null;
  rfid_tag?: string | null;
  sscc: string | null;
  quantity: number;
  unit: string;
  gross_weight: number | null;
  net_weight: number | null;
  tare_weight: number | null;
  location_id: string | null;
  position: string | null;
  unit_status: StockLotStatus;
  label_printed_at: string | null;
  label_printed_by: string | null;
  created_at: string;
  updated_at: string;
}

// QC Checklist (Config)
export interface QCChecklist {
  id: string;
  code: string;
  name: string;
  reception_type: ReceptionType;
  description: string | null;
  is_active: boolean;
  version: number;
  created_at: string;
  updated_at: string;
  // Joined
  items?: QCChecklistItem[];
}

// QC Checklist Item (Config)
export interface QCChecklistItem {
  id: string;
  checklist_id: string;
  code: string;
  category: string;
  name: string;
  description: string | null;
  severity: CheckSeverity;
  sequence_order: number;
  is_active: boolean;
  created_at: string;
}

// ── RQC (Rapport Contrôle Qualité Réception Achat) ─────────────────────────
export interface RQCCritere {
  test1: number | null;
  test2: number | null;
  test3: number | null;
  taux_moyen: number | null;
}

export interface RQCData {
  conventionnel: boolean;
  bio_certifie: boolean;
  ggp: boolean;
  bon_de_reception_ref: string | null;
  poids_echantillon_branche_kg: number | null;
  poids_tb_kg: number | null;
  taux_tb_percent: number | null;
  poids_vrac_kg: number | null;
  type_dattes_branche: boolean;
  type_dattes_vrac: boolean;
  infestee: RQCCritere;
  fermentee: RQCCritere;
  immature: RQCCritere;
  craquellee: RQCCritere;
  grasse: RQCCritere;
  seche: RQCCritere;
  tachee: RQCCritere;
  ridee: RQCCritere;
  petit_calibre: RQCCritere;
  taux_dechet_percent: number | null;
  endommage_percent: number | null;
  db_score: string | null;
  td_percent: number | null;
  conclusion: string | null;
  responsable_qc1: string | null;
  responsable_qc2: string | null;
  directeur_qc: string | null;
}

// QC Inspection
/** RG-Q07: one entry per analysis type when lab returns results */
export interface LabAnalysisResult {
  analysis_type: string;
  result_value: string;
  threshold: string | null;
  conformant: boolean;
  notes: string | null;
  entered_at: string;
  entered_by: string | null;
}

export interface QCInspection {
  id: string;
  inspection_number: string;
  reception_id: string;
  reception_lot_id: string | null;
  checklist_id: string | null;
  inspector_id: string | null;
  inspector_name: string;
  started_at: string;
  ended_at: string | null;
  decision: QCDecisionType | null;
  comment: string | null;
  nonconformity_code: string | null;
  nonconformity_codes?: string[] | null;
  sampling_method: string | null;
  nb_samples: number | null;
  sampled_by: string | null;
  sampling_time: string | null;
  photos: string[] | null;
  documents: string[] | null;
  ambient_temperature: number | null;
  ambient_humidity: number | null;
  inspection_delay_hours?: number | null;
  lab_sample_required?: boolean | null;
  lab_analyses?: string[] | null;
  lab_storage_location?: string | null;
  lab_sample_code?: string | null;
  lab_analysis_results?: LabAnalysisResult[] | null;
  secondary_inspector_name?: string | null;
  recommended_decision?: QCDecisionType | null;
  override_justification?: string | null;
  rqc?: RQCData | null;
  created_at: string;
  updated_at: string;
  // Joined
  check_results?: QCCheckResult[];
}

// QC Check Result
export interface QCCheckResult {
  id: string;
  inspection_id: string;
  checklist_item_id: string | null;
  check_code: string;
  check_name: string;
  category: string | null;
  severity: CheckSeverity;
  result: CheckResult;
  note: string | null;
  measured_value: string | null;
  expected_value: string | null;
  checked_at: string;
  checked_by: string | null;
}

// Reception Stock Movement
export interface ReceptionStockMovement {
  id: string;
  movement_number: string;
  reception_id: string | null;
  reception_lot_id: string | null;
  unit_id: string | null;
  movement_type: ReceptionMovementType;
  from_location_id: string | null;
  to_location_id: string | null;
  quantity: number;
  unit: string;
  return_reference: string | null;
  destruction_certificate: string | null;
  destruction_method: string | null;
  performed_by: string;
  performed_at: string;
  validated_by: string | null;
  validated_at: string | null;
  notes: string | null;
}

// Reception Alert
export interface ReceptionAlert {
  id: string;
  alert_type: string;
  severity: CheckSeverity;
  reception_id: string | null;
  lot_id: string | null;
  supplier_id: string | null;
  title: string;
  message: string;
  threshold_value: number | null;
  current_value: number | null;
  status: 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED';
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
}

// Audit Log
export interface ReceptionAuditLogV2 {
  id: string;
  entity_type: 'RECEPTION' | 'LOT' | 'UNIT' | 'QC' | 'MOVEMENT';
  entity_id: string;
  action: string;
  old_state: Record<string, unknown> | null;
  new_state: Record<string, unknown> | null;
  field_changed: string | null;
  performed_by: string;
  performed_at: string;
  reason: string | null;
  ip_address: string | null;
}

// Labels for display
export const receptionStatusLabels: Record<ReceptionHeaderStatus, string> = {
  BROUILLON: 'Brouillon',
  EN_ATTENTE_QC: 'En attente QC',
  EN_QC: 'En contrôle QC',
  LIBERE: 'Libéré',
  BLOQUE: 'Bloqué (Quarantaine)',
  REJETE: 'Rejeté',
  ANNULE: 'Annulé'
};

export const receptionStatusColors: Record<ReceptionHeaderStatus, string> = {
  BROUILLON: 'bg-gray-500',
  EN_ATTENTE_QC: 'bg-yellow-500',
  EN_QC: 'bg-blue-500',
  LIBERE: 'bg-green-500',
  BLOQUE: 'bg-orange-500',
  REJETE: 'bg-red-500',
  ANNULE: 'bg-gray-400'
};

export const stockStatusLabels: Record<StockLotStatus, string> = {
  NON_STOCKE: 'Non stocké',
  EN_QUARANTAINE: 'En quarantaine',
  STOCK_LIBERE: 'Stock libéré',
  STOCK_REJETE: 'Stock rejeté'
};

export const stockStatusColors: Record<StockLotStatus, string> = {
  NON_STOCKE: 'bg-gray-500',
  EN_QUARANTAINE: 'bg-orange-500',
  STOCK_LIBERE: 'bg-green-500',
  STOCK_REJETE: 'bg-red-500'
};

export const qcDecisionLabels: Record<QCDecisionType, string> = {
  ACCEPTE: 'Accepté',
  QUARANTAINE: 'Quarantaine',
  REJETE: 'Rejeté'
};

export const qcDecisionColors: Record<QCDecisionType, string> = {
  ACCEPTE: 'bg-green-500 text-white',
  QUARANTAINE: 'bg-orange-500 text-white',
  REJETE: 'bg-red-500 text-white'
};

export const checkResultLabels: Record<CheckResult, string> = {
  CONFORME: 'Conforme',
  NON_CONFORME: 'Non conforme',
  NA: 'N/A'
};

export const severityLabels: Record<CheckSeverity, string> = {
  CRITIQUE: 'Critique',
  MAJEUR: 'Majeur',
  MINEUR: 'Mineur'
};

export const severityColors: Record<CheckSeverity, string> = {
  CRITIQUE: 'bg-red-600 text-white',
  MAJEUR: 'bg-orange-500 text-white',
  MINEUR: 'bg-yellow-500 text-black'
};

export const receptionTypeLabels: Record<ReceptionType, string> = {
  DATTE: 'Dattes',
  EMBALLAGE: 'Emballage',
  AUTRE: 'Autre'
};

export const unitTypeLabels: Record<ReceptionUnitType, string> = {
  PALETTE: 'Palette',
  CAISSE: 'Caisse',
  VRAC: 'Vrac',
  PL: 'PL',
  GC: 'GC',
  PLOX: 'PLOX',
  LAMME: 'LAMME'
};

export const royalPalmPresentationLabels: Record<RoyalPalmPresentation, string> = {
  'En caisses': 'En caisses',
  'En regimes': 'En regimes',
  'En vrac': 'En vrac',
  Melange: 'Melange',
};
