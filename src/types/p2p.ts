// ── Approval Matrix ────────────────────────────────────────────────────────────
export type ApprovalLevel = 'dept_manager' | 'purchasing_manager' | 'daf' | 'general_direction';

export interface ApprovalMatrixStep {
  level: ApprovalLevel;
  threshold_gte: number;
  label: string;
}

export const APPROVAL_MATRIX: ApprovalMatrixStep[] = [
  { level: 'dept_manager',       threshold_gte: 0,     label: 'Responsable département' },
  { level: 'purchasing_manager', threshold_gte: 1000,  label: 'Responsable Achats' },
  { level: 'daf',                threshold_gte: 10000, label: 'DAF' },
  { level: 'general_direction',  threshold_gte: 50000, label: 'Direction Générale' },
];

export const getRequiredApprovalLevels = (
  amount: number,
  matrix: ApprovalMatrixStep[] = APPROVAL_MATRIX,
): ApprovalLevel[] => matrix.filter((s) => amount >= s.threshold_gte).map((s) => s.level);

// ── Site / Company ─────────────────────────────────────────────────────────────
export type SiteCode = 'ROYALE_PALM' | 'ECODATTE' | 'BIOSCHA';

export interface SiteConfig {
  code: SiteCode;
  name: string;
  bio_certification_required: boolean;
  phytosanitary_required: boolean;
  lot_traceability_required: boolean;
  dluo_required: boolean;
  fds_required: boolean;
  forex_enabled: boolean;
  systematic_quarantine: boolean;
  cert_alert_days: number[];
}

export const SITE_CONFIGS: Record<SiteCode, SiteConfig> = {
  ROYALE_PALM: {
    code: 'ROYALE_PALM',
    name: 'Royale Palm Tunisia',
    bio_certification_required: false,
    phytosanitary_required: false,
    lot_traceability_required: false,
    dluo_required: false,
    fds_required: false,
    forex_enabled: true,
    systematic_quarantine: false,
    cert_alert_days: [60, 30],
  },
  ECODATTE: {
    code: 'ECODATTE',
    name: 'EcoDatte',
    bio_certification_required: true,
    phytosanitary_required: true,
    lot_traceability_required: false,
    dluo_required: false,
    fds_required: false,
    forex_enabled: false,
    systematic_quarantine: false,
    cert_alert_days: [60, 30],
  },
  BIOSCHA: {
    code: 'BIOSCHA',
    name: 'Bioscha',
    bio_certification_required: false,
    phytosanitary_required: false,
    lot_traceability_required: true,
    dluo_required: true,
    fds_required: true,
    forex_enabled: false,
    systematic_quarantine: true,
    cert_alert_days: [60, 30],
  },
};

export const SITE_LABELS: Record<SiteCode, string> = {
  ROYALE_PALM: 'Royale Palm Tunisia',
  ECODATTE: 'EcoDatte',
  BIOSCHA: 'Bioscha',
};

// ── RFQ (Appel d'offres) ───────────────────────────────────────────────────────
export type RFQStatus = 'BROUILLON' | 'ENVOYEE' | 'REPONSE_RECUE' | 'EVALUEE' | 'CLOTUREE' | 'ANNULEE';

