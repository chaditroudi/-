import { useMemo, type ReactNode } from 'react';
import { AlertTriangle, ChevronRight, Droplets, Factory, Flame, Scissors, Wind, type LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataState, type DataSource } from '@/components/shared/DataState';
import { useFumigationCycles } from '@/hooks/useFumigation';
import { useCleaningCycles } from '@/hooks/useNettoyage';
import { useHydrationCycles } from '@/hooks/useHydratation';
import { useTriageSessions } from '@/hooks/useTriage';
import { usePhase2Pipeline } from '@/hooks/usePhase2Pipeline';
import { usePhase2AlertKpis } from '@/hooks/usePhase2Alerts';
import { useOrderLotAllocations, useProductionConfig } from '@/hooks/useProduction';
import type { ProductionStageView } from '@/lib/productionNav';
import type { ProductionOrder } from '@/types/production';
import { byUrgency, ORDER_STATUS_BADGE } from './orderStatus';
import type { ProductionView } from './views';

interface ProductionTodayProps {
  orders: ProductionOrder[];
  ordersSource: DataSource;
  ordersData: unknown;
  stagesEnabled: boolean;
  /** Restrict stage rows to one operator post. */
  stageFilter?: ProductionStageView | null;
  /** Hide OF rows for pure stage operators. */
  hideOrders?: boolean;
  onOpenView: (view: ProductionView) => void;
  onOpenOrder: (orderId: string) => void;
}

interface WorkRowProps {
  icon: LucideIcon;
  title: string;
  detail: string;
  status?: ReactNode;
  action: string;
  onAction: () => void;
}

const quantityOf = (order: ProductionOrder) =>
  order.target_quantity == null ? 'quantité à définir' : `${order.target_quantity} ${order.unit ?? ''}`.trim();

const WorkRow = ({ icon: Icon, title, detail, status, action, onAction }: WorkRowProps) => (
  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
    <Icon className="h-[18px] w-[18px] shrink-0 text-muted-foreground" />
    <div className="min-w-0 flex-1">
      <p className="truncate font-mono text-sm">{title}</p>
      <p className="truncate text-xs text-muted-foreground">{detail}</p>
    </div>
    {status}
    <Button type="button" size="sm" variant="outline" className="gap-1" onClick={onAction}>
      {action}
      <ChevronRight className="h-4 w-4" />
    </Button>
  </div>
);

const Section = ({ title, hint, unknown, children }: { title: string; hint: string; unknown?: boolean; children: ReactNode }) => {
  const rows = (Array.isArray(children) ? children.flat() : [children]).filter(Boolean);
  return (
    <section>
      <div className="flex items-baseline gap-2 pb-1">
        <h2 className="text-base">{title}</h2>
        <span className="text-xs text-muted-foreground">{hint}</span>
      </div>
      {rows.length > 0
        ? <div className="divide-y rounded-lg border bg-card">{children}</div>
        : <p className="rounded-lg border border-dashed px-3 py-3 text-sm text-muted-foreground">{unknown ? 'Non vérifié : les cycles de l\'atelier n\'ont pas pu être chargés.' : 'Rien pour le moment.'}</p>}
    </section>
  );
};

const PlannedOrderRow = ({ order, onOpenOrder, label }: { order: ProductionOrder; onOpenOrder: (id: string) => void; label: string }) => {
  const { data: allocations, isLoading } = useOrderLotAllocations(order.id);
  const hasLots = (allocations?.length ?? 0) > 0;
  return (
    <WorkRow
      icon={Factory}
      title={order.order_number}
      detail={`${order.product_name} : ${quantityOf(order)}`}
      status={!isLoading && !hasLots
        ? <Badge variant="outline" className={ORDER_STATUS_BADGE.cancelled}>Aucun lot alloué</Badge>
        : <Badge variant="outline" className={ORDER_STATUS_BADGE.planned}>{label}</Badge>}
      action={!isLoading && !hasLots ? 'Allouer un lot' : 'Démarrer'}
      onAction={() => onOpenOrder(order.id)}
    />
  );
};

const FUMIGATION_LABEL: Record<string, string> = {
  PREPARATION: 'Préparation', CHARGEMENT: 'Chargement', EN_COURS: 'En fumigation', VENTILATION: 'Ventilation', VALIDATION: 'À valider',
};
const FUMIGATION_ACTIVE = new Set(Object.keys(FUMIGATION_LABEL));
const RECENT_MS = 7 * 24 * 60 * 60 * 1000;
const isRecent = (row: { created_at?: string | null }) => Date.now() - new Date(row.created_at ?? 0).getTime() < RECENT_MS;

