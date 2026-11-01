import type { ReceptionV2 } from './reception';

/** Existing supplier-history endpoints; these do not confer field authorization. */
export type SupplierLot = ReceptionV2;
export interface SupplierOrder {
  id: string;
  order_number?: string;
  order_date?: string;
  quantity_kg?: number;
  total_amount_tnd?: number;
  unit_price_tnd?: number;
  status?: string;
}
export interface SupplierPayment {
  id: string;
  reference?: string;
  payment_date?: string;
  created_at?: string;
  amount_tnd?: number;
  payment_method?: string;
  notes?: string;
  lot_reference?: string;
}
export interface SupplierAuditEntry {
  id: string;
  action_label?: string;
  action?: string;
  performed_at?: string;
  performed_by?: string;
  changed_fields?: string[];
}
