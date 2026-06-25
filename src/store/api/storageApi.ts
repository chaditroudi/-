import { createApi } from '@reduxjs/toolkit/query/react';
import { axiosBaseQuery } from '@/lib/axiosBaseQuery';
import type {
  Module3StorageZone,
  StorageConditionReading,
  StorageDoorEvent,
  StorageDlcAlert,
  StorageLocation,
  StorageLocationMovement,
  StorageLocationSuggestion,
} from '@/types/storage';
import type {
  CreateStorageReadingInput,
  CreateStorageReadingResult,
  CreateStorageDoorEventInput,
  CreateStorageDoorEventResult,
  SuggestStorageLocationInput,
  SuggestFefoLotsInput,
  MoveStorageStockInput,
  MoveStorageStockResult,
} from '@/lib/api/storage';

type Envelope<T> = { data: T };

export const storageApi = createApi({
  reducerPath: 'storageApi',
  baseQuery: axiosBaseQuery,
  tagTypes: [
    'StorageZone',
    'StorageLocation',
    'StorageReading',
    'StorageDoorEvent',
    'StorageDlcAlert',
    'StorageMovement',
  ],
  endpoints: (b) => ({

    listModule3Zones: b.query<Module3StorageZone[], void>({
      query: () => ({ url: '/storage/module3/zones' }),
      transformResponse: (r: Envelope<Module3StorageZone[]>) => r.data ?? [],
      providesTags: ['StorageZone'],
    }),

    listModule3Locations: b.query<StorageLocation[], string | undefined>({
      query: (storageZoneId) => ({
        url: '/storage/module3/locations',
        params: storageZoneId ? { storageZoneId } : undefined,
      }),
      transformResponse: (r: Envelope<StorageLocation[]>) => r.data ?? [],
      providesTags: ['StorageLocation'],
    }),

    listStorageConditionReadings: b.query<StorageConditionReading[], number | undefined>({
      query: (limit = 80) => ({ url: '/storage/module3/readings', params: { limit } }),
      transformResponse: (r: Envelope<StorageConditionReading[]>) => r.data ?? [],
      providesTags: ['StorageReading'],
    }),

    listStorageLocationMovements: b.query<StorageLocationMovement[], number | undefined>({
      query: (limit = 80) => ({ url: '/storage/module3/location-movements', params: { limit } }),
      transformResponse: (r: Envelope<StorageLocationMovement[]>) => r.data ?? [],
      providesTags: ['StorageMovement'],
    }),

    listStorageDoorEvents: b.query<StorageDoorEvent[], number | undefined>({
      query: (limit = 80) => ({ url: '/storage/module3/door-events', params: { limit } }),
      transformResponse: (r: Envelope<StorageDoorEvent[]>) => r.data ?? [],
      providesTags: ['StorageDoorEvent'],
    }),

    listStorageDlcAlerts: b.query<StorageDlcAlert[], number | undefined>({
      query: (limit = 15) => ({ url: '/storage/module3/dlc-alerts', params: { limit } }),
      transformResponse: (r: Envelope<StorageDlcAlert[]>) => r.data ?? [],
      providesTags: ['StorageDlcAlert'],
    }),

    createReading: b.mutation<CreateStorageReadingResult, CreateStorageReadingInput>({
      query: (body) => ({ url: '/storage/readings', method: 'POST', data: body }),
      transformResponse: (r: Envelope<CreateStorageReadingResult>) => r.data,
      invalidatesTags: ['StorageReading', 'StorageDlcAlert'],
    }),

    createDoorEvent: b.mutation<CreateStorageDoorEventResult, CreateStorageDoorEventInput>({
      query: (body) => ({ url: '/storage/door-events', method: 'POST', data: body }),
      transformResponse: (r: Envelope<CreateStorageDoorEventResult>) => r.data,
      invalidatesTags: ['StorageDoorEvent'],
    }),

    suggestLocation: b.mutation<StorageLocationSuggestion, SuggestStorageLocationInput>({
      query: (body) => ({ url: '/storage/suggest-location', method: 'POST', data: body }),
      transformResponse: (r: Envelope<StorageLocationSuggestion>) => r.data,
    }),

    suggestFefo: b.mutation<unknown[], SuggestFefoLotsInput>({
      query: (body) => ({ url: '/storage/suggest-fefo', method: 'POST', data: body }),
      transformResponse: (r: Envelope<unknown[]>) => r.data ?? [],
    }),

    moveStorageStock: b.mutation<MoveStorageStockResult, MoveStorageStockInput>({
      query: (body) => ({ url: '/storage/move', method: 'POST', data: body }),
      transformResponse: (r: Envelope<MoveStorageStockResult>) => r.data,
      invalidatesTags: ['StorageLocation', 'StorageMovement'],
    }),

    seedModule3: b.mutation<unknown, void>({
      query: () => ({ url: '/storage/module3/seed', method: 'POST', data: {} }),
      invalidatesTags: ['StorageZone', 'StorageLocation'],
    }),
  }),
});

export const {
  useListModule3ZonesQuery,
  useListModule3LocationsQuery,
  useListStorageConditionReadingsQuery,
  useListStorageLocationMovementsQuery,
  useListStorageDoorEventsQuery,
  useListStorageDlcAlertsQuery,
  useCreateReadingMutation,
  useCreateDoorEventMutation,
  useSuggestLocationMutation,
  useSuggestFefoMutation,
  useMoveStorageStockMutation,
  useSeedModule3Mutation,
} = storageApi;
