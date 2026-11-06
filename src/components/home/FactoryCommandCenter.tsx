import { useState, useEffect, useCallback, useSyncExternalStore } from 'react';
import { DataState } from '@/components/shared/DataState';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Box,
  CheckCircle2,
  ChevronRight,
  Droplets,
  Layers,
  Maximize2,
  Minimize2,
  Package,
  RefreshCw,
  Truck,
  Wind,
  Zap,
  XCircle,
  Info,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { useLiveFactory, useAlertIntelligence } from '@/hooks/useFounderAnalytics';
import { getSseConnection } from '@/lib/sseClient';
import { describeRealtime, getRealtimeStatus, subscribeRealtimeStatus } from '@/lib/realtimeStatus';
import { useBranding } from '@/hooks/useBranding';
import { useOnline } from '@/hooks/useOnline';
import { SummaryStrip } from '@/components/shared/SummaryStrip';

// ── Formatters ─────────────────────────────────────────────────────────────────

const ALERT_TYPE_LABELS: Record<string, string> = {
  LOT_SUPPLIER_INTAKE: 'Lots fournisseur entrés',
  LOT_WEIGHED: 'Lots pesés',
  RECEPTION_CREATED: 'Réceptions créées',
};

const fmtKg = (n?: number | null) =>
  n != null
    ? new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(n) + ' kg'
    : '— kg';

const fmtN = (n?: number | null) =>
  n != null ? new Intl.NumberFormat('fr-FR').format(n) : '—';

const fmtPct = (n?: number | null) =>
  n != null ? n.toFixed(1) + ' %' : '— %';

