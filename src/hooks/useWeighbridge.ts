import { useCallback, useEffect, useState } from 'react';

import { apiRequest } from '@/integrations/mongodb/client';

export type WeighbridgeReading = {
  id: string;
  reading_id: string;
  device_code: string;
  captured_at: string;
  weight_kg: number;
  stable: boolean;
  direction: string;
  signature_verified: boolean;
};

export const useLatestWeighbridgeReading = (enabled = true) => {
  const [reading, setReading] = useState<WeighbridgeReading | null>(null);
  const [connected, setConnected] = useState(false);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    try {
      const response = await apiRequest<{ data: WeighbridgeReading[] }>(
        '/weighbridge/readings?unconsumed=true',
      );
      setReading(response.data?.[0] ?? null);
      setConnected(true);
    } catch {
      setConnected(false);
    }
  }, [enabled]);

  useEffect(() => {
    void refresh();
    if (!enabled) return;
    const timer = window.setInterval(() => void refresh(), 1500);
    return () => window.clearInterval(timer);
  }, [enabled, refresh]);

  return { reading, connected, refresh };
};
