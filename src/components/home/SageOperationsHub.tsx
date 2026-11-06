import { DataState } from '@/components/shared/DataState';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ShoppingCart,
  Truck,
  ClipboardCheck,
  Warehouse,
  Factory,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { useSageOperations } from '@/hooks/useSageOperations';
import { GoldenThreadPanel } from '@/components/home/GoldenThreadPanel';
import { RecallDrillPanel } from '@/components/home/RecallDrillPanel';
import { MarginCockpitPanel } from '@/components/costing/MarginCockpitPanel';
import type { AppTab } from '@/lib/roleAccess';

interface SageOperationsHubProps {
  onNavigate: (tab: string) => void;
  accessibleTabs: AppTab[];
}

export const SageOperationsHub = ({ onNavigate, accessibleTabs }: SageOperationsHubProps) => {
  const source = useSageOperations();
  const { data } = source;

  if (!data) return <DataState source={source} data={data} what="le cockpit usine">{null}</DataState>;

  // Coverage defaults to 100 with no receipts, and the API supplies no denominator.
  // Keep it unmeasured until a defensible measurement basis is exposed.
  const { flow, blockers } = data;

  const processCards = [
    {
      title: 'Achats',
      icon: ShoppingCart,
      value: flow.pendingDa + flow.poPendingInternalApproval + flow.poReadyToSend,
      tab: 'purchasing',
    },
    {
      title: 'Réception',
      icon: Truck,
      value: flow.receptionsWaitingQc + flow.quarantineLots,
      tab: 'receptions',
    },
    {
      title: 'Qualité',
      icon: ClipboardCheck,
      value: flow.receptionsWaitingQc + flow.receptionsBlocked,
      tab: 'receptions',
    },
    {
      title: 'Stock',
      icon: Warehouse,
      value: flow.quarantinedStockLots,
      tab: 'storage',
    },
    {
      title: 'Production',
      icon: Factory,
      value: flow.productionInProgress,
      tab: 'production',
    },
  ].filter((card) => accessibleTabs.includes(card.tab as AppTab));

  const visibleBlockers = blockers
    .filter((b) => accessibleTabs.includes(b.tab as AppTab) && b.count > 0)
    .slice(0, 5);

  return (
    <DataState source={{ ...source, updatedAt: source.dataUpdatedAt }} data={data} what="le cockpit usine">
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl border px-3 py-2.5">
          <p className="text-xs text-muted-foreground">Blocages</p>
          <p className="text-lg font-semibold">{visibleBlockers.length}</p>
        </div>
        <div className="rounded-xl border px-3 py-2.5">
          <p className="text-xs text-muted-foreground">QC</p>
          <p className="text-lg font-semibold">
            {flow.receptionsWaitingQc + flow.receptionsBlocked}
          </p>
        </div>
        <div className="rounded-xl border px-3 py-2.5">
          <p className="text-xs text-muted-foreground">Traçabilité achat</p>
          <p className="text-lg font-semibold">Non mesurée</p>
          <p className="text-xs text-muted-foreground">Base non fournie</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {processCards.map((card) => (
          <button
            key={card.title}
            type="button"
            onClick={() => onNavigate(card.tab)}
            className="rounded-xl border bg-card px-3 py-3 text-start hover:bg-muted/40"
          >
            <div className="flex items-center justify-between">
              <card.icon className="h-4 w-4 text-muted-foreground" />
              <span className="text-base font-bold">{card.value}</span>
            </div>
            <p className="mt-1 text-xs font-semibold">{card.title}</p>
          </button>
        ))}
      </div>

      {visibleBlockers.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">À traiter</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {visibleBlockers.map((b) => (
              <button
                key={b.key}
                type="button"
                className="flex w-full items-center justify-between rounded-lg border px-3 py-2 text-start text-sm hover:bg-muted/40"
                onClick={() => onNavigate(b.tab)}
              >
                <span className="inline-flex items-center gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-orange-500" />
                  {b.label}
                </span>
                <Badge variant="secondary">{b.count}</Badge>
              </button>
            ))}
          </CardContent>
        </Card>
      )}

      {visibleBlockers.length === 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800">
          <CheckCircle2 className="h-4 w-4" />
          Aucun blocage prioritaire.
        </div>
      )}

      <MarginCockpitPanel />
      <GoldenThreadPanel onOpenScan={() => onNavigate('scan')} />
      <RecallDrillPanel />
    </div>
    </DataState>
  );
};
