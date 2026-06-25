import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  usePlantHealthScore,
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
import { Activity, GitBranch, Flame, Package, Bell, Users, Shield, Truck, Warehouse, ScrollText, TrendingUp, Layers } from 'lucide-react';

type Period = 'today' | 'week' | 'month' | 'quarter';

const PERIOD_LABELS: Record<Period, string> = {
  today: "Aujourd'hui",
  week: '7 derniers jours',
  month: 'Ce mois',
  quarter: 'Ce trimestre',
};

function scoreColor(s: number) {
  if (s >= 85) return { text: 'text-green-600', bg: 'bg-green-500', border: 'border-green-300', badge: 'bg-green-600', label: 'EXCELLENT' };
  if (s >= 70) return { text: 'text-amber-600', bg: 'bg-amber-500', border: 'border-amber-300', badge: 'bg-amber-600', label: 'BON' };
  if (s >= 55) return { text: 'text-orange-600', bg: 'bg-orange-500', border: 'border-orange-300', badge: 'bg-orange-600', label: 'MOYEN' };
  return { text: 'text-red-600', bg: 'bg-red-500', border: 'border-red-300', badge: 'bg-red-600', label: 'FAIBLE' };
}

function ExecutiveStrip({ period }: { period: Period }) {
  const { data: funnel, isLoading: fl } = useSupplyFunnel(period);
  const { data: live, isLoading: ll } = useLiveFactory();
  const { data: pkg, isLoading: pl } = usePackagingAnalytics(period);
  const { data: rec, isLoading: rl } = useReceptionPhase1Analytics(period);

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
    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
      {/* Volume reçu */}
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-2.5">
        <div className="flex items-center gap-1 mb-0.5">
          <Truck className="h-3 w-3 text-blue-500" />
          <span className="text-[10px] text-blue-600 font-semibold uppercase tracking-wide">Volume reçu</span>
        </div>
        <div className={`text-lg font-black text-blue-700 leading-tight ${loading ? 'opacity-40' : ''}`}>
          {loading ? '…' : totalKg > 0 ? fmtKg(totalKg) : '—'}
        </div>
        <div className="text-[10px] text-blue-500 mt-0.5">{rec?.receptions.total ?? 0} réceptions</div>
      </div>

      {/* Rendement Phase 2 */}
      <div className={`rounded-xl border p-2.5 ${p2Yield >= 90 ? 'border-green-200 bg-green-50' : p2Yield > 0 ? 'border-amber-200 bg-amber-50' : 'border-border bg-card'}`}>
        <div className="flex items-center gap-1 mb-0.5">
          <TrendingUp className="h-3 w-3 text-muted-foreground" />
          <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">Rendement P2</span>
        </div>
        <div className={`text-lg font-black leading-tight ${loading ? 'opacity-40' : ''} ${p2Yield >= 90 ? 'text-green-700' : p2Yield > 0 ? 'text-amber-700' : 'text-muted-foreground'}`}>
          {loading ? '…' : p2Yield > 0 ? `${p2Yield.toFixed(1)}%` : '—'}
        </div>
        <div className="text-[10px] text-muted-foreground mt-0.5">cible ≥ 90%</div>
      </div>

      {/* OEE Conditionnement */}
      <div className={`rounded-xl border p-2.5 ${oee >= 85 ? 'border-green-200 bg-green-50' : oee > 0 ? 'border-amber-200 bg-amber-50' : 'border-border bg-card'}`}>
        <div className="flex items-center gap-1 mb-0.5">
          <Package className="h-3 w-3 text-muted-foreground" />
          <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">OEE Cond.</span>
        </div>
        <div className={`text-lg font-black leading-tight ${loading ? 'opacity-40' : ''} ${oee >= 85 ? 'text-green-700' : oee > 0 ? 'text-amber-700' : 'text-muted-foreground'}`}>
          {loading ? '…' : oee > 0 ? `${oee.toFixed(1)}%` : '—'}
        </div>
        <div className="text-[10px] text-muted-foreground mt-0.5">cible ≥ 85%</div>
      </div>

      {/* Palettes PF */}
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-2.5">
        <div className="flex items-center gap-1 mb-0.5">
          <Layers className="h-3 w-3 text-emerald-500" />
          <span className="text-[10px] text-emerald-600 font-semibold uppercase tracking-wide">Palettes PF</span>
        </div>
        <div className={`text-lg font-black text-emerald-700 leading-tight ${loading ? 'opacity-40' : ''}`}>
          {loading ? '…' : palettes > 0 ? palettes : '—'}
        </div>
        <div className="text-[10px] text-emerald-500 mt-0.5">{palettesKg > 0 ? fmtKg(palettesKg) + ' net' : 'scellées'}</div>
      </div>

      {/* Cycles actifs */}
      <div className={`rounded-xl border p-2.5 ${cycles > 0 ? 'border-violet-200 bg-violet-50' : 'border-border bg-card'}`}>
        <div className="flex items-center gap-1 mb-0.5">
          <Activity className="h-3 w-3 text-muted-foreground" />
          <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">Cycles actifs</span>
        </div>
        <div className={`text-lg font-black leading-tight ${loading ? 'opacity-40' : ''} ${cycles > 0 ? 'text-violet-700' : 'text-muted-foreground'}`}>
          {loading ? '…' : cycles}
        </div>
        <div className="text-[10px] text-muted-foreground mt-0.5">en production</div>
      </div>

      {/* Alertes */}
      <div className={`rounded-xl border p-2.5 ${alertsCrit > 0 ? 'border-red-300 bg-red-50' : alertsTotal > 0 ? 'border-amber-200 bg-amber-50' : 'border-green-200 bg-green-50'}`}>
        <div className="flex items-center gap-1 mb-0.5">
          <Bell className="h-3 w-3 text-muted-foreground" />
          <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">Alertes</span>
        </div>
        <div className={`text-lg font-black leading-tight ${loading ? 'opacity-40' : ''} ${alertsCrit > 0 ? 'text-red-700' : alertsTotal > 0 ? 'text-amber-700' : 'text-green-700'}`}>
          {loading ? '…' : alertsTotal}
        </div>
        <div className={`text-[10px] mt-0.5 ${alertsCrit > 0 ? 'text-red-500 font-semibold' : 'text-muted-foreground'}`}>
          {alertsCrit > 0 ? `${alertsCrit} critique${alertsCrit > 1 ? 's' : ''}` : 'actives'}
        </div>
      </div>
    </div>
  );
}

