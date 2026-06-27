import { apiRequest } from '@/integrations/mongodb/client';
import type { ExportOrder, COADocument, ExportContract } from '@/types/exportOrders';

type Envelope<T> = { data: T };

// ── Export Orders ─────────────────────────────────────────────────────────────

export const exportOrdersApi = {
  list: async (): Promise<ExportOrder[]> => {
    const r = await apiRequest<Envelope<ExportOrder[]>>('/export-orders');
    return r.data ?? [];
  },

  get: async (id: string): Promise<ExportOrder | null> => {
    const r = await apiRequest<Envelope<ExportOrder>>(`/export-orders/${id}`);
    return r.data ?? null;
  },

  create: async (input: Partial<ExportOrder>): Promise<ExportOrder> => {
    const r = await apiRequest<Envelope<ExportOrder>>('/export-orders', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return r.data;
  },

  update: async (id: string, patch: Partial<ExportOrder>): Promise<ExportOrder> => {
    const r = await apiRequest<Envelope<ExportOrder>>(`/export-orders/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    return r.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiRequest<Envelope<ExportOrder>>(`/export-orders/${id}`, { method: 'DELETE' });
  },
};

// ── COA Documents ─────────────────────────────────────────────────────────────

export const coaApi = {
  list: async (): Promise<COADocument[]> => {
    const r = await apiRequest<Envelope<COADocument[]>>('/coa-documents');
    return r.data ?? [];
  },

  get: async (id: string): Promise<COADocument | null> => {
    const r = await apiRequest<Envelope<COADocument>>(`/coa-documents/${id}`);
    return r.data ?? null;
  },

  create: async (input: Partial<COADocument>): Promise<COADocument> => {
    const r = await apiRequest<Envelope<COADocument>>('/coa-documents', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return r.data;
  },

  update: async (id: string, patch: Partial<COADocument>): Promise<COADocument> => {
    const r = await apiRequest<Envelope<COADocument>>(`/coa-documents/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    return r.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiRequest<Envelope<COADocument>>(`/coa-documents/${id}`, { method: 'DELETE' });
  },
};

// ── Export Contracts ──────────────────────────────────────────────────────────

export const exportContractsApi = {
  list: async (): Promise<ExportContract[]> => {
    const r = await apiRequest<Envelope<ExportContract[]>>('/export-contracts');
    return r.data ?? [];
  },

  get: async (id: string): Promise<ExportContract | null> => {
    const r = await apiRequest<Envelope<ExportContract>>(`/export-contracts/${id}`);
    return r.data ?? null;
  },

  create: async (input: Partial<ExportContract>): Promise<ExportContract> => {
    const r = await apiRequest<Envelope<ExportContract>>('/export-contracts', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return r.data;
  },

  update: async (id: string, patch: Partial<ExportContract>): Promise<ExportContract> => {
    const r = await apiRequest<Envelope<ExportContract>>(`/export-contracts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    return r.data;
  },
};
