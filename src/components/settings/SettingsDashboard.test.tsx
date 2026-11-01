import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ApiRequestError } from '@/lib/axiosClient';
import { SettingsDashboard } from './SettingsDashboard';

const state = vi.hoisted(() => ({ data: undefined, isLoading: false, isFetching: false, error: null as unknown, refetch: vi.fn() }));
vi.mock('@/hooks/useSettings', () => ({ useSiteSettings: () => state }));
// Panels are not mounted before settings arrive. Their editing hooks need not run.
vi.mock('./plant/PlantInfoPanel', () => ({ PlantInfoPanel: () => <button>Enregistrer les paramètres</button> }));

describe('settings failure boundary', () => {
  it.each([403, 500])('does not render editable defaults after HTTP %s', status => {
    state.error = new ApiRequestError({ status, message: 'Erreur' });
    render(<MemoryRouter><SettingsDashboard /></MemoryRouter>);
    expect(screen.queryByRole('button', { name: /Enregistrer/ })).not.toBeInTheDocument();
    expect(screen.getByText(status === 403 ? 'Accès réservé' : 'Données indisponibles')).toBeInTheDocument();
  });
});
