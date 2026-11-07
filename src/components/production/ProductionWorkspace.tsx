import { Fragment, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DataState, type DataSource } from '@/components/shared/DataState';
import {
  Bell,
  CheckCircle2,
  ClipboardList,
  Droplets,
  FlaskConical,
  Flame,
  GitMerge,
  LineChart,
  ListTodo,
  Printer,
  Scissors,
  Search,
  ShieldAlert,
  Waypoints,
  Wind,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { LotTraceabilityDialog } from '@/components/phase2/LotTraceabilityDialog';
import { FumigationPanel } from '@/components/phase2/fumigation/FumigationPanel';
import { NettoyagePanel } from '@/components/phase2/nettoyage/NettoyagePanel';
import { HydratationPanel } from '@/components/phase2/hydratation/HydratationPanel';
import { TriagePanel } from '@/components/phase2/triage/TriagePanel';
import { Phase2AlertsPanel } from '@/components/phase2/alerts/Phase2AlertsPanel';
import { printPhase2DailyReport } from '@/components/phase2/printPhase2DailyReport';
import { useFumigationCycles } from '@/hooks/useFumigation';
import { useCleaningCycles } from '@/hooks/useNettoyage';
import { useHydrationCycles } from '@/hooks/useHydratation';
import { useTriageSessions } from '@/hooks/useTriage';
import { usePhase2Pipeline } from '@/hooks/usePhase2Pipeline';
import { usePhase2AlertKpis } from '@/hooks/usePhase2Alerts';
import {
  defaultProductionView,
  getOperatorProductionStage,
  getProductionNavGroups,
  isAllowedProductionView,
  isProductionSupervisor,
} from '@/lib/productionNav';
import type { ActorRole } from '@/types/roles';
import type { MaterialReception } from '@/types/mes';
import type { ProductionOrder } from '@/types/production';
import { HaccpDashboard } from './HaccpDashboard';
import { MaterialBalancePanel } from './MaterialBalancePanel';
import { ProductionDone } from './ProductionDone';
import { ProductionKpiPanel } from './ProductionKpiPanel';
import { ProductionLinesPanel } from './ProductionLinesPanel';
import { ProductionOrderDetail } from './ProductionOrderDetail';
import { ProductionOrdersList } from './ProductionOrdersList';
import { ProductionPipelinePanel } from './ProductionPipelinePanel';
import { ProductionToday } from './ProductionToday';
import type { ProductionView } from './views';

const ICONS: Record<ProductionView, LucideIcon> = {
  today: ListTodo,
  orders: ClipboardList,
  pipeline: GitMerge,
  done: CheckCircle2,
  fumigation: Flame,
  nettoyage: Droplets,
  hydratation: Wind,
  triage: Scissors,
  alertes: Bell,
  flux: Waypoints,
  balance: FlaskConical,
  haccp: ShieldAlert,
  kpi: LineChart,
};

interface ProductionWorkspaceProps {
  orders: ProductionOrder[];
  ordersSource: DataSource;
  ordersData: unknown;
  receptions: MaterialReception[];
  currentUser: string;
  stagesEnabled: boolean;
  view: ProductionView;
  onViewChange: (view: ProductionView) => void;
  preSelectedLot?: string;
  roles?: ActorRole[];
}

/** One level of navigation for everything production does, opening on the work to do. */
export function ProductionWorkspace({
  orders,
  ordersSource,
  ordersData,
  receptions,
  currentUser,
  stagesEnabled,
  view,
  onViewChange,
  preSelectedLot,
  roles = [],
}: ProductionWorkspaceProps) {
  const { t } = useTranslation();
  const pipeline = usePhase2Pipeline({ enabled: stagesEnabled });
  const alerts = usePhase2AlertKpis();
  const { data: fumigation = [] } = useFumigationCycles(undefined, { enabled: stagesEnabled });
  const { data: cleaning = [] } = useCleaningCycles(undefined, { enabled: stagesEnabled });
  const { data: hydration = [] } = useHydrationCycles(undefined, { enabled: stagesEnabled });
  const { data: triage = [] } = useTriageSessions(undefined, { enabled: stagesEnabled });

  const [orderId, setOrderId] = useState<string | null>(null);
  const [lotQuery, setLotQuery] = useState(preSelectedLot ?? '');
  const [traceLot, setTraceLot] = useState(preSelectedLot ?? '');
  const [traceOpen, setTraceOpen] = useState(Boolean(preSelectedLot));

  const operatorStage = useMemo(() => getOperatorProductionStage(roles), [roles]);
  const supervisor = useMemo(() => isProductionSupervisor(roles), [roles]);
  const groups = useMemo(() => getProductionNavGroups(roles, stagesEnabled), [roles, stagesEnabled]);
  // A stage operator has one post: three large tabs, like the dock. Supervisors get the whole workshop.
  const postOnly = groups.length === 1 && groups[0].id === 'post';

  useEffect(() => {
    if (!preSelectedLot) return;
    setLotQuery(preSelectedLot);
    setTraceLot(preSelectedLot);
    setTraceOpen(true);
  }, [preSelectedLot]);

  useEffect(() => {
    if (isAllowedProductionView(roles, stagesEnabled, view)) return;
    onViewChange(defaultProductionView(roles, stagesEnabled));
  }, [onViewChange, roles, stagesEnabled, view]);

  const openTraceability = () => {
    setTraceLot(lotQuery.trim());
    setTraceOpen(true);
  };

  const badgeFor = (navView: ProductionView) => {
    if (navView === 'pipeline') return pipeline.waiting.length;
    if (navView === 'alertes') return alerts.total;
    return undefined;
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
      <nav aria-label={t('productionNav.label')} className="-mx-1 overflow-x-auto px-1 pb-1 scrollbar-hide">
        <div
          className={cn(
            'rounded-2xl border bg-card p-1.5 shadow-sm',
            postOnly ? 'grid grid-cols-3 gap-1.5' : 'flex w-max min-w-full items-center gap-1.5 lg:w-full lg:flex-wrap',
          )}
        >
          {groups.map((group, groupIndex) => (
            <Fragment key={group.id}>
              {!postOnly && groupIndex > 0 && <span aria-hidden className="mx-1 h-7 w-px shrink-0 bg-border" />}
              {!postOnly && (
                <span className="sr-only">{t(`productionNav.group.${group.id}`, { defaultValue: group.label })}</span>
              )}
              {group.items.map((item) => {
                const Icon = ICONS[item.view];
                const badge = badgeFor(item.view);
                const active = view === item.view;
                return (
                  <button
                    key={item.view}
                    type="button"
                    aria-current={active ? 'page' : undefined}
                    onClick={() => onViewChange(item.view)}
                    className={cn(
                      'relative flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      postOnly ? 'min-h-14 flex-col gap-1 px-2 text-sm sm:flex-row sm:gap-2 sm:text-base' : 'min-h-11 px-3.5 text-sm',
                      active ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
                    )}
                  >
                    <Icon className={cn('shrink-0', postOnly ? 'h-5 w-5' : 'h-4 w-4')} aria-hidden />
                    <span className="truncate">{t(`productionNav.item.${item.labelKey}`, { defaultValue: item.label })}</span>
                    {Boolean(badge) && (
                      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-warning px-1.5 text-xs font-bold leading-none text-warning-foreground">
                        {badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </Fragment>
          ))}
        </div>
      </nav>

      <div className="min-w-0 space-y-4">
        {view === 'today' && stagesEnabled && supervisor && (
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border bg-card p-3">
            <div className="flex min-w-0 flex-1 gap-2">
              <Input
                aria-label={t('productionWorkspace.traceLabel')}
                placeholder={t('productionWorkspace.tracePlaceholder')}
                value={lotQuery}
                onChange={(event) => setLotQuery(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && lotQuery.trim() && openTraceability()}
                className="h-11 min-w-0 flex-1 sm:max-w-xs"
              />
              <Button type="button" variant="outline" className="h-11 gap-1.5" aria-label={t('productionWorkspace.traceAction')} disabled={!lotQuery.trim()} onClick={openTraceability}>
                <Search className="h-4 w-4" />
                <span className="hidden sm:inline">{t('productionWorkspace.traceShort')}</span>
              </Button>
            </div>
            <Button
              type="button"
              variant="outline"
              className="h-11 gap-1.5"
              onClick={() => printPhase2DailyReport({ fumigation, cleaning, hydration, triage })}
            >
              <Printer className="h-4 w-4" />
              {t('productionWorkspace.dailyReport')}
            </Button>
          </div>
        )}

        {view === 'today' && (
          <ProductionToday
            orders={orders}
            ordersSource={ordersSource}
            ordersData={ordersData}
            stagesEnabled={stagesEnabled}
            stageFilter={operatorStage}
            hideOrders={!supervisor && Boolean(operatorStage)}
            onOpenView={onViewChange}
            onOpenOrder={setOrderId}
          />
        )}
        {view === 'orders' && <DataState source={ordersSource} data={ordersData} isEmpty={false} what="les ordres de fabrication"><ProductionOrdersList orders={orders} receptions={receptions} onOpenOrder={setOrderId} /></DataState>}
        {view === 'pipeline' && (
          <ProductionPipelinePanel
            onLaunchFumigation={(lot) => {
              setLotQuery(lot.reception_number);
              onViewChange('fumigation');
            }}
          />
        )}
        {view === 'done' && <ProductionDone stagesEnabled={stagesEnabled} stageFilter={operatorStage} />}
        {view === 'fumigation' && <FumigationPanel currentUser={currentUser} />}
        {view === 'nettoyage' && <NettoyagePanel currentUser={currentUser} />}
        {view === 'hydratation' && <HydratationPanel currentUser={currentUser} />}
        {view === 'triage' && <TriagePanel currentUser={currentUser} />}
        {view === 'alertes' && <Phase2AlertsPanel />}
        {view === 'flux' && <ProductionLinesPanel />}
        {view === 'balance' && <MaterialBalancePanel />}
        {view === 'haccp' && <HaccpDashboard />}
        {view === 'kpi' && <ProductionKpiPanel />}
      </div>

      {orderId && <ProductionOrderDetail open onOpenChange={(open) => !open && setOrderId(null)} orderId={orderId} />}
      <LotTraceabilityDialog open={traceOpen} onOpenChange={setTraceOpen} lotNumber={traceLot} />
    </div>
  );
}
