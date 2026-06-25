import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Landmark,
  ShoppingCart,
  Truck,
  ClipboardCheck,
  Warehouse,
  Factory,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';
import { useSageOperations } from '@/hooks/useSageOperations';
import { ModuleHero } from '@/components/layout/ModuleHero';
import type { AppTab } from '@/lib/roleAccess';
import { APP_TAB_META } from '@/lib/appTabs';

interface SageOperationsHubProps {
  onNavigate: (tab: string) => void;
  accessibleTabs: AppTab[];
}

const getSeverityBadge = (severity: 'low' | 'medium' | 'high') => {
  if (severity === 'high') return 'bg-red-600';
  if (severity === 'medium') return 'bg-orange-500';
  return 'bg-emerald-600';
};

export const SageOperationsHub = ({ onNavigate, accessibleTabs }: SageOperationsHubProps) => {
  const { data, isLoading, isError, error, refetch } = useSageOperations();

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          Chargement du cockpit SAGE...
        </CardContent>
      </Card>
    );
  }

  if (isError || !data) {
    return (
      <Card>
        <CardContent className="p-6 space-y-3">
          <div className="text-sm text-red-600 font-medium">Impossible de charger le cockpit SAGE.</div>
          <div className="text-xs text-muted-foreground">
            {error instanceof Error ? error.message : 'Erreur inconnue'}
          </div>
          <Button size="sm" variant="outline" onClick={() => refetch()}>
            Réessayer
          </Button>
        </CardContent>
      </Card>
    );
  }

  const { flow, compliance, blockers } = data;

  const processCards = [
    {
      title: 'Achats',
      icon: ShoppingCart,
      value: flow.pendingDa + flow.poPendingInternalApproval + flow.poReadyToSend,
      subtitle: `${flow.pendingDa} DA attente | ${flow.poPendingInternalApproval} BC validation`,
      tab: 'purchasing',
    },
    {
      title: 'Réception',
      icon: Truck,
      value: flow.poConfirmed + flow.poPartiallyDelivered,
      subtitle: `${flow.receptionsWaitingQc} en QC | ${flow.quarantineLots} quarantaine`,
      tab: 'receptions',
    },
    {
      title: 'Qualité',
      icon: ClipboardCheck,
      value: flow.receptionsWaitingQc + flow.receptionsBlocked,
      subtitle: `${flow.receptionsWaitingQc} attente QC | ${flow.receptionsBlocked} bloquées`,
      tab: 'receptions',
    },
    {
      title: 'Stock',
      icon: Warehouse,
      value: flow.quarantinedStockLots,
      subtitle: `${flow.quarantinedStockLots} lots quarantaine stock`,
      tab: 'stock-lots',
    },
    {
      title: 'Production',
      icon: Factory,
      value: flow.productionInProgress,
      subtitle: `${flow.productionDelayed} OF en pause`,
      tab: 'production',
    },
  ];
  const visibleProcessCards = processCards.filter((card) => accessibleTabs.includes(card.tab as AppTab));
  const visibleBlockers = blockers.filter((blocker) => accessibleTabs.includes(blocker.tab as AppTab));
  const quickTabs = ['purchasing', 'receptions', 'stock-lots', 'production'].filter((tab) =>
    accessibleTabs.includes(tab as AppTab),
  ) as AppTab[];

  return (
    <div className="space-y-6">
      <ModuleHero
        kicker="Hub • Orchestration"
        title="SAGE Operations Hub"
        description="Vue transverse pour suivre les flux entre achats, reception, qualite, stock, production et logistique depuis un seul cockpit."
        stats={[
          { label: 'Blocages', value: blockers.length },
          { label: 'Flux QC', value: flow.receptionsWaitingQc + flow.receptionsBlocked },
          { label: 'Production', value: flow.productionInProgress },
        ]}
      />

      <Card className="surface-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Landmark className="h-5 w-5" />
            Vue bout-en-bout
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Pilotage bout-en-bout: Demande d'achat → Bon de commande → Réception → QC → Stock → Production.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
            {visibleProcessCards.map((card) => (
              <Button
                key={card.title}
                variant="outline"
                className="h-auto p-4 justify-start"
                onClick={() => onNavigate(card.tab)}
              >
                <div className="w-full space-y-2 text-left">
                  <div className="flex items-center justify-between">
                    <card.icon className="h-4 w-4" />
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <div className="text-lg font-bold">{card.value}</div>
                  <div className="text-xs text-muted-foreground">{card.title}</div>
                  <div className="text-[11px] text-muted-foreground">{card.subtitle}</div>
                </div>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="surface-card">
          <CardHeader>
            <CardTitle className="text-base">Conformité SAGE</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span>Couverture traçabilité lots réceptionnés</span>
              <Badge className={compliance.traceabilityCoverage >= 95 ? 'bg-emerald-600' : 'bg-orange-500'}>
                {compliance.traceabilityCoverage}%
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>Couverture 3-way match</span>
              <Badge className={compliance.threeWayCoverage >= 80 ? 'bg-emerald-600' : 'bg-orange-500'}>
                {compliance.threeWayCoverage}%
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>3-way match conformes</span>
              <Badge className="bg-emerald-600">{compliance.threeWayMatched}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>3-way match en écart</span>
              <Badge className={compliance.threeWayMismatch > 0 ? 'bg-red-600' : 'bg-emerald-600'}>
                {compliance.threeWayMismatch}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="surface-card">
          <CardHeader>
            <CardTitle className="text-base">Blocages prioritaires</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {visibleBlockers.map((b) => (
              <button
                key={b.key}
                className="w-full rounded-md border p-3 text-left hover:bg-muted/50 transition-colors"
                onClick={() => onNavigate(b.tab)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {b.count > 0 ? (
                      <AlertTriangle className="h-4 w-4 text-orange-500" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    )}
                    <span className="text-sm font-medium">{b.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={getSeverityBadge(b.severity)}>{b.severity}</Badge>
                    <Badge variant="secondary">{b.count}</Badge>
                  </div>
                </div>
              </button>
            ))}
            <Separator className="my-3" />
            <div className="flex flex-wrap gap-2">
              {quickTabs.map((tab) => (
                <Button key={tab} size="sm" variant="outline" onClick={() => onNavigate(tab)}>
                  {APP_TAB_META[tab].label}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
