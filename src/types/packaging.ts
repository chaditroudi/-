/**
 * Royal Palm MES — Module 11: Packaging & Étiquettes
 * BOM · Label templates · Packaging orders · Palettes · Private label
 */

// ─── Formats & matériaux ────────────────────────────────────────────────────

export type PackagingFormat =
  | 'BARQUETTE_125G'
  | 'BARQUETTE_250G'
  | 'BARQUETTE_500G'
  | 'BOITE_500G'
  | 'BOITE_1KG'
  | 'SAC_2KG'
  | 'SAC_5KG'
  | 'SAC_10KG'
  | 'VRAC_25KG';

export type BoxMaterial =
  | 'CARTON'
  | 'PLASTIQUE'
  | 'SACHET_PP'
  | 'SACHET_PE'
  | 'BARQUETTE_PLASTIQUE';

export const PACKAGING_FORMAT_CONFIG: Record<
  PackagingFormat,
  { label: string; net_weight_g: number; overhead_g: number }
> = {
  BARQUETTE_125G:  { label: 'Barquette 125 g',   net_weight_g: 125,   overhead_g: 30  },
  BARQUETTE_250G:  { label: 'Barquette 250 g',   net_weight_g: 250,   overhead_g: 35  },
  BARQUETTE_500G:  { label: 'Barquette 500 g',   net_weight_g: 500,   overhead_g: 40  },
  BOITE_500G:      { label: 'Boîte carton 500 g', net_weight_g: 500,   overhead_g: 150 },
  BOITE_1KG:       { label: 'Boîte carton 1 kg',  net_weight_g: 1000,  overhead_g: 200 },
  SAC_2KG:         { label: 'Sac 2 kg',           net_weight_g: 2000,  overhead_g: 25  },
  SAC_5KG:         { label: 'Sac 5 kg',           net_weight_g: 5000,  overhead_g: 35  },
  SAC_10KG:        { label: 'Sac 10 kg',          net_weight_g: 10000, overhead_g: 50  },
  VRAC_25KG:       { label: 'Vrac 25 kg',         net_weight_g: 25000, overhead_g: 100 },
};

export const BOX_MATERIAL_LABELS: Record<BoxMaterial, string> = {
  CARTON:              'Carton ondulé',
  PLASTIQUE:           'Boîte plastique rigide',
  SACHET_PP:           'Sachet PP',
  SACHET_PE:           'Sachet PE',
  BARQUETTE_PLASTIQUE: 'Barquette plastique',
};

// ─── BOM (Nomenclature conditionnement) ────────────────────────────────────

export interface PackagingBOMItem {
  id: string;
  name: string;                         // "Boîte 500g Deglet Nour Premium"
  sku: string;                          // internal SKU: "PKG-BOX-500-DN-RP"
  format: PackagingFormat;
  net_weight_g: number;                 // may differ slightly from format default
  gross_weight_g: number;               // net + packaging overhead
  box_material: BoxMaterial;
  boxes_per_layer: number;              // for palette build
  layers_per_palette: number;
  label_template_id: string | null;
  label_template_name: string | null;
  is_private_label: boolean;
  private_label_client_id: string | null;
  private_label_client_name: string | null;
  is_active: boolean;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

// ─── Label templates ────────────────────────────────────────────────────────

export type LabelBrand    = 'ROYAL_PALM' | 'PRIVATE_LABEL';
export type LabelLanguage = 'FR' | 'EN' | 'AR' | 'DE' | 'FR_EN';
export type LabelStatus   = 'BROUILLON' | 'VALIDE' | 'ARCHIVE';

export const LABEL_LANGUAGE_LABELS: Record<LabelLanguage, string> = {
  FR:    'Français',
  EN:    'English',
  AR:    'عربي',
  DE:    'Deutsch',
  FR_EN: 'Français / English',
};

export interface LabelTemplate {
  id: string;
  name: string;
  version: string;                      // "v2.1"
  brand: LabelBrand;
  client_name: string | null;           // populated for PRIVATE_LABEL
  language: LabelLanguage;
  market: string;                       // country code: "TN", "FR", "DE", "UK"
  product_name: string;
  variety: string | null;
  origin: string;                       // "Tunisie – Région de Tozeur"
  net_weight_g: number;
  ingredients: string;
  allergens: string | null;
  storage_temp: string;
  use_by_days: number;
  gtin: string | null;                  // GS1 GTIN-13 (13 digits)
  status: LabelStatus;
  approved_by: string | null;
  approved_at: string | null;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

// ─── Private label clients ──────────────────────────────────────────────────

export interface PrivateLabelClient {
  id: string;
  name: string;
  code: string;                         // "CARREFOUR-FR"
  country: string;
  contact_name: string | null;
  contact_email: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

// ─── Packaging orders ───────────────────────────────────────────────────────

export type PackagingOrderStatus = 'PLANIFIE' | 'EN_COURS' | 'PAUSE' | 'TERMINE' | 'ANNULE';
export type PackagingLine        = 'L-PKG-1' | 'L-PKG-2' | 'L-PKG-3';
export type TriageGradeInput     = 'EXTRA' | 'CATEGORIE_I' | 'CATEGORIE_II';

export const PACKAGING_LINE_LABELS: Record<PackagingLine, string> = {
  'L-PKG-1': 'Ligne PKG-1',
  'L-PKG-2': 'Ligne PKG-2',
  'L-PKG-3': 'Ligne PKG-3',
};

export const ORDER_STATUS_STYLE: Record<PackagingOrderStatus, string> = {
  PLANIFIE: 'bg-slate-100 text-slate-700',
  EN_COURS: 'bg-blue-100 text-blue-700',
  PAUSE:    'bg-amber-100 text-amber-700',
  TERMINE:  'bg-green-100 text-green-700',
  ANNULE:   'bg-red-100 text-red-700',
};

export interface PackagingOrder {
  id: string;
  order_number: string;                 // PKG-20260608-001
  status: PackagingOrderStatus;

