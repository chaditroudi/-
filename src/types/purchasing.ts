import { Material, Supplier } from './mes';

export type UrgencyLevel = 'low' | 'normal' | 'high' | 'critical';
export type RequisitionStatus = 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'ordered' | 'cancelled';

export type PurchaseOrderType = 'ferme' | 'sur_pied' | 'ouverte';
export type QualiteAttendue = 'Extra' | 'Cat.I' | 'Cat.II' | 'Mixte';
export type PaymentStatus = 'non_paye' | 'partiel' | 'paye';

export type LegacyPurchaseOrderStatus = 'sent' | 'partially_received' | 'received';
export type CanonicalPurchaseOrderStatus =
  | 'draft'
  | 'submitted'
  | 'confirmed'
  | 'partially_delivered'
  | 'delivered'
  | 'invoiced'
  | 'closed'
  | 'cancelled'
  | 'on_hold';
export type PurchaseOrderStatus = CanonicalPurchaseOrderStatus | LegacyPurchaseOrderStatus;

export type PurchaseOrderInvoiceStatus = 'not_invoiced' | 'partially_invoiced' | 'invoiced' | 'blocked';
export type PurchaseOrderReceiptStatus =
  | 'not_received'
  | 'partially_delivered'
  | 'delivered'
  | 'delivered_with_tolerance'
  | 'discrepancy';
export type PurchaseOrderLineStatus = 'open' | 'partially_delivered' | 'delivered' | 'closed' | 'discrepancy' | 'cancelled';
export type PurchaseOrderMatchStatus = 'pending' | 'matched' | 'mismatch' | 'under_review';
export type ReceiptQcOutcome = 'pending_qc' | 'accepted' | 'conditional' | 'rejected';

const LEGACY_STATUS_MAP: Record<LegacyPurchaseOrderStatus, CanonicalPurchaseOrderStatus> = {
  sent: 'submitted',
  partially_received: 'partially_delivered',
  received: 'delivered',
};

const roundQuantity = (value: number, precision = 3) => {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
};

const readQuantity = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const normalizePurchaseOrderStatus = (status?: string | null): CanonicalPurchaseOrderStatus => {
  if (!status) return 'draft';

  if (status in LEGACY_STATUS_MAP) {
    return LEGACY_STATUS_MAP[status as LegacyPurchaseOrderStatus];
  }

  switch (status) {
    case 'draft':
    case 'submitted':
    case 'confirmed':
    case 'partially_delivered':
    case 'delivered':
    case 'invoiced':
    case 'closed':
    case 'cancelled':
    case 'on_hold':
      return status;
    default:
      return 'draft';
  }
};

export const normalizePurchaseOrderInvoiceStatus = (
  status?: string | null,
): PurchaseOrderInvoiceStatus => {
  switch (status) {
    case 'partially_invoiced':
    case 'invoiced':
    case 'blocked':
      return status;
    default:
      return 'not_invoiced';
  }
};

export const normalizePurchaseOrderLineStatus = (
  status?: string | null,
): PurchaseOrderLineStatus => {
  switch (status) {
    case 'partially_delivered':
    case 'delivered':
    case 'closed':
    case 'discrepancy':
    case 'cancelled':
      return status;
    default:
      return 'open';
  }
};

/** Signature d'un niveau de la matrice d'approbation (§5.1 cahier P2P). */
export interface RequisitionApproval {
  level: string;
  label: string;
  approved_by: string;
  approved_at: string;
}

export interface PurchaseRequisition {
  id: string;
  requisition_number: string;
  requester_id: string | null;
  requester_name: string;
  department: string | null;
  material_id: string | null;
  material_name: string;
  quantity: number;
  unit: string;
  urgency: UrgencyLevel;
  justification: string | null;
  estimated_cost: number | null;
  preferred_supplier_id: string | null;
  status: RequisitionStatus;
  /** Niveaux déjà signés (matrice d'approbation par seuils). */
  approvals?: RequisitionApproval[] | null;
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  material?: Material;
  preferred_supplier?: Supplier;
}

