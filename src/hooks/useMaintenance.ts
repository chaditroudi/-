import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import {
  maintenanceApi,
  type MaintenanceRequestInsert,
  type MaintenanceStats,
} from '@/lib/api/maintenance';
import type { MaintenanceRequest, MaintenanceRequestStatus } from '@/types/maintenance';

type QueryOptions = { enabled?: boolean };

const invalidate = (queryClient: ReturnType<typeof useQueryClient>) => {
  queryClient.invalidateQueries({ queryKey: ['maintenance_requests'] });
  queryClient.invalidateQueries({ queryKey: ['maintenance_stats'] });
};

export const useMaintenanceRequests = (status?: MaintenanceRequestStatus, options?: QueryOptions) =>
  useQuery({
    queryKey: ['maintenance_requests', status],
    queryFn: async () => maintenanceApi.listRequests(status),
    enabled: options?.enabled ?? true,
  });

export const useMaintenanceStats = (options?: QueryOptions) =>
  useQuery<MaintenanceStats>({
    queryKey: ['maintenance_stats'],
    queryFn: async () => maintenanceApi.getStats(),
    enabled: options?.enabled ?? true,
  });

export const useCreateMaintenanceRequest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (request: MaintenanceRequestInsert) => maintenanceApi.createRequest(request),
    onSuccess: () => {
      invalidate(queryClient);
      toast.success('Demande de maintenance créée');
    },
    onError: (error: any) => {
      toast.error(error?.message || 'Erreur lors de la création de la demande');
      console.error(error);
    },
  });
};

export const useUpdateMaintenanceRequest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<MaintenanceRequest> & { id: string }) =>
      maintenanceApi.updateRequest(id, data),
    onSuccess: () => {
      invalidate(queryClient);
      toast.success('Demande mise à jour');
    },
    onError: (error: any) => {
      toast.error(error?.message || 'Erreur lors de la mise à jour');
      console.error(error);
    },
  });
};

export const useSubmitMaintenanceRequest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string | null }) =>
      maintenanceApi.submitRequest(id, reason),
    onSuccess: () => {
      invalidate(queryClient);
      toast.success('Demande soumise');
    },
    onError: (error: any) => {
      toast.error(error?.message || 'Erreur lors de la soumission');
      console.error(error);
    },
  });
};

export const useApproveMaintenanceRequest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string | null }) =>
      maintenanceApi.approveRequest(id, reason),
    onSuccess: () => {
      invalidate(queryClient);
      toast.success("Niveau d'approbation enregistré");
    },
    onError: (error: any) => {
      toast.error(error?.message || "Erreur lors de l'approbation");
      console.error(error);
    },
  });
};

export const useRejectMaintenanceRequest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) =>
      maintenanceApi.rejectRequest(id, reason),
    onSuccess: () => {
      invalidate(queryClient);
      toast.success('Demande rejetée');
    },
    onError: (error: any) => {
      toast.error(error?.message || 'Erreur lors du rejet');
      console.error(error);
    },
  });
};

export const useReturnMaintenanceRequest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) =>
      maintenanceApi.returnRequest(id, reason),
    onSuccess: () => {
      invalidate(queryClient);
      toast.success('Demande renvoyée pour correction');
    },
    onError: (error: any) => {
      toast.error(error?.message || 'Erreur lors du retour');
      console.error(error);
    },
  });
};

export const useCancelMaintenanceRequest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string | null }) =>
      maintenanceApi.cancelRequest(id, reason),
    onSuccess: () => {
      invalidate(queryClient);
      toast.success('Demande annulée');
    },
    onError: (error: any) => {
      toast.error(error?.message || "Erreur lors de l'annulation");
      console.error(error);
    },
  });
};

export const useCompleteMaintenanceRequest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string | null }) =>
      maintenanceApi.completeRequest(id, reason),
    onSuccess: () => {
      invalidate(queryClient);
      toast.success('Intervention clôturée');
    },
    onError: (error: any) => {
      toast.error(error?.message || 'Erreur lors de la clôture');
      console.error(error);
    },
  });
};

export const useDeleteMaintenanceRequest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => maintenanceApi.deleteRequest(id),
    onSuccess: () => {
      invalidate(queryClient);
      toast.success('Demande supprimée');
    },
    onError: (error: any) => {
      toast.error(error?.message || 'Erreur lors de la suppression');
      console.error(error);
    },
  });
};
