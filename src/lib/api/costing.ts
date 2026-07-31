import { apiRequest } from '@/integrations/mongodb/client';

export type LotCostGrade = {
  grade: string | null;
  lot_number: string | null;
  weight_kg: number;
  destination: string | null;
  cost_tnd: number | null;
  cost_tnd_per_kg: number | null;
};

export type LotCostView = {
  lot: {
    id: string;
    lot_internal: string | null;
    reception_id: string | null;
    quantity: number;
    purchase_cost_tnd_per_kg: number | null;
    purchase_cost_tnd: number | null;
    cost_source: string | null;
  };
  rates: {
    labour_rate_tnd_per_hour: number;
    energy_tariff_tnd_per_kwh: number;
    overhead_tnd_per_kg: number;
    target_cost_tnd_per_kg: number;
    basis: 'standard';
  };
  triage: {
    session_id: string;
    session_number: string | null;
    input_cost_tnd: number | null;
    material_cost_tnd: number | null;
    labour_cost_tnd: number | null;
    overhead_cost_tnd: number | null;
    cost_basis: string | null;
    mass_balance_variance_pct: number | null;
    parent_weight_kg: number;
    grades: LotCostGrade[];
  } | null;
};

export const costingApi = {
  getLotCost: async (lotId: string): Promise<LotCostView> => {
    const response = await apiRequest<{ data: LotCostView }>(
      `/costing/lots/${encodeURIComponent(lotId)}`,
    );
    return response.data;
  },
};
