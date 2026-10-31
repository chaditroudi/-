import { useEffect, useState } from 'react';
import {
  Bell,
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
import type { MaterialReception } from '@/types/mes';
import type { ProductionOrder } from '@/types/production';
import { HaccpDashboard } from './HaccpDashboard';
import { MaterialBalancePanel } from './MaterialBalancePanel';
import { ProductionKpiPanel } from './ProductionKpiPanel';
import { ProductionLinesPanel } from './ProductionLinesPanel';
import { ProductionOrderDetail } from './ProductionOrderDetail';
import { ProductionOrdersList } from './ProductionOrdersList';
import { ProductionPipelinePanel } from './ProductionPipelinePanel';
import { ProductionToday } from './ProductionToday';
import type { ProductionView } from './views';

type NavItem = { view: ProductionView; label: string; icon: LucideIcon; badge?: number; stage?: boolean };

interface ProductionWorkspaceProps {
  orders: ProductionOrder[];
  receptions: MaterialReception[];
  currentUser: string;
  stagesEnabled: boolean;
  view: ProductionView;
  onViewChange: (view: ProductionView) => void;
  preSelectedLot?: string;
}

/** One level of navigation for everything production does, opening on the work to do. */
export function ProductionWorkspace({ orders, receptions, currentUser, stagesEnabled, view, onViewChange, preSelectedLot }: ProductionWorkspaceProps) {
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

  useEffect(() => {
    if (!preSelectedLot) return;
    setLotQuery(preSelectedLot);
    setTraceLot(preSelectedLot);
    setTraceOpen(true);
  }, [preSelectedLot]);

  const openTraceability = () => {
    setTraceLot(lotQuery.trim());
    setTraceOpen(true);
  };

  const allGroups: Array<{ label: string; items: NavItem[] }> = [
    {
      label: 'Travail',
      items: [
        { view: 'today', label: 'À faire', icon: ListTodo },
        { view: 'orders', label: 'Ordres de fabrication', icon: ClipboardList },
        { view: 'pipeline', label: 'Lots à lancer', icon: GitMerge, badge: pipeline.waiting.length, stage: true },
      ],
    },
    {
      label: 'Étapes',
      items: [
        { view: 'fumigation', label: 'Fumigation', icon: Flame, stage: true },
        { view: 'nettoyage', label: 'Nettoyage', icon: Droplets, stage: true },
        { view: 'hydratation', label: 'Hydratation', icon: Wind, stage: true },
        { view: 'triage', label: 'Triage', icon: Scissors, stage: true },
      ],
    },
    {
      label: 'Suivi',
      items: [
        { view: 'alertes', label: 'Alertes', icon: Bell, badge: alerts.total, stage: true },
        { view: 'flux', label: 'Lignes F1 à F8', icon: Waypoints },
        { view: 'balance', label: 'Bilan matière', icon: FlaskConical },
        { view: 'haccp', label: 'Plan HACCP', icon: ShieldAlert },
        { view: 'kpi', label: 'Indicateurs', icon: LineChart },
      ],
    },
  ];
  const groups = allGroups.map((group) => ({ ...group, items: group.items.filter((item) => stagesEnabled || !item.stage) }));

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:gap-4">
      <nav aria-label="Sections de la production" className="-mx-1 overflow-x-auto scrollbar-hide lg:sticky lg:top-14 lg:mx-0 lg:w-48 lg:shrink-0 lg:overflow-visible">
        <div className="flex gap-1 px-1 lg:block lg:space-y-3 lg:px-0">
          {groups.map((group) => (
            <div key={group.label} className="flex gap-1 lg:block lg:space-y-px">
              <p className="hidden pb-1 text-xs font-medium text-muted-foreground lg:block">{group.label}</p>
              {group.items.map((item) => (
                <button
                  key={item.view}
                  type="button"
                  aria-current={view === item.view ? 'page' : undefined}
                  onClick={() => onViewChange(item.view)}
                  className={cn(
                    'flex min-h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-md px-2 text-sm font-medium pointer-coarse:min-h-11 lg:w-full',
                    view === item.view ? 'bg-card text-foreground ring-1 ring-border' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                  {Boolean(item.badge) && <span className="ml-auto rounded-sm bg-amber-100 px-1 text-xs font-semibold text-amber-900">{item.badge}</span>}
                </button>
              ))}
            </div>
          ))}
        </div>
      </nav>

      <div className="min-w-0 flex-1 space-y-3">
        {view === 'today' && stagesEnabled && (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <div className="flex gap-1">
              <Input
                aria-label="Numéro de lot à tracer"
                placeholder="Tracer un lot"
                value={lotQuery}
                onChange={(event) => setLotQuery(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && lotQuery.trim() && openTraceability()}
                className="h-9 w-44"
              />
              <Button type="button" size="icon" variant="outline" className="h-9 w-9" aria-label="Tracer ce lot" disabled={!lotQuery.trim()} onClick={openTraceability}>
                <Search className="h-4 w-4" />
              </Button>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-9 gap-1.5"
              onClick={() => printPhase2DailyReport({ fumigation, cleaning, hydration, triage })}
            >
              <Printer className="h-4 w-4" />
              Rapport du jour
            </Button>
          </div>
        )}

        {view === 'today' && <ProductionToday orders={orders} stagesEnabled={stagesEnabled} onOpenView={onViewChange} onOpenOrder={setOrderId} />}
        {view === 'orders' && <ProductionOrdersList orders={orders} receptions={receptions} onOpenOrder={setOrderId} />}
        {view === 'pipeline' && (
          <ProductionPipelinePanel
            onLaunchFumigation={(lot) => {
              setLotQuery(lot.reception_number);
              onViewChange('fumigation');
            }}
          />
        )}
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

