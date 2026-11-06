import { DataState } from '@/components/shared/DataState';
import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import {
  useSupplyFunnel,
  useLiveFactory,
  usePackagingAnalytics,
  useReceptionPhase1Analytics,
} from '@/hooks/useFounderAnalytics';
import { LivePulse } from './founder/LivePulse';
import { SupplyFunnel } from './founder/SupplyFunnel';
import { ReceptionPhase1Panel } from './founder/ReceptionPhase1Panel';
import { Phase2Performance } from './founder/Phase2Performance';
import { PackagingPerformance } from './founder/PackagingPerformance';
import { StockStoragePanel } from './founder/StockStoragePanel';
import { AlertsIntelligence } from './founder/AlertsIntelligence';
import { SupplierScorecard } from './founder/SupplierScorecard';
import { SystemAuditPanel } from './founder/SystemAuditPanel';
import { Activity, GitBranch, Flame, Package, Bell, Users, Truck, Warehouse, ScrollText } from 'lucide-react';
import { SummaryStrip } from '@/components/shared/SummaryStrip';

type Period = 'today' | 'week' | 'month' | 'quarter';

const PERIOD_LABELS: Record<Period, string> = {
  today: "Aujourd'hui",
  week: '7 derniers jours',
  month: 'Ce mois',
  quarter: 'Ce trimestre',
};

