import { apiRequest } from '@/integrations/mongodb/client';

type Env<T> = { data: T };

export const fluxProductionApi = {
  // ── Flux Production Runs ────────────────────────────────────────────────────
  listRuns: async (params?: {
    flux_code?: string;
    status?: string;
    since?: string;
    limit?: number;
    order_id?: string;
  }): Promise<unknown[]> => {
    const qs = new URLSearchParams();
    if (params?.flux_code) qs.set('flux_code', params.flux_code);
    if (params?.status)    qs.set('status',    params.status);
    if (params?.since)     qs.set('since',      params.since);
    if (params?.limit)     qs.set('limit',      String(params.limit));
    if (params?.order_id)  qs.set('order_id',   params.order_id);
    const q = qs.toString();
    const r = await apiRequest<Env<unknown[]>>(`/flux/runs${q ? '?' + q : ''}`);
    return r.data ?? [];
  },

  createRun: async (payload: Record<string, unknown>): Promise<unknown> => {
    const r = await apiRequest<Env<unknown>>('/flux/runs', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return r.data;
  },

  updateRun: async (id: string, payload: Record<string, unknown>): Promise<unknown> => {
    const r = await apiRequest<Env<unknown>>(`/flux/runs/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    return r.data;
  },

  deleteRun: async (id: string): Promise<void> => {
    await apiRequest(`/flux/runs/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  // ── HACCP States ────────────────────────────────────────────────────────────
  listHaccpStates: async (): Promise<unknown[]> => {
    const r = await apiRequest<Env<unknown[]>>('/flux/haccp-states');
    return r.data ?? [];
  },

  upsertHaccpState: async (payload: Record<string, unknown>): Promise<unknown> => {
    const r = await apiRequest<Env<unknown>>('/flux/haccp-states', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return r.data;
  },

  updateHaccpState: async (id: string, payload: Record<string, unknown>): Promise<unknown> => {
    const r = await apiRequest<Env<unknown>>(`/flux/haccp-states/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    return r.data;
  },
};
