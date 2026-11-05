import { describe, expect, it } from 'vitest';
import {
  defaultProductionView,
  getOperatorProductionStage,
  getProductionNavGroups,
  isAllowedProductionView,
  isProductionSupervisor,
} from './productionNav';

describe('productionNav', () => {
  it('gives cleaning operators a three-step post', () => {
    const roles = ['operateur_nettoyage'] as const;
    expect(getOperatorProductionStage([...roles])).toBe('nettoyage');
    expect(isProductionSupervisor([...roles])).toBe(false);
    const views = getProductionNavGroups([...roles], true).flatMap((group) => group.items.map((item) => item.view));
    expect(views).toEqual(['today', 'nettoyage', 'done']);
    expect(isAllowedProductionView([...roles], true, 'kpi')).toBe(false);
    expect(defaultProductionView([...roles], true)).toBe('today');
  });

  it('keeps the full atelier for production supervisors', () => {
    const roles = ['responsable_production'] as const;
    expect(getOperatorProductionStage([...roles])).toBeNull();
    expect(isProductionSupervisor([...roles])).toBe(true);
    const views = getProductionNavGroups([...roles], true).flatMap((group) => group.items.map((item) => item.view));
    expect(views).toContain('orders');
    expect(views).toContain('fumigation');
    expect(views).toContain('kpi');
    expect(views).toContain('done');
  });

  it('hides stage-only views when phase2 is disabled', () => {
    const views = getProductionNavGroups(['responsable_production'], false).flatMap((group) =>
      group.items.map((item) => item.view),
    );
    expect(views).not.toContain('fumigation');
    expect(views).toContain('today');
    expect(views).toContain('orders');
  });
});
