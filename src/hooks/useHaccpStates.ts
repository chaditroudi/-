import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fluxProductionApi } from '@/lib/api/fluxProduction';
import { toast } from 'sonner';

export type HaccpCcpStatus = 'compliant' | 'warning' | 'non_compliant' | 'not_monitored';

export interface HaccpState {
  id: string;
  ccp_code: 'CCP1' | 'CCP2';
  status: HaccpCcpStatus;
  measured_value: string | null;
  checked_by: string | null;
  note: string | null;
  last_checked_at: string | null;
  created_at: string;
  updated_at: string;
}

export function useHaccpStates() {
  return useQuery({
    queryKey: ['haccp-states'],
    queryFn: () => fluxProductionApi.listHaccpStates() as Promise<HaccpState[]>,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });
}

export function useUpdateHaccpState() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      ccp_code: 'CCP1' | 'CCP2';
      status: HaccpCcpStatus;
      measured_value?: string;
      checked_by?: string;
      note?: string;
    }) => {
      const now = new Date().toISOString();
      return fluxProductionApi.upsertHaccpState({
        ccp_code: input.ccp_code,
        status: input.status,
        measured_value: input.measured_value ?? null,
        checked_by: input.checked_by ?? null,
        note: input.note ?? null,
        last_checked_at: now,
        created_at: now,
        updated_at: now,
      }) as Promise<HaccpState>;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['haccp-states'] });
      toast.success('État CCP mis à jour');
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Erreur mise à jour CCP'),
  });
}
