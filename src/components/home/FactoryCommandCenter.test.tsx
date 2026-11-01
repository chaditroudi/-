import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FactoryCommandCenter } from './FactoryCommandCenter';

const sources = vi.hoisted(() => new Map<string, unknown>());
vi.mock('@/hooks/useFounderAnalytics', () => ({
  useLiveFactory: () => sources.get('live'),
  useAlertIntelligence: () => ({ data: undefined }),
}));
vi.mock('@/hooks/useBranding', () => ({ useBranding: () => ({ companyName: 'Synthetic factory', footprint: 'Local test site', printFooter: 'Synthetic data' }) }));
vi.mock('@/lib/sseClient', () => ({ getSseConnection: () => ({ subscribe: () => () => {} }) }));

describe('factory command center measurement presentation', () => {
  beforeEach(() => {
    sources.set('live', {
      data: { active: {}, today: { fumKgIn: 0, netKgIn: 0, hydKgIn: 0, triKgIn: 0, fumYield: 0, netYield: 0, hydYield: 0, triYield: 0, avgYield: 0 }, alerts: {} },
      isLoading: false, isFetching: false, refetch: vi.fn(), dataUpdatedAt: Date.now(),
    });
  });
  it('does not display measured zero yield when there are no production measurements', () => {
    render(<FactoryCommandCenter />);
    expect(screen.getByText('Moyenne non mesurée')).toBeInTheDocument();
    expect(screen.getAllByText('Non mesuré')).toHaveLength(4);
    expect(screen.queryByText('0.0%')).not.toBeInTheDocument();
    expect(screen.getByText('Rapports indicatifs des volumes déclarés')).toBeInTheDocument();
  });
  it('does not show operational figures when the live source fails', () => {
    sources.set('live', { data: undefined, error: { status: 503 }, isLoading: false, isFetching: false, refetch: vi.fn() });
    render(<FactoryCommandCenter />);
    expect(screen.getByRole('alert')).toHaveTextContent(/indisponibles/i);
    expect(screen.queryByText('Volumes déclarés aujourd\'hui')).not.toBeInTheDocument();
  });
});
