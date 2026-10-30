import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ReceptionV2 } from '@/types/reception';

const submitDecision = vi.fn();
const createInspection = vi.fn();

vi.mock('@/hooks/useReceptionsV2', () => ({
  receptionErrorMessage: (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback),
  useCalibrationStatus: () => ({ data: null }),
  useCreateQCInspection: () => ({ mutateAsync: createInspection, isPending: false }),
  useQCInspections: () => ({ data: [] }),
  useSubmitQCDecision: () => ({ mutateAsync: submitDecision, isPending: false }),
}));
vi.mock('@/hooks/useStorageModule3', () => ({ useModule3StorageZones: () => ({ data: [] }) }));
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'qc-1', email: 'qc@example.test' }, isAdmin: false, profile: { full_name: 'Inspectrice QC' } }),
}));
vi.mock('@/lib/phase1RuleEngine', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/phase1RuleEngine')>()),
  recalculateAndSaveSupplierScore: vi.fn(async () => null),
  triggerAutoBlockIfNeeded: vi.fn(async () => false),
  createRejectionNotification: vi.fn(async () => undefined),
}));

const { QCInspectionDialog } = await import('./QCInspectionDialog');

const reception = {
  id: 'rec-1',
  reception_number: 'REC-1',
  status: 'EN_ATTENTE_QC',
  supplier_id: 'sup-1',
  supplier: { delivered_lots_count: 4 },
  quantity_total: 900,
  unit: 'kg',
  variety: 'Deglet Nour',
  bio_declared: false,
  created_by: 'op-1',
  gate_arrival_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
} as unknown as ReceptionV2;

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

beforeEach(() => {
  submitDecision.mockReset().mockResolvedValue({});
  createInspection.mockReset().mockResolvedValue({ id: 'insp-1', inspection_number: 'QC-1' });
});

const startInspection = async () => {
  render(<QCInspectionDialog open onOpenChange={vi.fn()} reception={reception} />);
  fireEvent.click(screen.getByRole('button', { name: /Demarrer l'inspection/i }));
  await screen.findByRole('button', { name: /Valider la décision QC/i });
};

// The full QC dialog takes a few seconds to render in jsdom when the whole suite runs in parallel.
describe('QC inspection flow', { timeout: 30_000 }, () => {
  it('offers no shortcut that writes measurements the inspector did not take', async () => {
    await startInspection();
    expect(screen.queryByText(/Conforme Standard/i)).not.toBeInTheDocument();
    for (const input of screen.getAllByPlaceholderText('%')) expect(input).toHaveValue(null);
  });

  it('refuses to submit until every humidity and caliber reading is entered', async () => {
    await startInspection();
    fireEvent.click(screen.getByRole('button', { name: /Valider la décision QC/i }));

    expect(await screen.findByText(/Mesures incomplètes : 13 valeur\(s\) manquante\(s\)/)).toBeInTheDocument();
    expect(submitDecision).not.toHaveBeenCalled();
  });

  it('signs the release with the PIN inside the same dialog and sends the measured values', async () => {
    await startInspection();
    for (const input of screen.getAllByPlaceholderText('%')) fireEvent.change(input, { target: { value: '22' } });
    const [caliberFill] = screen.getAllByPlaceholderText('mm');
    fireEvent.change(caliberFill, { target: { value: '46' } });
    fireEvent.click(screen.getByRole('button', { name: /Appliquer à tous/i }));

    fireEvent.click(screen.getByRole('button', { name: /Valider la décision QC/i }));
    const padTitle = await screen.findByText('Libération QC — code signature');
    expect(screen.getAllByRole('dialog')).toHaveLength(1);

    const pad = within(padTitle.closest('.rounded-lg.border') as HTMLElement);
    for (const digit of ['1', '2', '3', '4']) fireEvent.click(pad.getByRole('button', { name: digit }));
    fireEvent.click(pad.getByRole('button', { name: /Signer et libérer/i }));

    await waitFor(() => expect(submitDecision).toHaveBeenCalledTimes(1));
    const payload = submitDecision.mock.calls[0][0];
    expect(payload).toMatchObject({ inspectionId: 'insp-1', decision: 'ACCEPTE', pin: '1234' });
    expect(payload.checkResults).toEqual(expect.arrayContaining([
      expect.objectContaining({ check_code: 'HUM', measured_value: '22' }),
      expect.objectContaining({ check_code: 'CAL', measured_value: '46' }),
    ]));
  });
});
