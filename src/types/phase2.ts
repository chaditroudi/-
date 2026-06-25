/**
 * Royal Palm — Phase 2 Types
 * Fumigation (CCP-1) · Nettoyage · Hydratation/Séchage · Triage manuel
 */

// ─── Shared ────────────────────────────────────────────────────────────────

export type Phase2LotRef = {
  reception_id: string;
  lot_number: string;
  variety: string | null;
  weight_kg: number;
  is_bio: boolean;
};

// ─── Module 5: Fumigation (CCP-1) ──────────────────────────────────────────

export type FumigationChamber = 'FU-01' | 'FU-02';
export type FumigationProtocol = 'FUM-PH3-72' | 'FUM-CO2-96' | 'FUM-THERM-04';

export type FumigationCycleStatus =
  | 'PREPARATION'   // pre-checks (calibration, stock, seal)
  | 'CHARGEMENT'    // scanning lots in
  | 'EN_COURS'      // T0 locked, CCP active
  | 'VENTILATION'   // post-cycle aeration
  | 'VALIDATION'    // residual test + dual signature
  | 'TERMINE'       // complete, certificate issued, lots released
  | 'INTERROMPU'    // emergency stop
  | 'ECHEC';        // failed validation

export interface FumigationSensorReading {
  id: string;
  cycle_id: string;
  read_at: string;                       // ISO timestamp — immutable once written

  // Gas (4 sensors N/S/E/O)
  concentration_p1_gm3: number | null;
  concentration_p2_gm3: number | null;
  concentration_p3_gm3: number | null;
  concentration_p4_gm3: number | null;
  concentration_avg_gm3: number | null;  // official CCP value

  // Temperature (6 probes: 3 heights × 2 zones)
  temperature_t1_c: number | null;
  temperature_t2_c: number | null;
  temperature_t3_c: number | null;
  temperature_t4_c: number | null;
  temperature_t5_c: number | null;
  temperature_t6_c: number | null;

  // Humidity (2 probes)
  humidity_h1_percent: number | null;
  humidity_h2_percent: number | null;

  // Safety
  pressure_differential_pa: number | null;
  external_leak_ppm: number | null;
  door_locked: boolean;
  created_by: string; // system/IoT gateway
}

export interface FumigationCycle {
  id: string;
  cycle_number: string;               // FUM-FU01-20260608-001
  chamber: FumigationChamber;
  protocol: FumigationProtocol;
  status: FumigationCycleStatus;

  // Lots in this cycle
  lot_refs: Phase2LotRef[];           // stored as JSONB array
  total_weight_kg: number;
  fill_rate_percent: number;          // alerts if <60% or >90%
  has_bio_lots: boolean;              // enforces CO2/Thermique only

  // Dosage (operator input — Bloc Dosage)
  dose_calculated_g: number | null;
  dose_applied_g: number | null;
  dose_variance_percent: number | null;
  product_lot_number: string | null;  // pastilles PH3 or CO2 cylinders
  product_expiry_date: string | null; // RG-FUM: refuse if expired
  photo_disposition_urls: string[];   // mandatory before sealing (RG)

  // CCP timeline (Bloc Validation)
  t0_start: string | null;
  t_end_real: string | null;
  duration_minutes: number | null;
  minimum_duration_minutes: number;   // PH3=4320, CO2=5760, THERM=240
  duration_compliant: boolean | null;
  parameters_compliant: boolean | null; // all readings within spec

  // Post-ventilation (RG-FUM-09)
  residual_concentration_ppm: number | null;
  residual_tlv_compliant: boolean | null;

  // Dual signature — CCP mandatory (RG-FUM-12)
  operator_id: string | null;
  operator_name: string | null;
  operator_signed_at: string | null;
  quality_inspector_id: string | null;
  quality_inspector_name: string | null;
  quality_signed_at: string | null;

  // Certificate (RG-FUM-14: 7-year retention)
  certificate_pdf_url: string | null;
  certificate_generated_at: string | null;

  // Audit
  created_by: string;
  created_at: string;
  updated_at: string;

  // Joined
  readings?: FumigationSensorReading[];
}

// Protocol constraints lookup
export const FUMIGATION_PROTOCOL_CONFIG: Record<
  FumigationProtocol,
  {
    label: string;
    min_duration_h: number;
    min_duration_min: number;
    target_concentration: string;
    target_temperature: string;
    allows_bio: boolean;
    cost_per_tonne: number;
  }
