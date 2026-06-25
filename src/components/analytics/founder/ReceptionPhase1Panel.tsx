import { useReceptionPhase1Analytics } from '@/hooks/useFounderAnalytics';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, PieChart, Pie, Cell, Legend, ComposedChart, Line,
} from 'recharts';
import { Truck, FlaskConical, CheckCircle2, XCircle, AlertCircle, Package2, Layers } from 'lucide-react';

type Period = 'today' | 'week' | 'month' | 'quarter';

const QC_COLORS = { ACCEPTE: '#22c55e', REJETE: '#ef4444', QUARANTAINE: '#f59e0b', PENDING: '#94a3b8' };

const BATCH_STATUS_LABEL: Record<string, string> = {
  EN_ATTENTE: 'En attente',
  EN_COURS: 'En cours',
  TERMINE: 'Terminé',
  REJETE: 'Rejeté',
};

export function ReceptionPhase1Panel({ period }: { period: Period }) {
  const { data, isLoading } = useReceptionPhase1Analytics(period);

  if (isLoading) return <div className="py-20 text-center text-sm text-muted-foreground animate-pulse">Analyse Réception & Phase 1…</div>;

  const r = data?.receptions;
  const q = data?.qc;
  const b = data?.batches;

  const qcPieData = [
    { name: 'Accepté', value: q?.accepted ?? 0, color: QC_COLORS.ACCEPTE },
    { name: 'Rejeté', value: q?.rejected ?? 0, color: QC_COLORS.REJETE },
    { name: 'Quarantaine', value: q?.quarantine ?? 0, color: QC_COLORS.QUARANTAINE },
  ].filter(d => d.value > 0);

  const batchPieData = Object.entries(data?.batches.byStatus ?? {}).map(([status, count]) => ({
    name: BATCH_STATUS_LABEL[status] ?? status,
    value: count as number,
    color: status === 'TERMINE' ? '#22c55e' : status === 'EN_COURS' ? '#3b82f6' : status === 'REJETE' ? '#ef4444' : '#94a3b8',
  })).filter(d => d.value > 0);

  return (
    <div className="space-y-4">
      {/* Reception KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100/40 border-blue-200">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Truck className="h-3.5 w-3.5 text-blue-600" />
              <span className="text-xs text-blue-600 font-medium">Réceptions</span>
            </div>
            <div className="text-3xl font-black text-blue-700">{r?.total ?? 0}</div>
            <div className="text-xs text-blue-600 mt-0.5">
              {r?.totalKg ? (r.totalKg >= 1000 ? `${(r.totalKg / 1000).toFixed(2)} t` : `${r.totalKg.toFixed(0)} kg`) : '0 kg'}
            </div>
          </CardContent>
        </Card>

        <Card className={`border-2 ${(r?.acceptanceRate ?? 0) >= 80 ? 'border-green-300 bg-green-50' : 'border-amber-300 bg-amber-50'}`}>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-1.5 mb-1">
              <CheckCircle2 className={`h-3.5 w-3.5 ${(r?.acceptanceRate ?? 0) >= 80 ? 'text-green-600' : 'text-amber-600'}`} />
              <span className={`text-xs font-medium ${(r?.acceptanceRate ?? 0) >= 80 ? 'text-green-600' : 'text-amber-600'}`}>Taux acceptation</span>
            </div>
            <div className={`text-3xl font-black ${(r?.acceptanceRate ?? 0) >= 80 ? 'text-green-700' : 'text-amber-700'}`}>
              {(r?.acceptanceRate ?? 0).toFixed(1)}%
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">{r?.accepted ?? 0} acceptées</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-1.5 mb-1">
              <XCircle className="h-3.5 w-3.5 text-red-500" />
              <span className="text-xs text-muted-foreground">Rejetées</span>
            </div>
            <div className={`text-3xl font-black ${(r?.rejected ?? 0) > 0 ? 'text-red-600' : 'text-muted-foreground/50'}`}>{r?.rejected ?? 0}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{r?.quarantine ?? 0} en quarantaine</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Layers className="h-3.5 w-3.5 text-violet-600" />
              <span className="text-xs text-muted-foreground">Lots reçus</span>
            </div>
            <div className="text-3xl font-black text-violet-700">{data?.lots.total ?? 0}</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {data?.lots.totalKg ? (data.lots.totalKg >= 1000 ? `${(data.lots.totalKg / 1000).toFixed(2)} t` : `${data.lots.totalKg.toFixed(0)} kg`) : '—'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* QC Metrics */}
      {(q?.total ?? 0) > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Taux défaut moy.', value: q?.avgDefectRate ? `${q.avgDefectRate.toFixed(1)}%` : '—', icon: AlertCircle, color: 'text-amber-600' },
            { label: 'Brix moyen', value: q?.avgBrix ? `${q.avgBrix.toFixed(1)} °Bx` : '—', icon: FlaskConical, color: 'text-purple-600' },
            { label: 'Humidité moy.', value: q?.avgMoisture ? `${q.avgMoisture.toFixed(1)}%` : '—', icon: FlaskConical, color: 'text-cyan-600' },
            { label: 'Inspections QC', value: q?.total?.toString() ?? '0', icon: CheckCircle2, color: 'text-blue-600' },
          ].map(({ label, value, icon: Icon, color }) => (
            <Card key={label}>
              <CardContent className="pt-3 pb-2">
                <div className="flex items-center gap-1.5 mb-1">
                  <Icon className={`h-3.5 w-3.5 ${color}`} />
                  <span className="text-xs text-muted-foreground">{label}</span>
                </div>
                <div className={`text-xl font-black ${color}`}>{value}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Daily reception chart */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Volume de réceptions (30 jours)</CardTitle></CardHeader>
          <CardContent>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data?.dailyReceptions} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="recGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 9 }} interval={6} />
                  <YAxis yAxisId="kg" tick={{ fontSize: 9 }} unit=" kg" width={50} />
                  <YAxis yAxisId="cnt" orientation="right" tick={{ fontSize: 9 }} />
                  <Tooltip />
                  <Area yAxisId="kg" type="monotone" dataKey="kg" name="kg reçus" stroke="#3b82f6" fill="url(#recGrad)" strokeWidth={2} />
                  <Line yAxisId="cnt" dataKey="count" name="nb. réceptions" stroke="#f59e0b" strokeWidth={1.5} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* QC decision pie */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Décisions QC</CardTitle></CardHeader>
          <CardContent>
            {qcPieData.length === 0 ? (
              <div className="py-12 text-center text-xs text-muted-foreground">Aucune inspection QC sur cette période.</div>
            ) : (
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={qcPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={72} paddingAngle={3} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                      {qcPieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => [v, 'inspections']} />
                    <Legend iconSize={10} iconType="circle" />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* By variety */}
        {(data?.byVariety.length ?? 0) > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-sm">Réceptions par variété (kg)</CardTitle></CardHeader>
            <CardContent>
              <div style={{ height: Math.max((data?.byVariety.length ?? 1) * 32 + 20, 100) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data?.byVariety} layout="vertical" margin={{ left: 0, right: 16 }}>
                    <XAxis type="number" tick={{ fontSize: 9 }} />
                    <YAxis type="category" dataKey="variety" tick={{ fontSize: 9 }} width={90} />
                    <Tooltip formatter={(v: number) => [`${v >= 1000 ? `${(v / 1000).toFixed(2)} t` : `${v.toFixed(0)} kg`}`]} />
                    <Bar dataKey="kg" name="kg" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Batch lifecycle */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Lots (batches) — état</CardTitle>
              <div className="flex gap-1.5 items-center">
                <Package2 className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">{b?.total ?? 0} total</span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {batchPieData.length === 0 ? (
              <div className="py-10 text-center text-xs text-muted-foreground">Aucun lot enregistré.</div>
            ) : (
              <>
                <div className="h-36">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={batchPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60} paddingAngle={2}>
                        {batchPieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                      </Pie>
                      <Tooltip />
                      <Legend iconSize={10} iconType="circle" />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="text-center text-xs text-muted-foreground mt-1">
                  {b?.totalKg ? `${b.totalKg >= 1000 ? `${(b.totalKg / 1000).toFixed(2)} t` : `${b.totalKg.toFixed(0)} kg`} au total` : ''}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
