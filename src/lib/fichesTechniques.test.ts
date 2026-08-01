import { describe, expect, it } from 'vitest';

import {
  FICHES_TECHNIQUES,
  getFicheById,
  getFicheForStage,
  listFichesForTabs,
  mergeFicheWithOverride,
} from './fichesTechniques';
import { LOT_JOURNEY_STAGES } from './lotJourney';

describe('fichesTechniques A→Z', () => {
  it('covers every golden-thread stage', () => {
    for (const stage of LOT_JOURNEY_STAGES) {
      const fiche = getFicheForStage(stage);
      expect(fiche, `missing fiche for ${stage}`).toBeTruthy();
      expect(fiche!.stage).toBe(stage);
      expect(fiche!.steps.length).toBeGreaterThanOrEqual(4);
      expect(fiche!.criticalLimits.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('includes BRA and BDE document aides', () => {
    expect(getFicheById('FT-BRA')?.navigate.view).toBe('bra');
    expect(getFicheById('FT-BDE')?.navigate.view).toBe('bde');
  });

  it('filters by accessible tabs', () => {
    const onlyReception = listFichesForTabs(['receptions']);
    expect(onlyReception.every((f) => f.navigate.tab === 'receptions')).toBe(true);
    expect(onlyReception.some((f) => f.id === 'FT-BRA')).toBe(true);
    expect(onlyReception.some((f) => f.id === 'FT-BDE')).toBe(false);
  });

  it('merges site overrides onto base fiches', () => {
    const base = getFicheById('FT-05-FUMIGATION')!;
    const merged = mergeFicheWithOverride(base, {
      criticalLimits: [{ label: 'Température', value: 'Site: 28–32 °C' }],
      ifBlocked: 'Appeler chef CCP site',
    });
    expect(merged.title).toBe(base.title);
    expect(merged.criticalLimits[0].value).toContain('28–32');
    expect(merged.ifBlocked).toMatch(/chef CCP/);
  });
});
