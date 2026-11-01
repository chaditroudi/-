import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AdvancedProductionPanel } from './AdvancedProductionPanel';
import { AdvancedStockPanel } from './AdvancedStockPanel';
import { AdvancedCostPanel } from './AdvancedCostPanel';
import { StockStoragePanel } from './founder/StockStoragePanel';
import { Phase2Performance } from './founder/Phase2Performance';
import { SupplyFunnel } from './founder/SupplyFunnel';

const sources = vi.hoisted(() => new Map<string, unknown>());
vi.mock('@/hooks/useAdvancedAnalytics', () => ({
  useAdvancedProductionAnalytics: () => sources.get('production'),
  useAdvancedStockAnalytics: () => sources.get('stock'),
  useAdvancedCostAnalytics: () => sources.get('cost'),
}));
vi.mock('@/hooks/useFounderAnalytics', () => ({
  useStockStorageAnalytics: () => sources.get('founderStock'),
  usePhase2Analytics: () => sources.get('phase2'),
  useSupplyFunnel: () => sources.get('funnel'),
}));
const answer = (data: unknown, error?: unknown) => ({ data, error, isLoading: false, refetch: vi.fn(), dataUpdatedAt: Date.now() });

describe('analytics on the working screen', () => {
  beforeAll(() => vi.stubGlobal('ResizeObserver', class {
    observe() {} unobserve() {} disconnect() {}
  }));
  afterAll(() => vi.unstubAllGlobals());
  beforeEach(() => {
    sources.clear();
    sources.set('production', answer({
      kpis: { yieldRate: 100, totalActual: 0, ordersTotal: 0 },
      dailyTrend: [], downtimeBreakdown: [{ label: 'Maintenance', hours: 6 }],
      measurement: { mass: false, output: false, plan: false, downtime: false },
    }));
    sources.set('stock', answer({
      kpis: { fifoCompliance: 95, rawMaterialCoverageDays: 30 },
      stockAging: [], zoneOccupancy: [{ zone: 'Capacité absente', capacity: 0, current: 0, occupancy: 0 }],
      measurement: { occupancy: false, coverage: false, fifo: false },
    }));
    sources.set('cost', answer({
      kpis: { costPerKg: 0, costVariancePercent: -100, targetCostPerKg: 2 },
      costBreakdown: [], totalProduced: 0, basis: 'standard',
    }));
  });
  it('does not turn idle production into perfect yield or measured downtime', () => {
    render(<AdvancedProductionPanel period="month" />);
    expect(screen.queryByText('100.0%')).not.toBeInTheDocument();
    expect(screen.getAllByText('Non mesuré').length).toBeGreaterThan(0);
    expect(screen.getByText(/Arrêts non mesurés/)).toBeInTheDocument();
  });
  it('withholds fixed FIFO and coverage, and a zero-capacity occupancy', () => {
    render(<AdvancedStockPanel />);
    expect(screen.queryByText('95%')).not.toBeInTheDocument();
    expect(screen.queryByText('30j')).not.toBeInTheDocument();
    expect(screen.getAllByText('Non mesurée')).toHaveLength(2);
    expect(screen.getByText(/Occupation non mesurée/)).toBeInTheDocument();
  });
  it('does not claim a unit cost or saving without production', () => {
    render(<AdvancedCostPanel period="month" />);
    expect(screen.queryByText('-100.0%')).not.toBeInTheDocument();
    expect(screen.getAllByText('Non mesuré').length).toBeGreaterThan(0);
    expect(screen.getByText('Coût standard calculé')).toBeInTheDocument();
  });
  it('shows a failed source without an empty operational result', () => {
    sources.set('production', answer(undefined, { status: 503 }));
    render(<AdvancedProductionPanel period="month" />);
    expect(screen.getByRole('alert')).toHaveTextContent(/indisponibles/i);
    expect(screen.queryByText('Rendement')).not.toBeInTheDocument();
  });
  it('shows restricted access without operational indicators', () => {
    sources.set('stock', answer(undefined, { status: 403 }));
    render(<AdvancedStockPanel />);
    expect(screen.getByText('Accès réservé')).toBeInTheDocument();
    expect(screen.queryByText('95%')).not.toBeInTheDocument();
  });
  it('does not invent perfect storage conditions without readings', () => {
    sources.set('founderStock', answer({ storage: {
      condCompliance: 100, condReadings: 0, occupancyPct: 0,
      zones: [{ name: 'Capacité absente', current: 0, capacity: 0, occupancy: 0 }],
    } }));
    render(<StockStoragePanel period="month" />);
    expect(screen.queryByText('100%')).not.toBeInTheDocument();
    expect(screen.getAllByText(/Non mesuré/).length).toBeGreaterThan(1);
  });
  it('does not turn the historical CCP estimate into signed compliance', () => {
    sources.set('phase2', answer({
      fumigation: { done: 1, yield: 100, ccpCompliance: 100 },
      nettoyage: { done: 0 }, hydratation: { done: 0 }, triage: { done: 0 },
      gradeDistribution: [], dailyVolumes: [],
    }));
    render(<Phase2Performance period="month" />);
    expect(screen.queryByText('CONFORME')).not.toBeInTheDocument();
    expect(screen.getAllByText('Conformité CCP non établie par cette synthèse').length).toBeGreaterThan(0);
    expect(screen.getByText(/Consultez les preuves et la décision qualité signée/)).toBeInTheDocument();
  });
  it('labels flow ratios as indicative and removes unapproved factory targets', () => {
    sources.set('funnel', answer({ stages: [], yields: { phase2: 100, triage: 90, packaging: 85 }, palettesKg: 0 }));
    render(<SupplyFunnel period="month" />);
    expect(screen.queryByText(/vs cible/)).not.toBeInTheDocument();
    expect(screen.queryByText('OEE Cond.')).not.toBeInTheDocument();
    expect(screen.getAllByText(/Rapport indicatif des volumes déclarés/)).toHaveLength(3);
  });
});