  // Input lot
  source_sublot_id: string;
  source_lot_number: string;
  source_weight_kg: number;
  grade: TriageGradeInput;

  // BOM + Label
  bom_id: string;
  bom_name: string;
  bom_format: PackagingFormat;
  label_template_id: string;
  label_template_name: string;

  // Targets (computed at creation)
  target_units: number;                 // floor(source_weight_kg * 1000 / bom.net_weight_g)

  // Execution counters
  produced_units: number;
  rejected_units: number;
  checkweigher_count: number;           // total units checked
  checkweigher_failures: number;        // units outside ±g tolerance
  metal_detector_failures: number;      // any failure → STOP

  // Line
  line: PackagingLine;
  operator_name: string;
  chef_ligne: string | null;
  worker_count: number;

  // Timing
  planned_at: string;
  started_at: string | null;
  ended_at: string | null;
  duration_minutes: number | null;

  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

// ─── Palettes ───────────────────────────────────────────────────────────────

export type PaletteStatus = 'EN_COURS' | 'SCELLE' | 'EXPEDIE';

export interface PackagingPalette {
  id: string;
  palette_number: string;               // PAL-20260608-001
  order_id: string;
  order_number: string;
  status: PaletteStatus;
  bom_id: string;
  box_count: number;
  gross_weight_kg: number;
  net_weight_kg: number;
  seal_number: string | null;           // stretch-wrap barcode
  sealed_by: string | null;
  sealed_at: string | null;
  sscc: string | null;                  // GS1 SSCC-18
  storage_location_id: string | null;
  created_at: string;
  updated_at: string;
}

// ─── KPI aggregates ─────────────────────────────────────────────────────────

export interface PackagingKpis {
  active_orders: number;
  planned_orders: number;
  completed_today: number;
  total_produced_today: number;
  palettes_sealed_today: number;
  avg_yield_pct: number | null;
}

// ─── Alert codes ────────────────────────────────────────────────────────────

export type PackagingAlertCode =
  | 'AL-PKG-01'   // checkweigher failure rate >2%
  | 'AL-PKG-02'   // metal detector failure — immediate stop
  | 'AL-PKG-03'   // label not VALIDE used in order
  | 'AL-PKG-04'   // yield <95% (produced/target)
  | 'AL-PKG-05';  // palette SSCC missing at seal

export const PACKAGING_ALERT_CATALOG: Record<
  PackagingAlertCode,
  { description: string; level: 'URGENCE' | 'CRITIQUE' | 'IMPORTANT' | 'PREVENTIF'; sla_minutes: number }
> = {
  'AL-PKG-01': { description: 'Taux d\'échec pondéral >2%',          level: 'IMPORTANT',  sla_minutes: 60   },
  'AL-PKG-02': { description: 'Détection métal — arrêt immédiat',    level: 'URGENCE',    sla_minutes: 2    },
  'AL-PKG-03': { description: 'Étiquette non validée utilisée',      level: 'CRITIQUE',   sla_minutes: 15   },
  'AL-PKG-04': { description: 'Rendement conditionn. <95%',          level: 'IMPORTANT',  sla_minutes: 60   },
  'AL-PKG-05': { description: 'Palette scellée sans SSCC',           level: 'PREVENTIF',  sla_minutes: 1440 },
};

// ─── Helpers ────────────────────────────────────────────────────────────────

export function computeTargetUnits(sourceWeightKg: number, netWeightG: number): number {
  return Math.floor((sourceWeightKg * 1000) / netWeightG);
}

export function computeBoxesPerPalette(boxesPerLayer: number, layersPerPalette: number): number {
  return boxesPerLayer * layersPerPalette;
}

export function computePaletteGrossWeightKg(
  boxCount: number,
  grossWeightG: number,
  palletWeightKg = 25,
): number {
  return parseFloat(((boxCount * grossWeightG) / 1000 + palletWeightKg).toFixed(2));
}

/** GS1 check digit for GTIN-13 or SSCC-18 (same algorithm). */
export function computeGS1CheckDigit(digits: string): string {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    const d = parseInt(digits[digits.length - 1 - i], 10);
    sum += d * (i % 2 === 0 ? 3 : 1);
  }
  return String((10 - (sum % 10)) % 10);
}

/** Generate SSCC-18 from a serial counter (extension=0, company prefix=09999999). */
export function generateSSCC(serialNumber: number): string {
  const extension = '0';
  const companyPrefix = '09999999';    // Royal Palm placeholder — replace with real GS1 prefix
  const serial = String(serialNumber).padStart(8, '0');
  const base17 = extension + companyPrefix + serial;
  return base17 + computeGS1CheckDigit(base17);
}

/** Format a GS1-128 human-readable string for a product label. */
export function formatGS1HRI(params: {
  gtin?: string | null;
  lotNumber: string;
  productionDate: string;  // YYMMDD
  expiryDate: string;      // YYMMDD
  netWeightG: number;
}): string {
  const parts: string[] = [];
  if (params.gtin) parts.push(`(01)${params.gtin}`);
  parts.push(`(10)${params.lotNumber}`);
  parts.push(`(11)${params.productionDate}`);
  parts.push(`(17)${params.expiryDate}`);
  parts.push(`(3102)${String(Math.round(params.netWeightG)).padStart(6, '0')}`);
  return parts.join(' ');
}
