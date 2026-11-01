import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OutboxItem } from '@/lib/offline/outbox';
import { OfflineSyncStatus } from './OfflineSyncStatus';

const mocks = vi.hoisted(() => ({
  items: [] as OutboxItem[],
  dispatch: vi.fn(), drain: vi.fn(), retry: vi.fn(), signOut: vi.fn(), invalidate: vi.fn(),
}));
const client = { invalidateQueries: mocks.invalidate };
vi.mock('@tanstack/react-query', () => ({ useQueryClient: () => client }));
vi.mock('@/contexts/AuthContext', () => ({
  useAuthContext: () => ({ user: { id: 'user-1' }, signOut: mocks.signOut }),
}));
vi.mock('@/store/hooks', () => ({ useAppDispatch: () => mocks.dispatch }));
vi.mock('@/lib/offline/draftStore', () => ({ deleteLocalDraft: vi.fn() }));
vi.mock('@/store/api/receptionsApi', () => ({ receptionsApi: { util: { invalidateTags: vi.fn() } } }));
vi.mock('@/store/slices/receptionsSlice', () => ({ fetchReceptions: vi.fn(), receptionUpserted: vi.fn() }));
vi.mock('@/lib/offline/outbox', () => ({
  listOutbox: async () => mocks.items,
  subscribeOutbox: () => () => undefined,
  drainOutbox: mocks.drain,
  retryOutboxItem: mocks.retry,
}));

const item = (patch: Partial<OutboxItem> = {}): OutboxItem => ({
  id: 'waiting', kind: 'reception_intake', status: 'pending',
  payload: { client_request_id: 'waiting' }, ownerUserId: 'user-1',
  createdAt: '2026-11-01T08:00:00Z', updatedAt: '2026-11-01T08:00:00Z',
  attempts: 1, nextAttemptAt: Date.now() + 60_000, lastError: null, ...patch,
});

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  mocks.items = [];
  mocks.drain.mockResolvedValue(undefined);
  mocks.retry.mockResolvedValue(undefined);
});
afterEach(cleanup);

describe('reception queue status', () => {
  it('shows why an unsent reception is waiting instead of claiming an active synchronization', async () => {
    mocks.items = [item({ lastError: 'Le serveur ne répond pas.' })];
    render(<OfflineSyncStatus />);

    await screen.findByText('Réception en attente d’envoi');
    expect(screen.getByText(/Le serveur ne répond pas\./)).toBeVisible();
    expect(screen.queryByText('Synchronisation en cours')).not.toBeInTheDocument();
  });

  it('shows active synchronization only while a request is actually sending', async () => {
    mocks.items = [item({ status: 'syncing' })];
    render(<OfflineSyncStatus />);
    await screen.findByText('Synchronisation en cours');
  });

  it('explains a rejected stale draft and points to its saved entry', async () => {
    mocks.items = [item({ status: 'failed', lastError: 'Le brouillon a changé.' })];
    render(<OfflineSyncStatus />);

    await screen.findByText('Réception refusée par le serveur');
    expect(screen.getByText(/Le brouillon a changé.*Réception › En attente/)).toBeVisible();
  });

  it('expedites a failed pending send without releasing an untouched form request or another account entry', async () => {
    mocks.items = [
      item({ id: 'retry', lastError: 'Serveur indisponible' }),
      item({ id: 'form-active', attempts: 0 }),
      item({ id: 'other-account', ownerUserId: 'user-2', lastError: 'Private error' }),
    ];
    render(<OfflineSyncStatus />);
    await screen.findByText('Réception en attente d’envoi');

    fireEvent.click(screen.getByRole('button', { name: /Réessayer l.envoi/ }));

    await waitFor(() => expect(mocks.retry).toHaveBeenCalledTimes(1));
    expect(mocks.retry).toHaveBeenCalledWith('retry');
    expect(screen.queryByText(/Private error/)).not.toBeInTheDocument();
  });

  it('keeps the owner sign-in requirement visible after an expired session', async () => {
    mocks.items = [item({ waitingForLogin: true, lastError: 'Session expirée' })];
    render(<OfflineSyncStatus />);

    await screen.findByText('Session expirée');
    expect(screen.getByRole('button', { name: /Se reconnecter/ })).toBeVisible();
  });
});
