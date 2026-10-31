import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { HomePage } from './HomePage';

vi.mock('./LotJourneyHub', () => ({ LotJourneyHub: () => null }));
vi.mock('@/hooks/useSettings', () => ({ useSiteSettings: () => ({ data: {} }) }));

const known = {
  draftReceptions: 0, waitingQcReceptions: 0, inQcReceptions: 0, releasedReceptions: 0, pendingReceptions: 0,
  inProgressOrders: 0, qualityLots: 0, quarantinedLots: 0, storedLots: 0, activeAlertsCount: 0,
  phase2Active: 0, phase2Waiting: 0, validatedPFLots: 0, activePackagingOrders: 0, pendingShipments: 0,
  coverage: { loading: false, unavailable: [] as string[] },
};

const renderHome = (metrics = known, canInspect = false) =>
  render(<HomePage onNavigate={vi.fn()} accessibleTabs={['home', 'receptions', 'storage']} metrics={metrics} canInspect={canInspect} />);

describe('HomePage', () => {
  it('says nothing is urgent only when every source answered', () => {
    renderHome();
    expect(screen.getByText(/Rien d'urgent/)).toBeInTheDocument();
  });

  it('does not say nothing is urgent while something could not be checked', () => {
    renderHome({ ...known, quarantinedLots: null, coverage: { loading: false, unavailable: ['lots'] } });
    expect(screen.queryByText(/Rien d'urgent/)).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Impossible de vérifier : lots.');
  });

  it('does not say nothing is urgent while still checking', () => {
    renderHome({ ...known, coverage: { loading: true, unavailable: [] } });
    expect(screen.queryByText(/Rien d'urgent/)).not.toBeInTheDocument();
    expect(screen.getByText(/Vérification du travail/)).toBeInTheDocument();
  });

  it('keeps known work on screen when another source fails', () => {
    renderHome({ ...known, quarantinedLots: 4, activeAlertsCount: null, coverage: { loading: false, unavailable: ['alertes'] } });
    expect(screen.getByText('4 lots en quarantaine')).toBeInTheDocument();
  });

  it('offers QC work only to those who may do it', () => {
    renderHome({ ...known, qualityLots: 3 }, false);
    expect(screen.queryByText(/contrôles QC à faire/)).not.toBeInTheDocument();
  });

  it('gives inspectors their queue', () => {
    renderHome({ ...known, qualityLots: 3 }, true);
    expect(screen.getByText('3 contrôles QC à faire')).toBeInTheDocument();
  });
});