export interface PurchaseOrderLine {
  id: string;
  order_id: string;
  line_number?: number | null;
  material_id: string | null;
  description: string;
  quantity: number;
  confirmed_quantity?: number | null;
  unit: string;
  unit_price: number;
  total_price: number;
  received_quantity: number;
  accepted_quantity?: number | null;
  rejected_quantity?: number | null;
  invoiced_quantity?: number | null;
  over_delivery_tolerance_pct?: number | null;
  under_delivery_tolerance_pct?: number | null;
  line_status?: PurchaseOrderLineStatus | null;
  reception_id: string | null;
  last_reception_id?: string | null;
  last_received_at?: string | null;
  last_supplier_lot?: string | null;
  notes: string | null;
  created_at: string;
  material?: Material;
}

export interface PurchaseOrder {
  id: string;
  order_number: string;
  supplier_id: string;
  requisition_id: string | null;
  status: CanonicalPurchaseOrderStatus;
  order_date: string;
  expected_delivery_date: string | null;
  actual_delivery_date: string | null;
  delivered_at?: string | null;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  currency: string;
  payment_terms: string | null;
  delivery_address: string | null;
  delivery_site?: string | null;
  incoterm?: string | null;
  supplier_reference?: string | null;
  notes: string | null;
  created_by: string | null;
  buyer_name?: string | null;
  approval_required?: boolean | null;
  approval_threshold?: number | null;
  approved_by: string | null;
  approved_at: string | null;
  submitted_at?: string | null;
  sent_at: string | null;
  confirmed_at: string | null;
  order_type?: PurchaseOrderType | null;
  variety?: string | null;
  quality_expected?: QualiteAttendue | null;
  bio_required?: boolean | null;
  tolerance_pct?: number | null;
  advance_paid?: number | null;
  transport_mode?: string | null;
  payment_status?: PaymentStatus | null;
  supplier_confirmed_at?: string | null;
  invoiced_at?: string | null;
  invoice_number?: string | null;
  invoice_date?: string | null;
  invoice_amount?: number | null;
  invoice_status?: PurchaseOrderInvoiceStatus | null;
  /** Tolérance de rapprochement 3 voies pour ce BC (RG-PAY-01). */
  invoice_tolerance_pct?: number | null;
  receipt_status?: PurchaseOrderReceiptStatus | null;
  matching_status?: PurchaseOrderMatchStatus | null;
  goods_receipt_count?: number | null;
  line_count?: number | null;
  created_at: string;
  updated_at: string;
  supplier?: Supplier;
  requisition?: PurchaseRequisition;
  lines?: PurchaseOrderLine[];
}

export const getPurchaseOrderLineTargetQuantity = (line: Partial<PurchaseOrderLine>) =>
  roundQuantity(readQuantity(line.confirmed_quantity ?? line.quantity));

export const getPurchaseOrderLineRemainingQuantity = (line: Partial<PurchaseOrderLine>) =>
  Math.max(0, roundQuantity(getPurchaseOrderLineTargetQuantity(line) - readQuantity(line.received_quantity)));

export const computePurchaseOrderLineStatus = (
  line: Partial<PurchaseOrderLine>,
): PurchaseOrderLineStatus => {
  const explicitStatus = normalizePurchaseOrderLineStatus(line.line_status);
  if (explicitStatus === 'cancelled') return explicitStatus;

  const targetQuantity = getPurchaseOrderLineTargetQuantity(line);
  const receivedQuantity = roundQuantity(readQuantity(line.received_quantity));
  const acceptedQuantity = roundQuantity(readQuantity(line.accepted_quantity));
  const rejectedQuantity = roundQuantity(readQuantity(line.rejected_quantity));
  const invoicedQuantity = roundQuantity(readQuantity(line.invoiced_quantity));

  if (acceptedQuantity + rejectedQuantity > receivedQuantity + 0.0001) {
    return 'discrepancy';
  }

  if (targetQuantity > 0 && invoicedQuantity >= targetQuantity && acceptedQuantity + rejectedQuantity >= targetQuantity) {
    return 'closed';
  }

  if (receivedQuantity <= 0) {
    return 'open';
  }

  if (receivedQuantity + 0.0001 < targetQuantity) {
    return 'partially_delivered';
  }

  return 'delivered';
};

