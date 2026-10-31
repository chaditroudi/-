import { describe, expect, it } from 'vitest';

import {
  assessWeightGap,
  buildIntakePayload,
  createIntakeDraft,
  DEFAULT_INTAKE_POLICY,
  describeWeighingSource,
  getDeliveryBlockers,
  getDraftWaitingFor,
  getNetWeightKg,
  getWeighingBlockers,
  isVerifiedDeviceWeighing,
  type IntakeDraft,
} from './receptionIntake';

const complete = (patch: Partial<IntakeDraft> = {}): IntakeDraft => ({
  ...createIntakeDraft(new Date('2026-10-31T08:00:00.000Z')),
  supplier_id: 'sup-1',
  supplier_label: 'SUP-1 · Oasis',
  delivery_note_number: 'BL-1',
  vehicle_number: '123 TU 4567',
  variety: 'Deglet Nour',
  maturity_stage: 'Tamar',
  harvest_method: 'Manuelle traditionnelle',
  gross_weight_kg: '1000.3',
  tare_weight_kg: '100.1',
  unit_count: '2',
  lots: [{ lot_supplier: 'LS-1', quantity: '900.2' }],
  arrival_temperature_c: '24',
  storage_zone_code: 'ZR-01',
  photos: ['a', 'b'],
  ...patch,
});

const context = { hasBioCertification: false };

describe('reception draft', () => {
  it('starts with no measurement and no quality judgement', () => {
    const draft = createIntakeDraft();
    expect(draft).toMatchObject({
      gross_weight_kg: '', tare_weight_kg: '', arrival_temperature_c: '', variety: '',
      maturity_stage: '', harvest_method: '', quick_visual_state: '', transport_condition: '', harvest_date: '',
    });
    expect(getNetWeightKg(draft)).toBeNull();
  });

  it('computes the net at gram precision and accepts a French decimal comma', () => {
    expect(getNetWeightKg({ gross_weight_kg: '1000,3', tare_weight_kg: '100.1' })).toBe(900.2);
  });

  it('says what a parked delivery is waiting for', () => {
    expect(getDraftWaitingFor({ supplier_id: '', gross_weight_kg: '', tare_weight_kg: '' })).toBe('Fournisseur à choisir');
    expect(getDraftWaitingFor({ supplier_id: 's', gross_weight_kg: '', tare_weight_kg: '' })).toBe('En attente de pesée brute');
    expect(getDraftWaitingFor({ supplier_id: 's', gross_weight_kg: '10', tare_weight_kg: '' })).toBe('En attente de la tare');
    expect(getDraftWaitingFor({ supplier_id: 's', gross_weight_kg: '10', tare_weight_kg: '1' })).toBe('À vérifier et confirmer');
  });
});

describe('delivery step', () => {
  it('passes a complete delivery', () => {
    expect(getDeliveryBlockers(complete(), DEFAULT_INTAKE_POLICY, context)).toEqual([]);
  });

  it('applies the site policy on orders and vehicles', () => {
    const noVehicle = complete({ vehicle_number: '' });
    expect(getDeliveryBlockers(noVehicle, DEFAULT_INTAKE_POLICY, context)).toHaveLength(1);
    expect(getDeliveryBlockers(noVehicle, { ...DEFAULT_INTAKE_POLICY, requireVehicleNumber: false }, context)).toEqual([]);
    expect(getDeliveryBlockers(complete(), { ...DEFAULT_INTAKE_POLICY, requirePurchaseOrder: true }, context)[0]).toMatch(/bon de commande/);
    expect(getDeliveryBlockers(complete(), { ...DEFAULT_INTAKE_POLICY, allowSpontaneous: false }, context)[0]).toMatch(/bon de commande/);
  });

  it('requires the line once an order is chosen', () => {
    expect(getDeliveryBlockers(complete({ purchase_order_id: 'po-1' }), DEFAULT_INTAKE_POLICY, context)[0]).toMatch(/ligne/);
  });

  it('blocks a Bio declaration without a valid certificate (RG-R05)', () => {
    const bio = complete({ bio_declared: true });
    expect(getDeliveryBlockers(bio, DEFAULT_INTAKE_POLICY, context)[0]).toMatch(/RG-R05/);
    expect(getDeliveryBlockers(bio, DEFAULT_INTAKE_POLICY, { hasBioCertification: true })).toEqual([]);
  });
});

