import { useQuery } from '@tanstack/react-query';
import { receptionsApi } from '@/lib/api/receptions';
import { productionApi } from '@/lib/api/production';
import { batchesApi } from '@/lib/api/batches';
import { stockApi } from '@/lib/api/stock';
import { startOfMonth, subMonths, format, startOfWeek, eachDayOfInterval } from 'date-fns';

// ==================== RECEPTION ANALYTICS ====================

export interface ReceptionStats {
  totalReceptions: number;
  totalQuantity: number;
  acceptedCount: number;
  rejectedCount: number;
  quarantineCount: number;
  pendingCount: number;
  acceptanceRate: number;
  avgQuantityPerReception: number;
}

export interface SupplierPerformance {
  supplier_id: string;
  supplier_name: string;
  total_receptions: number;
  accepted: number;
  rejected: number;
  quarantine: number;
  total_quantity: number;
  acceptance_rate: number;
}

export interface DailyReceptionTrend {
  date: string;
  count: number;
  quantity: number;
  accepted: number;
  rejected: number;
}

export const useReceptionAnalytics = (period: 'week' | 'month' | 'quarter' = 'month') => {
  return useQuery({
    queryKey: ['analytics-receptions', period],
    queryFn: async () => {
      const now = new Date();
      let startDate: Date;

      switch (period) {
        case 'week':
          startDate = startOfWeek(now, { weekStartsOn: 1 });
          break;
        case 'quarter':
          startDate = subMonths(startOfMonth(now), 2);
          break;
        default:
          startDate = startOfMonth(now);
      }

      const allReceptions = await receptionsApi.list() as any[];
      const receptions = allReceptions.filter(
        (r: any) => r.created_at && new Date(r.created_at) >= startDate,
      );

      const stats: ReceptionStats = {
        totalReceptions: receptions.length,
        totalQuantity: receptions.reduce((sum: number, r: any) => sum + (r.quantity_total || 0), 0),
        acceptedCount: receptions.filter((r: any) => r.qc_decision === 'ACCEPTE').length,
        rejectedCount: receptions.filter((r: any) => r.qc_decision === 'REJETE').length,
        quarantineCount: receptions.filter((r: any) => r.qc_decision === 'QUARANTAINE').length,
        pendingCount: receptions.filter((r: any) => ['BROUILLON', 'EN_ATTENTE_QC', 'EN_QC'].includes(r.status)).length,
        acceptanceRate: 0,
        avgQuantityPerReception: 0,
      };

      const totalDecided = stats.acceptedCount + stats.rejectedCount + stats.quarantineCount;
      stats.acceptanceRate = totalDecided > 0 ? (stats.acceptedCount / totalDecided) * 100 : 0;
      stats.avgQuantityPerReception = stats.totalReceptions > 0 ? stats.totalQuantity / stats.totalReceptions : 0;

      // Supplier performance (use denormalized supplier_id / supplier_name on reception)
      const supplierMap = new Map<string, SupplierPerformance>();
      receptions.forEach((r: any) => {
        const supplierId = r.supplier_id || 'unknown';
        const supplierName = r.supplier_name || r.supplier?.name || supplierId;

        if (!supplierMap.has(supplierId)) {
          supplierMap.set(supplierId, {
            supplier_id: supplierId,
            supplier_name: supplierName,
            total_receptions: 0,
            accepted: 0,
            rejected: 0,
            quarantine: 0,
            total_quantity: 0,
            acceptance_rate: 0,
          });
        }

        const perf = supplierMap.get(supplierId)!;
        perf.total_receptions++;
        perf.total_quantity += r.quantity_total || 0;
        if (r.qc_decision === 'ACCEPTE') perf.accepted++;
        else if (r.qc_decision === 'REJETE') perf.rejected++;
        else if (r.qc_decision === 'QUARANTAINE') perf.quarantine++;
      });

      const supplierPerformance = Array.from(supplierMap.values()).map(s => ({
        ...s,
        acceptance_rate:
          s.accepted + s.rejected + s.quarantine > 0
            ? (s.accepted / (s.accepted + s.rejected + s.quarantine)) * 100
            : 0,
      })).sort((a, b) => b.total_quantity - a.total_quantity);

      // Daily trend
      const days = eachDayOfInterval({ start: startDate, end: now });
      const dailyTrend: DailyReceptionTrend[] = days.map(day => {
        const dayStr = format(day, 'yyyy-MM-dd');
        const dayReceptions = receptions.filter(
          (r: any) => r.created_at && format(new Date(r.created_at), 'yyyy-MM-dd') === dayStr,
        );
        return {
          date: format(day, 'dd/MM'),
          count: dayReceptions.length,
          quantity: dayReceptions.reduce((sum: number, r: any) => sum + (r.quantity_total || 0), 0),
          accepted: dayReceptions.filter((r: any) => r.qc_decision === 'ACCEPTE').length,
          rejected: dayReceptions.filter((r: any) => r.qc_decision === 'REJETE').length,
        };
      });

      return { stats, supplierPerformance, dailyTrend };
    },
  });
};

