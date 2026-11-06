import { formatMeasurement } from '@/lib/analyticsPresentation';
import { DataState } from '@/components/shared/DataState';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Factory,
  TrendingUp,
  TrendingDown,
  Target,
  Clock,
  Zap,
  Users,
  Gauge,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import { useAdvancedProductionAnalytics } from '@/hooks/useAdvancedAnalytics';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, Legend, AreaChart, Area, PieChart, Pie, Cell,
  ComposedChart, ReferenceLine
} from 'recharts';
import { KPI_THRESHOLDS, getKPIStatus, KPI_STATUS_COLORS, KPI_STATUS_BG } from '@/types/analytics';

interface AdvancedProductionPanelProps {
  period: 'week' | 'month' | 'quarter';
}

export const AdvancedProductionPanel = ({ period }: AdvancedProductionPanelProps) => {
  const source = useAdvancedProductionAnalytics(period);
  const { data, isLoading } = source;
  if (!data && !isLoading) return <DataState source={source} data={data} what="les indicateurs">{null}</DataState>;

  if (isLoading) {
    return (
      <div className="grid gap-4 animate-pulse">
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="h-48 bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const kpis = data?.kpis;
  const yieldMeasured = kpis?.yieldRate != null && data?.measurement?.mass !== false;
  const yieldStatus = yieldMeasured
    ? getKPIStatus(kpis.yieldRate, KPI_THRESHOLDS.yieldRate)
    : 'warning';

  return (
    <DataState source={{ ...source, updatedAt: source.dataUpdatedAt }} data={data} what="les indicateurs">
    <div className="space-y-4">
      {/* Main KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* Yield Rate - Main KPI */}
        <Card className="col-span-2 md:col-span-1">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-xl bg-muted`}>
                <Gauge className={`h-6 w-6 text-muted-foreground`} />
              </div>
              <div>
                <p className="text-2xl font-bold">{yieldMeasured ? `${kpis.yieldRate.toFixed(1)}%` : '—'}</p>
                <p className="text-xs text-muted-foreground">Rendement</p>
              </div>
            </div>
            <div className="mt-3">
              <Progress value={yieldMeasured ? kpis.yieldRate : 0} className="h-2" />
              <p className="text-xs text-muted-foreground mt-1">{yieldMeasured ? 'Cible: 90%' : 'Non mesuré'}</p>
            </div>
          </CardContent>
        </Card>

        {/* Ordres Total */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Factory className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{kpis?.ordersTotal || 0}</p>
                <p className="text-xs text-muted-foreground">Ordres total</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Terminés */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <CheckCircle className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{kpis?.ordersCompleted || 0}</p>
                <p className="text-xs text-muted-foreground">Terminés</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quantité Produite */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <Target className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatMeasurement(kpis ? kpis.totalActual / 1000 : undefined, data?.measurement.output, " t")}</p>
                <p className="text-xs text-muted-foreground">Produit</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Variance */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg bg-muted`}>
                <Target className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className={`text-2xl font-bold text-foreground`}>
                  {formatMeasurement(kpis?.variancePercent, data?.measurement.plan && data?.measurement.output, "%")}
                </p>
                <p className="text-xs text-muted-foreground">Écart plan</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pertes */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <AlertCircle className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatMeasurement(kpis?.wasteRate, data?.measurement.mass, "%")}</p>
                <p className="text-xs text-muted-foreground">Taux pertes</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Production vs Planned Trend */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              Production: Planifié vs Réel
            </CardTitle>
            <CardDescription>Suivi quotidien de la production</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data?.dailyTrend.map(day => ({ ...day, actual: data.measurement.output ? day.actual : null })) || []}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v/1000).toFixed(0)}T`} />
                  <Tooltip 
                    formatter={(value: number) => [`${value.toLocaleString('fr-FR')} kg`, '']}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--background))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px'
                    }}
                  />
                  <Legend />
                  <Bar dataKey="planned" fill="hsl(var(--chart-1))" name="Planifié" opacity={0.6} />
                  <Bar dataKey="actual" fill="hsl(var(--chart-3))" name="Réel" />
                  <Line type="monotone" dataKey="completed" stroke="hsl(var(--chart-4))" name="Ordres terminés" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Downtime Pareto */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="h-4 w-4 text-red-500" />
              Analyse Pareto des Arrêts
            </CardTitle>
            <CardDescription>Classification des temps d'arrêt</CardDescription>
          </CardHeader>
          <CardContent>
<p className="py-12 text-center text-sm text-muted-foreground">Arrêts non mesurés. Les estimations existantes ne constituent pas des relevés d’arrêt.</p>
          </CardContent>
        </Card>
      </div>

      {/* Status Distribution & Performance Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Order Status Distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Répartition par Statut</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4">
              <div className="text-center p-4 rounded-lg bg-gray-50 dark:bg-gray-900">
                <p className="text-2xl font-bold text-gray-600">{kpis?.ordersDraft || 0}</p>
                <p className="text-xs text-muted-foreground">Brouillons</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20">
                <p className="text-2xl font-bold text-amber-600">{kpis?.ordersInProgress || 0}</p>
                <p className="text-xs text-muted-foreground">En cours</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-emerald-50 dark:bg-emerald-900/20">
                <p className="text-2xl font-bold text-emerald-600">{kpis?.ordersCompleted || 0}</p>
                <p className="text-xs text-muted-foreground">Terminés</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-red-50 dark:bg-red-900/20">
                <p className="text-2xl font-bold text-red-600">{kpis?.ordersCancelled || 0}</p>
                <p className="text-xs text-muted-foreground">Annulés</p>
              </div>
            </div>
            
            <div className="mt-6 space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Taux de complétion</span>
                  <span className="font-semibold">
                    {formatMeasurement(kpis?.ordersTotal ? kpis.ordersCompleted / kpis.ordersTotal * 100 : undefined, !!kpis?.ordersTotal, "%")}
                  </span>
                </div>
                <Progress 
                  value={kpis?.ordersTotal ? ((kpis?.ordersCompleted || 0) / kpis.ordersTotal * 100) : 0} 
                  className="h-2" 
                />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Rendement global</span>
                  <span className={`font-semibold ${KPI_STATUS_COLORS[yieldStatus]}`}>
                    {yieldMeasured ? `${kpis.yieldRate.toFixed(1)}%` : 'Non mesuré'}
                  </span>
                </div>
                <Progress value={yieldMeasured ? kpis.yieldRate : 0} className="h-2" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Volume Summary */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Bilan des Volumes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-lg border">
                  <div className="flex items-center gap-2 mb-2">
                    <Target className="h-4 w-4 text-blue-500" />
                    <span className="text-sm text-muted-foreground">Objectif</span>
                  </div>
                  <p className="text-2xl font-bold">{((kpis?.totalPlanned || 0) / 1000).toFixed(2)} T</p>
                </div>
                <div className="p-4 rounded-lg border">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                    <span className="text-sm text-muted-foreground">Réalisé</span>
                  </div>
                  <p className="text-2xl font-bold">{formatMeasurement(kpis ? kpis.totalActual / 1000 : undefined, data?.measurement.output, " t", 2)}</p>
                </div>
              </div>

              <div className="p-4 rounded-lg bg-muted/50">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Écart Planifié/Réel</p>
                    <p className={`text-xl font-bold text-foreground`}>
                      {data?.measurement.output && data?.measurement.plan ? `${(kpis.totalActual - kpis.totalPlanned).toLocaleString("fr-FR")} kg` : "Non mesuré"}
                    </p>
                  </div>
                  <Badge 
                    variant="outline"
                    className="text-lg px-3 py-1"
                  >
                    {formatMeasurement(kpis?.variancePercent, data?.measurement.plan && data?.measurement.output, "%")}
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
    </DataState>
  );
};

