import { createAsyncThunk, createSelector, createSlice, type PayloadAction } from '@reduxjs/toolkit';

import { receptionsApi } from '@/lib/api/receptions';
import type { ReceptionHeaderStatus, ReceptionV2, QCDecisionType } from '@/types/reception';
import type { RootState } from '@/store';

type AsyncStatus = 'idle' | 'loading' | 'succeeded' | 'failed';

interface ReceptionsState {
  items: ReceptionV2[];
  status: AsyncStatus;
  error: string | null;
  initialized: boolean;
  lastSyncedAt: string | null;
}

const initialState: ReceptionsState = {
  items: [],
  status: 'idle',
  error: null,
  initialized: false,
  lastSyncedAt: null,
};

const sortReceptions = (items: ReceptionV2[]) =>
  [...items].sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime());

const mergeReception = (current: ReceptionV2 | undefined, incoming: ReceptionV2): ReceptionV2 => ({
  ...(current || {}),
  ...incoming,
  supplier: incoming.supplier ?? current?.supplier,
  supplier_name_snapshot:
    incoming.supplier_name_snapshot ??
    current?.supplier_name_snapshot ??
    incoming.supplier?.name ??
    current?.supplier?.name ??
    null,
  supplier_code_snapshot:
    incoming.supplier_code_snapshot ??
    current?.supplier_code_snapshot ??
    incoming.supplier?.code ??
    current?.supplier?.code ??
    null,
});

const upsertReceptionList = (items: ReceptionV2[], reception: ReceptionV2) => {
  const existingIndex = items.findIndex((entry) => entry.id === reception.id);
  if (existingIndex === -1) {
    return sortReceptions([mergeReception(undefined, reception), ...items]);
  }

  const next = [...items];
  next[existingIndex] = mergeReception(next[existingIndex], reception);
  return sortReceptions(next);
};

export const fetchReceptions = createAsyncThunk<ReceptionV2[], void, { rejectValue: string }>(
  'receptions/fetchAll',
  async (_, { rejectWithValue }) => {
    try {
      return await receptionsApi.list();
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Impossible de charger les réceptions.');
    }
  },
);

export const hydrateReceptionById = createAsyncThunk<ReceptionV2, string, { rejectValue: string }>(
  'receptions/hydrateById',
  async (receptionId, { rejectWithValue }) => {
    try {
      const data = await receptionsApi.getById(receptionId);
      if (!data) {
        return rejectWithValue('Réception introuvable.');
      }

      return data;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Réception introuvable.');
    }
  },
);

const receptionsSlice = createSlice({
  name: 'receptions',
  initialState,
  reducers: {
    receptionUpserted(state, action: PayloadAction<ReceptionV2>) {
      state.items = upsertReceptionList(state.items, action.payload);
      state.initialized = true;
      state.lastSyncedAt = new Date().toISOString();
    },
    receptionRemoved(state, action: PayloadAction<string>) {
      state.items = state.items.filter((entry) => entry.id !== action.payload);
      state.lastSyncedAt = new Date().toISOString();
    },
    receptionPatched(
      state,
      action: PayloadAction<{ id: string; changes: Partial<ReceptionV2> }>,
    ) {
      const target = state.items.find((entry) => entry.id === action.payload.id);
      if (!target) return;

      Object.assign(target, action.payload.changes);
      state.items = sortReceptions(state.items);
      state.lastSyncedAt = new Date().toISOString();
    },
    receptionsCleared(state) {
      state.items = [];
      state.status = 'idle';
      state.error = null;
      state.initialized = false;
      state.lastSyncedAt = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchReceptions.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchReceptions.fulfilled, (state, action) => {
        state.items = sortReceptions(action.payload);
        state.status = 'succeeded';
        state.error = null;
        state.initialized = true;
        state.lastSyncedAt = new Date().toISOString();
      })
      .addCase(fetchReceptions.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload || action.error.message || 'Impossible de charger les réceptions.';
      })
      .addCase(hydrateReceptionById.fulfilled, (state, action) => {
        state.items = upsertReceptionList(state.items, action.payload);
        state.initialized = true;
        state.lastSyncedAt = new Date().toISOString();
      });
  },
});

export const {
  receptionPatched,
  receptionRemoved,
  receptionUpserted,
  receptionsCleared,
} = receptionsSlice.actions;

export const receptionsReducer = receptionsSlice.reducer;

const selectReceptionsState = (state: RootState) => state.receptions;

export const selectAllReceptions = createSelector(
  [selectReceptionsState],
  (state) => state.items,
);

export const selectReceptionsStatus = createSelector(
  [selectReceptionsState],
  (state) => state.status,
);

export const selectReceptionsError = createSelector(
  [selectReceptionsState],
  (state) => state.error,
);

export const selectReceptionsInitialized = createSelector(
  [selectReceptionsState],
  (state) => state.initialized,
);

export const selectReceptionById = (receptionId: string) =>
  createSelector([selectAllReceptions], (items) => items.find((entry) => entry.id === receptionId) || null);

export const selectReceptionStats = createSelector([selectAllReceptions], (receptions) => {
  const today = new Date().toISOString().split('T')[0];
  const todayReceptions = receptions.filter((reception) => reception.created_at.startsWith(today));

  return {
    total: receptions.length,
    today: todayReceptions.length,
    brouillon: receptions.filter((reception) => reception.status === 'BROUILLON').length,
    en_attente_qc: receptions.filter((reception) => reception.status === 'EN_ATTENTE_QC').length,
    en_qc: receptions.filter((reception) => reception.status === 'EN_QC').length,
    libere: receptions.filter((reception) => reception.status === 'LIBERE').length,
    bloque: receptions.filter((reception) => reception.status === 'BLOQUE').length,
    rejete: receptions.filter((reception) => reception.status === 'REJETE').length,
    annule: receptions.filter((reception) => reception.status === 'ANNULE').length,
  };
});

export const getReceptionStatusFromDecision = (decision: QCDecisionType): ReceptionHeaderStatus => {
  if (decision === 'ACCEPTE') return 'LIBERE';
  if (decision === 'REJETE') return 'REJETE';
  return 'BLOQUE';
};
