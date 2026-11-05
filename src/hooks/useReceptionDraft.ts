import { useCallback, useEffect, useRef, useState } from 'react';

import { useAuthContext } from '@/contexts/AuthContext';
import { apiRequest } from '@/integrations/mongodb/client';
import { ApiRequestError, axiosClient } from '@/lib/axiosClient';
import { deleteLocalDraft, getLocalDraft, saveLocalDraft } from '@/lib/offline/draftStore';
import { createIntakeDraft, getDraftWaitingFor, type IntakeDraft } from '@/lib/receptionIntake';
import { factoryOwnerKey, readFactorySession } from '@/lib/factorySession';

type ServerDraft = { id: string; version: number; status: string; reception_id?: string | null; payload?: IntakeDraft };

export type DraftSaveState = 'idle' | 'shared' | 'device' | 'saving';

const LOCAL_SAVE_DELAY_MS = 300;
/** Saves queue up, so one stuck on bad Wi-Fi must not hold back the ones behind it. */
const SHARE_TIMEOUT_MS = 8000;

const fromServer = (row: ServerDraft): IntakeDraft => ({ ...(row.payload as IntakeDraft), id: row.id, version: row.version });

/**
 * Every keystroke reaches this device first, so a reload or a dead battery loses
 * nothing. `share` publishes it to other devices; the server refuses a save from
 * an outdated screen and hands back the newer draft instead of overwriting it.
 */
export const useReceptionDraft = (draftId?: string | null) => {
  const { user } = useAuthContext();
  const userId = user?.id ?? null;
  const ownerScope = factoryOwnerKey(user);
  const [draft, setDraft] = useState<IntakeDraft | null>(draftId ? null : () => createIntakeDraft());
  const [saveState, setSaveState] = useState<DraftSaveState>('idle');
  const [conflict, setConflict] = useState<IntakeDraft | null>(null);
  const [closedReceptionId, setClosedReceptionId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const timer = useRef<number | null>(null);
  const latest = useRef(draft);
  latest.current = draft;
  // Saves run one at a time, each on the version the previous one returned: two
  // overlapping saves from this screen must never look like another device.
  const serverVersion = useRef<number | null>(draft?.version ?? null);
  const saveQueue = useRef<Promise<unknown>>(Promise.resolve());

  useEffect(() => {
    if (!draftId) return;
    let active = true;
    void (async () => {
      const local = await getLocalDraft(draftId).catch(() => undefined);
      const remote = await apiRequest<{ data: ServerDraft }>(`/reception-drafts/${draftId}`)
        .then((response) => response.data)
        .catch(() => null);
      if (!active) return;
      if (remote?.status === 'CONFIRMED') {
        await deleteLocalDraft(draftId).catch(() => undefined);
        setClosedReceptionId(remote.reception_id ?? null);
        return;
      }
      // Same version: the local copy holds everything typed since that save.
      const useRemote = remote?.status === 'OPEN' && remote.payload && (!local || remote.version > (local.draft.version ?? 0));
      const loaded = useRemote ? fromServer(remote) : local?.draft ?? null;
      if (loaded) {
        serverVersion.current = remote?.status === 'OPEN' ? remote.version : loaded.version;
        setDraft({ ...loaded, version: serverVersion.current });
      }
      else setLoadError("Ce brouillon n'est disponible ni sur cet appareil ni sur le serveur.");
    })();
    return () => { active = false; };
  }, [draftId]);

  const update = useCallback((patch: Partial<IntakeDraft>) => {
    setDraft((current) => (current ? { ...current, ...patch } : current));
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      if (!latest.current) return;
      void saveLocalDraft(latest.current, userId, ownerScope).then(() => setSaveState('device')).catch(() => undefined);
    }, LOCAL_SAVE_DELAY_MS);
  }, [userId, ownerScope]);

  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);

  /** Returns the version now on the server, or null when the draft stayed on this device. */
  const saveShared = useCallback(async (next?: IntakeDraft, rejectConflicts = false): Promise<number | null> => {
    const base = next ?? latest.current;
    if (!base?.supplier_id) return null;
    const session = readFactorySession();
    if (!session || session.ownerKey !== ownerScope) throw new ApiRequestError({ message: 'La session a changé.', status: 409, code: 'SESSION_CHANGED' });
    const current = { ...base, version: serverVersion.current };
    await saveLocalDraft(current, userId, ownerScope).catch(() => undefined);
    if (!navigator.onLine) {
      setSaveState('device');
      return null;
    }
    setSaveState('saving');
    try {
      const response = await axiosClient.put<{ data: ServerDraft }>(`/reception-drafts/${current.id}`, {
        version: current.version,
        stage: current.stage,
        summary: {
          supplier: current.supplier_label,
          deliveryNote: current.delivery_note_number,
          vehicle: current.vehicle_number,
          waitingFor: getDraftWaitingFor(current),
        },
        payload: current,
      }, { timeout: SHARE_TIMEOUT_MS, headers: { Authorization: `Bearer ${session.accessToken}` } });
      const version = response.data.data.version;
      serverVersion.current = version;
      setDraft((value) => (value ? { ...value, version } : value));
      await saveLocalDraft({ ...current, version }, userId, ownerScope).catch(() => undefined);
      setSaveState('shared');
      return version;
    } catch (error) {
      if (error instanceof ApiRequestError && error.code === 'DRAFT_STALE') {
        const newer = (error.details as { draft?: ServerDraft } | undefined)?.draft;
        if (newer?.payload) setConflict(fromServer(newer));
      } else if (error instanceof ApiRequestError && error.code === 'DRAFT_CLOSED') {
        setClosedReceptionId((error.details as { reception_id?: string | null } | undefined)?.reception_id ?? '');
      }
      setSaveState('device');
      // Confirmation must stop at a refused shared version. Background sharing
      // still handles conflicts without an unhandled rejection on stage changes.
      if (rejectConflicts && error instanceof ApiRequestError
        && (error.code === 'DRAFT_STALE' || error.code === 'DRAFT_CLOSED')) {
        throw error;
      }
      return null;
    }
  }, [userId, ownerScope]);

  const share = useCallback((next?: IntakeDraft, options?: { rejectConflicts?: boolean }) => {
    const run = saveQueue.current.then(() => saveShared(next, options?.rejectConflicts));
    saveQueue.current = run.catch(() => undefined);
    return run;
  }, [saveShared]);

  const acceptConflict = useCallback(() => {
    if (!conflict) return;
    serverVersion.current = conflict.version;
    setDraft(conflict);
    void saveLocalDraft(conflict, userId, ownerScope).catch(() => undefined);
    setConflict(null);
  }, [conflict, userId, ownerScope]);

  const reportConflict = useCallback((newer: IntakeDraft) => setConflict(newer), []);

  const discard = useCallback(async () => {
    const current = latest.current;
    if (!current) return;
    await deleteLocalDraft(current.id).catch(() => undefined);
    if (current.version !== null) {
      await apiRequest(`/reception-drafts/${current.id}`, { method: 'DELETE' }).catch(() => undefined);
    }
  }, []);

  /** The version on the server now, which a render may not have caught up with. */
  const getServerVersion = useCallback(() => serverVersion.current, []);

  return { draft, update, share, getServerVersion, saveState, conflict, acceptConflict, reportConflict, closedReceptionId, loadError, discard };
};