> = {
  'FUM-PH3-72': {
    label: 'PH3 Phosphine (72h)',
    min_duration_h: 72,
    min_duration_min: 4320,
    target_concentration: '2–3 g/m³',
    target_temperature: '20–30°C',
    allows_bio: false,
    cost_per_tonne: 50,
  },
  'FUM-CO2-96': {
    label: 'CO2 haute concentration (96h)',
    min_duration_h: 96,
    min_duration_min: 5760,
    target_concentration: '60–70% atmosphère',
    target_temperature: '20–30°C',
    allows_bio: true,
    cost_per_tonne: 120,
  },
  'FUM-THERM-04': {
    label: 'Thermique (4h)',
    min_duration_h: 4,
    min_duration_min: 240,
    target_concentration: '55°C ±2°C',
    target_temperature: '55°C ±2°C',
    allows_bio: true,
    cost_per_tonne: 200,
  },
};

// ─── Module 6: Nettoyage / Lavage ──────────────────────────────────────────

export type CleaningProgram = 'A' | 'B' | 'C' | 'D';
export type WasteCategory = 'ORGANIQUE' | 'INERTE' | 'MAUVAISES_DATTES';
export type CleaningCycleStatus = 'EN_COURS' | 'TERMINE' | 'INCIDENT';

export interface CleaningCycle {
  id: string;
  cycle_number: string;               // NET-20260608-001

  // Lot
  reception_id: string;
  lot_number: string;
  variety: string | null;
  status: CleaningCycleStatus;

  // Program (RG-NET-02: branched → force D)
  program: CleaningProgram;
  program_forced_reason: string | null;

  // Weights (auto from scales)
  weight_in_kg: number | null;
  weight_out_kg: number | null;
  yield_percent: number | null;       // alert if <92% (RG-NET-03)

  // IoT sensors (auto)
  water_volume_liters: number | null;
  water_recycled_percent: number | null;
  water_temperature_c: number | null;
  turbidity_ntu: number | null;       // alert if >200 NTU (RG-NET-04)
  ph_water: number | null;            // alert if outside 6.5–8.5 (RG-NET-05)

  // Waste (operator input — mandatory for close RG-NET-06)
  waste_weight_kg: number | null;
  waste_category: WasteCategory | null;
  waste_photo_urls: string[];

  // Timing
  started_at: string;
  ended_at: string | null;

  // Operator
  operator_name: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export const CLEANING_PROGRAM_CONFIG: Record<
  CleaningProgram,
  { label: string; temperature_c: number; duration_s: number; pressure: string; effect: string }
> = {
  A: { label: 'A — Léger', temperature_c: 25, duration_s: 30, pressure: 'basse pression', effect: 'Poussières superficielles' },
  B: { label: 'B — Standard', temperature_c: 28, duration_s: 45, pressure: 'pression normale', effect: 'Poussière + débris légers' },
  C: { label: 'C — Intensif', temperature_c: 30, duration_s: 60, pressure: 'haute pression', effect: 'Sable, terre, débris végétaux' },
  D: { label: 'D — Pas lavage (branchées)', temperature_c: 0, duration_s: 0, pressure: '-', effect: 'Bypass (préserver grappes)' },
};

// ─── Module 7: Hydratation / Séchage ───────────────────────────────────────

export type HydrationProgram = 'HYD-LONG' | 'HYD-COURT' | 'SKIP' | 'SEC-COURT' | 'SEC-LONG';
export type HydrationChamber = 'HY-01' | 'HY-02' | 'HY-03';
export type HydrationConformity = 'VERT' | 'JAUNE' | 'ROUGE';
export type HydrationCycleStatus = 'EN_COURS' | 'TERMINE' | 'NON_CONFORME';
export type HydrationNonConformityAction = 'REFAIRE' | 'ACCEPTER' | 'REJETER';

export interface HydrationCycle {
  id: string;
  cycle_number: string;               // HYD-HY01-20260608-001
  chamber: HydrationChamber;
  lot_refs: Phase2LotRef[];           // up to 5T total
  status: HydrationCycleStatus;

  // Program routing (RG-HYD-02/03)
  humidity_in_percent: number | null; // from Phase 1 QC data
  program_suggested: HydrationProgram;
  program_applied: HydrationProgram;
  program_override_reason: string | null; // ≥20 chars if override

  // IoT (auto every 30s)
  temperature_t1_c: number | null;
  temperature_t2_c: number | null;
  air_humidity_percent: number | null;
  steam_injected_kg: number | null;
  energy_kwh: number | null;

  // Output measurement (3 manual readings — RG-HYD-05)
  humidity_out_1: number | null;
  humidity_out_2: number | null;
  humidity_out_3: number | null;
  humidity_out_avg: number | null;    // must be 20–26%
  conformity: HydrationConformity | null;

  // If non-conformant (RG-HYD-06: max 1 additional cycle)
  additional_cycle_count: number;
  non_conformity_action: HydrationNonConformityAction | null;

