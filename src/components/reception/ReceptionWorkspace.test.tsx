import { fireEvent, render, screen } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ActorRole } from '@/types/roles';
import type { ReceptionLot, ReceptionV2 } from '@/types/reception';

const auth = vi.hoisted(() => ({ roles: [] as string[] }));
const data = vi.hoisted(() => ({
  reception: null as unknown,
  lots: [] as unknown[],
  audit: [] as unknown[],
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuthContext: () => ({ roles: auth.roles, profile: { full_name: 'Test' }, user: { id: 'u-1' } }),
}));
vi.mock('@/hooks/useReceptionsV2', () => ({
  receptionErrorMessage: (_error: unknown, fallback: string) => fallback,
  useReceptionV2Detail: () => ({ data: data.reception, isLoading: false, isError: false }),
  useReceptionLots: () => ({ data: data.lots }),
  useQCInspections: () => ({ data: [] }),
  useUpdateReceptionV2Status: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock('@/store/api/receptionsApi', () => ({ useListReceptionAuditQuery: () => ({ data: data.audit }) }));
vi.mock('./ReceptionCorrectionDialog', () => ({ ReceptionCorrectionDialog: () => <div data-testid="correction-dialog" /> }));

// Children own their behaviour and tests; the workspace decides what is offered to whom.
const stub = (name: string) => () => <div data-testid={name} />;
vi.mock('./StorageAssignment', () => ({ StorageAssignment: stub('storage-assignment') }));
vi.mock('./QCInspectionDialog', () => ({ QCInspectionDialog: stub('qc-dialog') }));
vi.mock('./LotCostCard', () => ({ LotCostCard: stub('lot-cost') }));
vi.mock('./UnitsManagement', () => ({ UnitsManagement: stub('units') }));
vi.mock('./LabelPrintDialog', () => ({ LabelPrintDialog: stub('label-dialog') }));
vi.mock('./BonReceptionDialog', () => ({ BonReceptionDialog: stub('bon-dialog') }));
vi.mock('./BonExpeditionDialog', () => ({ BonExpeditionDialog: stub('expedition-dialog') }));
vi.mock('./RapportQCDialog', () => ({ RapportQCDialog: stub('rapport-dialog') }));
vi.mock('./ReclamationFournisseurDialog', () => ({ ReclamationFournisseurDialog: stub('reclamation-dialog') }));
vi.mock('./BonReclamationDialog', () => ({ BonReclamationDialog: stub('bon-reclamation-dialog') }));
vi.mock('./WeighingRecordDialog', () => ({ WeighingRecordDialog: stub('weighing-dialog') }));
vi.mock('./Gs1LabelPreview', () => ({ Gs1LabelPreview: stub('gs1') }));
vi.mock('./ReceptionLotStatusDialog', () => ({ ReceptionLotStatusDialog: stub('lot-status-dialog') }));
vi.mock('./ReceptionCancelDialog', () => ({ ReceptionCancelDialog: stub('cancel-dialog') }));

const { ReceptionDetailV2 } = await import('./ReceptionDetailV2');

const reception = (patch: Partial<ReceptionV2> = {}) => ({
  id: 'rec-1',
  reception_number: 'REC-1',
  status: 'EN_ATTENTE_QC',
  qc_decision: null,
  supplier_name_snapshot: 'Coopérative Oasis',
  quantity_total: 900,
  unit: 'kg',
  created_at: '2026-10-01T08:00:00.000Z',
  ...patch,
}) as unknown as ReceptionV2;

const lot = (patch: Partial<ReceptionLot> = {}) => ({
  id: 'lot-1', lot_internal: 'RP-TOZ-1', lot_supplier: 'BL-9', quantity: 900, unit: 'kg', stock_status: 'EN_QUARANTAINE', ...patch,
}) as unknown as ReceptionLot;

const renderAs = (roles: ActorRole[]) => {
  auth.roles = roles;
  return render(<ReceptionDetailV2 receptionId="rec-1" onBack={vi.fn()} />);
};

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

beforeEach(() => {
  data.reception = reception();
  data.lots = [lot()];
  data.audit = [];
});

describe('reception workspace', () => {
  it('tells a reception operator the delivery waits for QC, without QC or cancel actions', () => {
    renderAs(['operateur_reception']);
    expect(screen.getByText('En attente du contrôle qualité')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Lancer le contrôle QC/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Annuler la réception/i })).not.toBeInTheDocument();
  });

  it('gives the inspector a one-tap QC start from the next-step bar', () => {
    renderAs(['inspecteur_qualite']);
    expect(screen.queryByTestId('qc-dialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Lancer le contrôle QC/i }));
    expect(screen.getByTestId('qc-dialog')).toBeInTheDocument();
  });

  it('lets a reception supervisor cancel before the QC decision', () => {
    renderAs(['chef_reception']);
    expect(screen.getByRole('button', { name: /Annuler la réception/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Lancer le contrôle QC/i })).not.toBeInTheDocument();
  });

  it('sends released lots without a zone to the storage section', () => {
    data.reception = reception({ status: 'LIBERE', qc_decision: 'ACCEPTE' });
    data.lots = [lot({ stock_status: 'STOCK_LIBERE', storage_zone_code: null })];
    renderAs(['magasinier_wms']);

    fireEvent.click(screen.getByRole('button', { name: /Affecter au stock/i }));
    expect(screen.getByTestId('storage-assignment')).toBeInTheDocument();
  });

  it('shows the action history in plain French with who acted', () => {
    data.audit = [{
      id: 'a-1',
      action: 'CANCELLED',
      entity_type: 'RECEPTION',
      previous_state: { status: 'EN_QC' },
      new_state: { status: 'ANNULE', reason: 'BL erroné' },
      performed_by: 'u-7',
      performed_by_name: 'Sami Ben Ali',
      created_at: '2026-10-01T09:00:00.000Z',
    }];
    renderAs(['chef_reception']);
    fireEvent.mouseDown(screen.getByRole('tab', { name: /Historique/i }));

    expect(screen.getByText('Réception annulée')).toBeInTheDocument();
    expect(screen.getByText('par Sami Ben Ali')).toBeInTheDocument();
    expect(screen.getByText('En contrôle QC → Annulé · Motif : BL erroné')).toBeInTheDocument();
    expect(screen.queryByText(/"status"/)).not.toBeInTheDocument();
  });
});
