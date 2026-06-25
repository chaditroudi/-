import { usePhase2Analytics } from '@/hooks/useFounderAnalytics';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { Flame, Droplets, Wind, Scissors, ShieldCheck } from 'lucide-react';

type Period = 'today' | 'week' | 'month' | 'quarter';

const GRADE_COLORS = { EXTRA: '#22c55e', CATEGORIE_I: '#3b82f6', CATEGORIE_II: '#f59e0b', REJETE: '#ef4444' };

const yieldColor = (v: number) => v >= 95 ? 'text-green-600' : v >= 88 ? 'text-amber-600' : 'text-red-600';
const yieldBg = (v: number) => v >= 95 ? 'bg-green-500' : v >= 88 ? 'bg-amber-500' : 'bg-red-500';

export function Phase2Performance({ period }: { period: Period }) {
  const { data, isLoading } = usePhase2Analytics(period);

  if (isLoading) return <div className="py-20 text-center text-sm text-muted-foreground animate-pulse">Analyse Phase 2…</div>;

  const modules = [
    { key: 'fumigation', label: 'Fumigation', icon: Flame, extra: `CCP ${data?.fumigation.ccpCompliance.toFixed(0)}%` },
    { key: 'nettoyage', label: 'Nettoyage', icon: Droplets, extra: data?.nettoyage.avgTurbidity ? `Turbidité ${data.nettoyage.avgTurbidity.toFixed(0)} NTU` : '' },
    { key: 'hydratation', label: 'Hydratation', icon: Wind, extra: data?.hydratation.avgHumidityGain ? `+${data.hydratation.avgHumidityGain.toFixed(1)}% hum.` : '' },
    { key: 'triage', label: 'Triage', icon: Scissors, extra: data?.triage.avgRejetePct ? `${data.triage.avgRejetePct.toFixed(1)}% rejeté` : '' },
  ] as const;

  return (
    <div className="space-y-4">
      {/* Module yield cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {modules.map(({ key, label, icon: Icon, extra }) => {
          const m = data?.[key] as { yield?: number; done?: number } | undefined;
          const y = m?.yield ?? 0;
          return (
            <Card key={key}>
              <CardContent className="pt-3 pb-3">
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs font-medium">{label}</span>
                </div>
                <div className={`text-3xl font-black ${yieldColor(y)}`}>{m?.done > 0 ? `${y.toFixed(1)}%` : '—'}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">rendement moyen</div>
                {m?.done > 0 && <Progress value={y} className="h-1 mt-2" indicatorClassName={yieldBg(y)} />}
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[10px] text-muted-foreground">{m?.done ?? 0} cycle(s)</span>
                  {extra && <span className="text-[10px] text-muted-foreground">{extra}</span>}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Grade distribution */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Distribution des grades (triage)</CardTitle></CardHeader>
          <CardContent>
            {(data?.gradeDistribution.every(g => g.kg === 0)) ? (
              <div className="py-8 text-center text-xs text-muted-foreground">Aucune session de triage terminée.</div>
            ) : (
              <>
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={data?.gradeDistribution} dataKey="kg" nameKey="label" cx="50%" cy="50%" outerRadius={70} paddingAngle={3}>
                        {data?.gradeDistribution.map(g => (
                          <Cell key={g.grade} fill={GRADE_COLORS[g.grade as keyof typeof GRADE_COLORS] ?? '#94a3b8'} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => [`${v.toFixed(0)} kg`]} />
                      <Legend iconSize={10} iconType="circle" />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-2 gap-1.5 mt-2">
                  {data?.gradeDistribution.map(g => (
                    <div key={g.grade} className="flex items-center justify-between text-xs px-2 py-1 rounded bg-muted/40">
                      <span style={{ color: GRADE_COLORS[g.grade as keyof typeof GRADE_COLORS] }} className="font-semibold">{g.label}</span>
                      <span className="font-mono">{g.pct.toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Daily throughput */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Débit quotidien Phase 2 (30 j.)</CardTitle></CardHeader>
          <CardContent>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data?.dailyThroughput} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="p2grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 9 }} interval={6} />
                  <YAxis tick={{ fontSize: 9 }} unit=" kg" width={50} />
                  <Tooltip formatter={(v: any) => [`${v.toFixed(0)} kg`, 'Entrée']} />
                  <Area type="monotone" dataKey="kgIn" stroke="#8b5cf6" strokeWidth={2} fill="url(#p2grad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* CCP Compliance */}
      {(data?.fumigation.done ?? 0) > 0 && (
        <Card className={data!.fumigation.ccpCompliance >= 95 ? 'border-green-300 bg-green-50' : 'border-amber-300 bg-amber-50'}>
          <CardContent className="pt-3 pb-3 flex items-center gap-3">
            <ShieldCheck className={`h-5 w-5 shrink-0 ${data!.fumigation.ccpCompliance >= 95 ? 'text-green-600' : 'text-amber-600'}`} />
            <div>
              <span className="text-sm font-semibold">CCP Fumigation — Conformité PH3</span>
              <div className="text-xs text-muted-foreground">Concentration 0.3–1.5% • Phosphine ≤ 0.3 ppm</div>
            </div>
            <div className="ml-auto text-2xl font-black">{data!.fumigation.ccpCompliance.toFixed(0)}%</div>
            <Badge className={data!.fumigation.ccpCompliance >= 95 ? 'bg-green-600' : 'bg-amber-600'}>
              {data!.fumigation.ccpCompliance >= 95 ? 'CONFORME' : 'SURVEILLER'}
            </Badge>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
