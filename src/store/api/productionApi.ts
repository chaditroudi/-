import { createApi } from '@reduxjs/toolkit/query/react';
import { axiosBaseQuery } from '@/lib/axiosBaseQuery';
import type {
  ProductionOrder,
  ProductionStep,
  QualityCheck,
  LotAllocation,
  LiberedLot,
  ProductionOutputLot,
  ProductionStepDefinition,
  ProductionConfig,
} from '@/types/production';

type Envelope<T> = { data: T };

export const productionApi = createApi({
  reducerPath: 'productionApi',
  baseQuery: axiosBaseQuery,
  tagTypes: [
    'ProductionOrder',
    'ProductionStep',
    'QualityCheck',
    'LotAllocation',
    'LiberedLot',
    'OutputLot',
    'StepDefinition',
    'ProductionAudit',
    'ProductionConfig',
  ],
  endpoints: (b) => ({

    // ── Configuration ──────────────────────────────────────────────────────────

    getProductionConfig: b.query<ProductionConfig, void>({
      query: () => ({ url: '/production/config' }),
      transformResponse: (r: Envelope<ProductionConfig>) => r.data,
      providesTags: ['ProductionConfig'],
    }),

    // ── Step Definitions ───────────────────────────────────────────────────────

    listStepDefinitions: b.query<ProductionStepDefinition[], void>({
      query: () => ({ url: '/production/step-definitions' }),
      transformResponse: (r: Envelope<ProductionStepDefinition[]>) => r.data ?? [],
      providesTags: ['StepDefinition'],
    }),

    // ── Production Orders ──────────────────────────────────────────────────────

    listProductionOrders: b.query<ProductionOrder[], void>({
      query: () => ({ url: '/production/orders' }),
      transformResponse: (r: Envelope<ProductionOrder[]>) => r.data ?? [],
      providesTags: ['ProductionOrder'],
    }),

    getProductionOrder: b.query<ProductionOrder, string>({
      query: (id) => ({ url: `/production/orders/${id}` }),
      transformResponse: (r: Envelope<ProductionOrder>) => r.data,
      providesTags: (_r, _e, id) => [{ type: 'ProductionOrder', id }],
    }),

    createProductionOrder: b.mutation<ProductionOrder, Record<string, unknown>>({
      query: (body) => ({ url: '/production/orders', method: 'POST', data: body }),
      transformResponse: (r: Envelope<ProductionOrder>) => r.data,
      invalidatesTags: ['ProductionOrder'],
    }),

    updateProductionOrder: b.mutation<ProductionOrder, { id: string } & Record<string, unknown>>({
      query: ({ id, ...body }) => ({ url: `/production/orders/${id}`, method: 'PATCH', data: body }),
      transformResponse: (r: Envelope<ProductionOrder>) => r.data,
      invalidatesTags: (_r, _e, arg) => ['ProductionOrder', { type: 'ProductionOrder', id: arg.id }],
    }),

    // ── Production Steps ───────────────────────────────────────────────────────

    listProductionSteps: b.query<ProductionStep[], string>({
      query: (orderId) => ({ url: '/production/steps', params: { order_id: orderId } }),
      transformResponse: (r: Envelope<ProductionStep[]>) => r.data ?? [],
      providesTags: (_r, _e, orderId) => [{ type: 'ProductionStep', id: orderId }],
    }),

    createProductionStep: b.mutation<ProductionStep, Record<string, unknown>>({
      query: (body) => ({ url: '/production/steps', method: 'POST', data: body }),
      transformResponse: (r: Envelope<ProductionStep>) => r.data,
      invalidatesTags: (result) => [{ type: 'ProductionStep', id: (result as any)?.production_order_id }],
    }),

    updateProductionStep: b.mutation<ProductionStep, { id: string } & Record<string, unknown>>({
      query: ({ id, ...body }) => ({ url: `/production/steps/${id}`, method: 'PATCH', data: body }),
      transformResponse: (r: Envelope<ProductionStep>) => r.data,
      invalidatesTags: (result) => [
        { type: 'ProductionStep', id: (result as any)?.production_order_id },
        { type: 'ProductionOrder', id: (result as any)?.production_order_id },
        'ProductionOrder',
      ],
    }),

    // ── Quality Checks ─────────────────────────────────────────────────────────

    listQualityChecks: b.query<QualityCheck[], string>({
      query: (stepId) => ({ url: '/production/quality-checks', params: { step_id: stepId } }),
      transformResponse: (r: Envelope<QualityCheck[]>) => r.data ?? [],
      providesTags: (_r, _e, id) => [{ type: 'QualityCheck', id }],
    }),

    createQualityCheck: b.mutation<QualityCheck, Record<string, unknown>>({
      query: (body) => ({ url: '/production/quality-checks', method: 'POST', data: body }),
      transformResponse: (r: Envelope<QualityCheck>) => r.data,
      invalidatesTags: (result) => [{ type: 'QualityCheck', id: (result as any)?.production_step_id }, 'ProductionOrder'],
    }),

    // ── Libered Lots ───────────────────────────────────────────────────────────

    listLiberedLots: b.query<LiberedLot[], void>({
      query: () => ({ url: '/production/libered-lots' }),
      transformResponse: (r: Envelope<LiberedLot[]>) => r.data ?? [],
      providesTags: ['LiberedLot'],
    }),

    // ── Lot Allocations ────────────────────────────────────────────────────────

    listLotAllocations: b.query<LotAllocation[], string>({
      query: (orderId) => ({ url: '/production/allocations', params: { order_id: orderId } }),
      transformResponse: (r: Envelope<LotAllocation[]>) => r.data ?? [],
      providesTags: (_r, _e, id) => [{ type: 'LotAllocation', id }],
    }),

    createLotAllocation: b.mutation<LotAllocation, Record<string, unknown>>({
      query: (body) => ({ url: '/production/allocations', method: 'POST', data: body }),
      transformResponse: (r: Envelope<LotAllocation>) => r.data,
      invalidatesTags: (result) => [
        { type: 'LotAllocation', id: (result as any)?.production_order_id },
        'LiberedLot',
      ],
    }),

    deleteLotAllocation: b.mutation<void, { allocationId: string; production_order_id: string }>({
      query: ({ allocationId }) => ({ url: `/production/allocations/${allocationId}`, method: 'DELETE' }),
      invalidatesTags: (_r, _e, arg) => [
        { type: 'LotAllocation', id: arg.production_order_id },
        'LiberedLot',
      ],
    }),

    // ── Output Lots ────────────────────────────────────────────────────────────

    listOutputLots: b.query<ProductionOutputLot[], string>({
      query: (orderId) => ({ url: '/production/output-lots', params: { order_id: orderId } }),
      transformResponse: (r: Envelope<ProductionOutputLot[]>) => r.data ?? [],
      providesTags: (_r, _e, id) => [{ type: 'OutputLot', id }],
    }),

    createOutputLot: b.mutation<ProductionOutputLot, Record<string, unknown>>({
      query: (body) => ({ url: '/production/output-lots', method: 'POST', data: body }),
      transformResponse: (r: Envelope<ProductionOutputLot>) => r.data,
      invalidatesTags: (result) => [
        { type: 'OutputLot', id: (result as any)?.production_order_id },
        'ProductionOrder',
      ],
    }),

    // ── Audit log ──────────────────────────────────────────────────────────────

    createProductionAuditLog: b.mutation<unknown, Record<string, unknown>>({
      query: (body) => ({ url: '/production/audit-logs', method: 'POST', data: body }),
    }),
  }),
});

export const {
  useGetProductionConfigQuery,
  useListStepDefinitionsQuery,
  useListProductionOrdersQuery,
  useGetProductionOrderQuery,
  useCreateProductionOrderMutation,
  useUpdateProductionOrderMutation,
  useListProductionStepsQuery,
  useCreateProductionStepMutation,
  useUpdateProductionStepMutation,
  useListQualityChecksQuery,
  useCreateQualityCheckMutation,
  useListLiberedLotsQuery,
  useListLotAllocationsQuery,
  useCreateLotAllocationMutation,
  useDeleteLotAllocationMutation,
  useListOutputLotsQuery,
  useCreateOutputLotMutation,
  useCreateProductionAuditLogMutation,
} = productionApi;
