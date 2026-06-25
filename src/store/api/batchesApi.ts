import { createApi } from '@reduxjs/toolkit/query/react';
import { axiosBaseQuery } from '@/lib/axiosBaseQuery';
import type { Alert, AlertSeverity, Batch, StorageZone } from '@/types/batch';

type Envelope<T> = { data: T };

export const batchesApi = createApi({
  reducerPath: 'batchesApi',
  baseQuery: axiosBaseQuery,
  tagTypes: ['Batch', 'BatchAlert', 'StorageZone', 'QualityInspection', 'NonConformity', 'BatchMovement'],
  endpoints: (b) => ({

    // ── Storage Zones ──────────────────────────────────────────────────────────

    listStorageZones: b.query<StorageZone[], void>({
      query: () => ({ url: '/batches/storage-zones' }),
      transformResponse: (r: Envelope<StorageZone[]>) => r.data ?? [],
      providesTags: ['StorageZone'],
    }),

    createStorageZone: b.mutation<StorageZone, Record<string, unknown>>({
      query: (body) => ({ url: '/batches/storage-zones', method: 'POST', data: body }),
      transformResponse: (r: Envelope<StorageZone>) => r.data,
      invalidatesTags: ['StorageZone'],
    }),

    updateStorageZone: b.mutation<StorageZone, { id: string } & Record<string, unknown>>({
      query: ({ id, ...body }) => ({ url: `/batches/storage-zones/${id}`, method: 'PATCH', data: body }),
      transformResponse: (r: Envelope<StorageZone>) => r.data,
      invalidatesTags: ['StorageZone'],
    }),

    // ── Batches ────────────────────────────────────────────────────────────────

    listBatches: b.query<Batch[], void>({
      query: () => ({ url: '/batches' }),
      transformResponse: (r: Envelope<Batch[]>) => r.data ?? [],
      providesTags: ['Batch'],
    }),

    getBatch: b.query<Batch, string>({
      query: (id) => ({ url: `/batches/${id}` }),
      transformResponse: (r: Envelope<Batch>) => r.data,
      providesTags: (_r, _e, id) => [{ type: 'Batch', id }],
    }),

    createBatch: b.mutation<Batch, Record<string, unknown>>({
      query: (body) => ({ url: '/batches', method: 'POST', data: body }),
      transformResponse: (r: Envelope<Batch>) => r.data,
      invalidatesTags: ['Batch'],
    }),

    updateBatch: b.mutation<Batch, { id: string } & Record<string, unknown>>({
      query: ({ id, ...body }) => ({ url: `/batches/${id}`, method: 'PATCH', data: body }),
      transformResponse: (r: Envelope<Batch>) => r.data,
      invalidatesTags: (_r, _e, arg) => ['Batch', { type: 'Batch', id: arg.id }],
    }),

    // ── Quality Inspections ────────────────────────────────────────────────────

    listQualityInspections: b.query<unknown[], string | undefined>({
      query: (batchId) => ({
        url: '/batches/quality-inspections',
        params: batchId ? { batch_id: batchId } : undefined,
      }),
      transformResponse: (r: Envelope<unknown[]>) => r.data ?? [],
      providesTags: ['QualityInspection'],
    }),

    createQualityInspection: b.mutation<unknown, Record<string, unknown>>({
      query: (body) => ({ url: '/batches/quality-inspections', method: 'POST', data: body }),
      transformResponse: (r: Envelope<unknown>) => r.data,
      invalidatesTags: ['QualityInspection', 'Batch'],
    }),

    // ── Non Conformities ───────────────────────────────────────────────────────

    listNonConformities: b.query<unknown[], void>({
      query: () => ({ url: '/batches/non-conformities' }),
      transformResponse: (r: Envelope<unknown[]>) => r.data ?? [],
      providesTags: ['NonConformity'],
    }),

    createNonConformity: b.mutation<unknown, Record<string, unknown>>({
      query: (body) => ({ url: '/batches/non-conformities', method: 'POST', data: body }),
      transformResponse: (r: Envelope<unknown>) => r.data,
      invalidatesTags: ['NonConformity', 'Batch'],
    }),

    // ── Batch Movements ────────────────────────────────────────────────────────

    listMovements: b.query<unknown[], string | undefined>({
      query: (batchId) => ({
        url: '/batches/movements',
        params: batchId ? { batch_id: batchId } : undefined,
      }),
      transformResponse: (r: Envelope<unknown[]>) => r.data ?? [],
      providesTags: ['BatchMovement'],
    }),

    createMovement: b.mutation<unknown, Record<string, unknown>>({
      query: (body) => ({ url: '/batches/movements', method: 'POST', data: body }),
      transformResponse: (r: Envelope<unknown>) => r.data,
      invalidatesTags: ['BatchMovement', 'Batch'],
    }),

    // ── Alerts ─────────────────────────────────────────────────────────────────

    listAlerts: b.query<Alert[], void>({
      query: () => ({ url: '/batches/alerts' }),
      transformResponse: (r: Envelope<Alert[]>) => r.data ?? [],
      providesTags: ['BatchAlert'],
    }),

    acknowledgeAlert: b.mutation<Alert, { id: string; acknowledged_by?: string }>({
      query: ({ id, acknowledged_by }) => ({
        url: `/batches/alerts/${id}`,
        method: 'PATCH',
        data: {
          status: 'acknowledged',
          acknowledged_by: acknowledged_by ?? null,
          acknowledged_at: new Date().toISOString(),
        },
      }),
      transformResponse: (r: Envelope<Alert>) => r.data,
      invalidatesTags: ['BatchAlert'],
    }),

    resolveAlert: b.mutation<Alert, { id: string; resolved_by?: string }>({
      query: ({ id, resolved_by }) => ({
        url: `/batches/alerts/${id}`,
        method: 'PATCH',
        data: {
          status: 'resolved',
          resolved_by: resolved_by ?? null,
          resolved_at: new Date().toISOString(),
        },
      }),
      transformResponse: (r: Envelope<Alert>) => r.data,
      invalidatesTags: ['BatchAlert'],
    }),
  }),
});

export const {
  useListStorageZonesQuery,
  useCreateStorageZoneMutation,
  useUpdateStorageZoneMutation,
  useListBatchesQuery,
  useGetBatchQuery,
  useCreateBatchMutation,
  useUpdateBatchMutation,
  useListQualityInspectionsQuery,
  useCreateQualityInspectionMutation,
  useListNonConformitiesQuery,
  useCreateNonConformityMutation,
  useListMovementsQuery,
  useCreateMovementMutation,
  useListAlertsQuery,
  useAcknowledgeAlertMutation,
  useResolveAlertMutation,
} = batchesApi;
