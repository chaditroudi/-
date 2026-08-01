import { describe, expect, it } from 'vitest';

import {
  journeyStageStatus,
  resolveLotJourneyNextAction,
} from './lotJourney';

describe('resolveLotJourneyNextAction', () => {
  it('points to weighing after intake only', () => {
    const next = resolveLotJourneyNextAction({
      completed: ['SUPPLIER_INTAKE'],
      missing: ['WEIGHED', 'QC_DECIDED', 'COLD_STORE', 'FUMIGATION_CCP', 'TRIAGE', 'PACKED', 'SHIPPED'],
      stage: 'SUPPLIER_INTAKE',
    });
    expect(next.tab).toBe('receptions');
    expect(next.nextStage).toBe('WEIGHED');
    expect(next.ctaLabel).toMatch(/réception/i);
  });

  it('points to storage after QC', () => {
    const next = resolveLotJourneyNextAction({
      completed: ['SUPPLIER_INTAKE', 'WEIGHED', 'QC_DECIDED'],
      missing: ['COLD_STORE', 'FUMIGATION_CCP', 'TRIAGE', 'PACKED', 'SHIPPED'],
      stage: 'QC_DECIDED',
    });
    expect(next.tab).toBe('storage');
    expect(next.nextStage).toBe('COLD_STORE');
  });

  it('points to fumigation phase2 after cold store', () => {
    const next = resolveLotJourneyNextAction({
      completed: ['SUPPLIER_INTAKE', 'WEIGHED', 'QC_DECIDED', 'COLD_STORE'],
      missing: ['FUMIGATION_CCP', 'TRIAGE', 'PACKED', 'SHIPPED'],
      stage: 'COLD_STORE',
    });
    expect(next.tab).toBe('production');
    expect(next.view).toBe('phase2');
    expect(next.module).toBe('fumigation');
  });

  it('points to triage module after fumigation', () => {
    const next = resolveLotJourneyNextAction({
      completed: ['SUPPLIER_INTAKE', 'WEIGHED', 'QC_DECIDED', 'COLD_STORE', 'FUMIGATION_CCP'],
      missing: ['TRIAGE', 'PACKED', 'SHIPPED'],
      stage: 'FUMIGATION_CCP',
    });
    expect(next.module).toBe('triage');
  });

  it('points to export when complete', () => {
    const next = resolveLotJourneyNextAction({ complete: true, stage: 'SHIPPED' });
    expect(next.tab).toBe('export');
    expect(next.nextStage).toBe('SHIPPED');
  });

  it('routes rejected lots to quality', () => {
    expect(resolveLotJourneyNextAction({ rejected: true }).tab).toBe('quality');
  });
});

describe('journeyStageStatus', () => {
  it('marks done / current / todo', () => {
    const progress = {
      completed: ['SUPPLIER_INTAKE', 'WEIGHED'],
      current: 'QC_DECIDED' as string | null,
    };
    expect(journeyStageStatus('SUPPLIER_INTAKE', progress)).toBe('done');
    expect(journeyStageStatus('QC_DECIDED', progress)).toBe('current');
    expect(journeyStageStatus('SHIPPED', progress)).toBe('todo');
  });
});
