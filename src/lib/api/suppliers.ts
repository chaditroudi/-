import { apiRequest } from '@/integrations/mongodb/client';
import type { Supplier } from '@/types/mes';

type ApiEnvelope<T> = { data: T };

export const suppliersApi = {
  list: async (): Promise<Supplier[]> => {
    const r = await apiRequest<ApiEnvelope<Supplier[]>>('/suppliers');
    return r.data ?? [];
  },

  create: async (payload: Omit<Supplier, 'id' | 'created_at' | 'updated_at'>): Promise<Supplier> => {
    const r = await apiRequest<ApiEnvelope<Supplier>>('/suppliers', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return r.data;
  },

  update: async (id: string, payload: Partial<Supplier>): Promise<Supplier> => {
    const r = await apiRequest<ApiEnvelope<Supplier>>(`/suppliers/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    return r.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiRequest(`/suppliers/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  receptionCheck: async (id: string): Promise<{ hasReceptions: boolean }> => {
    const r = await apiRequest<{ data: unknown[]; hasReceptions: boolean }>(
      `/suppliers/${encodeURIComponent(id)}/reception-check`,
    );
    return { hasReceptions: r.hasReceptions };
  },

  getLots: async (id: string): Promise<unknown[]> => {
    const r = await apiRequest<ApiEnvelope<unknown[]>>(`/suppliers/${encodeURIComponent(id)}/lots`);
    return r.data ?? [];
  },

  getOrders: async (id: string): Promise<unknown[]> => {
    const r = await apiRequest<ApiEnvelope<unknown[]>>(`/suppliers/${encodeURIComponent(id)}/orders`);
    return r.data ?? [];
  },

  getPayments: async (id: string): Promise<unknown[]> => {
    const r = await apiRequest<ApiEnvelope<unknown[]>>(`/suppliers/${encodeURIComponent(id)}/payments`);
    return r.data ?? [];
  },

  getAuditLogs: async (id: string): Promise<unknown[]> => {
    const r = await apiRequest<ApiEnvelope<unknown[]>>(`/suppliers/${encodeURIComponent(id)}/audit-logs`);
    return r.data ?? [];
  },

  createAuditLog: async (id: string, payload: Record<string, unknown>): Promise<unknown> => {
    const r = await apiRequest<ApiEnvelope<unknown>>(`/suppliers/${encodeURIComponent(id)}/audit-logs`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return r.data;
  },
};
