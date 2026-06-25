import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { qualityExtApi } from '@/lib/api/quality-ext';
import { toast } from 'sonner';

// ─── Type ─────────────────────────────────────────────────────────────────────

export interface InboundNotice {
  id: string;
  supplier_id: string;
  supplier_name?: string | null;
  supplier_code?: string | null;
  vehicle_number: string;
  driver_name?: string | null;
  variety: string;
  declared_weight_kg?: number | null;
  estimated_arrival_at: string;
  delivery_note_number?: string | null;
  notes?: string | null;
  reception_id?: string | null;
  status: 'PENDING' | 'RECEIVED' | 'CANCELLED';
  created_at: string;
  updated_at: string;
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export const useInboundNotices = () =>
  useQuery({
    queryKey: ['inbound_notices'],
    queryFn: async () => {
      const data = await qualityExtApi.listInboundNotices();
      return (data ?? []) as InboundNotice[];
    },
  });

export const useTodayPendingNotices = () =>
  useQuery({
    queryKey: ['inbound_notices', 'today_pending'],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const data = await qualityExtApi.listInboundNotices({
        status: 'PENDING',
        date_from: `${today}T00:00:00`,
        date_to: `${today}T23:59:59`,
      });
      return (data ?? []) as InboundNotice[];
    },
    refetchInterval: 60_000,
  });

export const useCreateInboundNotice = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (notice: Omit<InboundNotice, 'id' | 'created_at' | 'updated_at' | 'status'>) => {
      return await qualityExtApi.createInboundNotice({ ...notice, status: 'PENDING' }) as InboundNotice;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inbound_notices'] });
      toast.success('Pré-annonce enregistrée');
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Erreur pré-annonce');
    },
  });
};

export const useCancelInboundNotice = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await qualityExtApi.updateInboundNotice(id, { status: 'CANCELLED' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inbound_notices'] });
      toast.success('Pré-annonce annulée');
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Erreur annulation');
    },
  });
};

export const useMarkNoticeReceived = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, receptionId }: { id: string; receptionId: string }) => {
      await qualityExtApi.updateInboundNotice(id, { status: 'RECEIVED', reception_id: receptionId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inbound_notices'] });
    },
  });
};
