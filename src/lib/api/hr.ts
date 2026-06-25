import { apiRequest } from '@/integrations/mongodb/client';

type ApiEnvelope<T> = { data: T };

export const hrApi = {
  // ── Employees ─────────────────────────────────────────────────────────────

  listEmployees: async (params?: { status?: string }): Promise<unknown[]> => {
    const qs = params?.status ? `?status=${encodeURIComponent(params.status)}` : '';
    const r = await apiRequest<ApiEnvelope<unknown[]>>(`/employees${qs}`);
    return r.data ?? [];
  },

  getEmployee: async (id: string): Promise<unknown> => {
    const r = await apiRequest<ApiEnvelope<unknown>>(`/employees/${encodeURIComponent(id)}`);
    return r.data;
  },

  createEmployee: async (payload: Record<string, unknown>): Promise<unknown> => {
    const r = await apiRequest<ApiEnvelope<unknown>>('/employees', { method: 'POST', body: JSON.stringify(payload) });
    return r.data;
  },

  updateEmployee: async (id: string, payload: Record<string, unknown>): Promise<unknown> => {
    const r = await apiRequest<ApiEnvelope<unknown>>(`/employees/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(payload) });
    return r.data;
  },

  deleteEmployee: async (id: string): Promise<void> => {
    await apiRequest(`/employees/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  // ── Timesheets ────────────────────────────────────────────────────────────

  listTimesheets: async (params?: { employee_id?: string; start_date?: string; end_date?: string }): Promise<unknown[]> => {
    const qs = new URLSearchParams();
    if (params?.employee_id) qs.set('employee_id', params.employee_id);
    if (params?.start_date) qs.set('start_date', params.start_date);
    if (params?.end_date) qs.set('end_date', params.end_date);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    const r = await apiRequest<ApiEnvelope<unknown[]>>(`/timesheets${suffix}`);
    return r.data ?? [];
  },

  createTimesheet: async (payload: Record<string, unknown>): Promise<unknown> => {
    const r = await apiRequest<ApiEnvelope<unknown>>('/timesheets', { method: 'POST', body: JSON.stringify(payload) });
    return r.data;
  },

  updateTimesheet: async (id: string, payload: Record<string, unknown>): Promise<unknown> => {
    const r = await apiRequest<ApiEnvelope<unknown>>(`/timesheets/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(payload) });
    return r.data;
  },

  deleteTimesheet: async (id: string): Promise<void> => {
    await apiRequest(`/timesheets/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  // ── Employee Tasks ────────────────────────────────────────────────────────

  listTasks: async (params?: { assigned_to?: string; status?: string }): Promise<unknown[]> => {
    const qs = new URLSearchParams();
    if (params?.assigned_to) qs.set('assigned_to', params.assigned_to);
    if (params?.status) qs.set('status', params.status);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    const r = await apiRequest<ApiEnvelope<unknown[]>>(`/employee-tasks${suffix}`);
    return r.data ?? [];
  },

  createTask: async (payload: Record<string, unknown>): Promise<unknown> => {
    const r = await apiRequest<ApiEnvelope<unknown>>('/employee-tasks', { method: 'POST', body: JSON.stringify(payload) });
    return r.data;
  },

  updateTask: async (id: string, payload: Record<string, unknown>): Promise<unknown> => {
    const r = await apiRequest<ApiEnvelope<unknown>>(`/employee-tasks/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(payload) });
    return r.data;
  },

  deleteTask: async (id: string): Promise<void> => {
    await apiRequest(`/employee-tasks/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },
};
