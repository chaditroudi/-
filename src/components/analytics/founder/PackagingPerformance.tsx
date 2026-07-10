import { usePackagingAnalytics } from '@/hooks/useFounderAnalytics';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
  RadialBarChart, RadialBar,
} from 'recharts';
import { Package, Layers, AlertTriangle, TrendingUp } from 'lucide-react';

type Period = 'today' | 'week' | 'month' | 'quarter';

const oeeColor = (v: number) => v >= 85 ? '#22c55e' : v >= 70 ? '#f59e0b' : '#ef4444';
const oeeLabel = (v: number) => v >= 85 ? 'EXCELLENT' : v >= 70 ? 'ACCEPTABLE' : 'FAIBLE';

export function PackagingPerformance({ period }: { period: Period }) {
  const { data, isLoading } = usePackagingAnalytics(period);

  if (isLoading) return <div className="py-20 text-center text-sm text-muted-foreground animate-pulse">Analyse Conditionnement…</div>;

  const oee = data?.oee ?? 0;
  const kpis = data?.kpis;

  const radialData = [{ name: 'OEE', value: Math.round(oee), fill: oeeColor(oee) }];

  return (
    <div className="space-y-4">
      {/* Metal detection alert */}
      {(kpis?.metalFailures ?? 0) > 0 && (
        <div className="flex items-center gap-3 rounded-xl bg-red-50 border border-red-300 px-4 py-3">
          <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 animate-pulse" />
          <span className="text-red-700 font-semibold text-sm">
            {kpis!.metalFailures} détection(s) métal enregistrée(s) sur la période
          </span>
        </div>
      )}

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="col-span-1 row-span-1">
          <CardContent className="pt-4 pb-3 text-center">
            <div className="h-28">
              <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart cx="50%" cy="50%" innerRadius="60%" outerRadius="90%" data={radialData} startAngle={200} endAngle={-20}>
                  <RadialBar dataKey="value" cornerRadius={4} background={{ fill: '#f0f0f0' }} />
                </RadialBarChart>
              </ResponsiveContainer>
            </div>
            <div className="text-2xl font-black -mt-10" style={{ color: oeeColor(oee) }}>{oee.toFixed(1)}%</div>
            <div className="text-[11px] text-muted-foreground">OEE Global</div>
            <Badge className="mt-1 text-[11px]" style={{ background: oeeColor(oee) }}>{oeeLabel(oee)}</Badge>
          </CardContent>
        </Card>
        {[
          { label: 'Unités produites', value: kpis?.totalProduced.toLocaleString() ?? '—', sub: `/ ${kpis?.totalTarget.toLocaleString()} cibles`, icon: Package, color: 'text-emerald-600' },
          { label: 'Unités rejetées', value: kpis?.totalRejected.toLocaleString() ?? '—', sub: kpis?.totalProduced ? `${((kpis.totalRejected / kpis.totalProduced) * 100).toFixed(1)}% taux rejet` : '', icon: AlertTriangle, color: (kpis?.totalRejected ?? 0) > 0 ? 'text-red-600' : 'text-muted-foreground' },
          { label: 'Palettes scellées', value: kpis?.sealedPalettes.toString() ?? '—', sub: kpis?.totalNetKg ? `${kpis.totalNetKg.toFixed(0)} kg net` : '', icon: Layers, color: 'text-blue-600' },
        ].map(({ label, value, sub, icon: Icon, color }) => (
          <Card key={label}>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Icon className={`h-3.5 w-3.5 ${color}`} />
                <span className="text-xs text-muted-foreground">{label}</span>
              </div>
              <div className={`text-2xl font-black ${color}`}>{value}</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Line OEE */}
      <Card>
        <CardHeader><CardTitle className="text-sm">OEE par ligne de conditionnement</CardTitle></CardHeader>
        <CardContent>
          {data?.lineOEE.every(l => l.count === 0) ? (
            <div className="py-8 text-center text-xs text-muted-foreground">Aucun ordre de conditionnement terminé sur cette période.</div>
          ) : (
            <div className="space-y-3">
              {data?.lineOEE.map(l => (
                <div key={l.line} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{l.line}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground text-xs">{l.count} OF</span>
                      <span className="font-bold" style={{ color: oeeColor(l.oee) }}>{l.oee.toFixed(1)}%</span>
                    </div>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-2 rounded-full transition-all" style={{ width: `${l.oee}%`, background: oeeColor(l.oee) }} />
                  </div>
                  <div className="text-[11px] text-muted-foreground">{l.produced.toLocaleString()} / {l.target.toLocaleString()} unités</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Daily output chart */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Production & Palettes (30 jours)</CardTitle></CardHeader>
        <CardContent>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data?.daily} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 9 }} interval={6} />
                <YAxis yAxisId="units" tick={{ fontSize: 9 }} />
                <YAxis yAxisId="pal" orientation="right" tick={{ fontSize: 9 }} />
                <Tooltip />
                <Legend iconSize={10} />
                <Bar yAxisId="units" dataKey="units" name="Unités" fill="#10b981" radius={[2, 2, 0, 0]} />
                <Line yAxisId="pal" dataKey="palettes" name="Palettes" stroke="#3b82f6" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