// ==================== PRODUCTION ANALYTICS ====================

export interface ProductionStats {
  totalOrders: number;
  completedOrders: number;
  inProgressOrders: number;
  draftOrders: number;
  cancelledOrders: number;
  totalTargetQuantity: number;
  totalActualQuantity: number;
  yieldRate: number;
  completionRate: number;
}

export interface ProductionTrend {
  date: string;
  completed: number;
  started: number;
  quantity: number;
}

export const useProductionAnalytics = (period: 'week' | 'month' | 'quarter' = 'month') => {
  return useQuery({
    queryKey: ['analytics-production', period],
    queryFn: async () => {
      const now = new Date();
      let startDate: Date;

      switch (period) {
        case 'week':
          startDate = startOfWeek(now, { weekStartsOn: 1 });
          break;
        case 'quarter':
          startDate = subMonths(startOfMonth(now), 2);
          break;
        default:
          startDate = startOfMonth(now);
      }

      const allOrders = await productionApi.listOrders() as any[];
      const orders = allOrders.filter(
        (o: any) => o.created_at && new Date(o.created_at) >= startDate,
      );

      const stats: ProductionStats = {
        totalOrders: orders.length,
        completedOrders: orders.filter((o: any) => o.status === 'completed').length,
        inProgressOrders: orders.filter((o: any) => o.status === 'in_progress').length,
        draftOrders: orders.filter((o: any) => o.status === 'draft').length,
        cancelledOrders: orders.filter((o: any) => o.status === 'cancelled').length,
        totalTargetQuantity: orders.reduce((sum: number, o: any) => sum + (o.target_quantity || 0), 0),
        totalActualQuantity: orders.reduce((sum: number, o: any) => sum + (o.actual_quantity || 0), 0),
        yieldRate: 0,
        completionRate: 0,
      };

      stats.yieldRate = stats.totalTargetQuantity > 0
        ? (stats.totalActualQuantity / stats.totalTargetQuantity) * 100
        : 0;
      stats.completionRate = stats.totalOrders > 0
        ? (stats.completedOrders / stats.totalOrders) * 100
        : 0;

      const days = eachDayOfInterval({ start: startDate, end: now });
      const dailyTrend: ProductionTrend[] = days.map(day => {
        const dayStr = format(day, 'yyyy-MM-dd');
        const dayCompleted = orders.filter(
          (o: any) => o.actual_end_date && format(new Date(o.actual_end_date), 'yyyy-MM-dd') === dayStr,
        );
        const dayStarted = orders.filter(
          (o: any) => o.actual_start_date && format(new Date(o.actual_start_date), 'yyyy-MM-dd') === dayStr,
        );
        return {
          date: format(day, 'dd/MM'),
          completed: dayCompleted.length,
          started: dayStarted.length,
          quantity: dayCompleted.reduce((s: number, o: any) => s + (o.actual_quantity || 0), 0),
        };
      });

      return { stats, dailyTrend };
    },
  });
};

