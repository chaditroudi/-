import { apiRequest } from '@/integrations/mongodb/client';

type ApiEnvelope<T> = { data: T };

export const stockApi = {
  // ── Products ──────────────────────────────────────────────────────────────

  listProducts: async (): Promise<unknown[]> => {
    const r = await apiRequest<ApiEnvelope<unknown[]>>('/stock/products');
    return r.data ?? [];
  },

  createProduct: async (payload: Record<string, unknown>): Promise<unknown> => {
    const r = await apiRequest<ApiEnvelope<unknown>>('/stock/products', { method: 'POST', body: JSON.stringify(payload) });
    return r.data;
  },

  updateProduct: async (id: string, payload: Record<string, unknown>): Promise<unknown> => {
    const r = await apiRequest<ApiEnvelope<unknown>>(`/stock/products/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(payload) });
    return r.data;
  },

  // ── Stock Lots ────────────────────────────────────────────────────────────

  listLots: async (status?: string): Promise<unknown[]> => {
    const qs = status ? `?status=${encodeURIComponent(status)}` : '';
    const r = await apiRequest<ApiEnvelope<unknown[]>>(`/stock/lots${qs}`);
    return r.data ?? [];
  },

  createLot: async (payload: Record<string, unknown>): Promise<unknown> => {
    const r = await apiRequest<ApiEnvelope<unknown>>('/stock/lots', { method: 'POST', body: JSON.stringify(payload) });
    return r.data;
  },

  updateLot: async (id: string, payload: Record<string, unknown>): Promise<unknown> => {
    const r = await apiRequest<ApiEnvelope<unknown>>(`/stock/lots/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(payload) });
    return r.data;
  },

  // ── Locations ─────────────────────────────────────────────────────────────

  listLocations: async (): Promise<unknown[]> => {
    const r = await apiRequest<ApiEnvelope<unknown[]>>('/stock/locations');
    return r.data ?? [];
  },

  updateLocation: async (id: string, payload: Record<string, unknown>): Promise<unknown> => {
    const r = await apiRequest<ApiEnvelope<unknown>>(`/stock/locations/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(payload) });
    return r.data;
  },

  // ── Movements ─────────────────────────────────────────────────────────────

  listMovements: async (lotId?: string): Promise<unknown[]> => {
    const qs = lotId ? `?lot_id=${encodeURIComponent(lotId)}` : '';
    const r = await apiRequest<ApiEnvelope<unknown[]>>(`/stock/movements${qs}`);
    return r.data ?? [];
  },

  createMovement: async (payload: Record<string, unknown>): Promise<unknown> => {
    const r = await apiRequest<ApiEnvelope<unknown>>('/stock/movements', { method: 'POST', body: JSON.stringify(payload) });
    return r.data;
  },

  // ── Alerts ────────────────────────────────────────────────────────────────

  listAlerts: async (): Promise<unknown[]> => {
    const r = await apiRequest<ApiEnvelope<unknown[]>>('/stock/alerts');
    return r.data ?? [];
  },

  updateAlert: async (id: string, payload: Record<string, unknown>): Promise<unknown> => {
    const r = await apiRequest<ApiEnvelope<unknown>>(`/stock/alerts/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(payload) });
    return r.data;
  },

  // ── Inventory Counts ──────────────────────────────────────────────────────

  listInventoryCounts: async (): Promise<unknown[]> => {
    const r = await apiRequest<ApiEnvelope<unknown[]>>('/stock/inventory-counts');
    return r.data ?? [];
  },

  createInventoryCount: async (payload: Record<string, unknown>): Promise<unknown> => {
    const r = await apiRequest<ApiEnvelope<unknown>>('/stock/inventory-counts', { method: 'POST', body: JSON.stringify(payload) });
    return r.data;
  },

  // ── Shipments ─────────────────────────────────────────────────────────────

  listShipments: async (): Promise<unknown[]> => {
    const r = await apiRequest<ApiEnvelope<unknown[]>>('/stock/shipments');
    return r.data ?? [];
  },

  createShipment: async (payload: Record<string, unknown>): Promise<unknown> => {
    const r = await apiRequest<ApiEnvelope<unknown>>('/stock/shipments', { method: 'POST', body: JSON.stringify(payload) });
    return r.data;
  },

  updateShipment: async (id: string, payload: Record<string, unknown>): Promise<unknown> => {
    const r = await apiRequest<ApiEnvelope<unknown>>(`/stock/shipments/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(payload) });
    return r.data;
  },

  // ── Shipment Lines ────────────────────────────────────────────────────────

  listShipmentLines: async (shipmentId: string): Promise<unknown[]> => {
    const r = await apiRequest<ApiEnvelope<unknown[]>>(`/stock/shipment-lines?shipment_id=${encodeURIComponent(shipmentId)}`);
    return r.data ?? [];
  },

  createShipmentLine: async (payload: Record<string, unknown>): Promise<unknown> => {
    const r = await apiRequest<ApiEnvelope<unknown>>('/stock/shipment-lines', { method: 'POST', body: JSON.stringify(payload) });
    return r.data;
  },

  updateShipmentLine: async (id: string, payload: Record<string, unknown>): Promise<unknown> => {
    const r = await apiRequest<ApiEnvelope<unknown>>(`/stock/shipment-lines/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(payload) });
    return r.data;
  },

  deleteShipmentLine: async (id: string): Promise<void> => {
    await apiRequest(`/stock/shipment-lines/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  // ── Expedition (multi-table) ──────────────────────────────────────────────

  expedition: async (payload: {
    shipmentId: string;
    pickedLines: { lot_id: string; quantity: number; product_id?: string | null }[];
    status: string;
  }): Promise<unknown> => {
    const r = await apiRequest<ApiEnvelope<unknown>>('/stock/expedition', { method: 'POST', body: JSON.stringify(payload) });
    return r.data;
  },
};
