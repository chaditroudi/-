import { apiRequest } from '@/integrations/mongodb/client';
import type { Customer } from '@/types/customer';

type Envelope<T> = { data: T };

export const customersApi = {
  list: async (activeOnly = true): Promise<Customer[]> => {
    const qs = activeOnly ? '?is_active=true' : '';
    const r = await apiRequest<Envelope<Customer[]>>(`/customers${qs}`);
    return r.data ?? [];
  },

  get: async (id: string): Promise<Customer | null> => {
    const r = await apiRequest<Envelope<Customer>>(`/customers/${id}`);
    return r.data ?? null;
  },

  create: async (input: Partial<Customer>): Promise<Customer> => {
    const r = await apiRequest<Envelope<Customer>>('/customers', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return r.data;
  },

  update: async (id: string, patch: Partial<Customer>): Promise<Customer> => {
    const r = await apiRequest<Envelope<Customer>>(`/customers/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    return r.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiRequest<Envelope<Customer>>(`/customers/${id}`, { method: 'DELETE' });
  },
};
