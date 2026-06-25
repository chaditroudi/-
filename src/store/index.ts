import { configureStore } from '@reduxjs/toolkit';
import { receptionsApi } from './api/receptionsApi';
import { productionApi } from './api/productionApi';
import { batchesApi } from './api/batchesApi';
import { suppliersApi } from './api/suppliersApi';
import { materialsApi } from './api/materialsApi';
import { stockApi } from './api/stockApi';
import { storageApi } from './api/storageApi';
import { notificationsApi } from './api/notificationsApi';
import { notificationsReducer } from './slices/notificationsSlice';
import { receptionsReducer } from './slices/receptionsSlice';

export const store = configureStore({
  reducer: {
    notifications: notificationsReducer,
    receptions: receptionsReducer,
    [receptionsApi.reducerPath]: receptionsApi.reducer,
    [productionApi.reducerPath]: productionApi.reducer,
    [batchesApi.reducerPath]: batchesApi.reducer,
    [suppliersApi.reducerPath]: suppliersApi.reducer,
    [materialsApi.reducerPath]: materialsApi.reducer,
    [stockApi.reducerPath]: stockApi.reducer,
    [storageApi.reducerPath]: storageApi.reducer,
    [notificationsApi.reducerPath]: notificationsApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(
      receptionsApi.middleware,
      productionApi.middleware,
      batchesApi.middleware,
      suppliersApi.middleware,
      materialsApi.middleware,
      stockApi.middleware,
      storageApi.middleware,
      notificationsApi.middleware,
    ),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
