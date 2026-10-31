import type { QueryClient } from '@tanstack/react-query';

import { sessionDataCleared, store } from '@/store';
import { batchesApi } from '@/store/api/batchesApi';
import { materialsApi } from '@/store/api/materialsApi';
import { notificationsApi } from '@/store/api/notificationsApi';
import { productionApi } from '@/store/api/productionApi';
import { receptionsApi } from '@/store/api/receptionsApi';
import { stockApi } from '@/store/api/stockApi';
import { storageApi } from '@/store/api/storageApi';
import { suppliersApi } from '@/store/api/suppliersApi';

/** Older service workers filled this with answers for whoever was signed in. */
export const LEGACY_API_CACHE = 'api-cache';

export const deleteLegacyApiCache = async () => {
  if (typeof caches === 'undefined') return;
  await caches.delete(LEGACY_API_CACHE).catch(() => false);
};

/** Removes everything held in memory for an account that has left this device. */
export const clearSessionData = async (client: QueryClient) => {
  await client.cancelQueries();
  client.clear();
  for (const api of [
    receptionsApi, productionApi, batchesApi, suppliersApi, materialsApi, stockApi, storageApi, notificationsApi,
  ]) {
    store.dispatch(api.util.resetApiState());
  }
  store.dispatch(sessionDataCleared());
  await deleteLegacyApiCache();
};