function ExecutiveStrip({ period }: { period: Period }) {
  const funnelSource = useSupplyFunnel(period);
  const { data: funnel, isLoading: fl } = funnelSource;
  const liveSource = useLiveFactory();
  const { data: live, isLoading: ll } = liveSource;
  const packagingSource = usePackagingAnalytics(period);
  const { data: pkg, isLoading: pl } = packagingSource;
  const receptionSource = useReceptionPhase1Analytics(period);
  const { data: rec, isLoading: rl } = receptionSource;
  const sources = [funnelSource, liveSource, packagingSource, receptionSource];
  const error = sources.find(source => source.error)?.error;
  const complete = sources.every(source => source.data !== undefined);

  const loading = fl || ll || pl || rl;
  const totalKg = rec?.receptions.totalKg ?? 0;
  const p2Yield = funnel?.yields.phase2 ?? 0;
  const oee = pkg?.oee ?? 0;
  const palettes = pkg?.kpis?.sealedPalettes ?? 0;
  const palettesKg = pkg?.kpis?.totalNetKg ?? 0;
  const cycles = live?.active.total ?? 0;
  const alertsCrit = live?.alerts.critique ?? 0;
  const alertsTotal = live?.alerts.total ?? 0;

  const fmtKg = (v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)} t` : `${v.toFixed(0)} kg`;

  return (
    <DataState source={{ isLoading: loading, error, refetch: () => Promise.all(sources.map(source => source.refetch())) }} data={complete ? { funnel, live, pkg, rec } : undefined} what="la synthèse de l’usine">
    <p className="mb-2 text-xs text-muted-foreground">Source : réceptions, étapes et conditionnement enregistrés · {PERIOD_LABELS[period]}. Cycles et alertes : état actuel.</p>
    <SummaryStrip items={[
      { label: 'Volume reçu', value: loading ? '…' : totalKg > 0 ? fmtKg(totalKg) : '—', helper: `${rec?.receptions.total ?? 0} réceptions` },
      { label: 'Rapport flux déclarés', value: loading ? '…' : p2Yield > 0 ? `${p2Yield.toFixed(1)} %` : '—', helper: 'indicatif, hors bilan matière par lot' },
      { label: 'Atteinte volume cible', value: loading ? '…' : (pkg?.kpis.totalTarget ?? 0) > 0 ? `${oee.toFixed(1)} %` : 'Non mesuré', helper: 'unités produites / cible, ne mesure pas le TRS' },
      { label: 'Palettes scellées', value: loading ? '…' : palettes > 0 ? palettes : '—', helper: palettesKg > 0 ? `${fmtKg(palettesKg)} net` : undefined },
      { label: 'Cycles actifs', value: loading ? '…' : cycles, helper: 'en production' },
      {
        label: 'Alertes actives',
        value: loading ? '…' : alertsTotal,
        helper: alertsCrit > 0 ? `${alertsCrit} critique${alertsCrit > 1 ? 's' : ''}` : undefined,
        tone: alertsCrit > 0 ? 'bad' : alertsTotal > 0 ? 'watch' : 'default',
      },
    ]} />
    </DataState>
  );
}

function PlantHealthHeader() {
  return <section aria-labelledby="plant-score-title" className="rounded-lg border bg-card p-3">
    <h2 id="plant-score-title" className="text-base">Score global non mesuré</h2>
    <p className="text-sm text-muted-foreground">La méthode actuelle attribue une valeur par défaut aux étapes sans activité. Ce score n’est pas présenté comme une mesure de conformité. Consultez les volumes et les exceptions enregistrés ci-dessous.</p>
  </section>;
}

export function FounderAnalyticsDashboard() {
  const [period, setPeriod] = useState<Period>('month');
  const [tab, setTab] = useState('live');

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
          <SelectTrigger className="w-[200px]" aria-label="Période">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(PERIOD_LABELS) as Period[]).map(p => (
              <SelectItem key={p} value={p}>{PERIOD_LABELS[p]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Plant Health Score */}
      <PlantHealthHeader />

      {/* Executive KPI strip */}
      <ExecutiveStrip period={period} />

      {/* Main tabs */}
      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList className="flex w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="live" className="gap-1.5 py-2">
            <Activity className="h-3.5 w-3.5" />
            <span>Live</span>
          </TabsTrigger>
          <TabsTrigger value="funnel" className="gap-1.5 py-2">
            <GitBranch className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Flux global</span>
            <span className="sm:hidden">Flux</span>
          </TabsTrigger>
          <TabsTrigger value="reception" className="gap-1.5 py-2">
            <Truck className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Réception & QC</span>
            <span className="sm:hidden">Récep.</span>
          </TabsTrigger>
          <TabsTrigger value="stock" className="gap-1.5 py-2">
            <Warehouse className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Stock & Stockage</span>
            <span className="sm:hidden">Stock</span>
          </TabsTrigger>
          <TabsTrigger value="phase2" className="gap-1.5 py-2">
            <Flame className="h-3.5 w-3.5" />
            <span>Phase 2</span>
          </TabsTrigger>
          <TabsTrigger value="packaging" className="gap-1.5 py-2">
            <Package className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Conditionnement</span>
            <span className="sm:hidden">Cond.</span>
          </TabsTrigger>
          <TabsTrigger value="alerts" className="gap-1.5 py-2">
            <Bell className="h-3.5 w-3.5" />
            <span>Alertes</span>
          </TabsTrigger>
          <TabsTrigger value="suppliers" className="gap-1.5 py-2">
            <Users className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Fournisseurs</span>
            <span className="sm:hidden">Four.</span>
          </TabsTrigger>
          <TabsTrigger value="audit" className="gap-1.5 py-2">
            <ScrollText className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Audit système</span>
            <span className="sm:hidden">Audit</span>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="live"><LivePulse /></TabsContent>
        <TabsContent value="funnel"><SupplyFunnel period={period} /></TabsContent>
        <TabsContent value="reception"><ReceptionPhase1Panel period={period} /></TabsContent>
        <TabsContent value="stock"><StockStoragePanel period={period} /></TabsContent>
        <TabsContent value="phase2"><Phase2Performance period={period} /></TabsContent>
        <TabsContent value="packaging"><PackagingPerformance period={period} /></TabsContent>
        <TabsContent value="alerts"><AlertsIntelligence period={period} /></TabsContent>
        <TabsContent value="suppliers"><SupplierScorecard period={period} /></TabsContent>
        <TabsContent value="audit"><SystemAuditPanel /></TabsContent>
      </Tabs>
    </div>
  );
}
