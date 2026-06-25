import { createApi } from '@reduxjs/toolkit/query/react';
import { axiosBaseQuery } from '@/lib/axiosBaseQuery';
import type { Material } from '@/types/mes';

type Envelope<T> = { data: T };

export const materialsApi = createApi({
  reducerPath: 'materialsApi',
  baseQuery: axiosBaseQuery,
  tagTypes: ['Material'],
  endpoints: (b) => ({

    listMaterials: b.query<Material[], void>({
      query: () => ({ url: '/materials' }),
      transformResponse: (r: Envelope<Material[]>) => r.data ?? [],
      providesTags: ['Material'],
    }),

    createMaterial: b.mutation<Material, Omit<Material, 'id' | 'created_at' | 'updated_at'>>({
      query: (body) => ({ url: '/materials', method: 'POST', data: body }),
      transformResponse: (r: Envelope<Material>) => r.data,
      invalidatesTags: ['Material'],
    }),

    updateMaterial: b.mutation<Material, { id: string } & Partial<Material>>({
      query: ({ id, ...body }) => ({ url: `/materials/${id}`, method: 'PATCH', data: body }),
      transformResponse: (r: Envelope<Material>) => r.data,
      invalidatesTags: ['Material'],
    }),

    deleteMaterial: b.mutation<void, string>({
      query: (id) => ({ url: `/materials/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Material'],
    }),
  }),
});

export const {
  useListMaterialsQuery,
  useCreateMaterialMutation,
  useUpdateMaterialMutation,
  useDeleteMaterialMutation,
} = materialsApi;
