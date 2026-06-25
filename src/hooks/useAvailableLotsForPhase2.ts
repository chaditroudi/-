import { useQuery } from '@tanstack/react-query';
import { phase2Api, type AvailableLot } from '@/lib/api/phase2';

export type { AvailableLot } from '@/lib/api/phase2';

export function useAvailableLotsForPhase2(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['available-lots-phase2'],
    queryFn: () => phase2Api.listAvailableLots(),
    refetchInterval: 2 * 60_000,
    staleTime: 60_000,
    enabled: options?.enabled ?? true,
  });
}
