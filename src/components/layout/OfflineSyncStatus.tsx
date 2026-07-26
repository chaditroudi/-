import { useCallback, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Cloud, CloudOff, RefreshCw, TriangleAlert } from 'lucide-react';

import {
  drainOutbox,
  listOutbox,
  retryOutboxItem,
  subscribeOutbox,
  type OutboxItem,
} from '@/lib/offline/outbox';
import { useAppDispatch } from '@/store/hooks';
import { fetchReceptions, receptionUpserted } from '@/store/slices/receptionsSlice';
import type { ReceptionIntakeResponse } from '@/hooks/useReceptionIntake';

export const OfflineSyncStatus = () => {
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const [online, setOnline] = useState(() => navigator.onLine);
  const [items, setItems] = useState<OutboxItem[]>([]);

  const refresh = useCallback(async () => setItems(await listOutbox()), []);
  const onSynced = useCallback(async (_item: OutboxItem, raw: unknown) => {
    const data = raw as ReceptionIntakeResponse;
    if (data?.reception) dispatch(receptionUpserted(data.reception));
    void dispatch(fetchReceptions());
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['receptions-v2'] }),
      queryClient.invalidateQueries({ queryKey: ['stock_lots'] }),
      queryClient.invalidateQueries({ queryKey: ['stock_summary'] }),
    ]);
  }, [dispatch, queryClient]);

  const drain = useCallback(async () => {
    await drainOutbox(onSynced);
    await refresh();
  }, [onSynced, refresh]);

  useEffect(() => {
    void refresh();
    const unsubscribe = subscribeOutbox(() => void refresh());
    const handleOnline = () => {
      setOnline(true);
      void drain();
    };
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('backend-sse-connected', handleOnline);
    const timer = window.setInterval(() => void drain(), 10_000);
    void drain();
    return () => {
      unsubscribe();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('backend-sse-connected', handleOnline);
      window.clearInterval(timer);
    };
  }, [drain, refresh]);

  const pending = items.filter((item) => item.status === 'pending' || item.status === 'syncing');
  const failed = items.filter((item) => item.status === 'failed');
  if (online && pending.length === 0 && failed.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex max-w-sm items-center gap-3 rounded-xl border bg-background/95 px-4 py-3 text-sm shadow-lg backdrop-blur">
      {!online ? <CloudOff className="h-5 w-5 text-amber-600" />
        : failed.length > 0 ? <TriangleAlert className="h-5 w-5 text-destructive" />
          : <Cloud className="h-5 w-5 text-primary" />}
      <div className="min-w-0">
        <p className="font-medium">
          {!online ? 'Mode hors ligne' : failed.length > 0 ? 'Synchronisation à corriger' : 'Synchronisation en cours'}
        </p>
        <p className="text-xs text-muted-foreground">
          {pending.length} en attente{failed.length > 0 ? ` · ${failed.length} en erreur` : ''}
        </p>
      </div>
      {online && (pending.length > 0 || failed.length > 0) && (
        <button
          type="button"
          className="rounded-md p-2 hover:bg-muted"
          title="Réessayer"
          onClick={async () => {
            await Promise.all(failed.map((item) => retryOutboxItem(item.id)));
            await drain();
          }}
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      )}
    </div>
  );
};
