import { createApi } from '@reduxjs/toolkit/query/react';
import { axiosBaseQuery } from '@/lib/axiosBaseQuery';

type Envelope<T> = { data: T };

export const stockApi = createApi({
  reducerPath: 'stockApi',
  baseQuery: axiosBaseQuery,
  tagTypes: ['StockLot', 'StockLocation', 'StockMovement', 'StockProduct', 'StockSummary'],
  endpoints: (b) => ({

    // ── Products ───────────────────────────────────────────────────────────────

    listProducts: b.query<unknown[], void>({
      query: () => ({ url: '/stock/products' }),
      transformResponse: (r: Envelope<unknown[]>) => r.data ?? [],
      providesTags: ['StockProduct'],
    }),

    createProduct: b.mutation<unknown, Record<string, unknown>>({
      query: (body) => ({ url: '/stock/products', method: 'POST', data: body }),
      invalidatesTags: ['StockProduct'],
    }),

    updateProduct: b.mutation<unknown, { id: string } & Record<string, unknown>>({
      query: ({ id, ...body }) => ({ url: `/stock/products/${id}`, method: 'PATCH', data: body }),
      invalidatesTags: ['StockProduct'],
    }),

    // ── Stock Lots ─────────────────────────────────────────────────────────────

    listStockLots: b.query<unknown[], string | undefined>({
      query: (status) => ({
        url: '/stock/lots',
        params: status ? { status } : undefined,
      }),
      transformResponse: (r: Envelope<unknown[]>) => r.data ?? [],
      providesTags: ['StockLot'],
    }),

    createStockLot: b.mutation<unknown, Record<string, unknown>>({
      query: (body) => ({ url: '/stock/lots', method: 'POST', data: body }),
      invalidatesTags: ['StockLot', 'StockSummary'],
    }),

    updateStockLot: b.mutation<unknown, { id: string } & Record<string, unknown>>({
      query: ({ id, ...body }) => ({ url: `/stock/lots/${id}`, method: 'PATCH', data: body }),
      invalidatesTags: ['StockLot', 'StockSummary'],
    }),

    // ── Locations ──────────────────────────────────────────────────────────────

    listStockLocations: b.query<unknown[], void>({
      query: () => ({ url: '/stock/locations' }),
      transformResponse: (r: Envelope<unknown[]>) => r.data ?? [],
      providesTags: ['StockLocation'],
    }),

    updateStockLocation: b.mutation<unknown, { id: string } & Record<string, unknown>>({
      query: ({ id, ...body }) => ({ url: `/stock/locations/${id}`, method: 'PATCH', data: body }),
      invalidatesTags: ['StockLocation'],
    }),

    // ── Movements ──────────────────────────────────────────────────────────────

    listStockMovements: b.query<unknown[], string | undefined>({
      query: (lotId) => ({
        url: '/stock/movements',
        params: lotId ? { lot_id: lotId } : undefined,
      }),
      transformResponse: (r: Envelope<unknown[]>) => r.data ?? [],
      providesTags: ['StockMovement'],
    }),

    // ── Summary ────────────────────────────────────────────────────────────────

    getStockSummary: b.query<unknown, void>({
      query: () => ({ url: '/stock/summary' }),
      transformResponse: (r: Envelope<unknown>) => r.data,
      providesTags: ['StockSummary'],
    }),

    // ── Inventory counts ───────────────────────────────────────────────────────

    listInventoryCounts: b.query<unknown[], void>({
      query: () => ({ url: '/stock/inventory-counts' }),
      transformResponse: (r: Envelope<unknown[]>) => r.data ?? [],
      providesTags: ['StockLot'],
      keepUnusedDataFor: 60,
    }),

    // ── Stock alerts ───────────────────────────────────────────────────────────

    listStockAlerts: b.query<unknown[], void>({
      query: () => ({ url: '/stock/alerts' }),
      transformResponse: (r: Envelope<unknown[]>) => r.data ?? [],
      providesTags: ['StockSummary'],
      keepUnusedDataFor: 30,
    }),

    updateStockAlert: b.mutation<unknown, { id: string } & Record<string, unknown>>({
      query: ({ id, ...body }) => ({ url: `/stock/alerts/${id}`, method: 'PATCH', data: body }),
      invalidatesTags: ['StockSummary'],
    }),

    // ── Shipments ──────────────────────────────────────────────────────────────

    listShipments: b.query<unknown[], void>({
      query: () => ({ url: '/stock/shipments' }),
      transformResponse: (r: Envelope<unknown[]>) => r.data ?? [],
      providesTags: ['StockMovement'],
    }),

    createShipment: b.mutation<unknown, Record<string, unknown>>({
      query: (body) => ({ url: '/stock/shipments', method: 'POST', data: body }),
      invalidatesTags: ['StockMovement', 'StockLot'],
    }),

    updateShipment: b.mutation<unknown, { id: string } & Record<string, unknown>>({
      query: ({ id, ...body }) => ({ url: `/stock/shipments/${id}`, method: 'PATCH', data: body }),
      invalidatesTags: ['StockMovement'],
    }),

    // ── Shipment lines ─────────────────────────────────────────────────────────

    createShipmentLine: b.mutation<unknown, Record<string, unknown>>({
      query: (body) => ({ url: '/stock/shipment-lines', method: 'POST', data: body }),
      invalidatesTags: ['StockMovement', 'StockLot'],
    }),

    updateShipmentLine: b.mutation<unknown, { id: string } & Record<string, unknown>>({
      query: ({ id, ...body }) => ({ url: `/stock/shipment-lines/${id}`, method: 'PATCH', data: body }),
      invalidatesTags: ['StockMovement'],
    }),

    deleteShipmentLine: b.mutation<void, string>({
      query: (id) => ({ url: `/stock/shipment-lines/${id}`, method: 'DELETE' }),
      invalidatesTags: ['StockMovement', 'StockLot'],
    }),

    // ── Lot suggestions for expedition ─────────────────────────────────────────

    getExpeditionLotSuggestions: b.mutation<unknown, Record<string, unknown>>({
      query: (body) => ({ url: '/stock/expedition', method: 'POST', data: body }),
    }),

    // ── All reception lots (unified storage view) ──────────────────────────────

    listAllReceptionLots: b.query<Record<string, unknown>[], { stockStatus?: string; variety?: string } | void>({
      query: (args) => ({
        url: '/stock/reception-lots',
        params: args ? { stock_status: args.stockStatus, variety: args.variety } : undefined,
      }),
      transformResponse: (r: Envelope<Record<string, unknown>[]>) => r.data ?? [],
      providesTags: ['StockLot'],
      keepUnusedDataFor: 30,
    }),
  }),
});

export const {
  useListProductsQuery,
  useCreateProductMutation,
  useUpdateProductMutation,
  useListStockLotsQuery,
  useCreateStockLotMutation,
  useUpdateStockLotMutation,
  useListStockLocationsQuery,
  useUpdateStockLocationMutation,
  useListStockMovementsQuery,
  useGetStockSummaryQuery,
  useListInventoryCountsQuery,
  useListStockAlertsQuery,
  useUpdateStockAlertMutation,
  useListShipmentsQuery,
  useCreateShipmentMutation,
  useUpdateShipmentMutation,
  useCreateShipmentLineMutation,
  useUpdateShipmentLineMutation,
  useDeleteShipmentLineMutation,
  useGetExpeditionLotSuggestionsMutation,
  useListAllReceptionLotsQuery,
} = stockApi;