// ==================== QUALITY ANALYTICS ====================

export interface QualityStats {
  totalInspections: number;
  passedInspections: number;
  failedInspections: number;
  passRate: number;
  avgHumidity: number;
  avgDefects: number;
  criticalNonConformities: number;
  totalNonConformities: number;
}

export interface QualityByGrade {
  grade: string;
  count: number;
  percentage: number;
}

export const useQualityAnalytics = (period: 'week' | 'month' | 'quarter' = 'month') => {
  return useQuery({
    queryKey: ['analytics-quality', period],
    queryFn: async () => {
      const now = new Date();
      let startDate: Date;

      switch (period) {
        case 'week':
          startDate = startOfWeek(now, { weekStartsOn: 1 });
          break;
        case 'quarter':
          startDate = subMonths(startOfMonth(now), 2);
          break;
        default:
          startDate = startOfMonth(now);
      }

      const [allInspections, allBatches, allNonConformities] = await Promise.all([
        batchesApi.listQualityInspections() as Promise<any[]>,
        batchesApi.listBatches() as Promise<any[]>,
        batchesApi.listNonConformities() as Promise<any[]>,
      ]);

      const inspections = allInspections.filter(
        (i: any) => i.created_at && new Date(i.created_at) >= startDate,
      );
      const batches = allBatches.filter(
        (b: any) => b.created_at && new Date(b.created_at) >= startDate,
      );
      const nonConformities = allNonConformities.filter(
        (nc: any) => nc.created_at && new Date(nc.created_at) >= startDate,
      );

      const acceptedInspections = inspections.filter((i: any) => i.decision === 'ACCEPTE').length;
      const decidedInspections = inspections.filter((i: any) => i.decision).length;

      const stats: QualityStats = {
        totalInspections: inspections.length,
        passedInspections: acceptedInspections,
        failedInspections: inspections.filter((i: any) => i.decision === 'REJETE').length,
        passRate: decidedInspections > 0 ? (acceptedInspections / decidedInspections) * 100 : 0,
        avgHumidity: 0,
        avgDefects: 0,
        criticalNonConformities: nonConformities.filter((nc: any) => nc.severity === 'critical').length,
        totalNonConformities: nonConformities.length,
      };

      const gradeLabels: Record<string, string> = {
        premium: 'Premium',
        standard: 'Standard',
        economy: 'Économique',
        rejected: 'Rejeté',
      };

      const gradeCounts = batches.reduce((acc: Record<string, number>, b: any) => {
        const grade = b.quality_grade || 'non_classé';
        acc[grade] = (acc[grade] || 0) + 1;
        return acc;
      }, {});

      const gradeDistribution: QualityByGrade[] = Object.entries(gradeCounts).map(([grade, count]) => ({
        grade: gradeLabels[grade] || grade,
        count: count as number,
        percentage: batches.length > 0 ? ((count as number) / batches.length) * 100 : 0,
      })).sort((a, b) => b.count - a.count);

      return { stats, gradeDistribution };
    },
  });
};

// ==================== STOCK ANALYTICS ====================

export interface StockStats {
  totalStockKg: number;
  rawMaterialsKg: number;
  wipKg: number;
  finishedProductsKg: number;
  packagingKg: number;
  quarantineKg: number;
  expiringLots: number;
  lowStockAlerts: number;
  zoneOccupancyAvg: number;
}

export interface StockByCategory {
  category: string;
  quantity: number;
  lotCount: number;
  color: string;
}

export interface ZoneOccupancy {
  zone: string;
  name: string;
  occupancy: number;
  current: number;
  capacity: number;
}