const elapsed = (from?: string | null) => {
  if (!from) return null;
  const ms = Date.now() - new Date(from).getTime();
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

// ── Process stage node ─────────────────────────────────────────────────────────

interface NodeProps {
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  count: number;
  subtext?: string;
  isActive: boolean;
  colorText: string;
  colorBorder: string;
  colorGlow: string;
}

const ProcessNode = ({ label, Icon, count, subtext, isActive, colorText, colorBorder, colorGlow }: NodeProps) => (
  <div className="flex flex-col items-center gap-2.5 shrink-0">
    <div className={cn(
      'relative h-14 w-14 rounded-full border-2 flex items-center justify-center transition-all duration-700',
      isActive
        ? cn('bg-slate-800', colorBorder, 'shadow-[0_0_20px_rgba(0,0,0,0.5)]', colorGlow)
        : 'border-slate-700/60 bg-slate-900',
    )}>
      {isActive && (
        <span className={cn('absolute inset-[-3px] rounded-full border hidden opacity-30', colorBorder)} />
      )}
      <Icon className={cn('h-6 w-6 transition-colors duration-500', isActive ? colorText : 'text-slate-300')} />
      {isActive && count > 0 && (
        <span className={cn(
          'absolute -top-1.5 -end-1.5 h-5 w-5 rounded-full text-xs font-bold flex items-center justify-center bg-slate-950',
          'border-2', colorBorder, colorText,
        )}>
          {count}
        </span>
      )}
    </div>
    <div className="text-center">
      <p className={cn('text-xs font-bold uppercase transition-colors duration-500',
        isActive ? colorText : 'text-slate-300'
      )}>
        {label}
      </p>
      {subtext && (
        <p className={cn('text-xs tabular-nums mt-0.5', isActive ? 'text-slate-400' : 'text-slate-300')}>
          {subtext}
        </p>
      )}
    </div>
  </div>
);

// ── Flow connector ─────────────────────────────────────────────────────────────

const FlowLine = ({ active }: { active: boolean }) => (
  <div className="flex min-w-[20px] flex-1 items-center justify-center px-1 pb-[3.25rem]">
    <div className={cn('h-px w-full', active ? 'bg-emerald-500' : 'bg-slate-800')} />
  </div>
);

// ── KPI card ───────────────────────────────────────────────────────────────────

interface KpiProps {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  accent: string;
  glow?: boolean;
}

const KpiCard = ({ label, value, sub, icon, accent, glow }: KpiProps) => (
  <div className={cn(
    'rounded-xl border bg-slate-900/80 p-4 flex flex-col gap-2 relative overflow-hidden',
    glow ? 'border-slate-600' : 'border-slate-800',
  )}>
    <div className={cn('absolute inset-0 opacity-5 rounded-xl', accent)} />
    <div className="flex items-center justify-between">
      <span className="text-xs font-semibold text-slate-300">{label}</span>
      <span className={cn('h-8 w-8 rounded-lg flex items-center justify-center', accent + '/20')}>
        <span className={cn('text-current', accent.replace('bg-', 'text-'))}>{icon}</span>
      </span>
    </div>
    <p className="text-2xl font-black tabular-nums text-white leading-none">{value}</p>
    {sub && <p className="text-xs text-slate-300">{sub}</p>}
  </div>
);

// ── Yield bar ─────────────────────────────────────────────────────────────────

const YieldRow = ({ label, kgIn, yieldPct, colorClass }: { label: string; kgIn: number; yieldPct: number; colorClass: string }) => (
  <div className="space-y-1">
    <div className="flex items-center justify-between text-xs">
      <span className="text-slate-400">{label}</span>
      <div className="flex items-center gap-3">
        <span className="text-slate-300 tabular-nums">{fmtKg(kgIn)}</span>
        <span className={cn('font-bold tabular-nums', colorClass)}>{kgIn > 0 && yieldPct > 0 ? fmtPct(yieldPct) : "Non mesuré"}</span>
      </div>
    </div>
    <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
      <div
        className={cn('h-full rounded-full transition-all duration-1000', colorClass.replace('text-', 'bg-'))}
        style={{ width: kgIn > 0 && yieldPct > 0 ? `${Math.min(yieldPct, 100)}%` : "0%" }}
      />
    </div>
  </div>
);

// ── Main component ─────────────────────────────────────────────────────────────

export const FactoryCommandCenter = () => {
  const [clock, setClock] = useState(() => new Date());
  const [isFs, setIsFs] = useState(false);
  const { companyName, footprint, printFooter } = useBranding();
  const online = useOnline();
  const realtime = useSyncExternalStore(subscribeRealtimeStatus, getRealtimeStatus);
  const link = describeRealtime(realtime, online);

  const { data: lf, refetch, isFetching, isLoading: liveLoading, error: liveError, dataUpdatedAt } = useLiveFactory();
  const { data: alertData } = useAlertIntelligence('today');

  // Live clock — 1s tick
  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // SSE real-time — refetch on any db change
  useEffect(() => {
    const sse = getSseConnection();
    return sse.subscribe((msg) => {
      if (msg.eventName === 'db_change') void refetch();
    });
  }, [refetch]);

  // Fullscreen API
  const toggleFs = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => null);
      setIsFs(true);
    } else {
      document.exitFullscreen?.().catch(() => null);
      setIsFs(false);
    }
  }, []);

  useEffect(() => {
    const handler = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const active    = lf?.active;
  const today     = lf?.today;
  const alerts    = lf?.alerts;
  const rec       = lf?.receptions;

  const critiques  = alertData?.bySeverity?.CRITIQUE ?? alerts?.critique ?? 0;
  const urgences   = alertData?.bySeverity?.URGENCE ?? 0;
  const warnings   = alertData?.bySeverity?.AVERTISSEMENT ?? alerts?.avertissement ?? 0;
  const totalAlerts = alertData?.byStatus?.ACTIVE ?? alerts?.total ?? 0;

  const stages: NodeProps[] = [
    {
      label: 'Réception',
      Icon: Truck,
      count: rec?.today ?? 0,
      subtext: fmtKg(rec?.kgToday),
      isActive: (rec?.today ?? 0) > 0,
      colorText: 'text-sky-400',
      colorBorder: 'border-sky-500',
      colorGlow: 'shadow-sky-500/30',
    },
    {
      label: 'Fumigation',
      Icon: Wind,
      count: active?.fumigation ?? 0,
      subtext: fmtKg(today?.fumKgIn),
      isActive: (active?.fumigation ?? 0) > 0,
      colorText: 'text-violet-400',
      colorBorder: 'border-violet-500',
      colorGlow: 'shadow-violet-500/30',
    },
    {
      label: 'Nettoyage',
      Icon: Droplets,
      count: active?.nettoyage ?? 0,
      subtext: fmtKg(today?.netKgIn),
      isActive: (active?.nettoyage ?? 0) > 0,
      colorText: 'text-cyan-400',
      colorBorder: 'border-cyan-500',
      colorGlow: 'shadow-cyan-500/30',
    },
    {
      label: 'Hydratation',
      Icon: Droplets,
      count: active?.hydratation ?? 0,
      subtext: fmtKg(today?.hydKgIn),
      isActive: (active?.hydratation ?? 0) > 0,
      colorText: 'text-teal-400',
      colorBorder: 'border-teal-500',
      colorGlow: 'shadow-teal-500/30',
    },
    {
      label: 'Triage',
      Icon: Layers,
      count: active?.triage ?? 0,
      subtext: fmtKg(today?.triKgIn),
      isActive: (active?.triage ?? 0) > 0,
      colorText: 'text-amber-400',
      colorBorder: 'border-amber-500',
      colorGlow: 'shadow-amber-500/30',
    },
    {
      label: 'Conditionnement',
      Icon: Package,
      count: active?.packaging ?? 0,
      subtext: today?.pkgUnits ? `${fmtN(today.pkgUnits)} u.` : undefined,
      isActive: (active?.packaging ?? 0) > 0,
      colorText: 'text-orange-400',
      colorBorder: 'border-orange-500',
      colorGlow: 'shadow-orange-500/30',
    },
    {
      label: 'Expédition',
      Icon: Truck,
      count: 0,
      subtext: undefined,
      isActive: false,
      colorText: 'text-emerald-400',
      colorBorder: 'border-emerald-500',
      colorGlow: 'shadow-emerald-500/30',
    },
  ];

  const lastUpdateStr = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null;

  const packagingDetail = active?.packagingDetail ?? [];

  if (!lf) {
    return <DataState source={{ isLoading: liveLoading, error: liveError, refetch }} data={lf} isEmpty={false} what="l'état de l'usine">{null}</DataState>;
  }

  return (
    <>
      <div className={cn(
        'flex flex-col gap-0 overflow-hidden rounded-lg bg-slate-950 text-white',
        isFs ? 'fixed inset-0 z-[9999] rounded-none' : 'min-h-[calc(100vh-7rem)]',
      )}>

        <div className="shrink-0 border-b border-slate-800 px-4 py-3 sm:px-5">
          <SummaryStrip
            className="border-slate-700 bg-slate-800 [&_div]:bg-slate-900 [&_dt]:text-slate-400 [&_dd]:text-white"
            items={[
              { label: 'Réceptions du jour', value: fmtN(rec?.today), helper: fmtKg(rec?.kgToday) },
              { label: 'Fumigation', value: fmtN(active?.fumigation), helper: fmtKg(today?.fumKgIn) },
              { label: 'Nettoyage', value: fmtN(active?.nettoyage) },
              { label: 'Triage', value: fmtN(active?.triage) },
              { label: 'Alertes', value: fmtN(totalAlerts), tone: totalAlerts > 0 ? 'bad' : 'default' },
            ]}
          />
        </div>

        {/* ── Top bar ──────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-4">
            <div className="h-9 w-9 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
              <Activity className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-300">{footprint || companyName}</p>
              <p className="text-base font-bold text-white leading-tight">Centre de Commande Usine</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className={cn(
              'flex items-center gap-2 rounded-md border px-3 py-1.5',
              link?.tone === 'good' ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-amber-500/30 bg-amber-500/10',
            )}>
              <span className={cn(
                'h-2 w-2 rounded-full',
                link?.tone === 'good' ? 'bg-emerald-400' : link?.tone === 'bad' ? 'bg-red-400' : 'bg-amber-400',
              )} />
              <span className="text-xs font-bold text-slate-200">{link?.label ?? 'Flux non démarré'}</span>
            </div>

            {/* Clock */}
            <div className="text-end hidden sm:block">
              <p className="text-xl font-mono font-bold text-white tabular-nums">
                {clock.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </p>
              <p className="text-xs text-slate-300 capitalize">
                {clock.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1.5">
              <Button
                size="icon"
                variant="ghost"
                className="h-9 w-9 text-slate-300 hover:text-white hover:bg-slate-800"
                onClick={() => void refetch()}
                disabled={isFetching}
                title="Actualiser"
              >
                <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-9 w-9 text-slate-300 hover:text-white hover:bg-slate-800"
                onClick={toggleFs}
                title={isFs ? 'Quitter le plein écran' : 'Plein écran'}
              >
                {isFs ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>

        {/* ── Alert banner ─────────────────────────────────────────────────── */}
        {(critiques + urgences) > 0 && (
          <div className="flex items-center gap-3 px-5 py-2.5 bg-red-950/60 border-b border-red-800/50 shrink-0">
            <AlertTriangle className="h-4 w-4 text-red-300 shrink-0 animate-pulse" />
            <span className="text-sm font-semibold text-red-300">
              {urgences > 0 ? `${urgences} URGENCE${urgences > 1 ? 'S' : ''} · ` : ''}
              {critiques > 0 ? `${critiques} alerte${critiques > 1 ? 's' : ''} critique${critiques > 1 ? 's' : ''}` : ''}
            </span>
            {warnings > 0 && (
              <span className="text-xs text-amber-400 ms-1">· {warnings} avertissement{warnings > 1 ? 's' : ''}</span>
            )}
          </div>
        )}
        {(critiques + urgences) === 0 && warnings > 0 && (
          <div className="flex items-center gap-3 px-5 py-2 bg-amber-950/40 border-b border-amber-800/40 shrink-0">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
            <span className="text-xs text-amber-300">{warnings} avertissement{warnings > 1 ? 's' : ''} actif{warnings > 1 ? 's' : ''}</span>
          </div>
        )}

        <div className="flex-1 overflow-auto p-5 space-y-5">

          {/* ── Process flow ───────────────────────────────────────────────── */}
          <div className="bg-slate-900/60 rounded-xl border border-slate-800 p-5">
            <div className="flex items-center gap-2 mb-5">
              <span className="text-xs font-bold text-slate-300">Flux de production</span>
              {lf && (
                <span className="text-xs text-slate-300">
                  · {active?.total ?? 0} processus actif{(active?.total ?? 0) !== 1 ? 's' : ''}
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 xl:flex xl:items-start xl:gap-0">
              {stages.map((stage, i) => (
                <div key={stage.label} className="flex min-w-0 items-start justify-center last:col-span-2 sm:last:col-span-3 xl:flex-1 xl:justify-start xl:last:col-span-1">
                  <ProcessNode {...stage} />
                  {i < stages.length - 1 && (
                    <FlowLine active={stage.isActive && stages[i + 1].isActive} />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* ── KPI strip ──────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard
              label="Volumes déclarés aujourd'hui"
              value={fmtKg(today?.totalKgProcessed)}
              sub={today?.avgYield ? `Rapport indicatif : ${fmtPct(today.avgYield)}` : undefined}
              icon={<BarChart3 className="h-4 w-4" />}
              accent="bg-emerald-500"
              glow={(today?.totalKgProcessed ?? 0) > 0}
            />
            <KpiCard
              label="Processus actifs"
              value={fmtN(active?.total)}
              sub={active?.packagingDetail?.length ? `${active.packagingDetail.length} ligne(s) conditionnement` : 'Aucune ligne active'}
              icon={<Activity className="h-4 w-4" />}
              accent="bg-sky-500"
              glow={(active?.total ?? 0) > 0}
            />
            <KpiCard
              label="Réceptions aujourd'hui"
              value={fmtN(rec?.today)}
              sub={rec?.accepted != null ? `${rec.accepted} accepté${rec.accepted !== 1 ? 'es' : 'e'} · ${fmtKg(rec.kgToday)}` : undefined}
              icon={<Truck className="h-4 w-4" />}
              accent="bg-violet-500"
              glow={(rec?.today ?? 0) > 0}
            />
            <KpiCard
              label="Alertes actives"
              value={fmtN(totalAlerts)}
              sub={critiques + urgences > 0
                ? `${critiques + urgences} critique${critiques + urgences > 1 ? 's' : ''}`
                : warnings > 0
                  ? `${warnings} avertissement${warnings > 1 ? 's' : ''}`
                  : 'Aucune alerte critique'}
              icon={<AlertTriangle className="h-4 w-4" />}
              accent={critiques + urgences > 0 ? 'bg-red-500' : warnings > 0 ? 'bg-amber-500' : 'bg-slate-600'}
              glow={totalAlerts > 0}
            />
          </div>

          {/* ── Bottom panels ──────────────────────────────────────────────── */}
          <div className="grid lg:grid-cols-2 gap-4">

            {/* Active packaging lines */}
            <div className="bg-slate-900/60 rounded-xl border border-slate-800 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Package className="h-3.5 w-3.5 text-orange-400" />
                <span className="text-xs font-bold text-slate-400">
                  Lignes conditionnement
                </span>
                {packagingDetail.length > 0 && (
                  <span className="ms-auto text-xs px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-400 font-semibold border border-orange-500/20">
                    {packagingDetail.length} active{packagingDetail.length > 1 ? 's' : ''}
                  </span>
                )}
              </div>

              {packagingDetail.length === 0 ? (
                <p className="text-sm text-slate-300 py-4 text-center">Aucune ligne active en ce moment</p>
              ) : (
                <div className="space-y-2.5">
                  {packagingDetail.map((p) => {
                    const pct = p.target_units > 0 ? (p.produced_units / p.target_units) * 100 : 0;
                    return (
                      <div key={p.id} className="space-y-1.5 p-3 rounded-lg bg-slate-800/60 border border-slate-700/50">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-orange-400 animate-pulse" />
                            <span className="text-xs font-mono font-semibold text-orange-300">{p.order_number}</span>
                            {p.line && <span className="text-xs text-slate-300">· {p.line}</span>}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-400">
                            <span className="tabular-nums">{fmtN(p.produced_units)}/{fmtN(p.target_units)} u.</span>
                            {p.started_at && <span className="text-slate-300">{elapsed(p.started_at)}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Progress value={pct} className="h-1.5 flex-1 bg-slate-700 [&>*]:bg-orange-500" />
                          <span className="text-xs font-bold text-orange-400 tabular-nums w-9 text-end">
                            {pct.toFixed(0)}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Today's yield by stage */}
            <div className="bg-slate-900/60 rounded-xl border border-slate-800 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Zap className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-xs font-bold text-slate-400">
                  Rapports indicatifs des volumes déclarés
                </span>
                {today?.avgYield > 0 ? (
                  <span className="ms-auto text-xs font-bold text-emerald-400 tabular-nums">
                    Moy. indicative {fmtPct(today.avgYield)}
                  </span>
                ) : <span className="ms-auto text-xs text-slate-400">Moyenne non mesurée</span>}
              </div>

              {!today ? (
                <p className="text-sm text-slate-300 py-4 text-center">En attente de données…</p>
              ) : (
                <div className="space-y-3 pt-1">
                  <YieldRow label="Fumigation"   kgIn={today.fumKgIn} yieldPct={today.fumYield} colorClass="text-violet-400" />
                  <YieldRow label="Nettoyage"    kgIn={today.netKgIn} yieldPct={today.netYield} colorClass="text-cyan-400" />
                  <YieldRow label="Hydratation"  kgIn={today.hydKgIn} yieldPct={today.hydYield} colorClass="text-teal-400" />
                  <YieldRow label="Triage"       kgIn={today.triKgIn} yieldPct={today.triYield} colorClass="text-amber-400" />

                  {today.totalKgProcessed > 0 && (
                    <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                      <span className="text-xs text-slate-300">Total traité aujourd'hui</span>
                      <span className="text-sm font-bold text-white tabular-nums">{fmtKg(today.totalKgProcessed)}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Alert type breakdown */}
              {alertData?.topTypes && alertData.topTypes.length > 0 && (
                <div className="pt-3 border-t border-slate-800 space-y-1.5">
                  <p className="text-xs font-bold text-slate-300">Notifications par type</p>
                  {alertData.topTypes.slice(0, 3).map((t) => (
                    <div key={t.code} className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">{ALERT_TYPE_LABELS[t.code] ?? t.code.replace(/_/g, ' ').toLowerCase()}</span>
                      <span className="text-amber-400 font-bold tabular-nums">{t.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Footer ─────────────────────────────────────────────────────── */}
          <div className="flex items-center justify-between text-xs text-slate-300 pt-1">
            <span>{printFooter}</span>
            {lastUpdateStr && <span>Dernière actualisation : {lastUpdateStr}</span>}
          </div>
        </div>
      </div>
    </>
  );
};
