import { apiRequest } from '@/integrations/mongodb/client';

type ApiEnvelope<T> = { data: T };

export const qualityExtApi = {
  // ── CAPA Tickets ──────────────────────────────────────────────────────────

  listCAPATickets: async (params?: { status?: string; supplier_id?: string }): Promise<unknown[]> => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    if (params?.supplier_id) qs.set('supplier_id', params.supplier_id);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    const r = await apiRequest<ApiEnvelope<unknown[]>>(`/capa-tickets${suffix}`);
    return r.data ?? [];
  },

  getCAPATicket: async (id: string): Promise<unknown> => {
    const r = await apiRequest<ApiEnvelope<unknown>>(`/capa-tickets/${encodeURIComponent(id)}`);
    return r.data;
  },

  createCAPATicket: async (payload: Record<string, unknown>): Promise<unknown> => {
    const r = await apiRequest<ApiEnvelope<unknown>>('/capa-tickets', { method: 'POST', body: JSON.stringify(payload) });
    return r.data;
  },

  updateCAPATicket: async (id: string, payload: Record<string, unknown>): Promise<unknown> => {
    const r = await apiRequest<ApiEnvelope<unknown>>(`/capa-tickets/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(payload) });
    return r.data;
  },

  // ── Inbound Notices ───────────────────────────────────────────────────────

  listInboundNotices: async (params?: { status?: string; date_from?: string; date_to?: string }): Promise<unknown[]> => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    if (params?.date_from) qs.set('date_from', params.date_from);
    if (params?.date_to) qs.set('date_to', params.date_to);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    const r = await apiRequest<ApiEnvelope<unknown[]>>(`/inbound-notices${suffix}`);
    return r.data ?? [];
  },

  createInboundNotice: async (payload: Record<string, unknown>): Promise<unknown> => {
    const r = await apiRequest<ApiEnvelope<unknown>>('/inbound-notices', { method: 'POST', body: JSON.stringify(payload) });
    return r.data;
  },

  updateInboundNotice: async (id: string, payload: Record<string, unknown>): Promise<unknown> => {
    const r = await apiRequest<ApiEnvelope<unknown>>(`/inbound-notices/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(payload) });
    return r.data;
  },

  // ── QC Lab Results ────────────────────────────────────────────────────────

  listQcLabResults: async (): Promise<unknown[]> => {
    const r = await apiRequest<ApiEnvelope<unknown[]>>('/qc-lab-results');
    return r.data ?? [];
  },
};
