import { apiRequest } from '@/integrations/mongodb/client';

export type AtpPromise = {
  wave: string;
  requested_kg: number;
  product_id: string | null;
  grade: string | null;
  covered_kg: number;
  shortfall_kg: number;
  sealed_ready_kg: number;
  free_storage_capacity_kg: number;
  ship_week: string;
  ship_week_start: string;
  confidence: 'committed' | 'partial' | 'unavailable' | string;
  basis: string;
  allocations: Array<{
    lot_id: string;
    lot_number: string | null;
    qty_kg: number;
    reception_date: string | null;
    cost_tnd_per_kg: number | null;
  }>;
  notes: string;
};

export type AtpSummary = {
  wave: string;
  available_validated_kg: number;
  lot_count: number;
  free_storage_capacity_kg: number;
  sealed_ready_kg: number;
  next_ship_week_sample: string;
  basis: string;
};

export const atpApi = {
  summary: async () => {
    const response = await apiRequest<{ data: AtpSummary }>('/atp/summary');
    return response.data;
  },
  promise: async (input: { qty_kg: number; product_id?: string; grade?: string }) => {
    const qs = new URLSearchParams();
    qs.set('qty_kg', String(input.qty_kg));
    if (input.product_id) qs.set('product_id', input.product_id);
    if (input.grade) qs.set('grade', input.grade);
    const response = await apiRequest<{ data: AtpPromise }>(`/atp/promise?${qs}`);
    return response.data;
  },
  /** Wave D — calcule et inscrit la promesse ATP sur une commande export. */
  promiseOrder: async (orderId: string) => {
    const response = await apiRequest<{ data: { promise: AtpPromise; order: unknown } }>(
      `/atp/orders/${encodeURIComponent(orderId)}/promise`,
      { method: 'POST' },
    );
    return response.data;
  },
};