describe('weighing step', () => {
  it('passes a complete manual weighing read on the scale', () => {
    expect(getWeighingBlockers(complete())).toEqual([]);
  });

  it('refuses an impossible net and a lot split that differs from it', () => {
    expect(getWeighingBlockers(complete({ tare_weight_kg: '2000', lots: [{ lot_supplier: 'A', quantity: '1' }] })).join(' ')).toMatch(/net doit être positif/);
    expect(getWeighingBlockers(complete({ lots: [{ lot_supplier: 'A', quantity: '800' }] })).join(' ')).toMatch(/somme des lots/);
  });

  it('wants a reason when no scale was used', () => {
    const noScale = complete({ manual_evidence: 'NO_SCALE' });
    expect(getWeighingBlockers(noScale).join(' ')).toMatch(/bascule n'a pas servi/);
    expect(getWeighingBlockers({ ...noScale, manual_reason: 'Bascule en panne ce matin' })).toEqual([]);
  });

  it('requires both signed readings in connected mode, whatever is typed', () => {
    const connected = complete({ weighing_mode: 'CONNECTED' });
    expect(isVerifiedDeviceWeighing(connected)).toBe(false);
    expect(getWeighingBlockers(connected).join(' ')).toMatch(/Capturez le poids brut/);
    expect(isVerifiedDeviceWeighing({ ...connected, gross_reading_id: 'G', tare_reading_id: 'T' })).toBe(true);
  });

  it('requires photos and a measured temperature', () => {
    expect(getWeighingBlockers(complete({ photos: ['a'], arrival_temperature_c: '' })).join(' ')).toMatch(/température.*photos/s);
  });
});

describe('weighing provenance', () => {
  it('never reports a typed weight as a connected measurement', () => {
    expect(describeWeighingSource('SCALE', false)).toBe('Saisie manuelle · lu sur la bascule');
    expect(describeWeighingSource('MANUAL', false)).toBe('Saisie manuelle · sans bascule');
    expect(describeWeighingSource('DEVICE', true)).toBe('Bascule connectée · lecture signée');
    expect(describeWeighingSource('DEVICE', false)).toBe('Provenance non renseignée');
    expect(describeWeighingSource(null, null)).toBe('Provenance non renseignée');
  });

  it('sends typed weights with their source and no reading ids', () => {
    const payload = buildIntakePayload(complete());
    expect(payload).toMatchObject({
      client_request_id: expect.any(String), weighing_source: 'SCALE', gross_weight_kg: 1000.3,
      tare_weight_kg: 100.1, gross_reading_id: null, tare_reading_id: null,
    });
    expect(payload.lots[0]).toMatchObject({ lot_supplier: 'LS-1', quantity: 900.2, variety: 'Deglet Nour' });
  });

  it('sends only reading ids for a connected weighing: the server reads the weight from the evidence', () => {
    const payload = buildIntakePayload(complete({ weighing_mode: 'CONNECTED', gross_reading_id: 'G', tare_reading_id: 'T' }));
    expect(payload).toMatchObject({ gross_reading_id: 'G', tare_reading_id: 'T', gross_weight_kg: 0, tare_weight_kg: 0 });
    expect(payload.weighing_source).toBeUndefined();
  });

  it('carries the draft version only once the draft is shared', () => {
    expect(buildIntakePayload(complete())).not.toHaveProperty('draft_version');
    expect(buildIntakePayload(complete({ version: 3 }))).toMatchObject({ draft_version: 3 });
  });
});

describe('weight gap', () => {
  const policy = { weightGapWarningPct: 5, weightGapCriticalPct: 10 };

  it('keeps the sign: a shortfall and an excess are different facts', () => {
    expect(assessWeightGap(900, 1000, policy)).toEqual({ level: 'warning', gapKg: -100, gapPercent: -10 });
    expect(assessWeightGap(1200, 1000, policy)).toEqual({ level: 'critical', gapKg: 200, gapPercent: 20 });
  });

  it('follows the configured thresholds and ignores what is unknown', () => {
    expect(assessWeightGap(1040, 1000, policy).level).toBe('none');
    expect(assessWeightGap(1040, 1000, { weightGapWarningPct: 2, weightGapCriticalPct: 3 }).level).toBe('critical');
    expect(assessWeightGap(null, 1000, policy).level).toBe('none');
    expect(assessWeightGap(900, null, policy).gapKg).toBeNull();
  });
});
