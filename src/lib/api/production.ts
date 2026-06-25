import { apiRequest } from '@/integrations/mongodb/client';

type ApiEnvelope<T> = { data: T };

export const productionApi = {
  // ── Step Definitions ──────────────────────────────────────────────────────

  listStepDefinitions: async (): Promise<unknown[]> => {
    const r = await apiRequest<ApiEnvelope<unknown[]>>('/production/step-definitions');
    return r.data ?? [];
  },

  // ── Libered Lots ──────────────────────────────────────────────────────────

  listLiberedLots: async (): Promise<unknown[]> => {
    const r = await apiRequest<ApiEnvelope<unknown[]>>('/production/libered-lots');
    return r.data ?? [];
  },

  // ── Quality Checks ────────────────────────────────────────────────────────

  listQualityChecks: async (stepId: string): Promise<unknown[]> => {
    const r = await apiRequest<ApiEnvelope<unknown[]>>(`/production/quality-checks?step_id=${encodeURIComponent(stepId)}`);
    return r.data ?? [];
  },

  // ── Orders ────────────────────────────────────────────────────────────────

  getOrder: async (id: string): Promise<unknown> => {
    const r = await apiRequest<ApiEnvelope<unknown>>(`/production/orders/${encodeURIComponent(id)}`);
    return r.data;
  },

  listOrders: async (): Promise<unknown[]> => {
    const r = await apiRequest<ApiEnvelope<unknown[]>>('/production/orders');
    return r.data ?? [];
  },

  createOrder: async (payload: Record<string, unknown>): Promise<unknown> => {
    const r = await apiRequest<ApiEnvelope<unknown>>('/production/orders', { method: 'POST', body: JSON.stringify(payload) });
    return r.data;
  },

  updateOrder: async (id: string, payload: Record<string, unknown>): Promise<unknown> => {
    const r = await apiRequest<ApiEnvelope<unknown>>(`/production/orders/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(payload) });
    return r.data;
  },

  // ── Steps ─────────────────────────────────────────────────────────────────

  listSteps: async (orderId: string): Promise<unknown[]> => {
    const r = await apiRequest<ApiEnvelope<unknown[]>>(`/production/steps?order_id=${encodeURIComponent(orderId)}`);
    return r.data ?? [];
  },

  createStep: async (payload: Record<string, unknown>): Promise<unknown> => {
    const r = await apiRequest<ApiEnvelope<unknown>>('/production/steps', { method: 'POST', body: JSON.stringify(payload) });
    return r.data;
  },

  updateStep: async (id: string, payload: Record<string, unknown>): Promise<unknown> => {
    const r = await apiRequest<ApiEnvelope<unknown>>(`/production/steps/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(payload) });
    return r.data;
  },

  // ── Quality Checks ────────────────────────────────────────────────────────

  createQualityCheck: async (payload: Record<string, unknown>): Promise<unknown> => {
    const r = await apiRequest<ApiEnvelope<unknown>>('/production/quality-checks', { method: 'POST', body: JSON.stringify(payload) });
    return r.data;
  },

  // ── Audit Logs ────────────────────────────────────────────────────────────

  createAuditLog: async (payload: Record<string, unknown>): Promise<unknown> => {
    const r = await apiRequest<ApiEnvelope<unknown>>('/production/audit-logs', { method: 'POST', body: JSON.stringify(payload) });
    return r.data;
  },

  // ── Allocations ───────────────────────────────────────────────────────────

  listAllocations: async (orderId: string): Promise<unknown[]> => {
    const r = await apiRequest<ApiEnvelope<unknown[]>>(`/production/allocations?order_id=${encodeURIComponent(orderId)}`);
    return r.data ?? [];
  },

  createAllocation: async (payload: Record<string, unknown>): Promise<unknown> => {
    const r = await apiRequest<ApiEnvelope<unknown>>('/production/allocations', { method: 'POST', body: JSON.stringify(payload) });
    return r.data;
  },

  deleteAllocation: async (id: string): Promise<void> => {
    await apiRequest(`/production/allocations/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  // ── Output Lots ───────────────────────────────────────────────────────────

  listOutputLots: async (orderId: string): Promise<unknown[]> => {
    const r = await apiRequest<ApiEnvelope<unknown[]>>(`/production/output-lots?order_id=${encodeURIComponent(orderId)}`);
    return r.data ?? [];
  },

  createOutputLot: async (payload: Record<string, unknown>): Promise<unknown> => {
    const r = await apiRequest<ApiEnvelope<unknown>>('/production/output-lots', { method: 'POST', body: JSON.stringify(payload) });
    return r.data;
  },
};
