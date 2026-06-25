import { useEffect, useState } from 'react';
import { useLiveFactory } from '@/hooks/useFounderAnalytics';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Flame, Droplets, Wind, Scissors, Package, AlertTriangle, Activity } from 'lucide-react';

const MODULE_CONFIG = [
  { key: 'fumigation' as const, label: 'Fumigation', icon: Flame, color: 'bg-orange-500', text: 'text-orange-600', bg: 'bg-orange-50 border-orange-200' },
  { key: 'nettoyage' as const, label: 'Nettoyage', icon: Droplets, color: 'bg-blue-500', text: 'text-blue-600', bg: 'bg-blue-50 border-blue-200' },
  { key: 'hydratation' as const, label: 'Hydratation', icon: Wind, color: 'bg-cyan-500', text: 'text-cyan-600', bg: 'bg-cyan-50 border-cyan-200' },
  { key: 'triage' as const, label: 'Triage', icon: Scissors, color: 'bg-violet-500', text: 'text-violet-600', bg: 'bg-violet-50 border-violet-200' },
  { key: 'packaging' as const, label: 'Conditionnement', icon: Package, color: 'bg-emerald-500', text: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' },
];

function LiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);
  return (
    <span className="font-mono text-2xl font-bold tabular-nums">
      {now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
    </span>
  );
}

