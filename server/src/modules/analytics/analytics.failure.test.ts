// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AnalyticsService } from './analytics.service.js';

const failure = new Error('local injected database outage');
vi.mock('../../db/dynamic-model.js', () => ({
  sanitizeDocument: (value: unknown) => value,
  getCollectionModel: () => {
    const query = { lean: () => query, select: () => query, sort: () => query, limit: () => query, exec: async () => { throw failure; } };
    return { find: () => query };
  },
}));
afterEach(() => vi.restoreAllMocks());
describe('analytics source failures', () => {
  it('propagates a failed source instead of reporting an idle healthy factory', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await expect(new AnalyticsService().getFounderLiveFactory()).rejects.toBe(failure);
  });
});
