import { useMemo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, ChevronRight, Droplets, Factory, Flame, Scissors, Wind, type LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataState, type DataSource } from '@/components/shared/DataState';
import { SummaryStrip } from '@/components/shared/SummaryStrip';
import { TaskCard } from '@/components/shared/task';
import { useFumigationCycles } from '@/hooks/useFumigation';
import { useCleaningCycles } from '@/hooks/useNettoyage';
import { useHydrationCycles } from '@/hooks/useHydratation';
import { useTriageSessions } from '@/hooks/useTriage';
import { usePhase2Pipeline } from '@/hooks/usePhase2Pipeline';
import { usePhase2AlertKpis } from '@/hooks/usePhase2Alerts';
import { useOrderLotAllocations, useProductionConfig } from '@/hooks/useProduction';
import { formatNumber } from '@/lib/format';
import type { ProductionStageView } from '@/lib/productionNav';
import { cn } from '@/lib/utils';
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
  tone?: 'default' | 'blocked';
}

/** One piece of work: what it is, its state, and the one action that moves it on. */
const WorkRow = ({ icon: Icon, title, detail, status, action, onAction, tone = 'default' }: WorkRowProps) => (
  <li className={cn('flex flex-col gap-3 rounded-2xl border bg-card p-4 sm:flex-row sm:items-center', tone === 'blocked' && 'border-destructive/30')}>
    <div className="flex min-w-0 flex-1 items-start gap-3">
      <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl',
        tone === 'blocked' ? 'bg-destructive/10 text-destructive' : 'bg-accent text-accent-foreground')}>
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-mono text-base font-semibold">{title}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">{detail}</p>
        {status ? <div className="mt-2">{status}</div> : null}
      </div>
    </div>
    <Button type="button" variant={tone === 'blocked' ? 'outline' : 'default'} className="min-h-12 w-full shrink-0 sm:w-auto" onClick={onAction}>
      {action}
      <ChevronRight className="h-4 w-4" />
    </Button>
  </li>
);

const Section = ({ title, hint, unknown, empty, children }: { title: string; hint: string; unknown?: boolean; empty: string; children: ReactNode }) => {
  const { t } = useTranslation();
  const rows = (Array.isArray(children) ? children.flat() : [children]).filter(Boolean);
  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <h2 className="font-display text-lg font-semibold">{title}</h2>
        <span className="text-sm text-muted-foreground">{hint}</span>
      </div>
      {rows.length > 0
        ? <ul className="space-y-2">{children}</ul>
        : <p className="rounded-2xl border border-dashed bg-card px-4 py-4 text-sm text-muted-foreground">{unknown ? t('productionToday.unknown') : empty}</p>}
    </section>
  );
};

const PlannedOrderRow = ({ order, onOpenOrder, label, quantity }: { order: ProductionOrder; onOpenOrder: (id: string) => void; label: string; quantity: string }) => {
  const { t } = useTranslation();
  const { data: allocations, isLoading } = useOrderLotAllocations(order.id);
  const hasLots = (allocations?.length ?? 0) > 0;
  return (
    <WorkRow
      icon={Factory}
      title={order.order_number}
      detail={`${order.product_name} : ${quantity}`}
      status={!isLoading && !hasLots
        ? <Badge variant="outline" className={ORDER_STATUS_BADGE.cancelled}>{t('productionToday.noLot')}</Badge>
        : <Badge variant="outline" className={ORDER_STATUS_BADGE.planned}>{label}</Badge>}
      action={!isLoading && !hasLots ? t('productionToday.allocate') : t('productionToday.start')}
      onAction={() => onOpenOrder(order.id)}
    />
  );
};