  // Timing
  started_at: string;
  ended_at: string | null;

  // Operators
  operator_name: string;
  inspector_name: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

// RG-HYD-03: routing table
export function suggestHydrationProgram(humidityPercent: number): HydrationProgram {
  if (humidityPercent < 18) return 'HYD-LONG';
  if (humidityPercent < 20) return 'HYD-COURT';
  if (humidityPercent <= 26) return 'SKIP';
  if (humidityPercent <= 28) return 'SEC-COURT';
  return 'SEC-LONG';
}

export const HYDRATION_PROGRAM_CONFIG: Record<
  HydrationProgram,
  { label: string; direction: 'hydration' | 'drying' | 'skip'; params: string }
> = {
  'HYD-LONG':  { label: 'HYD-LONG — Hydratation forte',   direction: 'hydration', params: 'Vapeur 50°C, 4–6h, HR air 95%' },
  'HYD-COURT': { label: 'HYD-COURT — Hydratation légère', direction: 'hydration', params: 'Vapeur 45°C, 1–2h, HR air 90%' },
  'SKIP':       { label: 'SKIP — Humidité dans la plage',  direction: 'skip',      params: 'Pas de traitement (20–26% OK)' },
  'SEC-COURT': { label: 'SEC-COURT — Séchage léger',      direction: 'drying',    params: 'Air chaud 60°C, 1–2h, HR 30%' },
  'SEC-LONG':  { label: 'SEC-LONG — Séchage long',        direction: 'drying',    params: 'Air chaud 70°C, 2–4h, HR 20%' },
};

// ─── Module 8: Triage Manuel ───────────────────────────────────────────────

export type TriageLine = 'L1' | 'L2' | 'L3' | 'L4';
export type TapeSpeed = 'LENT' | 'STANDARD' | 'RAPIDE';
export type TriageSessionStatus = 'EN_COURS' | 'PAUSE' | 'TERMINE' | 'INCIDENT';
export type TriageGrade = 'EXTRA' | 'CATEGORIE_I' | 'CATEGORIE_II' | 'REJETE';
export type SubLotDestination =
  | 'CONDITIONNEMENT_PREMIUM'
  | 'CONDITIONNEMENT_STANDARD'
  | 'TRANSFORMATION'
  | 'DESTRUCTION';

export const SUBLOT_SUFFIX: Record<TriageGrade, string> = {
  EXTRA: '-EX',
  CATEGORIE_I: '-C1',
  CATEGORIE_II: '-C2',
  REJETE: '-RJ',
};

export const SUBLOT_DESTINATION: Record<TriageGrade, SubLotDestination> = {
  EXTRA: 'CONDITIONNEMENT_PREMIUM',
  CATEGORIE_I: 'CONDITIONNEMENT_STANDARD',
  CATEGORIE_II: 'TRANSFORMATION',
  REJETE: 'DESTRUCTION',
};

export interface TriageQualityCheck {
  id: string;
  session_id: string;
  checked_at: string;
  inspector_name: string;
  sample_weight_kg: number;           // 1 kg per grade
  extra_error_count: number;
  cat1_error_count: number;
  cat2_error_count: number;
  reject_error_count: number;
  error_rate_percent: number;         // alert if <90% correct (RG-TRI-06)
  notes: string | null;
}

export interface TriageSubLot {
  id: string;
  session_id: string;
  parent_reception_id: string;
  parent_lot_number: string;
  grade: TriageGrade;
  lot_number: string;                 // parent number + suffix
  weight_kg: number;
  percent_of_parent: number;
  destination: SubLotDestination;
  qr_label_url: string | null;
  created_at: string;
}

export interface TriageSession {
  id: string;
  session_number: string;             // TRI-L1-20260608-001

  // Line & Lot
  line: TriageLine;
  parent_reception_id: string;
  parent_lot_number: string;
  variety: string | null;
  parent_weight_kg: number;
  status: TriageSessionStatus;

  // Workforce
  worker_count: number;
  worker_ids: string[];               // employee matricule list
  chef_ligne: string;
  tape_speed: TapeSpeed;

  // Grade weights (cumulative, updated in real-time)
  weight_extra_kg: number;
  weight_cat1_kg: number;
  weight_cat2_kg: number;
  weight_reject_kg: number;
  total_sorted_kg: number;

  // Computed (on read)
  extra_percent: number;
  cat1_percent: number;
  cat2_percent: number;
  reject_percent: number;
  yield_kg_per_hour: number | null;  // cadence (RG-TRI-05: alert if <60% target)

  // Quality scoring (RG-TRI-06: pause if <90%)
  quality_score_percent: number | null;