export function LivePulse() {
  const { data, isLoading, dataUpdatedAt } = useLiveFactory();

  return (
    <div className="space-y-4">
      {/* Live header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10">
            <Activity className="h-5 w-5 text-emerald-600 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg">Usine en temps réel</span>
              <span className="flex items-center gap-1 text-[10px] bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-full px-2 py-0.5 font-semibold uppercase tracking-wider">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                LIVE
              </span>
            </div>
            <div className="text-xs text-muted-foreground">
              {dataUpdatedAt ? `Mis à jour ${formatDistanceToNow(new Date(dataUpdatedAt), { locale: fr, addSuffix: true })}` : 'Chargement…'}
            </div>
          </div>
        </div>
        <LiveClock />
      </div>

      {/* Alert banner */}
      {(data?.alerts.critique ?? 0) > 0 && (
        <div className="flex items-center gap-3 rounded-xl bg-red-50 border border-red-200 px-4 py-3 animate-pulse">
          <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
          <span className="font-semibold text-red-700 text-sm">
            {data!.alerts.critique} alerte{data!.alerts.critique > 1 ? 's' : ''} critique{data!.alerts.critique > 1 ? 's' : ''} active{data!.alerts.critique > 1 ? 's' : ''}
          </span>
        </div>
      )}

      {/* Active operations grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {MODULE_CONFIG.map(({ key, label, icon: Icon, color, text, bg }) => {
          const count = data?.active[key] ?? 0;
          return (
            <div key={key} className={`rounded-xl border p-3 ${count > 0 ? bg : 'bg-muted/30 border-border/50'}`}>
              <div className="flex items-center gap-2 mb-2">
                <div className={`h-7 w-7 rounded-lg flex items-center justify-center ${count > 0 ? color : 'bg-muted'}`}>
                  <Icon className={`h-3.5 w-3.5 ${count > 0 ? 'text-white' : 'text-muted-foreground'}`} />
                </div>
                <span className="text-xs font-medium text-muted-foreground">{label}</span>
              </div>
              <div className={`text-3xl font-black ${count > 0 ? text : 'text-muted-foreground/50'}`}>{isLoading ? '—' : count}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">{count > 0 ? 'cycle(s) actif(s)' : 'aucun actif'}</div>
            </div>
          );
        })}
      </div>

      {/* Module yields today */}
      {data && (data.today.fumKgIn > 0 || data.today.netKgIn > 0 || data.today.hydKgIn > 0 || data.today.triKgIn > 0) && (
        <Card>
          <CardContent className="pt-3 pb-3">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2.5">
              Rendements Phase 2 — aujourd'hui
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { key: 'fum', label: 'Fumigation', kgIn: data.today.fumKgIn, yld: data.today.fumYield, icon: Flame },
                { key: 'net', label: 'Nettoyage', kgIn: data.today.netKgIn, yld: data.today.netYield, icon: Droplets },
                { key: 'hyd', label: 'Hydratation', kgIn: data.today.hydKgIn, yld: data.today.hydYield, icon: Wind },
                { key: 'tri', label: 'Triage', kgIn: data.today.triKgIn, yld: data.today.triYield, icon: Scissors },
              ]
                .filter((m) => m.kgIn > 0)
                .map(({ key, label, kgIn, yld, icon: Icon }) => {
                  const color = yld >= 95 ? 'text-green-600' : yld >= 88 ? 'text-amber-600' : 'text-red-600';
                  const barColor = yld >= 95 ? 'bg-green-500' : yld >= 88 ? 'bg-amber-500' : 'bg-red-500';
                  return (
                    <div key={key} className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <Icon className="h-3 w-3 text-muted-foreground" />
                        <span className="text-[10px] text-muted-foreground font-medium">{label}</span>
                      </div>
                      <div className={`text-xl font-black ${color}`}>{yld.toFixed(1)}%</div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className={`h-1.5 rounded-full ${barColor}`} style={{ width: `${Math.min(yld, 100)}%` }} />
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {kgIn >= 1000 ? `${(kgIn / 1000).toFixed(1)} t` : `${kgIn.toFixed(0)} kg`} entrants
                      </div>
                    </div>
                  );
                })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Today's throughput */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100/50 border-blue-200">
          <CardContent className="pt-4 pb-3">
            <div className="text-xs text-blue-600 font-semibold uppercase tracking-wide mb-1">Réceptions auj.</div>
            <div className="text-3xl font-black text-blue-700">{data?.receptions.today ?? '—'}</div>
            <div className="text-xs text-blue-600 mt-0.5">{data?.receptions.kgToday ? `${data.receptions.kgToday.toFixed(0)} kg` : '0 kg'}</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-violet-50 to-violet-100/50 border-violet-200">
          <CardContent className="pt-4 pb-3">
            <div className="text-xs text-violet-600 font-semibold uppercase tracking-wide mb-1">Phase 2 auj.</div>
            <div className="text-3xl font-black text-violet-700">{data?.today.totalKgProcessed.toFixed(0) ?? '—'} <span className="text-lg font-normal">kg</span></div>
            <div className="text-xs text-violet-600 mt-0.5">traités aujourd'hui</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 border-emerald-200">
          <CardContent className="pt-4 pb-3">
            <div className="text-xs text-emerald-600 font-semibold uppercase tracking-wide mb-1">Cond. auj.</div>
            <div className="text-3xl font-black text-emerald-700">{data?.today.pkgUnits ?? '—'} <span className="text-lg font-normal">un.</span></div>
            <div className="text-xs text-emerald-600 mt-0.5">unités conditionnées</div>
          </CardContent>
        </Card>
        <Card className={`border-2 ${(data?.alerts.critique ?? 0) > 0 ? 'bg-red-50 border-red-300' : (data?.alerts.avertissement ?? 0) > 0 ? 'bg-amber-50 border-amber-300' : 'bg-green-50 border-green-300'}`}>
          <CardContent className="pt-4 pb-3">
            <div className={`text-xs font-semibold uppercase tracking-wide mb-1 ${(data?.alerts.critique ?? 0) > 0 ? 'text-red-600' : (data?.alerts.avertissement ?? 0) > 0 ? 'text-amber-600' : 'text-green-600'}`}>Alertes actives</div>
            <div className={`text-3xl font-black ${(data?.alerts.critique ?? 0) > 0 ? 'text-red-700' : (data?.alerts.avertissement ?? 0) > 0 ? 'text-amber-700' : 'text-green-700'}`}>{data?.alerts.total ?? '—'}</div>
            <div className="flex gap-1 mt-1 flex-wrap">
              {(data?.alerts.critique ?? 0) > 0 && <Badge className="text-[10px] h-4 bg-red-500 text-white px-1">{data!.alerts.critique} critique</Badge>}
              {(data?.alerts.avertissement ?? 0) > 0 && <Badge className="text-[10px] h-4 bg-amber-500 text-white px-1">{data!.alerts.avertissement} avert.</Badge>}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Active packaging orders detail */}
      {(data?.active.packagingDetail?.length ?? 0) > 0 && (
        <Card>
          <CardContent className="pt-3 pb-3">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Ordres de conditionnement actifs</div>
            <div className="divide-y">
              {data!.active.packagingDetail.map((o: Record<string, unknown>) => {
                const pct = o.target_units > 0 ? Math.round((o.produced_units / o.target_units) * 100) : 0;
                return (
                  <div key={o.id} className="py-2 flex items-center gap-3">
                    <Badge variant="outline" className="text-[10px] shrink-0">{o.line}</Badge>
                    <span className="font-mono text-xs font-semibold">{o.order_number}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-muted rounded-full h-1.5">
                          <div className="bg-emerald-500 h-1.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0">{pct}%</span>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">{o.produced_units}/{o.target_units} un.</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
