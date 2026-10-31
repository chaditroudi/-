import { QueryClient } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { store } from '@/store';
import { clearSessionData, LEGACY_API_CACHE } from './sessionData';

afterEach(() => vi.unstubAllGlobals());

describe('clearSessionData', () => {
  it('leaves no query from the previous account', async () => {
    const client = new QueryClient();
    client.setQueryData(['stock', 'lots'], [{ lot_number: 'LOT-0001', cost_tnd_per_kg: 26.46 }]);

    await clearSessionData(client);

    expect(client.getQueryCache().getAll()).toHaveLength(0);
  });

  it('removes the cache older service workers filled', async () => {
    const remove = vi.fn(async () => true);
    vi.stubGlobal('caches', { delete: remove });

    await clearSessionData(new QueryClient());

    expect(remove).toHaveBeenCalledWith(LEGACY_API_CACHE);
  });

  it('resets the store slices to their initial state', async () => {
    const before = store.getState().notifications;
    await clearSessionData(new QueryClient());
    expect(store.getState().notifications).toEqual(before);
  });

  it('survives a browser with no cache storage', async () => {
    vi.stubGlobal('caches', undefined);
    await expect(clearSessionData(new QueryClient())).resolves.toBeUndefined();
  });
});
