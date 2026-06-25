import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { phase2Api, type LotTraceabilityData } from '@/lib/api/phase2';
import { diffLotTraceability, type TraceabilityRealtimeChange } from '@/lib/traceabilityRealtime';

export type { LotTraceabilityData } from '@/lib/api/phase2';
export type { TraceabilityRealtimeChange } from '@/lib/traceabilityRealtime';

export function useLotTraceability(lotNumber: string | null) {
  return useQuery({
    queryKey: ['lot-traceability', lotNumber],
    queryFn: () => {
      if (!lotNumber) throw new Error('No lot number');
      return phase2Api.getLotTraceability(lotNumber);
    },
    enabled: !!lotNumber,
    refetchInterval: 20_000,
    staleTime: 30_000,
  });
}

export function useLiveLotTraceability(lotNumber: string | null) {
  const query = useLotTraceability(lotNumber);
  const previousDataRef = useRef<LotTraceabilityData | null>(null);
  const [recentChanges, setRecentChanges] = useState<TraceabilityRealtimeChange[]>([]);
  const [lastLiveUpdateAt, setLastLiveUpdateAt] = useState<string | null>(null);

  useEffect(() => {
    if (!query.data) {
      previousDataRef.current = null;
      setRecentChanges([]);
      setLastLiveUpdateAt(null);
      return;
    }

    const diff = diffLotTraceability(previousDataRef.current, query.data);
    previousDataRef.current = query.data;

    if (diff.length === 0) {
      return;
    }

    const now = new Date().toISOString();
    setLastLiveUpdateAt(now);
    setRecentChanges((current) => [...diff, ...current].slice(0, 8));
  }, [query.data]);

  useEffect(() => {
    if (recentChanges.length === 0) return;

    const timeout = window.setTimeout(() => {
      setRecentChanges((current) => current.slice(0, 4));
    }, 20_000);

    return () => window.clearTimeout(timeout);
  }, [recentChanges]);

  return {
    ...query,
    recentChanges,
    lastLiveUpdateAt,
  };
}
