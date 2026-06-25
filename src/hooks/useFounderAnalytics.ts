import { useQuery } from '@tanstack/react-query';
import { founderAnalyticsApi, type Period } from '@/lib/api/founderAnalytics';

export const useLiveFactory = () =>
  useQuery({
    queryKey: ['founder-live'],
    refetchInterval: 15_000,
    queryFn: () => founderAnalyticsApi.getLiveFactory(),
  });

export const useSupplyFunnel = (period: Period = 'month') =>
  useQuery({
    queryKey: ['founder-funnel', period],
    refetchInterval: 60_000,
    queryFn: () => founderAnalyticsApi.getSupplyFunnel(period),
  });

export const usePhase2Analytics = (period: Period = 'month') =>
  useQuery({
    queryKey: ['founder-phase2', period],
    refetchInterval: 60_000,
    queryFn: () => founderAnalyticsApi.getPhase2Analytics(period),
  });

export const usePackagingAnalytics = (period: Period = 'month') =>
  useQuery({
    queryKey: ['founder-packaging', period],
    refetchInterval: 60_000,
    queryFn: () => founderAnalyticsApi.getPackagingAnalytics(period),
  });

export const useAlertIntelligence = (period: Period = 'month') =>
  useQuery({
    queryKey: ['founder-alerts', period],
    refetchInterval: 30_000,
    queryFn: () => founderAnalyticsApi.getAlertIntelligence(period),
  });

export const useReceptionPhase1Analytics = (period: Period = 'month') =>
  useQuery({
    queryKey: ['founder-reception-phase1', period],
    refetchInterval: 60_000,
    queryFn: () => founderAnalyticsApi.getReceptionPhase1Analytics(period),
  });

export const useStockStorageAnalytics = (period: Period = 'month') =>
  useQuery({
    queryKey: ['founder-stock-storage', period],
    refetchInterval: 60_000,
    queryFn: () => founderAnalyticsApi.getStockStorageAnalytics(period),
  });

export const useSupplierIntelligence = (period: Period = 'month') =>
  useQuery({
    queryKey: ['founder-suppliers', period],
    refetchInterval: 120_000,
    queryFn: () => founderAnalyticsApi.getSupplierIntelligence(period),
  });

export const usePlantHealthScore = (period: Period = 'month') =>
  useQuery({
    queryKey: ['founder-health', period],
    refetchInterval: 60_000,
    queryFn: () => founderAnalyticsApi.getPlantHealthScore(period),
  });

export type { Period };
