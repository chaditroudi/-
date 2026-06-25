import { createApi } from '@reduxjs/toolkit/query/react';
import { axiosBaseQuery } from '@/lib/axiosBaseQuery';
import type { Supplier } from '@/types/mes';

type Envelope<T> = { data: T };

export const suppliersApi = createApi({
  reducerPath: 'suppliersApi',
  baseQuery: axiosBaseQuery,
  tagTypes: ['Supplier', 'SupplierAudit'],
  endpoints: (b) => ({

    listSuppliers: b.query<Supplier[], void>({
      query: () => ({ url: '/suppliers' }),
      transformResponse: (r: Envelope<Supplier[]>) => r.data ?? [],
      providesTags: ['Supplier'],
    }),

    getSupplier: b.query<Supplier, string>({
      query: (id) => ({ url: `/suppliers/${id}` }),
      transformResponse: (r: Envelope<Supplier>) => r.data,
      providesTags: (_r, _e, id) => [{ type: 'Supplier', id }],
    }),

    createSupplier: b.mutation<Supplier, Omit<Supplier, 'id' | 'created_at' | 'updated_at'>>({
      query: (body) => ({ url: '/suppliers', method: 'POST', data: body }),
      transformResponse: (r: Envelope<Supplier>) => r.data,
      invalidatesTags: ['Supplier'],
    }),

    updateSupplier: b.mutation<Supplier, { id: string } & Partial<Supplier>>({
      query: ({ id, ...body }) => ({ url: `/suppliers/${id}`, method: 'PATCH', data: body }),
      transformResponse: (r: Envelope<Supplier>) => r.data,
      invalidatesTags: (_r, _e, arg) => ['Supplier', { type: 'Supplier', id: arg.id }],
    }),

    deleteSupplier: b.mutation<void, string>({
      query: (id) => ({ url: `/suppliers/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Supplier'],
    }),

    checkSupplierReceptions: b.query<{ hasReceptions: boolean }, string>({
      query: (id) => ({ url: `/suppliers/${id}/reception-check` }),
      transformResponse: (r: { data: unknown[]; hasReceptions: boolean }) => ({
        hasReceptions: r.hasReceptions,
      }),
    }),

    listSupplierLots: b.query<unknown[], string>({
      query: (id) => ({ url: `/suppliers/${id}/lots` }),
      transformResponse: (r: Envelope<unknown[]>) => r.data ?? [],
    }),

    listSupplierOrders: b.query<unknown[], string>({
      query: (id) => ({ url: `/suppliers/${id}/orders` }),
      transformResponse: (r: Envelope<unknown[]>) => r.data ?? [],
    }),

    listSupplierPayments: b.query<unknown[], string>({
      query: (id) => ({ url: `/suppliers/${id}/payments` }),
      transformResponse: (r: Envelope<unknown[]>) => r.data ?? [],
    }),

    listSupplierAuditLogs: b.query<unknown[], string>({
      query: (id) => ({ url: `/suppliers/${id}/audit-logs` }),
      transformResponse: (r: Envelope<unknown[]>) => r.data ?? [],
      providesTags: (_r, _e, id) => [{ type: 'SupplierAudit', id }],
    }),

    createSupplierAuditLog: b.mutation<unknown, { id: string } & Record<string, unknown>>({
      query: ({ id, ...body }) => ({
        url: `/suppliers/${id}/audit-logs`,
        method: 'POST',
        data: body,
      }),
      invalidatesTags: (_r, _e, arg) => [{ type: 'SupplierAudit', id: arg.id }],
    }),
  }),
});

export const {
  useListSuppliersQuery,
  useGetSupplierQuery,
  useCreateSupplierMutation,
  useUpdateSupplierMutation,
  useDeleteSupplierMutation,
  useCheckSupplierReceptionsQuery,
  useListSupplierLotsQuery,
  useListSupplierOrdersQuery,
  useListSupplierPaymentsQuery,
  useListSupplierAuditLogsQuery,
  useCreateSupplierAuditLogMutation,
} = suppliersApi;
