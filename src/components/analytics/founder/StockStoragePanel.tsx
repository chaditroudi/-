import { useStockStorageAnalytics } from '@/hooks/useFounderAnalytics';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  ComposedChart, Area, Line, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { Warehouse, ArrowUpRight, ArrowDownRight, Thermometer, Droplets, AlertTriangle, Package } from 'lucide-react';

type Period = 'today' | 'week' | 'month' | 'quarter';

const occupancyColor = (pct: number) => pct >= 90 ? '#ef4444' : pct >= 75 ? '#f59e0b' : '#22c55e';
const occupancyLabel = (pct: number) => pct >= 90 ? 'CRITIQUE' : pct >= 75 ? 'ÉLEVÉ' : 'NORMAL';

export function StockStoragePanel({ period }: { period: Period }) {
  const { data, isLoading } = useStockStorageAnalytics(period);

  if (isLoading) return <div className="py-20 text-center text-sm text-muted-foreground animate-pulse">Analyse Stock & Stockage…</div>;

  const st = data?.stock;
  const mv = data?.movements;
  const sr = data?.storage;

  return (
    <div className="space-y-4">
      {/* Critical storage alerts */}
      {(st?.criticalAlerts ?? 0) > 0 && (
        <div className="flex items-center gap-3 rounded-xl bg-red-50 border border-red-300 px-4 py-3">
          <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 animate-pulse" />
          <span className="text-red-700 font-semibold text-sm">
            {st!.criticalAlerts} alerte{st!.criticalAlerts > 1 ? 's' : ''} critique{st!.criticalAlerts > 1 ? 's' : ''} sur le stock
          </span>
        </div>
      )}

      {/* Stock KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="bg-gradient-to-br from-violet-50 to-violet-100/40 border-violet-200">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Package className="h-3.5 w-3.5 text-violet-600" />
              <span className="text-xs text-violet-600 font-medium">Lots en stock</span>
            </div>
            <div className="text-3xl font-black text-violet-700">{st?.totalLots ?? 0}</div>
            <div className="text-xs text-violet-600 mt-0.5">
              {st?.totalKg ? (st.totalKg >= 1000 ? `${(st.totalKg / 1000).toFixed(2)} t` : `${st.totalKg.toFixed(0)} kg`) : '0 kg'}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100/40 border-green-200">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-1.5 mb-1">
              <ArrowUpRight className="h-3.5 w-3.5 text-green-600" />
              <span className="text-xs text-green-600 font-medium">Entrées période</span>
            </div>
            <div className="text-3xl font-black text-green-700">
              {mv?.totalIn ? (mv.totalIn >= 1000 ? `${(mv.totalIn / 1000).toFixed(1)} t` : `${mv.totalIn.toFixed(0)} kg`) : '0'}
            </div>
            <div className="text-xs text-green-600 mt-0.5">{mv?.count ?? 0} mouvements</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-50 to-red-100/40 border-red-200">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-1.5 mb-1">
              <ArrowDownRight className="h-3.5 w-3.5 text-red-600" />
              <span className="text-xs text-red-600 font-medium">Sorties période</span>
            </div>
            <div className="text-3xl font-black text-red-700">
              {mv?.totalOut ? (mv.totalOut >= 1000 ? `${(mv.totalOut / 1000).toFixed(1)} t` : `${mv.totalOut.toFixed(0)} kg`) : '0'}
            </div>
            <div className="text-xs text-red-600 mt-0.5">
              Balance: {mv?.balance != null ? (mv.balance >= 0 ? '+' : '') + (mv.balance >= 1000 || mv.balance <= -1000 ? `${(mv.balance / 1000).toFixed(1)} t` : `${mv.balance.toFixed(0)} kg`) : '—'}
            </div>
          </CardContent>
        </Card>

        <Card className={`border-2 ${(sr?.condCompliance ?? 100) >= 95 ? 'border-green-300 bg-green-50' : 'border-amber-300 bg-amber-50'}`}>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Thermometer className={`h-3.5 w-3.5 ${(sr?.condCompliance ?? 100) >= 95 ? 'text-green-600' : 'text-amber-600'}`} />
              <span className={`text-xs font-medium ${(sr?.condCompliance ?? 100) >= 95 ? 'text-green-600' : 'text-amber-600'}`}>Conformité conditions</span>
            </div>
            <div className={`text-3xl font-black ${(sr?.condCompliance ?? 100) >= 95 ? 'text-green-700' : 'text-amber-700'}`}>
              {(sr?.condCompliance ?? 100).toFixed(0)}%
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">{sr?.condReadings ?? 0} lectures</div>
          </CardContent>
        </Card>
      </div>

      {/* Zone occupancy */}
      {(sr?.zones.length ?? 0) > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Occupation des zones de stockage</CardTitle>
              <div className="flex items-center gap-1.5">
                <Warehouse className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  {sr?.occupancyPct?.toFixed(0) ?? 0}% global
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {sr?.zones.map(z => (
                <div key={z.name} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{z.name}</span>
                      <Badge className="text-[10px] h-4 px-1" style={{ background: occupancyColor(z.occupancy) }}>
                        {occupancyLabel(z.occupancy)}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      {z.temperature != null && (
                        <span className="flex items-center gap-0.5">
                          <Thermometer className="h-3 w-3" />{z.temperature.toFixed(1)}°C
                        </span>
                      )}
                      {z.humidity != null && (
                        <span className="flex items-center gap-0.5">
                          <Droplets className="h-3 w-3" />{z.humidity.toFixed(0)}%
                        </span>
                      )}
                      <span className="font-bold" style={{ color: occupancyColor(z.occupancy) }}>{z.occupancy.toFixed(0)}%</span>
                    </div>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-2 rounded-full transition-all" style={{ width: `${Math.min(z.occupancy, 100)}%`, background: occupancyColor(z.occupancy) }} />
                  </div>
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>{z.current >= 1000 ? `${(z.current / 1000).toFixed(2)} t` : `${z.current.toFixed(0)} kg`} occupé</span>
                    <span>capacité: {z.capacity >= 1000 ? `${(z.capacity / 1000).toFixed(1)} t` : `${z.capacity.toFixed(0)} kg`}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Stock by variety */}
        {(st?.byVariety.length ?? 0) > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-sm">Stock actuel par variété</CardTitle></CardHeader>
            <CardContent>
              <div style={{ height: Math.max((st?.byVariety.length ?? 1) * 32 + 20, 100) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={st?.byVariety} layout="vertical" margin={{ left: 0, right: 16 }}>
                    <XAxis type="number" tick={{ fontSize: 9 }} />
                    <YAxis type="category" dataKey="variety" tick={{ fontSize: 9 }} width={90} />
                    <Tooltip formatter={(v: number) => [`${v >= 1000 ? `${(v / 1000).toFixed(2)} t` : `${v.toFixed(0)} kg`}`]} />
                    <Bar dataKey="kg" name="kg en stock" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Daily movements chart */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Flux de stock (30 jours)</CardTitle></CardHeader>
          <CardContent>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={mv?.daily} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="inGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 9 }} interval={6} />
                  <YAxis tick={{ fontSize: 9 }} unit=" kg" width={50} />
                  <Tooltip />
                  <Area type="monotone" dataKey="in" name="Entrées (kg)" stroke="#22c55e" fill="url(#inGrad)" strokeWidth={2} />
                  <Line type="monotone" dataKey="out" name="Sorties (kg)" stroke="#ef4444" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
