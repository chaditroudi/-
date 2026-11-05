import { describe, expect, it } from 'vitest';
import { WORKER_DARIJA, darijaTitle } from './workerDarija';

describe('workerDarija', () => {
  it('exposes only non-empty verified glosses', () => {
    const keys = Object.keys(WORKER_DARIJA);
    expect(keys.length).toBeGreaterThan(5);
    for (const key of keys) {
      expect(WORKER_DARIJA[key].trim().length).toBeGreaterThan(0);
      expect(darijaTitle(key)).toBe(WORKER_DARIJA[key]);
    }
  });

  it('returns undefined for unverified actions', () => {
    expect(darijaTitle('qc.unknownAction')).toBeUndefined();
  });
});
