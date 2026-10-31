import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createIntakeDraft, type IntakeDraft } from '@/lib/receptionIntake';

const scale = vi.hoisted(() => ({
  reading: null as null | Record<string, unknown>,
  connected: true,
}));

vi.mock('@/hooks/useWeighbridge', () => ({
  useLatestWeighbridgeReading: () => ({ reading: scale.reading, connected: scale.connected, refresh: vi.fn() }),
}));
vi.mock('@/hooks/useReceptionIntakeZones', () => ({
  useStorageZonesForIntake: () => ({ zones: [], suggestedZone: '' }),
}));
vi.mock('../PhotoCapture', () => ({ PhotoCapture: () => <div data-testid="photos" /> }));

const { StepLotWeighing } = await import('./StepLotWeighing');

const none = { level: 'none' as const, gapKg: null, gapPercent: null };
let current: IntakeDraft;

const Harness = ({ initial }: { initial: Partial<IntakeDraft> }) => {
  const [draft, setDraft] = useState<IntakeDraft>({ ...createIntakeDraft(), ...initial });
  current = draft;
  return (
    <StepLotWeighing
      draft={draft}
      update={(patch) => setDraft((value) => ({ ...value, ...patch }))}
      declaredGap={none}
      orderGap={none}
      expectedKg={null}
    />
  );
};

const open = (initial: Partial<IntakeDraft> = {}) => render(<Harness initial={initial} />);

describe('StepLotWeighing', () => {
  beforeEach(() => {
    scale.reading = null;
    scale.connected = true;
  });

  it('never mentions a connected scale while weights are typed', () => {
    open();
    expect(screen.getByRole('radio', { name: /Saisie manuelle/ })).toHaveAttribute('aria-checked', 'true');
    expect(document.body.textContent).not.toMatch(/Modbus/);
  });

  it('shows the net from what was typed and gives the only lot that quantity', () => {
    open({ delivery_note_number: 'BL-7' });
    fireEvent.change(screen.getByLabelText(/Poids brut/), { target: { value: '1000' } });
    fireEvent.change(screen.getByLabelText(/^Tare/), { target: { value: '100' } });

    expect(screen.getByTestId('net-weight')).toHaveTextContent('900 kg');
    expect(current.lots).toEqual([{ lot_supplier: 'BL-7', quantity: '900' }]);
  });

  it('never turns typed weights into a device weighing, or the reverse', () => {
    open({ gross_weight_kg: '1000', tare_weight_kg: '100' });
    fireEvent.click(screen.getByRole('radio', { name: /Bascule connectée/ }));

    expect(current).toMatchObject({ weighing_mode: 'CONNECTED', gross_weight_kg: '', tare_weight_kg: '', gross_reading_id: '' });
  });

  it('says so when the scale cannot be reached', () => {
    scale.connected = false;
    open({ weighing_mode: 'CONNECTED' });
    expect(screen.getByText(/Bascule injoignable/)).toBeInTheDocument();
  });

  it('says so when the scale has no reading, and captures nothing', () => {
    open({ weighing_mode: 'CONNECTED' });
    expect(screen.getByText(/Aucune lecture disponible/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Prendre comme brut' })).toBeNull();
  });

  it('keeps the signed reading as evidence and cannot reuse it for the tare', () => {
    scale.reading = {
      id: 'r1', reading_id: 'G1', device_code: 'BASCULE-1', captured_at: '2026-10-31T08:00:00.000Z',
      weight_kg: 1000, stable: true, direction: 'GROSS', signature_verified: true,
    };
    open({ weighing_mode: 'CONNECTED' });
    fireEvent.click(screen.getByRole('button', { name: 'Prendre comme brut' }));

    expect(current).toMatchObject({ gross_weight_kg: '1000', gross_reading_id: 'G1', gross_device_code: 'BASCULE-1' });
    expect(screen.getByRole('button', { name: 'Prendre comme tare' })).toBeDisabled();
  });

  it('requires a reason only when no scale was used', () => {
    open();
    expect(screen.queryByLabelText(/Pourquoi la bascule/)).toBeNull();
    fireEvent.click(screen.getByRole('radio', { name: /Sans bascule/ }));
    expect(screen.getByLabelText(/Pourquoi la bascule/)).toBeInTheDocument();
  });
});