export const useStockAnalytics = () => {
  return useQuery({
    queryKey: ['analytics-stock'],
    queryFn: async () => {
      const [lots, locations, alerts] = await Promise.all([
        stockApi.listLots() as Promise<any[]>,
        stockApi.listLocations() as Promise<any[]>,
        stockApi.listAlerts() as Promise<any[]>,
      ]);

      const activeAlerts = (alerts as any[]).filter((a: any) => a.status === 'active');
      const activeLots = (lots as any[]).filter((l: any) => l.status !== 'CONSUMED' && l.status !== 'ARCHIVED');

      const categoryColors: Record<string, string> = {
        MP: 'hsl(var(--chart-1))',
        WIP: 'hsl(var(--chart-2))',
        PF: 'hsl(var(--chart-3))',
        EMB: 'hsl(var(--chart-4))',
      };

      const categoryLabels: Record<string, string> = {
        MP: 'Matières Premières',
        WIP: 'En-cours',
        PF: 'Produits Finis',
        EMB: 'Emballages',
      };

      const categoryStock: Record<string, { quantity: number; lotCount: number }> = {};
      let quarantineKg = 0;
      const now = new Date();
      const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      let expiringLots = 0;

      activeLots.forEach((lot: any) => {
        const category = lot.product?.category || lot.product_category || 'MP';
        if (!categoryStock[category]) categoryStock[category] = { quantity: 0, lotCount: 0 };
        categoryStock[category].quantity += lot.current_quantity || 0;
        categoryStock[category].lotCount++;
        if (lot.status === 'QUARANTINE') quarantineKg += lot.current_quantity || 0;
        const expiryDate = lot.dlc_date || lot.dluo_date;
        if (expiryDate && new Date(expiryDate) <= in7Days) expiringLots++;
      });

      const stockByCategory: StockByCategory[] = Object.entries(categoryStock).map(([cat, data]) => ({
        category: categoryLabels[cat] || cat,
        quantity: data.quantity,
        lotCount: data.lotCount,
        color: categoryColors[cat] || 'hsl(var(--chart-5))',
      }));

      const totalStock = stockByCategory.reduce((sum, c) => sum + c.quantity, 0);

      const zoneOccupancy: ZoneOccupancy[] = (locations as any[]).map((loc: any) => ({
        zone: loc.code,
        name: loc.name,
        occupancy: loc.capacity_kg > 0 ? Math.round((loc.current_load_kg / loc.capacity_kg) * 100) : 0,
        current: loc.current_load_kg,
        capacity: loc.capacity_kg,
      })).sort((a, b) => b.occupancy - a.occupancy);

      const avgOccupancy = zoneOccupancy.length > 0
        ? zoneOccupancy.reduce((sum, z) => sum + z.occupancy, 0) / zoneOccupancy.length
        : 0;

      const stats: StockStats = {
        totalStockKg: totalStock,
        rawMaterialsKg: categoryStock['MP']?.quantity || 0,
        wipKg: categoryStock['WIP']?.quantity || 0,
        finishedProductsKg: categoryStock['PF']?.quantity || 0,
        packagingKg: categoryStock['EMB']?.quantity || 0,
        quarantineKg,
        expiringLots,
        lowStockAlerts: activeAlerts.filter(
          (a: any) => a.alert_type === 'LOW_STOCK' || a.alert_type === 'CRITICAL_STOCK',
        ).length,
        zoneOccupancyAvg: avgOccupancy,
      };

      return { stats, stockByCategory, zoneOccupancy };
    },
  });
};

// ==================== GLOBAL DASHBOARD ====================

export const useFactoryDashboard = () => {
  const receptionAnalytics = useReceptionAnalytics('month');
  const productionAnalytics = useProductionAnalytics('month');
  const qualityAnalytics = useQualityAnalytics('month');
  const stockAnalytics = useStockAnalytics();

  return {
    reception: receptionAnalytics,
    production: productionAnalytics,
    quality: qualityAnalytics,
    stock: stockAnalytics,
    isLoading:
      receptionAnalytics.isLoading ||
      productionAnalytics.isLoading ||
      qualityAnalytics.isLoading ||
      stockAnalytics.isLoading,
  };
};
