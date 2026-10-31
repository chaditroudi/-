import { describe, expect, it } from 'vitest';

import { ApiRequestError } from './axiosClient';
import { conditionLabel, knownCount, resolveDataCondition } from './dataCondition';

const refused = new ApiRequestError({ message: 'x', status: 403 });
const broken = new ApiRequestError({ message: 'x', status: 500 });
const unreachable = new ApiRequestError({ message: 'x', isNetworkError: true });

describe('resolveDataCondition', () => {
  it('waits for the first answer', () => {
    expect(resolveDataCondition({ isLoading: true })).toBe('loading');
  });

  it('reports a true empty list only after a successful answer', () => {
    expect(resolveDataCondition({ data: [] })).toBe('empty');
    expect(resolveDataCondition({ data: [{ id: 1 }] })).toBe('ready');
  });

  it('never reads a refusal as empty', () => {
    expect(resolveDataCondition({ error: refused })).toBe('restricted');
  });

  it('hides data held from before when access is refused', () => {
    expect(resolveDataCondition({ error: refused, data: [{ id: 1 }] })).toBe('restricted');
  });

  it('never reads a server failure as empty', () => {
    expect(resolveDataCondition({ error: broken })).toBe('error');
  });

  it('keeps earlier data on a failed refresh, and says it is old', () => {
    expect(resolveDataCondition({ error: broken, data: [{ id: 1 }] })).toBe('stale');
    expect(resolveDataCondition({ error: broken, data: [] })).toBe('stale');
  });

  it('names a lost connection', () => {
    expect(resolveDataCondition({ error: unreachable, online: false })).toBe('offline');
    expect(resolveDataCondition({ online: false })).toBe('offline');
  });

  it('marks data as old while offline', () => {
    expect(resolveDataCondition({ data: [{ id: 1 }], online: false })).toBe('stale');
  });

  it('accepts an explicit emptiness for objects', () => {
    expect(resolveDataCondition({ data: { rows: [] }, isEmpty: true })).toBe('empty');
  });
});

describe('knownCount', () => {
  const count = (rows: number[]) => rows.length;

  it('gives no figure for what it does not know', () => {
    expect(knownCount('restricted', undefined, count)).toBeNull();
    expect(knownCount('error', undefined, count)).toBeNull();
    expect(knownCount('loading', undefined, count)).toBeNull();
    expect(knownCount('offline', undefined, count)).toBeNull();
    expect(knownCount('restricted', [1, 2], count)).toBeNull();
  });

  it('gives a real zero when the answer is empty', () => {
    expect(knownCount('empty', [], count)).toBe(0);
    expect(knownCount('ready', [1, 2], count)).toBe(2);
  });
});

describe('conditionLabel', () => {
  it('words every condition that hides a figure', () => {
    expect(conditionLabel('restricted')).toBe('Accès réservé');
    expect(conditionLabel('error')).toBe('Indisponible');
    expect(conditionLabel('offline')).toBe('Hors ligne');
    expect(conditionLabel('ready')).toBeNull();
  });
});
