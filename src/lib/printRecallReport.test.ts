import { describe, expect, it } from 'vitest';

import type { RecallDrillResult } from '@/lib/api/trust';
import { buildRecallReportHtml } from './printRecallReport';

const sample: RecallDrillResult = {
  wave: 'W2',
  resolvedLotId: 'lot-1',
  lotNumber: 'LOT-DEMO-001',
  tipHash: 'abc123',
  valid: true,
  elapsedMs: 420,
  under60s: true,
  targetSeconds: 60,
  stats: {
    nodeCount: 4,
    edgeCount: 3,
    upstreamCount: 2,
    downstreamCount: 2,
    shipmentCount: 1,
    paletteCount: 1,
    stageCount: 3,
  },
  upstream: [
    { id: 'u1', type: 'reception_lot', label: 'LOT-DEMO-001', sublabel: 'Réception', status: 'ok', column: 0 },
  ],
  downstream: [
    { id: 'd1', type: 'shipment', label: 'EXP-1', sublabel: 'Client X', status: 'SHIPPED', column: 2 },
  ],
  impactedShipments: [{ id: 's1', status: 'SHIPPED', reference: 'EXP-1', customer: 'Client X' }],
  impactedPalettes: [{ id: 'p1', sscc: '003123', palette_number: 'PAL-1', status: 'ok' }],
  ranAt: '2026-08-01T10:00:00.000Z',
};

describe('buildRecallReportHtml', () => {
  it('includes lot, timing, upstream/downstream and impacted lists', () => {
    const html = buildRecallReportHtml(sample, {
      companyName: 'Test Plant',
      coordinator: 'Mme Qualité',
    });
    expect(html).toContain('LOT-DEMO-001');
    expect(html).toContain('Sous 60 s');
    expect(html).toContain('Amont');
    expect(html).toContain('Aval');
    expect(html).toContain('EXP-1');
    expect(html).toContain('PAL-1');
    expect(html).toContain('Mme Qualité');
    expect(html).toContain('Test Plant');
  });

  it('flags slow or invalid chain', () => {
    const html = buildRecallReportHtml({
      ...sample,
      under60s: false,
      valid: false,
      elapsedMs: 61_000,
    });
    expect(html).toContain('Au-delà de 60 s');
    expect(html).toContain('cassée');
  });
});