const deriveReceiptStatusFromLines = (lines: PurchaseOrderLine[]) => {
  if (lines.length === 0) return 'not_received' as const;

  const hasReceipts = lines.some((line) => readQuantity(line.received_quantity) > 0);
  if (!hasReceipts) return 'not_received' as const;

  const hasToleranceReceipt = lines.some(
    (line) => readQuantity(line.received_quantity) > getPurchaseOrderLineTargetQuantity(line) + 0.0001,
  );
  const allDelivered = lines.every((line) => {
    const lineStatus = computePurchaseOrderLineStatus(line);
    return lineStatus === 'delivered' || lineStatus === 'closed';
  });

  if (allDelivered) {
    return hasToleranceReceipt ? ('delivered_with_tolerance' as const) : ('delivered' as const);
  }

  return 'partially_delivered' as const;
};

export const normalizePurchaseOrderLine = (line: PurchaseOrderLine): PurchaseOrderLine => {
  const normalized: PurchaseOrderLine = {
    ...line,
    line_number: line.line_number ?? null,
    quantity: readQuantity(line.quantity),
    confirmed_quantity: line.confirmed_quantity ?? line.quantity,
    unit_price: readQuantity(line.unit_price),
    total_price: readQuantity(line.total_price, roundQuantity(readQuantity(line.quantity) * readQuantity(line.unit_price), 2)),
    received_quantity: readQuantity(line.received_quantity),
    accepted_quantity: readQuantity(line.accepted_quantity),
    rejected_quantity: readQuantity(line.rejected_quantity),
    invoiced_quantity: readQuantity(line.invoiced_quantity),
    over_delivery_tolerance_pct: readQuantity(line.over_delivery_tolerance_pct),
    under_delivery_tolerance_pct: readQuantity(line.under_delivery_tolerance_pct, 100),
    line_status: 'open',
    last_reception_id: line.last_reception_id ?? line.reception_id ?? null,
    last_received_at: line.last_received_at ?? null,
    last_supplier_lot: line.last_supplier_lot ?? null,
  };

  normalized.line_status = computePurchaseOrderLineStatus(normalized);
  return normalized;
};

export const normalizePurchaseOrder = (order: PurchaseOrder): PurchaseOrder => {
  const lines = (order.lines || []).map(normalizePurchaseOrderLine);
  const receiptStatus = deriveReceiptStatusFromLines(lines);
  const invoiceStatus = normalizePurchaseOrderInvoiceStatus(order.invoice_status);
  const explicitStatus = normalizePurchaseOrderStatus(order.status);

  let status = explicitStatus;
  if (status !== 'cancelled') {
    if (invoiceStatus === 'invoiced' && (receiptStatus === 'delivered' || receiptStatus === 'delivered_with_tolerance')) {
      status = 'invoiced';
    } else if ((order.receipt_status || null) === 'discrepancy') {
      status = 'on_hold';
    } else if (receiptStatus === 'delivered' || receiptStatus === 'delivered_with_tolerance') {
      status = 'delivered';
    } else if (receiptStatus === 'partially_delivered') {
      status = 'partially_delivered';
    }
  }

  const goodsReceiptCount = order.goods_receipt_count ?? Array.from(
    new Set(
      lines
        .map((line) => line.last_reception_id || line.reception_id)
        .filter(Boolean),
    ),
  ).length;

  return {
    ...order,
    status,
    lines,
    invoice_status: invoiceStatus,
    receipt_status: order.receipt_status === 'discrepancy' ? 'discrepancy' : receiptStatus,
    goods_receipt_count: goodsReceiptCount,
    line_count: order.line_count ?? lines.length,
    approval_required: order.approval_required ?? readQuantity(order.total_amount) >= readQuantity(order.approval_threshold, 5000),
    approval_threshold: readQuantity(order.approval_threshold, 5000),
  };
};

export const isPurchaseOrderReceivable = (status?: string | null) => {
  const canonicalStatus = normalizePurchaseOrderStatus(status);
  return ['submitted', 'confirmed', 'partially_delivered', 'on_hold'].includes(canonicalStatus);
};

export const urgencyLabels: Record<UrgencyLevel, string> = {
  low: 'Basse',
  normal: 'Normale',
  high: 'Haute',
  critical: 'Critique',
};