export interface RFQRequest {
  id: string;
  rfq_number: string;
  requisition_id: string | null;
  site: SiteCode | null;
  title: string;
  description: string | null;
  deadline_response: string | null;
  status: RFQStatus;
  supplier_ids: string[];
  created_by: string | null;
  selected_supplier_id: string | null;
  selected_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface RFQResponse {
  id: string;
  rfq_id: string;
  supplier_id: string;
  supplier_name: string;
  unit_price: number;
  total_amount: number;
  currency: string;
  delivery_days: number | null;
  validity_days: number | null;
  notes: string | null;
  received_at: string;
  score: number | null;
  rank: number | null;
  created_at: string;
}

export const rfqStatusLabels: Record<RFQStatus, string> = {
  BROUILLON: 'Brouillon',
  ENVOYEE: 'Envoyée',
  REPONSE_RECUE: 'Réponse reçue',
  EVALUEE: 'Évaluée',
  CLOTUREE: 'Clôturée',
  ANNULEE: 'Annulée',
};

export const rfqStatusColors: Record<RFQStatus, string> = {
  BROUILLON: 'bg-gray-100 text-gray-700',
  ENVOYEE: 'bg-blue-100 text-blue-700',
  REPONSE_RECUE: 'bg-amber-100 text-amber-700',
  EVALUEE: 'bg-purple-100 text-purple-700',
  CLOTUREE: 'bg-green-100 text-green-700',
  ANNULEE: 'bg-red-100 text-red-700',
};

// ── Goods Receipt (Bon de Réception) ──────────────────────────────────────────
export type GoodsReceiptStatus =
  | 'ATTENDUE'
  | 'EN_QUARANTAINE'
  | 'ACCEPTEE'
  | 'PARTIELLEMENT_ACCEPTEE'
  | 'REFUSEE';

export interface GoodsReceipt {
  id: string;
  receipt_number: string;
  purchase_order_id: string | null;
  purchase_order_number: string | null;
  supplier_id: string;
  supplier_name: string | null;
  site: SiteCode | null;
  expected_date: string | null;
  received_date: string | null;
  status: GoodsReceiptStatus;
  quarantine_reason: string | null;
  release_decision: 'ACCEPTE' | 'REFUSE' | null;
  release_by: string | null;
  release_at: string | null;
  qc_notes: string | null;
  reception_id: string | null;
  // Bioscha-specific
  dluo_date: string | null;
  fds_document: string | null;
  // EcoDatte-specific
  bio_cert_ref: string | null;
  phyto_doc_ref: string | null;
  total_received_qty: number;
  total_accepted_qty: number;
  total_rejected_qty: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface GoodsReceiptLine {
  id: string;
  receipt_id: string;
  purchase_order_line_id: string | null;
  material_id: string | null;
  description: string;
  ordered_qty: number;
  received_qty: number;
  accepted_qty: number;
  rejected_qty: number;
  unit: string;
  rejection_reason: string | null;
  lot_number: string | null;
  dluo_date: string | null;
  notes: string | null;
}

export const goodsReceiptStatusLabels: Record<GoodsReceiptStatus, string> = {
  ATTENDUE: 'Attendue',
  EN_QUARANTAINE: 'En quarantaine',
  ACCEPTEE: 'Acceptée',
  PARTIELLEMENT_ACCEPTEE: 'Partielle',
  REFUSEE: 'Refusée',
};

export const goodsReceiptStatusColors: Record<GoodsReceiptStatus, string> = {
  ATTENDUE: 'bg-slate-100 text-slate-700',
  EN_QUARANTAINE: 'bg-amber-100 text-amber-700',
  ACCEPTEE: 'bg-emerald-100 text-emerald-700',
  PARTIELLEMENT_ACCEPTEE: 'bg-orange-100 text-orange-700',
  REFUSEE: 'bg-red-100 text-red-700',
};

// ── Supplier Invoice ───────────────────────────────────────────────────────────
export type InvoiceStatus =
  | 'RECUE'
  | 'EN_RAPPROCHEMENT'
  | 'BON_A_PAYER'
  | 'EN_LITIGE'
  | 'PAYEE'
  | 'CLOTUREE';

export type MatchResult = 'MATCH' | 'ECART_TOLERANCE' | 'ECART_BLOQUANT' | 'NON_VERIFIE';

export interface SupplierInvoice {
  id: string;
  invoice_number: string;
  supplier_id: string;
  supplier_name: string | null;
  purchase_order_id: string | null;
  purchase_order_number: string | null;
  goods_receipt_id: string | null;
  site: SiteCode | null;
  invoice_date: string;
  due_date: string | null;
  currency: string;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  status: InvoiceStatus;
  bc_amount: number | null;
  br_amount: number | null;
  variance_amount: number | null;
  variance_pct: number | null;
  tolerance_pct: number;
  match_result: MatchResult;
  match_notes: string | null;
  matched_by: string | null;
  matched_at: string | null;
  payment_reference: string | null;
  paid_at: string | null;
  paid_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export const invoiceStatusLabels: Record<InvoiceStatus, string> = {
  RECUE: 'Reçue',
  EN_RAPPROCHEMENT: 'En rapprochement',
  BON_A_PAYER: 'Bon à payer',
  EN_LITIGE: 'En litige',
  PAYEE: 'Payée',
  CLOTUREE: 'Clôturée',
};

export const invoiceStatusColors: Record<InvoiceStatus, string> = {
  RECUE: 'bg-slate-100 text-slate-700',
  EN_RAPPROCHEMENT: 'bg-blue-100 text-blue-700',
  BON_A_PAYER: 'bg-emerald-100 text-emerald-700',
  EN_LITIGE: 'bg-red-100 text-red-700',
  PAYEE: 'bg-green-100 text-green-700',
  CLOTUREE: 'bg-gray-100 text-gray-600',
};

export const matchResultLabels: Record<MatchResult, string> = {
  MATCH: 'Concordance parfaite',
  ECART_TOLERANCE: 'Écart dans tolérance',
  ECART_BLOQUANT: 'Écart bloquant',
  NON_VERIFIE: 'Non vérifié',
};

export const matchResultColors: Record<MatchResult, string> = {
  MATCH: 'text-emerald-700 bg-emerald-50',
  ECART_TOLERANCE: 'text-amber-700 bg-amber-50',
  ECART_BLOQUANT: 'text-red-700 bg-red-50',
  NON_VERIFIE: 'text-slate-600 bg-slate-50',
};

export const computeMatchResult = (
  bcAmount: number,
  brAmount: number,
  invoiceAmount: number,
  tolerancePct: number,
): { result: MatchResult; varianceAmount: number; variancePct: number } => {
  const ref = Math.max(bcAmount, brAmount);
  if (ref === 0) return { result: 'NON_VERIFIE', varianceAmount: 0, variancePct: 0 };
  const varianceAmount = invoiceAmount - ref;
  const variancePct = (Math.abs(varianceAmount) / ref) * 100;
  let result: MatchResult;
  if (variancePct === 0) result = 'MATCH';
  else if (variancePct <= tolerancePct) result = 'ECART_TOLERANCE';
  else result = 'ECART_BLOQUANT';
  return { result, varianceAmount, variancePct };
};

// ── Supplier Certificate ───────────────────────────────────────────────────────
export type CertificateType =
  | 'BIO_AB'
  | 'BIO_EU'
  | 'HACCP'
  | 'ISO_22000'
  | 'BRC'
  | 'IFS'
  | 'GLOBALGAP'
  | 'PHYTOSANITAIRE'
  | 'KOSHER'
  | 'HALAL'
  | 'AUTRE';

export type ExpiryAlertLevel = 'NONE' | 'J60' | 'J30' | 'EXPIRED';

export interface SupplierCertificate {
  id: string;
  supplier_id: string;
  supplier_name: string | null;
  certificate_type: CertificateType;
  certificate_number: string | null;
  issuer: string | null;
  issue_date: string | null;
  expiry_date: string;
  document_ref: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export const certificateTypeLabels: Record<CertificateType, string> = {
  BIO_AB: 'Bio AB (France)',
  BIO_EU: 'Bio EU',
  HACCP: 'HACCP',
  ISO_22000: 'ISO 22000',
  BRC: 'BRC',
  IFS: 'IFS',
  GLOBALGAP: 'GlobalGAP',
  PHYTOSANITAIRE: 'Phytosanitaire',
  KOSHER: 'Kosher',
  HALAL: 'Halal',
  AUTRE: 'Autre',
};

export const getExpiryAlertLevel = (expiryDate: string, alertDays: number[] = [60, 30]): ExpiryAlertLevel => {
  const normalized = [...alertDays]
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((a, b) => a - b);
  const shortWindow = normalized[0] ?? 30;
  const longWindow = normalized[1] ?? normalized[0] ?? 60;
  const diff = (new Date(expiryDate).getTime() - Date.now()) / 86_400_000;
  if (diff < 0) return 'EXPIRED';
  if (diff <= shortWindow) return 'J30';
  if (diff <= longWindow) return 'J60';
  return 'NONE';
};

export const expiryAlertLabels: Record<ExpiryAlertLevel, string> = {
  NONE: 'Valide',
  J60: 'Expire dans 60j',
  J30: 'Expire dans 30j',
  EXPIRED: 'Expiré',
};

export const expiryAlertColors: Record<ExpiryAlertLevel, string> = {
  NONE: 'text-emerald-700 bg-emerald-50',
  J60: 'text-amber-700 bg-amber-50',
  J30: 'text-orange-700 bg-orange-50',
  EXPIRED: 'text-red-700 bg-red-50',
};

// ── Budget Center ──────────────────────────────────────────────────────────────
export interface BudgetCenter {
  id: string;
  code: string;
  name: string;
  site: SiteCode | null;
  annual_budget: number;
  consumed: number;
  committed: number;
  currency: string;
  fiscal_year: number;
  created_at: string;
  updated_at: string;
}
