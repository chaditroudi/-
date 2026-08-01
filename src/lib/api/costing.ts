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

export type CostSummaryView = {
  period: 'week' | 'month' | 'quarter';
  basis: 'standard';
  rates: {
    labour_rate_tnd_per_hour: number;
    energy_tariff_tnd_per_kwh: number;
    overhead_tnd_per_kg: number;
    target_cost_tnd_per_kg: number;
  };
  totals: {
    material_cost_tnd: number;
    labour_cost_tnd: number;
    energy_cost_tnd: number;
    overhead_cost_tnd: number;
    loss_cost_tnd: number;
    maintenance_cost_tnd: number;
    total_cost_tnd: number;
    produced_kg: number;
    waste_kg: number;
    cost_tnd_per_kg: number;
    target_cost_tnd_per_kg: number;
    cost_variance_pct: number;
  };
  sources: {
    triage_sessions: number;
    packaging_orders: number;
    production_orders: number;
    reception_lots_with_purchase_cost: number;
  };
  breakdown: Array<{
    category: 'labor' | 'energy' | 'materials' | 'maintenance' | 'overhead' | 'losses';
    label: string;
    amount: number;
    percentage: number;
    trend: number;
  }>;
  kpis: {
    costPerKg: number;
    targetCostPerKg: number;
    costVariancePercent: number;
    laborCostPerTon: number;
    energyCostPerTon: number;
    materialCostPerTon: number;
    overheadCostPerTon: number;
    lossValue: number;
    lossPercentOfRevenue: number;
    maintenanceCost: number;
    downtimeImpact: number;
  };
};

export const costingApi = {
  getLotCost: async (lotId: string): Promise<LotCostView> => {
    const response = await apiRequest<{ data: LotCostView }>(
      `/costing/lots/${encodeURIComponent(lotId)}`,
    );
    return response.data;
  },

  getSummary: async (period: 'week' | 'month' | 'quarter' = 'month'): Promise<CostSummaryView> => {
    const response = await apiRequest<{ data: CostSummaryView }>(
      `/costing/summary?period=${encodeURIComponent(period)}`,
    );
    return response.data;
  },
};