  // Timing
  started_at: string;
  ended_at: string | null;
  duration_minutes: number | null;

  // Relationships
  sub_lots: TriageSubLot[];
  quality_checks: TriageQualityCheck[];

  // Audit
  created_by: string;
  created_at: string;
  updated_at: string;
}

// ─── Module 9: Phase 2 Alert Codes ────────────────────────────────────────

export type Phase2AlertCode =
  | 'AL-FUM-01' | 'AL-FUM-02' | 'AL-FUM-03' | 'AL-FUM-04'
  | 'AL-FUM-05' | 'AL-FUM-06' | 'AL-FUM-07'
  | 'AL-NET-01' | 'AL-NET-02' | 'AL-NET-03'
  | 'AL-HYD-01' | 'AL-HYD-02'
  | 'AL-TRI-01' | 'AL-TRI-02' | 'AL-TRI-03'
  | 'AL-GLB-01' | 'AL-GLB-02' | 'AL-GLB-03'
  | 'AL-PKG-01' | 'AL-PKG-02' | 'AL-PKG-05';

export type Phase2AlertLevel = 'URGENCE' | 'CRITIQUE' | 'IMPORTANT' | 'PREVENTIF';

export const PHASE2_ALERT_CATALOG: Record<
  Phase2AlertCode,
  { module: string; description: string; level: Phase2AlertLevel; sla_minutes: number }
> = {
  'AL-FUM-01': { module: 'Fumigation', description: 'Concentration sous seuil',         level: 'CRITIQUE',  sla_minutes: 15  },
  'AL-FUM-02': { module: 'Fumigation', description: 'Température hors plage',           level: 'IMPORTANT', sla_minutes: 60  },
  'AL-FUM-03': { module: 'Fumigation', description: 'Fuite gaz externe',               level: 'URGENCE',   sla_minutes: 2   },
  'AL-FUM-04': { module: 'Fumigation', description: 'Calibration capteurs expirée',    level: 'PREVENTIF', sla_minutes: 1440 },
  'AL-FUM-05': { module: 'Fumigation', description: 'Stock produit bas',               level: 'PREVENTIF', sla_minutes: 1440 },
  'AL-FUM-06': { module: 'Fumigation', description: "Test d'étanchéité échoué",        level: 'CRITIQUE',  sla_minutes: 15  },
  'AL-FUM-07': { module: 'Fumigation', description: 'Tentative ouverture en cycle',    level: 'CRITIQUE',  sla_minutes: 15  },
  'AL-NET-01': { module: 'Nettoyage',  description: 'Rendement <92%',                  level: 'IMPORTANT', sla_minutes: 60  },
  'AL-NET-02': { module: 'Nettoyage',  description: 'Turbidité eau excessive (>200 NTU)', level: 'PREVENTIF', sla_minutes: 1440 },
  'AL-NET-03': { module: 'Nettoyage',  description: 'pH eau hors plage (6.5–8.5)',     level: 'IMPORTANT', sla_minutes: 60  },
  'AL-HYD-01': { module: 'Hydratation', description: 'Humidité sortie hors plage',     level: 'IMPORTANT', sla_minutes: 60  },
  'AL-HYD-02': { module: 'Hydratation', description: 'Température excessive séchage',  level: 'CRITIQUE',  sla_minutes: 15  },
  'AL-TRI-01': { module: 'Triage',     description: '% rejet >10%',                    level: 'IMPORTANT', sla_minutes: 60  },
  'AL-TRI-02': { module: 'Triage',     description: 'Cadence <60% objectif',           level: 'PREVENTIF', sla_minutes: 1440 },
  'AL-TRI-03': { module: 'Triage',     description: 'Score qualité tri <90%',          level: 'IMPORTANT', sla_minutes: 60  },
  'AL-GLB-01': { module: 'Global',          description: 'Lot bloqué >12h',                    level: 'IMPORTANT', sla_minutes: 60  },
  'AL-GLB-02': { module: 'Global',          description: 'Capteur IoT déconnecté >5 min',      level: 'CRITIQUE',  sla_minutes: 15  },
  'AL-GLB-03': { module: 'Global',          description: 'Tentative modification donnée CCP',  level: 'CRITIQUE',  sla_minutes: 15  },
  'AL-PKG-01': { module: 'Conditionnement', description: 'Taux échec pondéral >2%',            level: 'IMPORTANT', sla_minutes: 60  },
  'AL-PKG-02': { module: 'Conditionnement', description: 'Détection métal — arrêt immédiat',  level: 'URGENCE',   sla_minutes: 5   },
  'AL-PKG-05': { module: 'Conditionnement', description: 'Palette scellée sans N° emballage', level: 'IMPORTANT', sla_minutes: 60  },
};
