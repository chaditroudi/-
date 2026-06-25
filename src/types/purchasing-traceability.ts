import type { ReceiptQcOutcome } from './purchasing';

export type AttachmentType =
  | 'coa'
  | 'phytosanitary'
  | 'msds'
  | 'spec'
  | 'invoice'
  | 'other';

export interface StorageLocation {
  warehouse: string;
  zone?: string | null;
  pallet?: string | null;
  bin?: string | null;
}

export interface ReceivingLot {
  id: string;
  purchase_order_id: string;
  purchase_order_line_id: string;
  reception_id: string | null;
  reception_lot_id: string | null;
  supplier_lot: string | null;
  internal_lot: string | null;
  expiry_date: string | null;
  ddm_date: string | null;
  location?: StorageLocation | null;
  received_quantity: number;
  accepted_quantity?: number | null;
  rejected_quantity?: number | null;
  unit: string;
  qc_outcome?: ReceiptQcOutcome | null;
  received_at: string;
  received_by: string | null;
  notes: string | null;
}

export interface PurchasingAttachment {
  id: string;
  entity_type: 'purchase_order' | 'purchase_order_receiving_lot';
  entity_id: string;
  type: AttachmentType;
  file_name: string;
  file_url: string;
  mime_type: string | null;
  size_bytes: number | null;
  uploaded_at: string;
  uploaded_by: string | null;
}
