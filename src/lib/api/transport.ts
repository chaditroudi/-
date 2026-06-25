import { apiRequest } from '@/integrations/mongodb/client';

type ApiEnvelope<T> = { data: T };

export const transportApi = {
  // ── Vehicles ──────────────────────────────────────────────────────────────

  listVehicles: async (params?: { status?: string }): Promise<unknown[]> => {
    const qs = params?.status ? `?status=${encodeURIComponent(params.status)}` : '';
    const r = await apiRequest<ApiEnvelope<unknown[]>>(`/transport/vehicles${qs}`);
    return r.data ?? [];
  },

  createVehicle: async (payload: Record<string, unknown>): Promise<unknown> => {
    const r = await apiRequest<ApiEnvelope<unknown>>('/transport/vehicles', { method: 'POST', body: JSON.stringify(payload) });
    return r.data;
  },

  updateVehicle: async (id: string, payload: Record<string, unknown>): Promise<unknown> => {
    const r = await apiRequest<ApiEnvelope<unknown>>(`/transport/vehicles/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(payload) });
    return r.data;
  },

  // ── Drivers ───────────────────────────────────────────────────────────────

  listDrivers: async (params?: { status?: string }): Promise<unknown[]> => {
    const qs = params?.status ? `?status=${encodeURIComponent(params.status)}` : '';
    const r = await apiRequest<ApiEnvelope<unknown[]>>(`/transport/drivers${qs}`);
    return r.data ?? [];
  },

  createDriver: async (payload: Record<string, unknown>): Promise<unknown> => {
    const r = await apiRequest<ApiEnvelope<unknown>>('/transport/drivers', { method: 'POST', body: JSON.stringify(payload) });
    return r.data;
  },

  updateDriver: async (id: string, payload: Record<string, unknown>): Promise<unknown> => {
    const r = await apiRequest<ApiEnvelope<unknown>>(`/transport/drivers/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(payload) });
    return r.data;
  },

  // ── Missions ──────────────────────────────────────────────────────────────

  listMissions: async (params?: { status?: string; vehicle_id?: string }): Promise<unknown[]> => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    if (params?.vehicle_id) qs.set('vehicle_id', params.vehicle_id);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    const r = await apiRequest<ApiEnvelope<unknown[]>>(`/transport/missions${suffix}`);
    return r.data ?? [];
  },

  createMission: async (payload: Record<string, unknown>): Promise<unknown> => {
    const r = await apiRequest<ApiEnvelope<unknown>>('/transport/missions', { method: 'POST', body: JSON.stringify(payload) });
    return r.data;
  },

  updateMission: async (id: string, payload: Record<string, unknown>): Promise<unknown> => {
    const r = await apiRequest<ApiEnvelope<unknown>>(`/transport/missions/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(payload) });
    return r.data;
  },

  // ── Position Logs ─────────────────────────────────────────────────────────

  listPositionLogs: async (params?: { mission_id?: string; vehicle_id?: string }): Promise<unknown[]> => {
    const qs = new URLSearchParams();
    if (params?.mission_id) qs.set('mission_id', params.mission_id);
    if (params?.vehicle_id) qs.set('vehicle_id', params.vehicle_id);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    const r = await apiRequest<ApiEnvelope<unknown[]>>(`/transport/position-logs${suffix}`);
    return r.data ?? [];
  },

  createPositionLog: async (payload: Record<string, unknown>): Promise<unknown> => {
    const r = await apiRequest<ApiEnvelope<unknown>>('/transport/position-logs', { method: 'POST', body: JSON.stringify(payload) });
    return r.data;
  },
};