function PlantHealthHeader({ period }: { period: Period }) {
  const { data, isLoading } = usePlantHealthScore(period);
  const score = data?.score ?? 0;
  const clr = scoreColor(score);

  return (
    <Card className={`border-2 ${clr.border} bg-card`}>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center gap-4 flex-wrap">
          {/* Score gauge */}
          <div className="relative flex items-center justify-center h-16 w-16 shrink-0">
            <svg className="absolute inset-0" viewBox="0 0 64 64" fill="none">
              <circle cx="32" cy="32" r="28" stroke="#e5e7eb" strokeWidth="6" fill="none" />
              <circle
                cx="32" cy="32" r="28"
                stroke={score >= 85 ? '#22c55e' : score >= 70 ? '#f59e0b' : score >= 55 ? '#f97316' : '#ef4444'}
                strokeWidth="6" fill="none"
                strokeDasharray={`${(score / 100) * 175.9} 175.9`}
                strokeLinecap="round"
                transform="rotate(-90 32 32)"
              />
            </svg>
            <span className={`text-sm font-black z-10 ${clr.text}`}>{isLoading ? '…' : Math.round(score)}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-lg">Score de santé usine</span>
              <Badge className={`${clr.badge} text-white text-[10px] uppercase tracking-wide`}>{clr.label}</Badge>
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Indicateur composite — Réception · Phase 2 · Conditionnement · Alertes
            </div>
          </div>
          {/* Breakdown bars */}
          <div className="flex gap-3 flex-wrap">
            {[
              { label: 'Réception', value: data?.breakdown.reception ?? 0, weight: '20%', color: 'bg-blue-500' },
              { label: 'Phase 2', value: data?.breakdown.phase2 ?? 0, weight: '30%', color: 'bg-violet-500' },
              { label: 'Condit.', value: data?.breakdown.packaging ?? 0, weight: '25%', color: 'bg-emerald-500' },
              { label: 'Alertes', value: data?.breakdown.alerts ?? 0, weight: '25%', color: 'bg-amber-500' },
            ].map(({ label, value, weight, color }) => (
              <div key={label} className="flex flex-col items-center gap-1 w-14">
                <div className="text-[10px] text-muted-foreground">{label}</div>
                <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                  <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${value}%` }} />
                </div>
                <div className="text-[10px] font-semibold">{isLoading ? '—' : Math.round(value)}</div>
                <div className="text-[9px] text-muted-foreground">{weight}</div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function FounderAnalyticsDashboard() {
  const [period, setPeriod] = useState<Period>('month');
  const [tab, setTab] = useState('live');

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <span className="font-bold text-lg">Analytics Fondateur</span>
          <span className="flex items-center gap-1 text-[10px] bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-full px-2 py-0.5 font-semibold uppercase tracking-wider">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            TEMPS RÉEL
          </span>
        </div>
        <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
          <SelectTrigger className="w-[200px]">
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
      <PlantHealthHeader period={period} />

      {/* Executive KPI strip */}
      <ExecutiveStrip period={period} />

      {/* Main tabs */}
      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList className="grid grid-cols-3 lg:grid-cols-9 gap-1 h-auto p-1 rounded-xl">
          <TabsTrigger value="live" className="gap-1.5 text-xs py-2">
            <Activity className="h-3.5 w-3.5" />
            <span>Live</span>
          </TabsTrigger>
          <TabsTrigger value="funnel" className="gap-1.5 text-xs py-2">
            <GitBranch className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Flux global</span>
            <span className="sm:hidden">Flux</span>
          </TabsTrigger>
          <TabsTrigger value="reception" className="gap-1.5 text-xs py-2">
            <Truck className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Réception & QC</span>
            <span className="sm:hidden">Récep.</span>
          </TabsTrigger>
          <TabsTrigger value="stock" className="gap-1.5 text-xs py-2">
            <Warehouse className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Stock & Stockage</span>
            <span className="sm:hidden">Stock</span>
          </TabsTrigger>
          <TabsTrigger value="phase2" className="gap-1.5 text-xs py-2">
            <Flame className="h-3.5 w-3.5" />
            <span>Phase 2</span>
          </TabsTrigger>
          <TabsTrigger value="packaging" className="gap-1.5 text-xs py-2">
            <Package className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Conditionnement</span>
            <span className="sm:hidden">Cond.</span>
          </TabsTrigger>
          <TabsTrigger value="alerts" className="gap-1.5 text-xs py-2">
            <Bell className="h-3.5 w-3.5" />
            <span>Alertes</span>
          </TabsTrigger>
          <TabsTrigger value="suppliers" className="gap-1.5 text-xs py-2">
            <Users className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Fournisseurs</span>
            <span className="sm:hidden">Four.</span>
          </TabsTrigger>
          <TabsTrigger value="audit" className="gap-1.5 text-xs py-2">
            <ScrollText className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Audit système</span>
            <span className="sm:hidden">Audit</span>
          </TabsTrigger>
        </TabsList>
fix
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
