import { describe, expect, it } from 'vitest';
import {
  assertBioCertificationForReception,
  buildRoyalPalmLotId,
  deriveReceptionPhase1State,
} from './phase1.js';

describe('phase1 service', () => {
  it('builds a Royal Palm lot id', () => {
    expect(
      buildRoyalPalmLotId({
        region: 'Tozeur',
        supplierCode: 'C012',
        dateKey: '20261018',
        sequence: 3,
      }),
    ).toBe('RP-TOZ-C012-20261018-003');
  });

  it('derives blocked state for hot arrivals', () => {
    const result = deriveReceptionPhase1State({
      status: 'EN_ATTENTE_QC',
      arrival_temperature_c: 36,
      weight_gap_percent: 4,
    });

    expect(result.status).toBe('BLOQUE');
    expect(result.alerts).toEqual(
      expect.arrayContaining(["Temperature d'arrivee elevee", 'Ecart poids a verifier']),
    );
  });

  it('requires bio certification for bio reception', () => {
    expect(() =>
      assertBioCertificationForReception({ certifications: [] }, true),
    ).toThrow(/Bio reception requires/);
  });
});
