import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  TrendingUp, 
  TrendingDown, 
  Package, 
  Factory, 
  CheckCircle, 
  AlertTriangle,
  Truck,
  Boxes,
  Scale,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Percent
} from 'lucide-react';
import { 
  useReceptionAnalytics, 
  useProductionAnalytics, 
  useQualityAnalytics, 
  useStockAnalytics 
} from '@/hooks/useAnalytics';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line, Area, AreaChart } from 'recharts';

interface OverviewPanelProps {
  period: 'week' | 'month' | 'quarter';
}

export const OverviewPanel = ({ period }: OverviewPanelProps) => {
  const { data: receptionData, isLoading: recLoading } = useReceptionAnalytics(period);
  const { data: productionData, isLoading: prodLoading } = useProductionAnalytics(period);
  const { data: qualityData, isLoading: qualLoading } = useQualityAnalytics(period);
  const { data: stockData, isLoading: stockLoading } = useStockAnalytics();

  const isLoading = recLoading || prodLoading || qualLoading || stockLoading;

  if (isLoading) {
    return (
      <div className="grid gap-6 animate-pulse">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="h-20 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const kpiCards = [
    {
      title: 'Réceptions',
      value: receptionData?.stats.totalReceptions || 0,
      subtitle: `${(receptionData?.stats.totalQuantity || 0).toLocaleString('fr-FR')} kg`,
      icon: Truck,
      color: 'text-blue-500',
      bg: 'bg-blue-500/10',
      trend: receptionData?.stats.acceptanceRate || 0,
      trendLabel: 'Taux acceptation'
    },
    {
      title: 'Production',
      value: productionData?.stats.completedOrders || 0,
      subtitle: `${productionData?.stats.inProgressOrders || 0} en cours`,
      icon: Factory,
      color: 'text-amber-500',
      bg: 'bg-amber-500/10',
      trend: productionData?.stats.yieldRate || 0,
      trendLabel: 'Rendement'
    },
    {
      title: 'Qualité',
      value: `${(qualityData?.stats.passRate || 0).toFixed(0)}%`,
      subtitle: `${qualityData?.stats.totalInspections || 0} inspections`,
      icon: CheckCircle,
      color: 'text-emerald-500',
      bg: 'bg-emerald-500/10',
      trend: qualityData?.stats.passRate || 0,
      trendLabel: 'Conformité'
    },
    {
      title: 'Stock Total',
      value: `${((stockData?.stats.totalStockKg || 0) / 1000).toFixed(1)}T`,
      subtitle: `${stockData?.stats.expiringLots || 0} lots à surveiller`,
      icon: Boxes,
      color: 'text-purple-500',
      bg: 'bg-purple-500/10',
      trend: stockData?.stats.zoneOccupancyAvg || 0,
      trendLabel: 'Occupation zones'
    }
  ];

  // Chart colors
  const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))'];

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpiCards.map((kpi) => (
          <Card key={kpi.title} className="relative overflow-hidden">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{kpi.title}</p>
                  <p className="text-3xl font-bold mt-1">{kpi.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{kpi.subtitle}</p>
                </div>
                <div className={`p-3 rounded-xl ${kpi.bg}`}>
                  <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
                </div>
              </div>
              <div className="flex items-center gap-2 mt-4 pt-4 border-t">
                <div className={`flex items-center gap-1 text-xs ${kpi.trend >= 80 ? 'text-emerald-600' : kpi.trend >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                  {kpi.trend >= 80 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                  {kpi.trend.toFixed(1)}%
                </div>
                <span className="text-xs text-muted-foreground">{kpi.trendLabel}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Reception Trend */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-blue-500" />
              Tendance des Réceptions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={receptionData?.dailyTrend || []}>
                  <defs>
                    <linearGradient id="colorQuantity" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--background))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }} 
                  />
                  <Area 
                    type="monotone" 
                    dataKey="quantity" 
                    stroke="hsl(var(--chart-1))" 
                    fillOpacity={1} 
                    fill="url(#colorQuantity)" 
                    name="Quantité (kg)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Stock Distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="h-4 w-4 text-purple-500" />
              Répartition du Stock
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stockData?.stockByCategory || []}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="quantity"
                    nameKey="category"
                  >
                    {stockData?.stockByCategory?.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number) => [`${value.toLocaleString('fr-FR')} kg`, '']}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--background))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quality Distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-emerald-500" />
              Qualité par Grade
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {qualityData?.gradeDistribution?.map((grade, index) => (
                <div key={grade.grade} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span>{grade.grade}</span>
                    <span className="font-medium">{grade.count} lots</span>
                  </div>
                  <Progress 
                    value={grade.percentage} 
                    className="h-2"
                    style={{ 
                      '--progress-color': COLORS[index % COLORS.length] 
                    } as React.CSSProperties}
                  />
                </div>
              ))}
              {(!qualityData?.gradeDistribution || qualityData.gradeDistribution.length === 0) && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Aucune donnée disponible
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Zone Occupancy */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Scale className="h-4 w-4 text-amber-500" />
              Occupation des Zones de Stockage
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stockData?.zoneOccupancy?.slice(0, 8) || []} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <YAxis dataKey="zone" type="category" width={80} tick={{ fontSize: 11 }} />
                  <Tooltip 
                    formatter={(value: number) => [`${value}%`, 'Occupation']}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--background))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Bar 
                    dataKey="occupancy" 
                    fill="hsl(var(--chart-2))" 
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alerts Summary */}
      {(stockData?.stats.lowStockAlerts || 0) > 0 || (stockData?.stats.expiringLots || 0) > 0 ? (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <div className="flex-1">
                <p className="font-medium text-amber-800">Alertes actives</p>
                <p className="text-sm text-amber-700">
                  {stockData?.stats.lowStockAlerts || 0} alertes stock bas • {stockData?.stats.expiringLots || 0} lots proches péremption
                </p>
              </div>
              <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300">
                {(stockData?.stats.lowStockAlerts || 0) + (stockData?.stats.expiringLots || 0)} total
              </Badge>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
};
