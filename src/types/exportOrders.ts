export type BuyerCountry = 'EU' | 'USA' | 'SA';
export type ContractLanguage = 'fr' | 'en' | 'ar';
export type ContractStatus = 'draft' | 'pending_approval' | 'approved' | 'locked';
export type ExportOrderStatus = 'draft' | 'confirmed' | 'shipped' | 'completed' | 'cancelled';

export interface ExportOrderLine {
  lot_id: string;
  lot_ref: string;
  product_name: string;
  net_weight_kg: number;
  unit_price: number;
  currency: string;
  origin_region?: string | null;
  origin_farm?: string | null;
  harvest_date?: string | null;
  quality_grade?: string | null;
  coa_ref?: string | null;
}

export interface ExportOrder {
  id: string;
  order_ref: string;
  customer_name: string;
  customer_country: BuyerCountry;
  customer_address?: string | null;
  customer_contact?: string | null;
  incoterms?: string | null;
  port_of_loading?: string | null;
  port_of_destination?: string | null;
  lines: ExportOrderLine[];
  total_weight_kg: number;
  total_amount: number;
  currency: string;
  status: ExportOrderStatus;
  contract_language: ContractLanguage;
  created_by?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface COADocument {
  id: string;
  coa_ref: string;
  batch_id: string;
  batch_ref?: string | null;
  // QC results (copied from inspection at time of COA creation)
  humidity_pct?: number | null;
  mold_score?: number | null;
  visual_grade?: string | null;
  net_weight_kg?: number | null;
  gross_weight_kg?: number | null;
  // Origin
  origin_region?: string | null;
  origin_farm?: string | null;
  harvest_date?: string | null;
  supplier_name?: string | null;
  certifications: string[];
  production_date?: string | null;
  expiry_date?: string | null;
  // Approval
  approved_by?: string | null;
  approved_at?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContractVersion {
  version: string;
  generated_at: string;
  generated_by?: string | null;
  doc_hash?: string | null;
  reason?: string | null;
}

export interface ExportContract {
  id: string;
  contract_ref: string;
  order_id: string;
  order_ref: string;
  language: ContractLanguage;
  buyer_country: BuyerCountry;
  status: ContractStatus;
  current_version: string;
  version_history: ContractVersion[];
  doc_hash?: string | null;
  locked_at?: string | null;
  locked_by?: string | null;
  created_at: string;
  updated_at: string;
}
