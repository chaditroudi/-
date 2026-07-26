import { apiRequest } from '@/integrations/mongodb/client';
import type {
  MaintenancePriority,
  MaintenanceRequest,
  MaintenanceRequestStatus,
} from '@/types/maintenance';

type ApiEnvelope<T> = {
  data: T;
};

export type MaintenanceRequestInsert = {
  title: string;
  description?: string | null;
  equipment_name?: string | null;
  equipment_id?: string | null;
  department?: string | null;
  priority?: MaintenancePriority;
  estimated_cost?: number | null;
  requester_id?: string | null;
  requester_name?: string | null;
  status?: MaintenanceRequestStatus;
};

export type MaintenanceStats = {
  total: number;
  draft: number;
  pending: number;
  approved: number;
  completed: number;
  rejected: number;
};

const post = async <T>(path: string, body?: Record<string, unknown>) => {
  const response = await apiRequest<ApiEnvelope<T>>(path, {
    method: 'POST',
    body: JSON.stringify(body ?? {}),
  });
  return response.data;
};

export const maintenanceApi = {
  listRequests: async (status?: MaintenanceRequestStatus) => {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    const suffix = params.toString() ? `?${params.toString()}` : '';
    const response = await apiRequest<ApiEnvelope<MaintenanceRequest[]>>(
      `/maintenance/requests${suffix}`,
    );
    return response.data || [];
  },

  getRequest: async (id: string) => {
    const response = await apiRequest<ApiEnvelope<MaintenanceRequest | null>>(
      `/maintenance/requests/${encodeURIComponent(id)}`,
    );
    return response.data;
  },

  createRequest: async (payload: MaintenanceRequestInsert) =>
    post<MaintenanceRequest>('/maintenance/requests', payload),

  updateRequest: async (id: string, payload: Record<string, unknown>) => {
    const response = await apiRequest<ApiEnvelope<MaintenanceRequest>>(
      `/maintenance/requests/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(payload) },
    );
    return response.data;
  },

  submitRequest: async (id: string, reason?: string | null) =>
    post<MaintenanceRequest>(`/maintenance/requests/${encodeURIComponent(id)}/submit`, {
      reason: reason || null,
    }),

  approveRequest: async (id: string, reason?: string | null) =>
    post<MaintenanceRequest>(`/maintenance/requests/${encodeURIComponent(id)}/approve`, {
      reason: reason || null,
    }),

  rejectRequest: async (id: string, reason: string) =>
    post<MaintenanceRequest>(`/maintenance/requests/${encodeURIComponent(id)}/reject`, { reason }),

  returnRequest: async (id: string, reason: string) =>
    post<MaintenanceRequest>(`/maintenance/requests/${encodeURIComponent(id)}/return`, { reason }),

  cancelRequest: async (id: string, reason?: string | null) =>
    post<MaintenanceRequest>(`/maintenance/requests/${encodeURIComponent(id)}/cancel`, {
      reason: reason || null,
    }),

  completeRequest: async (id: string, reason?: string | null) =>
    post<MaintenanceRequest>(`/maintenance/requests/${encodeURIComponent(id)}/complete`, {
      reason: reason || null,
    }),

  deleteRequest: async (id: string) => {
    const response = await apiRequest<ApiEnvelope<{ id: string; deleted: boolean }>>(
      `/maintenance/requests/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    );
    return response.data;
  },

  getStats: async () => {
    const response = await apiRequest<ApiEnvelope<MaintenanceStats>>('/maintenance/stats');
    return response.data;
  },
};
