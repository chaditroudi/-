import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ReceptionLot } from '@/types/reception';

const release = vi.fn();
const quarantine = vi.fn();

vi.mock('@/contexts/AuthContext', () => ({
  useAuthContext: () => ({ profile: { full_name: 'Responsable Qualité' }, user: { id: 'qc-1' } }),
}));
vi.mock('@/hooks/useReceptionsV2', () => ({
  useReleaseReceptionLot: () => ({ mutateAsync: release, isPending: false }),
  useQuarantineReceptionLot: () => ({ mutateAsync: quarantine, isPending: false }),
}));

const { ReceptionLotStatusDialog } = await import('./ReceptionLotStatusDialog');

const lot = {
  id: 'lot-1', lot_internal: 'RP-TOZ-1', lot_supplier: 'BL-9', quantity: 600, unit: 'kg',
  stock_status: 'EN_QUARANTAINE', quarantine_reason: 'Analyse labo en attente',
} as unknown as ReceptionLot;

beforeEach(() => {
  release.mockReset().mockResolvedValue({});
  quarantine.mockReset().mockResolvedValue({});
});

describe('ReceptionLotStatusDialog', () => {
  it('releases with reason and PIN in one dialog', async () => {
    const onClose = vi.fn();
    render(<ReceptionLotStatusDialog lot={lot} receptionId="rec-1" mode="release" onClose={onClose} />);

    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    fireEvent.change(screen.getByLabelText(/Justification de la libération/i), { target: { value: 'Labo conforme' } });
    const pad = within(screen.getByText('Code signature').closest('.rounded-lg.border') as HTMLElement);
    for (const digit of ['4', '8', '1', '5']) fireEvent.click(pad.getByRole('button', { name: digit }));
    fireEvent.click(pad.getByRole('button', { name: /Signer et libérer/i }));

    await waitFor(() => expect(release).toHaveBeenCalledWith({ receptionId: 'rec-1', lotId: 'lot-1', reason: 'Labo conforme', pin: '4815' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('keeps the dialog open with the reason when the server refuses', async () => {
    release.mockRejectedValueOnce(new Error('Code signature invalide'));
    const onClose = vi.fn();
    render(<ReceptionLotStatusDialog lot={lot} receptionId="rec-1" mode="release" onClose={onClose} />);

    fireEvent.change(screen.getByLabelText(/Justification de la libération/i), { target: { value: 'Labo conforme' } });
    const pad = within(screen.getByText('Code signature').closest('.rounded-lg.border') as HTMLElement);
    for (const digit of ['0', '0', '0', '0']) fireEvent.click(pad.getByRole('button', { name: digit }));
    fireEvent.click(pad.getByRole('button', { name: /Signer et libérer/i }));

    await waitFor(() => expect(release).toHaveBeenCalledTimes(1));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/Justification de la libération/i)).toHaveValue('Labo conforme');
  });

  it('requires a reason to quarantine', () => {
    render(<ReceptionLotStatusDialog lot={{ ...lot, stock_status: 'STOCK_LIBERE' }} receptionId="rec-1" mode="quarantine" onClose={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Confirmer la quarantaine/i })).toBeDisabled();
    expect(screen.queryByText('Code signature')).not.toBeInTheDocument();
  });
});
