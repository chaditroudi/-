import { apiRequest } from '@/integrations/mongodb/client';

type ApiEnvelope<T> = { data: T };

export const batchesApi = {
  // ── Storage Zones ─────────────────────────────────────────────────────────

  listStorageZones: async (): Promise<unknown[]> => {
    const r = await apiRequest<ApiEnvelope<unknown[]>>('/batches/storage-zones');
    return r.data ?? [];
  },

  createStorageZone: async (payload: Record<string, unknown>): Promise<unknown> => {
    const r = await apiRequest<ApiEnvelope<unknown>>('/batches/storage-zones', { method: 'POST', body: JSON.stringify(payload) });
    return r.data;
  },

  updateStorageZone: async (id: string, payload: Record<string, unknown>): Promise<unknown> => {
    const r = await apiRequest<ApiEnvelope<unknown>>(`/batches/storage-zones/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(payload) });
    return r.data;
  },

  // ── Non Conformities (list) ───────────────────────────────────────────────

  listNonConformities: async (): Promise<unknown[]> => {
    const r = await apiRequest<ApiEnvelope<unknown[]>>('/batches/non-conformities');
    return r.data ?? [];
  },

  // ── Batch Movements (list) ────────────────────────────────────────────────

  listMovements: async (batchId?: string): Promise<unknown[]> => {
    const qs = batchId ? `?batch_id=${encodeURIComponent(batchId)}` : '';
    const r = await apiRequest<ApiEnvelope<unknown[]>>(`/batches/movements${qs}`);
    return r.data ?? [];
  },

  // ── Batches ───────────────────────────────────────────────────────────────

  getById: async (id: string): Promise<unknown> => {
    const r = await apiRequest<ApiEnvelope<unknown>>(`/batches/${encodeURIComponent(id)}`);
    return r.data;
  },

  listBatches: async (): Promise<unknown[]> => {
    const r = await apiRequest<ApiEnvelope<unknown[]>>('/batches');
    return r.data ?? [];
  },

  getBatch: async (id: string): Promise<unknown> => {
    const r = await apiRequest<ApiEnvelope<unknown>>(`/batches/${encodeURIComponent(id)}`);
    return r.data;
  },

  createBatch: async (payload: Record<string, unknown>): Promise<unknown> => {
    const r = await apiRequest<ApiEnvelope<unknown>>('/batches', { method: 'POST', body: JSON.stringify(payload) });
    return r.data;
  },

  updateBatch: async (id: string, payload: Record<string, unknown>): Promise<unknown> => {
    const r = await apiRequest<ApiEnvelope<unknown>>(`/batches/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(payload) });
    return r.data;
  },

  // ── Quality Inspections ───────────────────────────────────────────────────

  listQualityInspections: async (batchId?: string): Promise<unknown[]> => {
    const qs = batchId ? `?batch_id=${encodeURIComponent(batchId)}` : '';
    const r = await apiRequest<ApiEnvelope<unknown[]>>(`/batches/quality-inspections${qs}`);
    return r.data ?? [];
  },

  createQualityInspection: async (payload: Record<string, unknown>): Promise<unknown> => {
    const r = await apiRequest<ApiEnvelope<unknown>>('/batches/quality-inspections', { method: 'POST', body: JSON.stringify(payload) });
    return r.data;
  },

  // ── Non Conformities ──────────────────────────────────────────────────────

  createNonConformity: async (payload: Record<string, unknown>): Promise<unknown> => {
    const r = await apiRequest<ApiEnvelope<unknown>>('/batches/non-conformities', { method: 'POST', body: JSON.stringify(payload) });
    return r.data;
  },

  // ── Alerts ────────────────────────────────────────────────────────────────

  listAlerts: async (): Promise<unknown[]> => {
    const r = await apiRequest<ApiEnvelope<unknown[]>>('/batches/alerts');
    return r.data ?? [];
  },

  createAlert: async (payload: Record<string, unknown>): Promise<unknown> => {
    const r = await apiRequest<ApiEnvelope<unknown>>('/batches/alerts', { method: 'POST', body: JSON.stringify(payload) });
    return r.data;
  },

  updateAlert: async (id: string, payload: Record<string, unknown>): Promise<unknown> => {
    const r = await apiRequest<ApiEnvelope<unknown>>(`/batches/alerts/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(payload) });
    return r.data;
  },

  // ── Movements ─────────────────────────────────────────────────────────────

  createMovement: async (payload: Record<string, unknown>): Promise<unknown> => {
    const r = await apiRequest<ApiEnvelope<unknown>>('/batches/movements', { method: 'POST', body: JSON.stringify(payload) });
    return r.data;
  },
};
