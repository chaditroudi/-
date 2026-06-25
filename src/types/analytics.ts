// ==================== TYPES ANALYTIQUES BI ====================

// === PRODUCTION KPIs ===
export interface ProductionKPIs {
  // Volume & Output
  totalPlanned: number;
  totalActual: number;
  variancePercent: number;
  
  // Rendement
  yieldRate: number; // Quantité conforme ÷ Quantité brute
  wasteRate: number;
  
  // Temps & Efficacité
  totalProductionHours: number;
  throughputKgPerHour: number;
  productivityKgPerPerson: number;
  
  // Disponibilité
  machineAvailability: number;
  
  // Ordres
  ordersTotal: number;
  ordersCompleted: number;
  ordersInProgress: number;
  ordersDraft: number;
  ordersCancelled: number;
}

export interface DowntimeBreakdown {
  category: 'maintenance' | 'labor' | 'material' | 'energy' | 'other';
  label: string;
  hours: number;
  percentage: number;
  color: string;
}

export interface ProductionByLine {
  lineId: string;
  lineName: string;
  plannedQty: number;
  actualQty: number;
  yieldRate: number;
  throughput: number;
  status: 'optimal' | 'warning' | 'critical';
}

// === QUALITÉ & PERTES KPIs ===
export interface QualityKPIs {
  // Taux
  rejectRate: number;
  reworkRate: number;
  passRate: number;
  
  // Inspections
  totalInspections: number;
  passedInspections: number;
  failedInspections: number;
  
  // Non-conformités
  totalNonConformities: number;
  criticalNonConformities: number;
  
  // Mesures
  avgHumidity: number;
  avgDefectPercent: number;
}

export interface LossBreakdown {
  type: 'sorting' | 'humidity' | 'packaging' | 'infestation' | 'other';
  label: string;
  quantityKg: number;
  percentage: number;
  costEstimate: number;
  color: string;
}

export interface GradeDistribution {
  grade: 'premium' | 'standard' | 'industrial' | 'rejected';
  label: string;
  count: number;
  quantityKg: number;
  percentage: number;
  color: string;
}

export interface SupplierQuality {
  supplierId: string;
  supplierName: string;
  totalReceptions: number;
  totalQuantityKg: number;
  acceptedPercent: number;
  rejectedPercent: number;
  avgQualityScore: number;
  trend: 'up' | 'down' | 'stable';
}

// === STOCK & SUPPLY CHAIN KPIs ===
export interface StockKPIs {
  // Volumes
  totalStockKg: number;
  rawMaterialsKg: number;
  wipKg: number;
  finishedProductsKg: number;
  packagingKg: number;
  quarantineKg: number;
  
  // Couverture
  rawMaterialCoverageDays: number;
  finishedGoodsCoverageDays: number;
  
  // Alertes
  expiringLots: number;
  lowStockAlerts: number;
  overstockAlerts: number;
  
  // Occupation
  avgZoneOccupancy: number;
  fifoCompliance: number;
}

export interface StockAging {
  range: '0-30' | '31-60' | '60+';
  label: string;
  quantityKg: number;
  percentage: number;
  riskLevel: 'low' | 'medium' | 'high';
  color: string;
}

export interface SupplierPerformance {
  supplierId: string;
  supplierName: string;
  onTimeDelivery: number;
  rejectRate: number;
  qualityScore: number;
  responseTime: number;
  overallRating: 'A' | 'B' | 'C' | 'D';
}

// === COÛTS & EFFICACITÉ KPIs ===
export interface CostKPIs {
  // Coût par kg
  costPerKg: number;
  targetCostPerKg: number;
  costVariancePercent: number;
  
  // Décomposition
  laborCostPerTon: number;
  energyCostPerTon: number;
  materialCostPerTon: number;
  overheadCostPerTon: number;
  
  // Pertes
  lossValue: number;
  lossPercentOfRevenue: number;
  
  // Maintenance
  maintenanceCost: number;
  downtimeImpact: number;
}

export interface CostBreakdown {
  category: 'labor' | 'energy' | 'materials' | 'maintenance' | 'overhead' | 'losses';
  label: string;
  amount: number;
  percentage: number;
  trend: number;
  color: string;
}

// === VENTES & DEMANDE KPIs ===
export interface SalesKPIs {
  // Alignement
  productionVsSales: number;
  forecastAccuracy: number;
  
  // Volumes
  totalSalesKg: number;
  exportSalesKg: number;
  localSalesKg: number;
  exportPercent: number;
  
  // Marges
  avgMarginPercent: number;
  premiumMargin: number;
  standardMargin: number;
  industrialMargin: number;
  
  // Risques
  customerConcentrationRisk: number;
  topCustomerPercent: number;
}

export interface SalesByMarket {
  market: 'export' | 'local';
  quantityKg: number;
  revenueAmount: number;
  marginPercent: number;
  growthPercent: number;
}

export interface SalesByGrade {
  grade: string;
  quantityKg: number;
  revenue: number;
  margin: number;
  percentage: number;
}

// === SEUILS KPI ===
export interface KPIThreshold {
  optimal: number;
  warning: number;
  critical: number;
}

export const KPI_THRESHOLDS: Record<string, KPIThreshold> = {
  yieldRate: { optimal: 90, warning: 80, critical: 70 },
  rejectRate: { optimal: 5, warning: 10, critical: 15 },
  machineAvailability: { optimal: 95, warning: 85, critical: 75 },
  onTimeDelivery: { optimal: 95, warning: 90, critical: 85 },
  passRate: { optimal: 95, warning: 90, critical: 80 },
  fifoCompliance: { optimal: 98, warning: 95, critical: 90 },
  zoneOccupancy: { optimal: 80, warning: 90, critical: 95 },
  forecastAccuracy: { optimal: 90, warning: 80, critical: 70 },
};

// === UTILITY ===
export type KPIStatus = 'optimal' | 'warning' | 'critical';

export const getKPIStatus = (value: number, threshold: KPIThreshold, higherIsBetter = true): KPIStatus => {
  if (higherIsBetter) {
    if (value >= threshold.optimal) return 'optimal';
    if (value >= threshold.warning) return 'warning';
    return 'critical';
  } else {
    if (value <= threshold.optimal) return 'optimal';
    if (value <= threshold.warning) return 'warning';
    return 'critical';
  }
};

export const KPI_STATUS_COLORS: Record<KPIStatus, string> = {
  optimal: 'text-emerald-600',
  warning: 'text-amber-600',
  critical: 'text-red-600'
};

export const KPI_STATUS_BG: Record<KPIStatus, string> = {
  optimal: 'bg-emerald-500/10',
  warning: 'bg-amber-500/10',
  critical: 'bg-red-500/10'
};
