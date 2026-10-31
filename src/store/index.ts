import { combineReducers, configureStore, createAction, type UnknownAction } from '@reduxjs/toolkit';
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

const combinedReducer = combineReducers({
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
});

type CombinedState = ReturnType<typeof combinedReducer>;

export const sessionDataCleared = createAction('session/dataCleared');

/** Slices have no reset of their own, so the next account starts from their initial state. */
const rootReducer = (state: CombinedState | undefined, action: UnknownAction) =>
  combinedReducer(
    state && sessionDataCleared.match(action)
      ? ({ ...state, notifications: undefined, receptions: undefined } as unknown as CombinedState)
      : state,
    action,
  );

export const store = configureStore({
  reducer: rootReducer,
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
