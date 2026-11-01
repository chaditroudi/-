import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiRequestError, axiosClient } from '@/lib/axiosClient';
import { createIntakeDraft, type IntakeDraft } from '@/lib/receptionIntake';
import { ReceptionIntakeFlow } from './ReceptionIntakeFlow';

const mocks = vi.hoisted(() => ({
  apiRequest: vi.fn(),
  getLocalDraft: vi.fn(),
  saveLocalDraft: vi.fn(),
  deleteLocalDraft: vi.fn(),
  createIntake: vi.fn(),
}));

vi.mock('@/contexts/AuthContext', () => ({ useAuthContext: () => ({ user: { id: 'operator-1' } }) }));
vi.mock('@/integrations/mongodb/client', () => ({ apiRequest: mocks.apiRequest }));
vi.mock('@/lib/offline/draftStore', () => ({
  getLocalDraft: mocks.getLocalDraft,
  saveLocalDraft: mocks.saveLocalDraft,
  deleteLocalDraft: mocks.deleteLocalDraft,
}));
vi.mock('@/hooks/useReceptionIntake', () => ({
  useCreateReceptionIntake: () => ({ mutateAsync: mocks.createIntake, isPending: false }),
}));
vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => false }));
vi.mock('@/hooks/usePurchasing', () => ({ usePurchaseOrders: () => ({ data: [] }) }));
vi.mock('@/hooks/useSettings', () => ({ useSiteSettings: () => ({ data: { operations: {} } }) }));
vi.mock('@/hooks/useSuppliers', () => ({
  useSuppliers: () => ({ data: [{ id: 'supplier-1', code: 'SUP-1', name: 'Supplier', supplier_status: 'active' }] }),
}));
vi.mock('@/store/api/receptionsApi', () => ({ useSearchReceptionsQuery: () => ({ data: { rows: [] } }) }));
vi.mock('./StepDelivery', () => ({ StepDelivery: () => null }));
vi.mock('./StepLotWeighing', () => ({ StepLotWeighing: () => null }));

let draft: IntakeDraft;
const savedReception = {
  reception: { id: 'reception-1', reception_number: 'REC-TEST-1', quantity_total: 900, unit: 'kg' },
  lots: [], units: [], alerts: [], notifications: [],
};

const openReview = async () => {
  const onClose = vi.fn();
  render(<ReceptionIntakeFlow draftId={draft.id} canRunQc={false} onClose={onClose} onOpenReception={vi.fn()} />);
  const confirm = await screen.findByRole('button', { name: 'Confirmer la réception' });
  expect(confirm).toBeEnabled();
  return { confirm, onClose };
};

