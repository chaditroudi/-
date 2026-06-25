import { apiRequest } from '@/integrations/mongodb/client';
import type { Material } from '@/types/mes';

type ApiEnvelope<T> = { data: T };

export const materialsApi = {
  list: async (): Promise<Material[]> => {
    const r = await apiRequest<ApiEnvelope<Material[]>>('/materials');
    return r.data ?? [];
  },

  create: async (payload: Omit<Material, 'id' | 'created_at' | 'updated_at'>): Promise<Material> => {
    const r = await apiRequest<ApiEnvelope<Material>>('/materials', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return r.data;
  },

  update: async (id: string, payload: Partial<Material>): Promise<Material> => {
    const r = await apiRequest<ApiEnvelope<Material>>(`/materials/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    return r.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiRequest(`/materials/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },
};