/** The first screen of Production: what is running, what comes next, what is stuck and why. */
export const ProductionToday = ({
  orders,
  ordersSource,
  ordersData,
  stagesEnabled,
  stageFilter = null,
  hideOrders = false,
  onOpenView,
  onOpenOrder,
}: ProductionTodayProps) => {
  const { orderStatusLabels } = useProductionConfig();
  const pipeline = usePhase2Pipeline({ enabled: stagesEnabled });
  const alerts = usePhase2AlertKpis();
  const { data: fumigation = [] } = useFumigationCycles(undefined, { enabled: stagesEnabled });
  const { data: cleaning = [] } = useCleaningCycles(undefined, { enabled: stagesEnabled });
  const { data: hydration = [] } = useHydrationCycles(undefined, { enabled: stagesEnabled });
  const { data: triage = [] } = useTriageSessions(undefined, { enabled: stagesEnabled });

  const allow = (stage: ProductionStageView) => !stageFilter || stageFilter === stage;

  const running = useMemo(
    () => (hideOrders ? [] : [...orders].filter((order) => order.status === 'in_progress').sort(byUrgency)),
    [hideOrders, orders],
  );
  const planned = useMemo(
    () => (hideOrders ? [] : [...orders].filter((order) => order.status === 'planned').sort(byUrgency)),
    [hideOrders, orders],
  );
  const drafts = useMemo(
    () => (hideOrders ? [] : [...orders].filter((order) => order.status === 'draft').sort(byUrgency)),
    [hideOrders, orders],
  );

  const stageWork = [
    ...(allow('fumigation')
      ? fumigation.filter((cycle) => FUMIGATION_ACTIVE.has(cycle.status)).map((cycle) => ({
          id: cycle.id, icon: Flame, title: cycle.cycle_number, detail: `Chambre ${cycle.chamber}`, status: FUMIGATION_LABEL[cycle.status], view: 'fumigation' as const,
        }))
      : []),
    ...(allow('nettoyage')
      ? cleaning.filter((cycle) => cycle.status === 'EN_COURS').map((cycle) => ({
          id: cycle.id, icon: Droplets, title: cycle.cycle_number, detail: `Lot ${cycle.lot_number}`, status: 'En cours', view: 'nettoyage' as const,
        }))
      : []),
    ...(allow('hydratation')
      ? hydration.filter((cycle) => cycle.status === 'EN_COURS').map((cycle) => ({
          id: cycle.id, icon: Wind, title: cycle.cycle_number, detail: 'Hydratation', status: 'En cours', view: 'hydratation' as const,
        }))
      : []),
    ...(allow('triage')
      ? triage.filter((session) => session.status === 'EN_COURS' || session.status === 'PAUSE').map((session) => ({
          id: session.id, icon: Scissors, title: session.session_number, detail: `Lot ${session.parent_lot_number}`, status: session.status === 'PAUSE' ? 'En pause' : 'En cours', view: 'triage' as const,
        }))
      : []),
  ];

  const stuck = [
    ...(allow('fumigation')
      ? fumigation.filter((cycle) => (cycle.status === 'INTERROMPU' || cycle.status === 'ECHEC') && isRecent(cycle)).map((cycle) => ({
          id: cycle.id, icon: Flame, title: cycle.cycle_number, reason: cycle.status === 'ECHEC' ? 'Fumigation en échec' : 'Fumigation interrompue', view: 'fumigation' as const,
        }))
      : []),
    ...(allow('nettoyage')
      ? cleaning.filter((cycle) => cycle.status === 'INCIDENT' && isRecent(cycle)).map((cycle) => ({
          id: cycle.id, icon: Droplets, title: cycle.cycle_number, reason: 'Incident de nettoyage', view: 'nettoyage' as const,
        }))
      : []),
    ...(allow('hydratation')
      ? hydration.filter((cycle) => cycle.status === 'NON_CONFORME' && isRecent(cycle)).map((cycle) => ({
          id: cycle.id, icon: Wind, title: cycle.cycle_number, reason: 'Hydratation non conforme', view: 'hydratation' as const,
        }))
      : []),
    ...(allow('triage')
      ? triage.filter((session) => session.status === 'INCIDENT' && isRecent(session)).map((session) => ({
          id: session.id, icon: Scissors, title: session.session_number, reason: 'Incident de triage', view: 'triage' as const,
        }))
      : []),
  ];

  const criticalAlerts = alerts.urgence + alerts.critique;
  const stagesUnknown = stagesEnabled && (Boolean(pipeline.error) || pipeline.isLoading);

  return (
    <DataState source={ordersSource} data={ordersData} isEmpty={false} what="les ordres de fabrication">
    <div className="space-y-4">
      {stagesEnabled && Boolean(pipeline.error) && (
        <DataState compact source={{ error: pipeline.error, refetch: pipeline.refetch }} data={undefined} what="les cycles de l'atelier">{null}</DataState>
      )}

      {criticalAlerts > 0 && (
        <button
          type="button"
          onClick={() => onOpenView('alertes')}
          className="flex w-full items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-left text-sm font-semibold text-red-900"
        >
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {criticalAlerts} alerte{criticalAlerts > 1 ? 's' : ''} critique{criticalAlerts > 1 ? 's' : ''} à traiter
          <ChevronRight className="ml-auto h-4 w-4" />
        </button>
      )}

      <Section title="En cours" hint="Le travail en atelier" unknown={stagesUnknown}>
        {running.map((order) => (
          <WorkRow
            key={order.id}
            icon={Factory}
            title={order.order_number}
            detail={`${order.product_name} : ${order.actual_quantity ?? 0} sur ${quantityOf(order)}`}
            status={<Badge variant="outline" className={ORDER_STATUS_BADGE.in_progress}>{orderStatusLabels[order.status]}</Badge>}
            action="Suivre"
            onAction={() => onOpenOrder(order.id)}
          />
        ))}
        {stageWork.map((work) => (
          <WorkRow
            key={work.id}
            icon={work.icon}
            title={work.title}
            detail={work.detail}
            status={<Badge variant="outline" className={ORDER_STATUS_BADGE.in_progress}>{work.status}</Badge>}
            action="Ouvrir"
            onAction={() => onOpenView(work.view)}
          />
        ))}
      </Section>

      <Section title="À lancer" hint="Les prochaines actions possibles" unknown={stagesUnknown}>
        {planned.map((order) => (
          <PlannedOrderRow key={order.id} order={order} onOpenOrder={onOpenOrder} label={orderStatusLabels[order.status]} />
        ))}
        {drafts.map((order) => (
          <WorkRow
            key={order.id}
            icon={Factory}
            title={order.order_number}
            detail={`${order.product_name} : ${quantityOf(order)}`}
            status={<Badge variant="outline" className={ORDER_STATUS_BADGE.draft}>{orderStatusLabels[order.status]}</Badge>}
            action="Planifier"
            onAction={() => onOpenOrder(order.id)}
          />
        ))}
        {stagesEnabled && !hideOrders && pipeline.waiting.length > 0 && (
          <WorkRow
            icon={Flame}
            title={`${pipeline.waiting.length} lot${pipeline.waiting.length > 1 ? 's' : ''} libéré${pipeline.waiting.length > 1 ? 's' : ''} à transformer`}
            detail={`${pipeline.totalKgWaiting.toLocaleString('fr-FR')} kg en attente de fumigation`}
            action="Voir les lots"
            onAction={() => onOpenView('pipeline')}
          />
        )}
        {stagesEnabled && stageFilter === 'fumigation' && pipeline.waiting.length > 0 && (
          <WorkRow
            icon={Flame}
            title={`${pipeline.waiting.length} lot${pipeline.waiting.length > 1 ? 's' : ''} prêt${pipeline.waiting.length > 1 ? 's' : ''} pour fumigation`}
            detail={`${pipeline.totalKgWaiting.toLocaleString('fr-FR')} kg en attente`}
            action="Ouvrir"
            onAction={() => onOpenView('fumigation')}
          />
        )}
      </Section>

      <Section title="Bloqué" hint="Incidents des 7 derniers jours" unknown={stagesUnknown}>
        {stuck.map((item) => (
          <WorkRow
            key={item.id}
            icon={item.icon}
            title={item.title}
            detail={item.reason}
            status={<Badge variant="outline" className={ORDER_STATUS_BADGE.cancelled}>À traiter</Badge>}
            action="Ouvrir"
            onAction={() => onOpenView(item.view)}
          />
        ))}
      </Section>
    </div>
    </DataState>
  );
};
