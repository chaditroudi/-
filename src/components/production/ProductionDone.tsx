import { useMemo } from 'react';
import { CheckCircle2, Droplets, Flame, Scissors, Wind } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/shared/EmptyState';
import { useFumigationCycles } from '@/hooks/useFumigation';
import { useCleaningCycles } from '@/hooks/useNettoyage';
import { useHydrationCycles } from '@/hooks/useHydratation';
import { useTriageSessions } from '@/hooks/useTriage';
import type { ProductionStageView } from '@/lib/productionNav';
import { ORDER_STATUS_BADGE } from './orderStatus';

const RECENT_MS = 7 * 24 * 60 * 60 * 1000;
const isRecent = (iso?: string | null) => Date.now() - new Date(iso ?? 0).getTime() < RECENT_MS;

interface ProductionDoneProps {
  stagesEnabled: boolean;
  /** When set, only that stage's completed work is listed. */
  stageFilter?: ProductionStageView | null;
}

/** Recently completed atelier operations — read-only for operators. */
export function ProductionDone({ stagesEnabled, stageFilter = null }: ProductionDoneProps) {
  const { data: fumigation = [] } = useFumigationCycles(undefined, { enabled: stagesEnabled });
  const { data: cleaning = [] } = useCleaningCycles(undefined, { enabled: stagesEnabled });
  const { data: hydration = [] } = useHydrationCycles(undefined, { enabled: stagesEnabled });
  const { data: triage = [] } = useTriageSessions(undefined, { enabled: stagesEnabled });

  const rows = useMemo(() => {
    const include = (stage: ProductionStageView) => !stageFilter || stageFilter === stage;
    return [
      ...(include('fumigation')
        ? fumigation
            .filter((cycle) => cycle.status === 'TERMINE' && isRecent(cycle.updated_at ?? cycle.created_at))
            .map((cycle) => ({
              id: cycle.id,
              icon: Flame,
              title: cycle.cycle_number,
              detail: `Chambre ${cycle.chamber}`,
              stage: 'Fumigation',
            }))
        : []),
      ...(include('nettoyage')
        ? cleaning
            .filter((cycle) => cycle.status === 'TERMINE' && isRecent(cycle.updated_at ?? cycle.created_at))
            .map((cycle) => ({
              id: cycle.id,
              icon: Droplets,
              title: cycle.cycle_number,
              detail: `Lot ${cycle.lot_number}`,
              stage: 'Nettoyage',
            }))
        : []),
      ...(include('hydratation')
        ? hydration
            .filter((cycle) => cycle.status === 'TERMINE' && isRecent(cycle.updated_at ?? cycle.created_at))
            .map((cycle) => ({
              id: cycle.id,
              icon: Wind,
              title: cycle.cycle_number,
              detail: 'Hydratation',
              stage: 'Hydratation',
            }))
        : []),
      ...(include('triage')
        ? triage
            .filter((session) => session.status === 'TERMINE' && isRecent(session.updated_at ?? session.created_at))
            .map((session) => ({
              id: session.id,
              icon: Scissors,
              title: session.session_number,
              detail: `Lot ${session.parent_lot_number}`,
              stage: 'Triage',
            }))
        : []),
    ];
  }, [cleaning, fumigation, hydration, stageFilter, triage]);

  if (!stagesEnabled) {
    return (
      <EmptyState
        title="Étapes atelier non activées"
        description="Les cycles de transformation ne sont pas disponibles sur ce site."
      />
    );
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<CheckCircle2 className="h-6 w-6" />}
        title="Rien de terminé récemment"
        description="Les opérations clôturées des 7 derniers jours apparaîtront ici."
      />
    );
  }

  return (
    <div className="divide-y rounded-lg border bg-card">
      {rows.map((row) => (
        <div key={row.id} className="flex min-h-12 items-center gap-3 px-3 py-2">
          <row.icon className="h-[18px] w-[18px] shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-mono text-sm">{row.title}</p>
            <p className="truncate text-xs text-muted-foreground">{row.detail}</p>
          </div>
          <Badge variant="outline" className={ORDER_STATUS_BADGE.completed}>{row.stage}</Badge>
        </div>
      ))}
    </div>
  );
}
