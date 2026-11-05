import { createApi } from '@reduxjs/toolkit/query/react';
import { axiosBaseQuery } from '@/lib/axiosBaseQuery';
import type {
  Product,
  ShipmentLine,
  ShipmentPreparation,
  StockAlert,
  StockLocation,
  StockLot,
  StockMovement,
} from '@/types/stock';

type Envelope<T> = { data: T };

export type StockCategorySummary = {
  total: number;
  inQuarantine: number;
  alertsMin: number;
  alertsSecurity: number;
};

export type StockSummaryByCategory = Partial<
  Record<'MP' | 'WIP' | 'PF' | 'EMB', StockCategorySummary>
>;

/** Lot suggestion returned by expedition FIFO/FEFO helper. */
export type ExpeditionLotSuggestion = {
  lot_id: string;
  lot_number?: string | null;
  available_qty?: number | null;
  rotation_rule?: string | null;
  sort_date?: string | null;
  product_id?: string | null;
  status?: string | null;
};

export type ExpeditionSuggestionsResponse =
  | ExpeditionLotSuggestion[]
  | { suggestions?: ExpeditionLotSuggestion[] };

export const stockApi = createApi({
  reducerPath: 'stockApi',
  baseQuery: axiosBaseQuery,
  tagTypes: ['StockLot', 'StockLocation', 'StockMovement', 'StockProduct', 'StockSummary'],
  endpoints: (b) => ({

    // ── Products ───────────────────────────────────────────────────────────────

    listProducts: b.query<Product[], void>({
      query: () => ({ url: '/stock/products' }),
      transformResponse: (r: Envelope<Product[]>) => r.data ?? [],
      providesTags: ['StockProduct'],
    }),

    createProduct: b.mutation<Product, Partial<Product>>({
      query: (body) => ({ url: '/stock/products', method: 'POST', data: body }),
      transformResponse: (r: Envelope<Product>) => r.data,
      invalidatesTags: ['StockProduct'],
    }),

    updateProduct: b.mutation<Product, { id: string } & Partial<Product>>({
      query: ({ id, ...body }) => ({ url: `/stock/products/${id}`, method: 'PATCH', data: body }),
      transformResponse: (r: Envelope<Product>) => r.data,
      invalidatesTags: ['StockProduct'],
    }),

    // ── Stock Lots ─────────────────────────────────────────────────────────────

    listStockLots: b.query<StockLot[], string | undefined>({
      query: (status) => ({
        url: '/stock/lots',
        params: status ? { status } : undefined,
      }),
      transformResponse: (r: Envelope<StockLot[]>) => r.data ?? [],
      providesTags: ['StockLot'],
    }),

    createStockLot: b.mutation<StockLot, Partial<StockLot>>({
      query: (body) => ({ url: '/stock/lots', method: 'POST', data: body }),
      transformResponse: (r: Envelope<StockLot>) => r.data,
      invalidatesTags: ['StockLot', 'StockSummary'],
    }),

    updateStockLot: b.mutation<StockLot, { id: string } & Partial<StockLot> & Record<string, unknown>>({
      query: ({ id, ...body }) => ({ url: `/stock/lots/${id}`, method: 'PATCH', data: body }),
      transformResponse: (r: Envelope<StockLot>) => r.data,
      invalidatesTags: ['StockLot', 'StockSummary'],
    }),

    // ── Locations ──────────────────────────────────────────────────────────────

    listStockLocations: b.query<StockLocation[], void>({
      query: () => ({ url: '/stock/locations' }),
      transformResponse: (r: Envelope<StockLocation[]>) => r.data ?? [],
      providesTags: ['StockLocation'],
    }),

    updateStockLocation: b.mutation<StockLocation, { id: string } & Partial<StockLocation>>({
      query: ({ id, ...body }) => ({ url: `/stock/locations/${id}`, method: 'PATCH', data: body }),
      transformResponse: (r: Envelope<StockLocation>) => r.data,
      invalidatesTags: ['StockLocation'],
    }),

    // ── Movements ──────────────────────────────────────────────────────────────

    listStockMovements: b.query<StockMovement[], string | undefined>({
      query: (lotId) => ({
        url: '/stock/movements',
        params: lotId ? { lot_id: lotId } : undefined,
      }),
      transformResponse: (r: Envelope<StockMovement[]>) => r.data ?? [],
      providesTags: ['StockMovement'],
    }),

    // ── Summary ────────────────────────────────────────────────────────────────

    getStockSummary: b.query<StockSummaryByCategory, void>({
      query: () => ({ url: '/stock/summary' }),
      transformResponse: (r: Envelope<StockSummaryByCategory>) => r.data ?? {},
      providesTags: ['StockSummary'],
    }),

    // ── Inventory counts ───────────────────────────────────────────────────────

    listInventoryCounts: b.query<Record<string, unknown>[], void>({
      query: () => ({ url: '/stock/inventory-counts' }),
      transformResponse: (r: Envelope<Record<string, unknown>[]>) => r.data ?? [],
      providesTags: ['StockLot'],
      keepUnusedDataFor: 60,
    }),

    // ── Stock alerts ───────────────────────────────────────────────────────────

    listStockAlerts: b.query<StockAlert[], void>({
      query: () => ({ url: '/stock/alerts' }),
      transformResponse: (r: Envelope<StockAlert[]>) => r.data ?? [],
      providesTags: ['StockSummary'],
      keepUnusedDataFor: 30,
    }),

    updateStockAlert: b.mutation<StockAlert, { id: string } & Partial<StockAlert>>({
      query: ({ id, ...body }) => ({ url: `/stock/alerts/${id}`, method: 'PATCH', data: body }),
      transformResponse: (r: Envelope<StockAlert>) => r.data,
      invalidatesTags: ['StockSummary'],
    }),

    // ── Shipments ──────────────────────────────────────────────────────────────

    listShipments: b.query<ShipmentPreparation[], void>({
      query: () => ({ url: '/stock/shipments' }),
      transformResponse: (r: Envelope<ShipmentPreparation[]>) => r.data ?? [],
      providesTags: ['StockMovement'],
    }),

    createShipment: b.mutation<ShipmentPreparation, Partial<ShipmentPreparation>>({
      query: (body) => ({ url: '/stock/shipments', method: 'POST', data: body }),
      transformResponse: (r: Envelope<ShipmentPreparation>) => r.data,
      invalidatesTags: ['StockMovement', 'StockLot'],
    }),

    updateShipment: b.mutation<ShipmentPreparation, { id: string } & Partial<ShipmentPreparation>>({
      query: ({ id, ...body }) => ({ url: `/stock/shipments/${id}`, method: 'PATCH', data: body }),
      transformResponse: (r: Envelope<ShipmentPreparation>) => r.data,
      invalidatesTags: ['StockMovement'],
    }),

    // ── Shipment lines ─────────────────────────────────────────────────────────

    createShipmentLine: b.mutation<ShipmentLine, Partial<ShipmentLine>>({
      query: (body) => ({ url: '/stock/shipment-lines', method: 'POST', data: body }),
      transformResponse: (r: Envelope<ShipmentLine>) => r.data,
      invalidatesTags: ['StockMovement', 'StockLot'],
    }),

    updateShipmentLine: b.mutation<ShipmentLine, { id: string } & Partial<ShipmentLine>>({
      query: ({ id, ...body }) => ({ url: `/stock/shipment-lines/${id}`, method: 'PATCH', data: body }),
      transformResponse: (r: Envelope<ShipmentLine>) => r.data,
      invalidatesTags: ['StockMovement'],
    }),

    deleteShipmentLine: b.mutation<void, string>({
      query: (id) => ({ url: `/stock/shipment-lines/${id}`, method: 'DELETE' }),
      invalidatesTags: ['StockMovement', 'StockLot'],
    }),

    // ── Lot suggestions for expedition ─────────────────────────────────────────

    getExpeditionLotSuggestions: b.mutation<ExpeditionSuggestionsResponse, Record<string, unknown>>({
      query: (body) => ({ url: '/stock/expedition', method: 'POST', data: body }),
      transformResponse: (r: Envelope<ExpeditionSuggestionsResponse> | ExpeditionSuggestionsResponse) =>
        (r && typeof r === 'object' && 'data' in r ? (r as Envelope<ExpeditionSuggestionsResponse>).data : r) as ExpeditionSuggestionsResponse,
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
