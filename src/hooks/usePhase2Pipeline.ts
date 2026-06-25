import { useMemo } from 'react';
import { useAvailableLotsForPhase2, type AvailableLot } from './useAvailableLotsForPhase2';
import { useFumigationCycles } from './useFumigation';
import { useCleaningCycles } from './useNettoyage';
import { useHydrationCycles } from './useHydratation';
import { useTriageSessions } from './useTriage';

export type Phase2Stage =
  | 'waiting'
  | 'fumigation'
  | 'nettoyage'
  | 'hydratation'
  | 'triage'
  | 'completed';

export interface LotPipelineInfo {
  stage: Phase2Stage;
  status: string;
  label: string;
  cycleId?: string;
}

export interface Phase2PipelineSummary {
  waiting: AvailableLot[];
  inFumigation: number;
  inCleaning: number;
  inHydration: number;
  inTriage: number;
  completedToday: number;
  totalKgWaiting: number;
  /** reception_id → stage info */
  lotStages: Map<string, LotPipelineInfo>;
}

const ACTIVE_STATUSES = new Set([
  'PREPARATION', 'CHARGEMENT', 'EN_COURS', 'VENTILATION', 'VALIDATION',
]);

const FUM_LABEL: Record<string, string> = {
  PREPARATION: 'Préparation',
  CHARGEMENT: 'Chargement',
  EN_COURS: 'En fumigation',
  VENTILATION: 'Ventilation',
  VALIDATION: 'Validation',
  TERMINE: 'Fumigé',
  INTERROMPU: 'Interrompu',
  ECHEC: 'Échec',
};

export function usePhase2Pipeline(options?: { enabled?: boolean }): Phase2PipelineSummary {
  const enabled = options?.enabled ?? true;
  const { data: availableLots = [] } = useAvailableLotsForPhase2({ enabled });
  const { data: fumCycles = [] } = useFumigationCycles(undefined, { enabled });
  const { data: netCycles = [] } = useCleaningCycles(undefined, { enabled });
  const { data: hydCycles = [] } = useHydrationCycles(undefined, { enabled });
  const { data: triSessions = [] } = useTriageSessions(undefined, { enabled });

  return useMemo(() => {
    const lotStages = new Map<string, LotPipelineInfo>();
    const today = new Date().toISOString().slice(0, 10);

    // Fumigation — lot_refs[] array
    for (const c of fumCycles as any[]) {
      const refs: any[] = Array.isArray(c.lot_refs) ? c.lot_refs : [];
      for (const ref of refs) {
        if (!ref?.reception_id) continue;
        const existing = lotStages.get(ref.reception_id);
        const isActive = ACTIVE_STATUSES.has(c.status);
        const isTermine = c.status === 'TERMINE';
        if (!existing || isActive || (isTermine && existing.stage === 'waiting')) {
          lotStages.set(ref.reception_id, {
            stage: isTermine ? 'fumigation' : 'fumigation',
            status: c.status,
            label: FUM_LABEL[c.status] ?? c.status,
            cycleId: c.id,
          });
        }
      }
    }

    // Nettoyage — direct reception_id field
    for (const c of netCycles as any[]) {
      if (!c.reception_id) continue;
      const isActive = c.status === 'EN_COURS';
      const isTermine = c.status === 'TERMINE';
      const existing = lotStages.get(c.reception_id);
      if (!existing || isActive || isTermine) {
        lotStages.set(c.reception_id, {
          stage: 'nettoyage',
          status: c.status,
          label: isTermine ? 'Nettoyé' : isActive ? 'En nettoyage' : c.status,
          cycleId: c.id,
        });
      }
    }

    // Hydratation — lot_refs[] array
    for (const c of hydCycles as any[]) {
      const refs: any[] = Array.isArray(c.lot_refs) ? c.lot_refs : [];
      for (const ref of refs) {
        if (!ref?.reception_id) continue;
        const isActive = c.status === 'EN_COURS';
        const isTermine = c.status === 'TERMINE';
        const existing = lotStages.get(ref.reception_id);
        if (!existing || isActive || isTermine) {
          lotStages.set(ref.reception_id, {
            stage: 'hydratation',
            status: c.status,
            label: isTermine ? 'Hydraté' : isActive ? 'En hydratation' : c.status,
            cycleId: c.id,
          });
        }
      }
    }

    // Triage — parent_reception_id field
    for (const s of triSessions as any[]) {
      if (!s.parent_reception_id) continue;
      const isActive = s.status === 'EN_COURS' || s.status === 'PAUSE';
      const isTermine = s.status === 'TERMINE';
      const existing = lotStages.get(s.parent_reception_id);
      if (!existing || isActive || isTermine) {
        lotStages.set(s.parent_reception_id, {
          stage: isTermine ? 'completed' : 'triage',
          status: s.status,
          label: isTermine ? 'Trié ✓' : isActive ? 'En triage' : s.status,
          cycleId: s.id,
        });
      }
    }

    // Waiting = available lots NOT yet in any Phase 2 cycle with an active/complete record
    const processedIds = new Set(lotStages.keys());
    const waiting = availableLots.filter((l) => !processedIds.has(l.id));
    const totalKgWaiting = waiting.reduce((s, l) => s + (l.quantity_total ?? 0), 0);

    // Counts
    let inFumigation = 0, inCleaning = 0, inHydration = 0, inTriage = 0, completedToday = 0;
    for (const [, info] of lotStages) {
      if (info.stage === 'fumigation' && ACTIVE_STATUSES.has(info.status)) inFumigation++;
      else if (info.stage === 'nettoyage' && info.status === 'EN_COURS') inCleaning++;
      else if (info.stage === 'hydratation' && info.status === 'EN_COURS') inHydration++;
      else if (info.stage === 'triage' && (info.status === 'EN_COURS' || info.status === 'PAUSE')) inTriage++;
      else if (info.stage === 'completed') completedToday++;
    }

    return {
      waiting,
      inFumigation,
      inCleaning,
      inHydration,
      inTriage,
      completedToday,
      totalKgWaiting,
      lotStages,
    };
  }, [availableLots, fumCycles, netCycles, hydCycles, triSessions]);
}