const FUMIGATION_ACTIVE = new Set(['PREPARATION', 'CHARGEMENT', 'EN_COURS', 'VENTILATION', 'VALIDATION']);
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
  const { t } = useTranslation();
  const { orderStatusLabels } = useProductionConfig();
  const pipeline = usePhase2Pipeline({ enabled: stagesEnabled });
  const alerts = usePhase2AlertKpis();
  const { data: fumigation = [] } = useFumigationCycles(undefined, { enabled: stagesEnabled });
  const { data: cleaning = [] } = useCleaningCycles(undefined, { enabled: stagesEnabled });
  const { data: hydration = [] } = useHydrationCycles(undefined, { enabled: stagesEnabled });
  const { data: triage = [] } = useTriageSessions(undefined, { enabled: stagesEnabled });

  const allow = (stage: ProductionStageView) => !stageFilter || stageFilter === stage;
  const quantityOf = (order: ProductionOrder) =>
    order.target_quantity == null ? t('productionToday.quantityUnset') : `${formatNumber(order.target_quantity)} ${order.unit ?? ''}`.trim();

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
          id: cycle.id, icon: Flame, title: cycle.cycle_number, detail: t('productionToday.chamber', { chamber: cycle.chamber }),
          status: t(`productionToday.fumigationStatus.${cycle.status}`), view: 'fumigation' as const,
        }))
      : []),
    ...(allow('nettoyage')
      ? cleaning.filter((cycle) => cycle.status === 'EN_COURS').map((cycle) => ({
          id: cycle.id, icon: Droplets, title: cycle.cycle_number, detail: t('productionToday.lot', { lot: cycle.lot_number }), status: t('productionToday.statusRunning'), view: 'nettoyage' as const,
        }))
      : []),
    ...(allow('hydratation')
      ? hydration.filter((cycle) => cycle.status === 'EN_COURS').map((cycle) => ({
          id: cycle.id, icon: Wind, title: cycle.cycle_number, detail: t('productionToday.hydration'), status: t('productionToday.statusRunning'), view: 'hydratation' as const,
        }))
      : []),
    ...(allow('triage')
      ? triage.filter((session) => session.status === 'EN_COURS' || session.status === 'PAUSE').map((session) => ({
          id: session.id, icon: Scissors, title: session.session_number, detail: t('productionToday.lot', { lot: session.parent_lot_number }),
          status: session.status === 'PAUSE' ? t('productionToday.paused') : t('productionToday.statusRunning'), view: 'triage' as const,
        }))
      : []),
  ];

  const stuck = [
    ...(allow('fumigation')
      ? fumigation.filter((cycle) => (cycle.status === 'INTERROMPU' || cycle.status === 'ECHEC') && isRecent(cycle)).map((cycle) => ({
          id: cycle.id, icon: Flame, title: cycle.cycle_number, reason: cycle.status === 'ECHEC' ? t('productionToday.stuck.fumigationFailed') : t('productionToday.stuck.fumigationStopped'), view: 'fumigation' as const,
        }))
      : []),
    ...(allow('nettoyage')
      ? cleaning.filter((cycle) => cycle.status === 'INCIDENT' && isRecent(cycle)).map((cycle) => ({
          id: cycle.id, icon: Droplets, title: cycle.cycle_number, reason: t('productionToday.stuck.cleaning'), view: 'nettoyage' as const,
        }))
      : []),
    ...(allow('hydratation')
      ? hydration.filter((cycle) => cycle.status === 'NON_CONFORME' && isRecent(cycle)).map((cycle) => ({
          id: cycle.id, icon: Wind, title: cycle.cycle_number, reason: t('productionToday.stuck.hydration'), view: 'hydratation' as const,
        }))
      : []),
    ...(allow('triage')
      ? triage.filter((session) => session.status === 'INCIDENT' && isRecent(session)).map((session) => ({
          id: session.id, icon: Scissors, title: session.session_number, reason: t('productionToday.stuck.triage'), view: 'triage' as const,
        }))
      : []),
  ];

  const criticalAlerts = alerts.urgence + alerts.critique;
  const stagesUnknown = stagesEnabled && (Boolean(pipeline.error) || pipeline.isLoading);
  const waitingCount = pipeline.waiting.length;
  const waitingKg = formatNumber(pipeline.totalKgWaiting, 0);
  const showPipelineRow = stagesEnabled && !hideOrders && waitingCount > 0;
  const showFumigationReady = stagesEnabled && stageFilter === 'fumigation' && waitingCount > 0;

  // A stage operator sees the first running cycle as the one big next task, as on the worker home.
  const hero = hideOrders ? stageWork[0] : undefined;
  const runningCount = running.length + stageWork.length;
  const nextCount = planned.length + drafts.length + (showPipelineRow ? 1 : 0) + (showFumigationReady ? 1 : 0);
  const unknownCount = stagesUnknown ? '—' : undefined;

  return (
    <DataState source={ordersSource} data={ordersData} isEmpty={false} what="les ordres de fabrication">
    <div className="space-y-5">
      {stagesEnabled && Boolean(pipeline.error) && (
        <DataState compact source={{ error: pipeline.error, refetch: pipeline.refetch }} data={undefined} what="les cycles de l'atelier">{null}</DataState>
      )}

      {criticalAlerts > 0 && (
        <button
          type="button"
          onClick={() => onOpenView('alertes')}
          className="flex min-h-14 w-full items-center gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-start font-semibold text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <AlertTriangle className="h-5 w-5 shrink-0" />
          {t('productionToday.criticalAlerts', { count: criticalAlerts })}
          <ChevronRight className="ms-auto h-5 w-5" />
        </button>
      )}

      <SummaryStrip
        items={[
          { label: t('productionToday.running.title'), value: unknownCount ?? runningCount },
          { label: t('productionToday.next.title'), value: unknownCount ?? nextCount },
          { label: t('productionToday.blocked.title'), value: unknownCount ?? stuck.length, tone: !stagesUnknown && stuck.length > 0 ? 'bad' : 'default' },
        ]}
      />

      {hero && (
        <TaskCard
          variant="hero"
          status="ready"
          icon={<hero.icon />}
          title={hero.title}
          description={hero.detail}
          meta={[hero.status]}
          actionLabel={t('productionToday.open')}
          onAction={() => onOpenView(hero.view)}
        />
      )}

      <Section title={t('productionToday.running.title')} hint={t('productionToday.running.hint')} empty={t('productionToday.nothing')} unknown={stagesUnknown}>
        {running.map((order) => (
          <WorkRow
            key={order.id}
            icon={Factory}
            title={order.order_number}
            detail={t('productionToday.progress', { product: order.product_name, done: formatNumber(order.actual_quantity ?? 0), target: quantityOf(order) })}
            status={<Badge variant="outline" className={ORDER_STATUS_BADGE.in_progress}>{orderStatusLabels[order.status]}</Badge>}
            action={t('productionToday.follow')}
            onAction={() => onOpenOrder(order.id)}
          />
        ))}
        {stageWork.filter((work) => work !== hero).map((work) => (
          <WorkRow
            key={work.id}
            icon={work.icon}
            title={work.title}
            detail={work.detail}
            status={<Badge variant="outline" className={ORDER_STATUS_BADGE.in_progress}>{work.status}</Badge>}
            action={t('productionToday.open')}
            onAction={() => onOpenView(work.view)}
          />
        ))}
      </Section>

      <Section title={t('productionToday.next.title')} hint={t('productionToday.next.hint')} empty={t('productionToday.nothing')} unknown={stagesUnknown}>
        {planned.map((order) => (
          <PlannedOrderRow key={order.id} order={order} onOpenOrder={onOpenOrder} label={orderStatusLabels[order.status]} quantity={quantityOf(order)} />
        ))}
        {drafts.map((order) => (
          <WorkRow
            key={order.id}
            icon={Factory}
            title={order.order_number}
            detail={`${order.product_name} : ${quantityOf(order)}`}
            status={<Badge variant="outline" className={ORDER_STATUS_BADGE.draft}>{orderStatusLabels[order.status]}</Badge>}
            action={t('productionToday.plan')}
            onAction={() => onOpenOrder(order.id)}
          />
        ))}
        {showPipelineRow && (
          <WorkRow
            icon={Flame}
            title={t('productionToday.pipelineTitle', { count: waitingCount })}
            detail={t('productionToday.pipelineDetail', { kg: waitingKg })}
            action={t('productionToday.seeLots')}
            onAction={() => onOpenView('pipeline')}
          />
        )}
        {showFumigationReady && (
          <WorkRow
            icon={Flame}
            title={t('productionToday.fumigationReadyTitle', { count: waitingCount })}
            detail={t('productionToday.fumigationReadyDetail', { kg: waitingKg })}
            action={t('productionToday.open')}
            onAction={() => onOpenView('fumigation')}
          />
        )}
      </Section>

      <Section title={t('productionToday.blocked.title')} hint={t('productionToday.blocked.hint')} empty={t('productionToday.nothing')} unknown={stagesUnknown}>
        {stuck.map((item) => (
          <WorkRow
            key={item.id}
            icon={item.icon}
            tone="blocked"
            title={item.title}
            detail={item.reason}
            status={<Badge variant="outline" className={ORDER_STATUS_BADGE.cancelled}>{t('productionToday.toHandle')}</Badge>}
            action={t('productionToday.open')}
            onAction={() => onOpenView(item.view)}
          />
        ))}
      </Section>
    </div>
    </DataState>
  );
};
