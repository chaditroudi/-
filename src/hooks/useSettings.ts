import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/integrations/mongodb/client';
import type { SiteSettings, ManagedUser } from '@/types/settings';
import { DEFAULT_SETTINGS, normalizeSiteSettings } from '@/types/settings';

const SETTINGS_KEY = ['site-settings'];
const USERS_KEY = ['managed-users'];

export const useSiteSettings = () =>
  useQuery({
    queryKey: SETTINGS_KEY,
    queryFn: async () => {
      const res = await apiRequest<{ data: SiteSettings }>('/settings');
      return normalizeSiteSettings(res.data ?? DEFAULT_SETTINGS);
    },
    staleTime: 5 * 60 * 1000,
  });

export const useUpdateSiteSettings = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<SiteSettings>) => {
      const res = await apiRequest<{ data: SiteSettings }>('/settings', {
        method: 'PUT',
        body: JSON.stringify(patch),
      });
      return normalizeSiteSettings(res.data);
    },
    onSuccess: (data) => {
      qc.setQueryData(SETTINGS_KEY, data);
    },
  });
};

export const useManagedUsers = () =>
  useQuery({
    queryKey: USERS_KEY,
    queryFn: async () => {
      const res = await apiRequest<{ data: ManagedUser[] }>('/settings/users');
      return res.data ?? [];
    },
  });

export const useUpdateManagedUser = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: {
      id: string;
      patch: {
        is_active?: boolean;
        roles?: string[];
        departments?: string[];
        primary_department?: string | null;
        org_roles?: string[];
        signature_pin?: string | null;
      };
    }) => {
      const res = await apiRequest<{ data: ManagedUser }>(`/settings/users/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: USERS_KEY }),
  });
};

export const useCreateManagedUser = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { email: string; password: string; full_name: string; role: string }) => {
      return apiRequest('/settings/users', { method: 'POST', body: JSON.stringify(payload) });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: USERS_KEY }),
  });
};
