import { describe, expect, it } from 'vitest';

import { buildPfLotLabelHtml } from './printPfLotLabel';

describe('buildPfLotLabelHtml', () => {
  it('prints lot, grade, weight and QR payload', () => {
    const html = buildPfLotLabelHtml({
      lotNumber: 'LOT-PF-001',
      productName: 'Deglet Nour Extra',
      variety: 'Deglet Nour',
      grade: 'Extra',
      netWeightKg: 12.5,
      companyName: 'Royal Palm',
      plantName: 'Tozeur',
      copies: 1,
    });

    expect(html).toContain('ÉTIQUETTE PF');
    expect(html).toContain('LOT-PF-001');
    expect(html).toContain('Extra');
    expect(html).toContain('12,5');
    expect(html).toContain('LOT:LOT-PF-001');
    expect(html).toContain('Deglet Nour Extra');
  });
});
