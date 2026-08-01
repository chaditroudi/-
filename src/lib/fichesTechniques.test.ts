import { describe, expect, it } from 'vitest';

import {
  FICHES_TECHNIQUES,
  getFicheById,
  getFicheForStage,
  listFichesForTabs,
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

  it('has stable codes FT-01…FT-08 plus docs', () => {
    const process = FICHES_TECHNIQUES.filter((f) => f.stage);
    expect(process).toHaveLength(8);
    expect(process.map((f) => f.code)).toEqual([
      'FT-01',
      'FT-02',
      'FT-03',
      'FT-04',
      'FT-05',
      'FT-06',
      'FT-07',
      'FT-08',
    ]);
  });
});
