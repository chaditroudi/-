import { apiRequest } from '@/integrations/mongodb/client';

type ApiEnvelope<T> = { data: T };

export type Period = 'today' | 'week' | 'month' | 'quarter';

export type LiveFactoryData = {
  active: {
    fumigation: number;
    nettoyage: number;
    hydratation: number;
    triage: number;
    packaging: number;
    packagingDetail: Array<{
      id: string;
      order_number: string;
      line: string;
      produced_units: number;
      target_units: number;
      started_at?: string | null;
    }>;
    total: number;
  };
  today: {
    fumKgIn: number;
    fumYield: number;
    netKgIn: number;
    netYield: number;
    hydKgIn: number;
    hydYield: number;
    triKgIn: number;
    triYield: number;
    pkgUnits: number;
    totalKgProcessed: number;
    avgYield: number;
  };
  alerts: {
    critique: number;
    avertissement: number;
    info: number;
    total: number;
  };
  receptions: {
    today: number;
    kgToday: number;
    accepted: number;
  };
  lastUpdated: string;
};

export type SupplyFunnelData = {
  stages: Array<{
    label: string;
    value: number;
    unit: string;
    icon: string;
    color: string;
  }>;
  yields: {
    reception: number;
    phase2: number;
    triage: number;
    packaging: number;
  };
  palettesKg: number;
};

export type Phase2AnalyticsData = {
  fumigation: {
    count: number;
    done: number;
    yield: number;
    ccpCompliance: number;
  };
  nettoyage: {
    count: number;
    done: number;
    yield: number;
    avgTurbidity: number;
    avgPH: number;
  };
  hydratation: {
    count: number;
    done: number;
    yield: number;
    avgHumidityGain: number;
  };
  triage: {
    count: number;
    done: number;
    yield: number;
    avgExtraPct: number;
    avgRejetePct: number;
  };
  gradeDistribution: Array<{
    grade: string;
    label: string;
    kg: number;
    pct: number;
  }>;
  dailyThroughput: Array<{
    date: string;
    kgIn: number;
  }>;
  totalKgProcessed: number;
};

export type PackagingAnalyticsData = {
  kpis: {
    totalTarget: number;
    totalProduced: number;
    totalRejected: number;
    metalFailures: number;
    avgYield: number;
    sealedPalettes: number;
    totalNetKg: number;
  };
  oee: number;
  lineOEE: Array<{
    line: string;
    produced: number;
    target: number;
    oee: number;
    count: number;
  }>;
  daily: Array<{
    date: string;
    units: number;
    palettes: number;
  }>;
  ordersCount: {
    total: number;
    done: number;
    active: number;
  };
};

export type AlertIntelligenceData = {
  bySeverity: {
    URGENCE: number;
    CRITIQUE: number;
    AVERTISSEMENT: number;
    INFO: number;
  };
  byStatus: {
    ACTIVE: number;
    ACKNOWLEDGED: number;
    RESOLVED: number;
  };
  topTypes: Array<{
    code: string;
    count: number;
  }>;
  daily: Array<{
    date: string;
    critical: number;
    warning: number;
    total: number;
  }>;
  mttrMin: number;
  total: number;
};

export type ReceptionPhase1AnalyticsData = {
  receptions: {
    total: number;
    totalKg: number;
    accepted: number;
    rejected: number;
    quarantine: number;
    acceptanceRate: number;
  };
  lots: {
    total: number;
    totalKg: number;
  };
  qc: {
    total: number;
    accepted: number;
    rejected: number;
    quarantine: number;
    acceptanceRate: number;
    avgDefectRate: number;
    avgBrix: number;
    avgMoisture: number;
  };
  batches: {
    total: number;
    totalKg: number;
    byStatus: Record<string, number>;
  };
  byVariety: Array<{
    variety: string;
    kg: number;
  }>;
  dailyReceptions: Array<{
    date: string;
    kg: number;
    count: number;
  }>;
  moveCount: number;
};

export type StockStorageAnalyticsData = {
  stock: {
    totalLots: number;
    totalKg: number;
    byVariety: Array<{
      variety: string;
      kg: number;
    }>;
    activeAlerts: number;
    criticalAlerts: number;
  };
  movements: {
    totalIn: number;
    totalOut: number;
    balance: number;
    count: number;
    daily: Array<{
      date: string;
      in: number;
      out: number;
    }>;
  };
  storage: {
    zones: Array<{
      name: string;
      capacity: number;
      current: number;
      occupancy: number;
      temperature: number | null;
      humidity: number | null;
      status: string;
    }>;
    totalCapacity: number;
    totalOccupied: number;
    occupancyPct: number;
    condCompliance: number;
    condReadings: number;
  };
};

export type SupplierIntelligenceData = {
  topSuppliers: Array<{
    supplierId: string;
    name: string;
    kgReceived: number;
    accepted: number;
    rejected: number;
    quarantine: number;
    deliveries: number;
    acceptanceRate: number;
  }>;
  kpiTotal: number;
  overallAcceptance: number;
  totalReceptions: number;
};

export type PlantHealthScoreData = {
  score: number;
  breakdown: {
    reception: number;
    phase2: number;
    packaging: number;
    alerts: number;
  };
};

const periodParam = (period: Period) => `?period=${period}`;

export const founderAnalyticsApi = {
  getLiveFactory: async () => {
    const res = await apiRequest<ApiEnvelope<LiveFactoryData>>('/analytics/live-factory');
    return res.data;
  },

  getSupplyFunnel: async (period: Period = 'month') => {
    const res = await apiRequest<ApiEnvelope<SupplyFunnelData>>(`/analytics/supply-funnel${periodParam(period)}`);
    return res.data;
  },

  getPhase2Analytics: async (period: Period = 'month') => {
    const res = await apiRequest<ApiEnvelope<Phase2AnalyticsData>>(`/analytics/phase2${periodParam(period)}`);
    return res.data;
  },

  getPackagingAnalytics: async (period: Period = 'month') => {
    const res = await apiRequest<ApiEnvelope<PackagingAnalyticsData>>(`/analytics/packaging${periodParam(period)}`);
    return res.data;
  },

  getAlertIntelligence: async (period: Period = 'month') => {
    const res = await apiRequest<ApiEnvelope<AlertIntelligenceData>>(`/analytics/alerts${periodParam(period)}`);
    return res.data;
  },

  getReceptionPhase1Analytics: async (period: Period = 'month') => {
    const res = await apiRequest<ApiEnvelope<ReceptionPhase1AnalyticsData>>(`/analytics/reception-phase1${periodParam(period)}`);
    return res.data;
  },

  getStockStorageAnalytics: async (period: Period = 'month') => {
    const res = await apiRequest<ApiEnvelope<StockStorageAnalyticsData>>(`/analytics/stock-storage${periodParam(period)}`);
    return res.data;
  },

  getSupplierIntelligence: async (period: Period = 'month') => {
    const res = await apiRequest<ApiEnvelope<SupplierIntelligenceData>>(`/analytics/suppliers${periodParam(period)}`);
    return res.data;
  },

  getPlantHealthScore: async (period: Period = 'month') => {
    const res = await apiRequest<ApiEnvelope<PlantHealthScoreData>>(`/analytics/health-score${periodParam(period)}`);
    return res.data;
  },
};
