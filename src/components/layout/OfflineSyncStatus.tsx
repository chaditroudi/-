import { useCallback, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Cloud, CloudOff, LogIn, RefreshCw, TriangleAlert } from 'lucide-react';

import { useAuthContext } from '@/contexts/AuthContext';
import { deleteLocalDraft } from '@/lib/offline/draftStore';
import {
  drainOutbox,
  listOutbox,
  retryOutboxItem,
  subscribeOutbox,
  type OutboxItem,
} from '@/lib/offline/outbox';
import { receptionsApi } from '@/store/api/receptionsApi';
import { useAppDispatch } from '@/store/hooks';
import { fetchReceptions, receptionUpserted } from '@/store/slices/receptionsSlice';
import type { ReceptionIntakeResponse } from '@/hooks/useReceptionIntake';

/** Whether the deliveries held on this device can leave it, and what they wait for. */
export const OfflineSyncStatus = () => {
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const { user, signOut } = useAuthContext();
  const userId = user?.id ?? null;
  const [online, setOnline] = useState(() => navigator.onLine);
  const [items, setItems] = useState<OutboxItem[]>([]);

  const refresh = useCallback(async () => {
    setItems(await listOutbox().catch(() => []));
  }, []);
  const onSynced = useCallback(async (item: OutboxItem, raw: unknown) => {
    const data = raw as ReceptionIntakeResponse;
    await deleteLocalDraft(item.id).catch(() => undefined);
    if (data?.reception) dispatch(receptionUpserted(data.reception));
    void dispatch(fetchReceptions());
    dispatch(receptionsApi.util.invalidateTags(['Reception', 'ReceptionDraft']));
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['receptions-v2'] }),
      queryClient.invalidateQueries({ queryKey: ['stock_lots'] }),
      queryClient.invalidateQueries({ queryKey: ['stock_summary'] }),
      queryClient.invalidateQueries({ queryKey: ['purchase_orders'] }),
    ]);
  }, [dispatch, queryClient]);

  const drain = useCallback(async () => {
    await drainOutbox(userId, onSynced).catch(() => undefined);
    await refresh();
  }, [onSynced, refresh, userId]);

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

  const mine = items.filter((item) => item.ownerUserId === userId);
  const others = items.length - mine.length;
  const pending = mine.filter((item) => item.status === 'pending' || item.status === 'syncing');
  const failed = mine.filter((item) => item.status === 'failed');
  const needsLogin = !userId ? items.length > 0 : pending.some((item) => item.waitingForLogin);

  // Always show when offline; otherwise only when sync work remains.
  if (online && items.length === 0) return null;

  const title = !online
    ? 'Hors ligne'
    : needsLogin
      ? 'Session expirée'
      : failed.length > 0
        ? 'Réception refusée par le serveur'
        : pending.length > 0
          ? 'Synchronisation en cours'
          : 'Réceptions d\'un autre compte';
  const detail = !online
    ? mine.length > 0
      ? `${mine.length} réception(s) gardée(s) sur cet appareil. Envoi automatique au retour de la connexion.`
      : 'Vos saisies restent sur cet appareil.'
    : needsLogin
      ? `${items.length} réception(s) gardée(s) sur cet appareil. Reconnectez-vous avec le même compte pour les envoyer.`
      : failed.length > 0
        ? `${failed[0].lastError ?? 'Refus du serveur.'} Corrigez dans Réception › En attente.`
        : pending.length > 0
          ? `${pending.length} réception(s) en attente d'envoi. Aucun numéro n'existe avant la confirmation du serveur.`
          : `${others} réception(s) attendent la connexion de leur auteur sur cet appareil.`;

  return (
    <div
      className={`fixed inset-x-4 top-14 z-[100] flex md:inset-x-auto md:bottom-4 md:left-[248px] md:top-auto md:max-w-sm items-center gap-3 rounded-xl border px-4 py-3 text-sm backdrop-blur ${
        !online || needsLogin
          ? 'border-amber-300 bg-amber-50/95 text-amber-950'
          : 'bg-background/95 shadow-lg'
      }`}
      role="status"
    >
      {!online ? <CloudOff className="h-5 w-5 shrink-0 text-amber-700" />
        : failed.length > 0 || needsLogin ? <TriangleAlert className="h-5 w-5 shrink-0 text-destructive" />
          : <Cloud className="h-5 w-5 shrink-0 text-primary" />}
      <div className="min-w-0">
        <p className="font-medium">{title}</p>
        <p className="text-xs opacity-80">{detail}</p>
      </div>
      {online && needsLogin && userId && (
        <button
          type="button"
          className="flex min-h-11 items-center gap-1 rounded-md px-2 text-sm font-medium hover:bg-amber-100"
          onClick={() => void signOut()}
        >
          <LogIn className="h-4 w-4" />
          Se reconnecter
        </button>
      )}
      {online && !needsLogin && (pending.length > 0 || failed.length > 0) && (
        <button
          type="button"
          className="flex h-11 w-11 items-center justify-center rounded-md hover:bg-muted"
          aria-label="Réessayer l'envoi"
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
