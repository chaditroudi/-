import { apiRequest } from '@/integrations/mongodb/client';

export type SettlementLine = {
  grade: string;
  weight_kg: number;
  price_tnd_per_kg: number;
  amount_tnd: number;
  lot_number: string | null;
};

export type SupplierSettlement = {
  id: string;
  settlement_number: string;
  supplier_id: string;
  supplier_name: string | null;
  triage_session_id: string;
  triage_session_number: string | null;
  reception_id: string | null;
  parent_lot_number: string | null;
  currency: string;
  status: 'DRAFT' | 'APPROVED' | 'PAID' | 'CANCELLED';
  lines: SettlementLine[];
  total_weight_kg: number;
  payable_weight_kg: number;
  total_amount_tnd: number;
  basis: string;
  created_at?: string;
  updated_at?: string;
};

export type ExportOrderMargin = {
  order_id: string;
  order_ref: string | null;
  status: string | null;
  currency: string;
  fx_rate_to_tnd: number;
  revenue_invoice: number;
  revenue_tnd: number;
  cost_tnd: number;
  margin_tnd: number;
  margin_pct: number;
  covered_kg: number;
  missing_cost_kg: number;
  basis: string;
  lines: Array<{
    lot_id: string | null;
    lot_ref: string | null;
    net_weight_kg: number;
    unit_price_invoice: number;
    currency: string;
    cost_tnd_per_kg: number | null;
    cost_tnd: number | null;
    cost_source: string | null;
  }>;
};

export const settlementsApi = {
  list: async (params?: { supplier_id?: string; status?: string }) => {
    const qs = new URLSearchParams();
    if (params?.supplier_id) qs.set('supplier_id', params.supplier_id);
    if (params?.status) qs.set('status', params.status);
    const suffix = qs.toString() ? `?${qs}` : '';
    const response = await apiRequest<{ data: SupplierSettlement[] }>(`/settlements${suffix}`);
    return response.data;
  },

  fromTriage: async (sessionId: string) => {
    const response = await apiRequest<{ data: SupplierSettlement }>(
      `/settlements/from-triage/${encodeURIComponent(sessionId)}`,
      { method: 'POST' },
    );
    return response.data;
  },

  approve: async (id: string) => {
    const response = await apiRequest<{ data: SupplierSettlement }>(
      `/settlements/${encodeURIComponent(id)}/approve`,
      { method: 'POST' },
    );
    return response.data;
  },

  pay: async (id: string) => {
    const response = await apiRequest<{ data: SupplierSettlement }>(
      `/settlements/${encodeURIComponent(id)}/pay`,
      { method: 'POST' },
    );
    return response.data;
  },

  cancel: async (id: string) => {
    const response = await apiRequest<{ data: SupplierSettlement }>(
      `/settlements/${encodeURIComponent(id)}/cancel`,
      { method: 'POST' },
    );
    return response.data;
  },

  exportMargin: async (orderId: string) => {
    const response = await apiRequest<{ data: ExportOrderMargin }>(
      `/export-orders/${encodeURIComponent(orderId)}/margin`,
    );
    return response.data;
  },
};