export const urgencyColors: Record<UrgencyLevel, string> = {
  low: 'bg-gray-500',
  normal: 'bg-blue-500',
  high: 'bg-orange-500',
  critical: 'bg-red-500',
};

export const requisitionStatusLabels: Record<RequisitionStatus, string> = {
  draft: 'Brouillon',
  pending_approval: 'En attente validation',
  approved: 'Validée',
  rejected: 'Refusée',
  ordered: 'Commandée',
  cancelled: 'Annulée',
};

export const requisitionStatusColors: Record<RequisitionStatus, string> = {
  draft: 'bg-gray-500',
  pending_approval: 'bg-yellow-500',
  approved: 'bg-green-500',
  rejected: 'bg-red-500',
  ordered: 'bg-blue-500',
  cancelled: 'bg-gray-400',
};

export const purchaseOrderStatusLabels: Record<CanonicalPurchaseOrderStatus, string> = {
  draft: 'Brouillon',
  submitted: 'Soumis',
  confirmed: 'Confirmé',
  partially_delivered: 'Livraison partielle',
  delivered: 'Livré',
  invoiced: 'Facturé',
  closed: 'Clôturé',
  cancelled: 'Annulé',
  on_hold: 'En litige',
};

export const purchaseOrderStatusColors: Record<CanonicalPurchaseOrderStatus, string> = {
  draft: 'bg-gray-500',
  submitted: 'bg-blue-500',
  confirmed: 'bg-emerald-500',
  partially_delivered: 'bg-orange-500',
  delivered: 'bg-green-600',
  invoiced: 'bg-violet-600',
  closed: 'bg-slate-600',
  cancelled: 'bg-red-500',
  on_hold: 'bg-amber-600',
};

export const purchaseOrderReceiptStatusLabels: Record<PurchaseOrderReceiptStatus, string> = {
  not_received: 'Non reçue',
  partially_delivered: 'Partielle',
  delivered: 'Livrée',
  delivered_with_tolerance: 'Livrée avec tolérance',
  discrepancy: 'Écart réception',
};

export const purchaseOrderReceiptStatusColors: Record<PurchaseOrderReceiptStatus, string> = {
  not_received: 'border-slate-200 text-slate-600',
  partially_delivered: 'border-amber-200 text-amber-700',
  delivered: 'border-emerald-200 text-emerald-700',
  delivered_with_tolerance: 'border-blue-200 text-blue-700',
  discrepancy: 'border-red-200 text-red-700',
};

export const purchaseOrderInvoiceStatusLabels: Record<PurchaseOrderInvoiceStatus, string> = {
  not_invoiced: 'Non facturé',
  partially_invoiced: 'Facturation partielle',
  invoiced: 'Facturé',
  blocked: 'Blocage facture',
};

export const purchaseOrderInvoiceStatusColors: Record<PurchaseOrderInvoiceStatus, string> = {
  not_invoiced: 'border-slate-200 text-slate-600',
  partially_invoiced: 'border-amber-200 text-amber-700',
  invoiced: 'border-violet-200 text-violet-700',
  blocked: 'border-red-200 text-red-700',
};

export const orderTypeLabels: Record<PurchaseOrderType, string> = {
  ferme: 'Ferme',
  sur_pied: 'Sur pied (شجرة)',
  ouverte: 'Ouverte (cadre)',
};

export const orderTypeColors: Record<PurchaseOrderType, string> = {
  ferme: 'bg-blue-500',
  sur_pied: 'bg-emerald-600',
  ouverte: 'bg-purple-500',
};

export const qualiteAttendueLabels: Record<QualiteAttendue, string> = {
  Extra: 'Extra',
  'Cat.I': 'Catégorie I',
  'Cat.II': 'Catégorie II',
  Mixte: 'Mixte',
};

export const paymentStatusLabels: Record<PaymentStatus, string> = {
  non_paye: 'Non payé',
  partiel: 'Paiement partiel',
  paye: 'Payé',
};

export const paymentStatusColors: Record<PaymentStatus, string> = {
  non_paye: 'border-slate-200 text-slate-600',
  partiel: 'border-amber-200 text-amber-700',
  paye: 'border-emerald-200 text-emerald-700',
};
