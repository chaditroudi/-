import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import i18n from '../../src/i18n/index';
import { NettoyagePanel } from '../../src/components/phase2/nettoyage/NettoyagePanel';

const state = vi.hoisted(() => ({ create: vi.fn(), close: vi.fn() }));
vi.mock('../../src/hooks/useNettoyage', () => ({
  useCleaningCycles: () => ({ data: [{ id: 'cycle-one', cycle_number: 'NET-1', status: 'EN_COURS', program: 'B', lot_number: 'STOCK-1', started_at: '2026-11-04T10:00:00Z' }] }),
  useCleaningKpis: () => ({ data: {} }),
  useCreateCleaningCycle: () => ({ mutateAsync: state.create, isPending: false }),
  useCloseCleaningCycle: () => ({ mutateAsync: state.close, isPending: false }),
}));
vi.mock('@tanstack/react-query', () => ({ useQuery: () => ({ data: [{ id: 'stock-one', lot_number: 'STOCK-1', current_quantity: 1000, unit: 'kg', source_reception_id: 'reception-one', variety: 'Deglet Nour' }], isLoading: false }) }));
vi.mock('../../src/integrations/mongodb/client', () => ({ apiRequest: vi.fn() }));
beforeEach(async () => { state.create.mockReset(); state.close.mockReset(); await i18n.changeLanguage('fr'); });
afterEach(cleanup);

it('creates cleaning with the chosen stock identity rather than a reception number', async () => {
  state.create.mockResolvedValue({});
  render(React.createElement(NettoyagePanel, { currentUser: 'Worker' }));
  fireEvent.click(screen.getByRole('button', { name: 'Nouveau cycle' }));
  fireEvent.change(screen.getByLabelText('Lot à nettoyer'), { target: { value: 'stock-one' } });
  fireEvent.click(screen.getByRole('button', { name: 'Démarrer' }));
  await waitFor(() => expect(state.create).toHaveBeenCalledWith(expect.objectContaining({ source_stock_lot_id: 'stock-one', lot_number: 'STOCK-1', reception_id: 'reception-one' })));
});

it('preserves a rejected close and entered quantities without an unhandled rejection', async () => {
  state.close.mockRejectedValue(Error('MASS_BALANCE_BLOCKED'));
  render(React.createElement(NettoyagePanel));
  fireEvent.click(screen.getByRole('button', { name: 'Clôturer' }));
  fireEvent.change(screen.getByLabelText('Poids entrée (kg)'), { target: { value: '1000' } });
  fireEvent.change(screen.getByLabelText('Poids sortie (kg)'), { target: { value: '960' } });
  fireEvent.change(screen.getByLabelText('Poids déchets (kg)'), { target: { value: '400' } });
  fireEvent.click(screen.getByRole('button', { name: 'Clôturer cycle' }));
  await waitFor(() => expect(state.close).toHaveBeenCalledOnce());
  expect(screen.getByRole('dialog')).toBeVisible();
  expect(screen.getByLabelText('Poids déchets (kg)')).toHaveValue(400);
});

it('renders actionable Arabic cleaning labels and quantities', async () => {
  await i18n.changeLanguage('ar');
  render(React.createElement(NettoyagePanel));
  fireEvent.click(screen.getByRole('button', { name: 'إغلاق الدورة' }));
  expect(screen.getByLabelText('وزن الدخول (كغ)')).toBeVisible();
  expect(screen.getByLabelText('وزن الخروج (كغ)')).toBeVisible();
  expect(screen.getByLabelText('وزن النفايات (كغ)')).toBeVisible();
});