describe('reception confirmation and shared draft saves', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    draft = {
      ...createIntakeDraft(), id: 'draft-1', version: 1, stage: 3,
      supplier_id: 'supplier-1', supplier_label: 'SUP-1 · Supplier',
      delivery_note_number: 'BL-1', vehicle_number: '123 TU 4567',
      variety: 'Deglet Nour', maturity_stage: 'Tamar', harvest_method: 'Manuelle traditionnelle',
      gross_weight_kg: '1000', tare_weight_kg: '100', unit_count: '2',
      lots: [{ lot_supplier: 'LS-1', quantity: '900' }],
      arrival_temperature_c: '24', storage_zone_code: 'ZR-01', photos: ['a', 'b'],
    };
    mocks.getLocalDraft.mockResolvedValue({ draft, ownerUserId: 'operator-1', savedAt: new Date().toISOString() });
    mocks.apiRequest.mockResolvedValue({ data: { id: draft.id, version: 1, status: 'OPEN', payload: draft } });
    mocks.saveLocalDraft.mockResolvedValue(undefined);
    mocks.deleteLocalDraft.mockResolvedValue(undefined);
    mocks.createIntake.mockResolvedValue(savedReception);
  });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it('keeps the form and does not book an intake when the server refuses the draft version', async () => {
    const message = 'La livraison a changé sur un autre poste.';
    vi.spyOn(axiosClient, 'put').mockRejectedValue(new ApiRequestError({
      status: 409, code: 'DRAFT_STALE', message,
      details: { draft: { id: draft.id, version: 2, status: 'OPEN', payload: { ...draft, remarks: 'Updated elsewhere' } } },
    }));
    const { confirm } = await openReview();

    fireEvent.click(confirm);

    await screen.findByText(message);
    expect(mocks.createIntake).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Charger la dernière version' })).toBeVisible();
    expect(mocks.saveLocalDraft).toHaveBeenCalledWith(expect.objectContaining({ id: draft.id, version: 1 }), 'operator-1');
  });

  it('does not book a second intake when the shared draft is already closed', async () => {
    vi.spyOn(axiosClient, 'put').mockRejectedValue(new ApiRequestError({
      status: 409, code: 'DRAFT_CLOSED', message: 'Cette réception a déjà été confirmée.',
      details: { reception_id: 'existing-reception' },
    }));
    const { confirm } = await openReview();

    fireEvent.click(confirm);

    await screen.findByText('Cette réception a déjà été confirmée sur un autre poste.');
    expect(mocks.createIntake).not.toHaveBeenCalled();
  });

  it('confirms the latest draft once after the employee explicitly loads the conflicting version', async () => {
    const put = vi.spyOn(axiosClient, 'put')
      .mockRejectedValueOnce(new ApiRequestError({
        status: 409, code: 'DRAFT_STALE', message: 'Une version plus récente existe.',
        details: { draft: { id: draft.id, version: 2, status: 'OPEN', payload: { ...draft, remarks: 'Reviewed latest draft' } } },
      }))
      .mockResolvedValueOnce({ data: { data: { id: draft.id, version: 3, status: 'OPEN' } } });
    const { confirm } = await openReview();
    fireEvent.click(confirm);
    await screen.findByText('Une version plus récente existe.');
    expect(mocks.createIntake).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Charger la dernière version' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer la réception' }));

    await waitFor(() => expect(mocks.createIntake).toHaveBeenCalledTimes(1));
    expect(put).toHaveBeenNthCalledWith(2, `/reception-drafts/${draft.id}`,
      expect.objectContaining({ version: 2, payload: expect.objectContaining({ remarks: 'Reviewed latest draft' }) }),
      expect.anything());
    expect(mocks.createIntake).toHaveBeenCalledWith(expect.objectContaining({ client_request_id: draft.id, draft_version: 3 }));
  });

  it('prevents another save or navigation while confirmation waits for the shared version', async () => {
    let finishSave!: (response: any) => void;
    const put = vi.spyOn(axiosClient, 'put').mockImplementation(() => new Promise((resolve) => { finishSave = resolve; }));
    const { confirm, onClose } = await openReview();

    fireEvent.click(confirm);
    await waitFor(() => expect(put).toHaveBeenCalledTimes(1));

    expect(confirm).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Retour' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Enregistrer et quitter/ })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /Enregistrer et quitter/ }));
    expect(onClose).not.toHaveBeenCalled();

    await act(async () => { finishSave({ data: { data: { id: draft.id, version: 2, status: 'OPEN' } } }); });
    await waitFor(() => expect(mocks.createIntake).toHaveBeenCalledTimes(1));
    expect(mocks.createIntake).toHaveBeenCalledWith(expect.objectContaining({ client_request_id: draft.id, draft_version: 2 }));
    expect(put).toHaveBeenCalledTimes(1);
  });

  it('still permits the offline intake path with the same saved draft identity', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    const put = vi.spyOn(axiosClient, 'put');
    mocks.createIntake.mockResolvedValue({ ...savedReception, offline_queued: true });
    const { confirm } = await openReview();

    fireEvent.click(confirm);

    await waitFor(() => expect(mocks.createIntake).toHaveBeenCalledTimes(1));
    expect(mocks.createIntake).toHaveBeenCalledWith(expect.objectContaining({ client_request_id: draft.id, draft_version: 1 }));
    expect(put).not.toHaveBeenCalled();
  });

  it('preserves the queued intake path when the server is unreachable while the device reports online', async () => {
    vi.spyOn(axiosClient, 'put').mockRejectedValue(new ApiRequestError({
      message: 'Le serveur ne répond pas.', isNetworkError: true,
    }));
    mocks.createIntake.mockResolvedValue({ ...savedReception, offline_queued: true });
    const { confirm } = await openReview();

    fireEvent.click(confirm);

    await waitFor(() => expect(mocks.createIntake).toHaveBeenCalledTimes(1));
    expect(mocks.createIntake).toHaveBeenCalledWith(expect.objectContaining({ client_request_id: draft.id, draft_version: 1 }));
  });
});
