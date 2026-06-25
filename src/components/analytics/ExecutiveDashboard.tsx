import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  TrendingUp, 
  TrendingDown, 
  Factory, 
  CheckCircle, 
  AlertTriangle,
  Boxes,
  DollarSign,
  Target,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  Activity,
  Zap,
  Shield
} from 'lucide-react';
import { useExecutiveDashboard } from '@/hooks/useAdvancedAnalytics';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend, AreaChart, Area, RadialBarChart, RadialBar 
} from 'recharts';
import { KPI_THRESHOLDS, getKPIStatus, KPI_STATUS_COLORS, KPI_STATUS_BG } from '@/types/analytics';

// Modern tooltip style
const modernTooltipStyle = {
  backgroundColor: 'rgba(255, 255, 255, 0.95)',
  backdropFilter: 'blur(8px)',
  border: 'none',
  borderRadius: '12px',
  boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
  padding: '12px 16px',
  fontSize: '13px'
};

interface ExecutiveDashboardProps {
  period: 'week' | 'month' | 'quarter';
}

export const ExecutiveDashboard = ({ period }: ExecutiveDashboardProps) => {
  const { production, quality, stock, cost, isLoading } = useExecutiveDashboard(period);

  if (isLoading) {
    return (
      <div className="grid gap-6 animate-pulse">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="h-24 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

  // Key Performance Indicators
  const kpiCards = [
    {
      title: 'Rendement Production',
      value: `${(production?.kpis.yieldRate || 0).toFixed(1)}%`,
      target: '90%',
      icon: Factory,
      status: getKPIStatus(production?.kpis.yieldRate || 0, KPI_THRESHOLDS.yieldRate),
      trend: production?.kpis.variancePercent || 0,
      subtitle: `${((production?.kpis.totalActual || 0) / 1000).toFixed(1)}T produites`
    },
    {
      title: 'Taux Conformité QC',
      value: `${(quality?.kpis.passRate || 0).toFixed(1)}%`,
      target: '95%',
      icon: CheckCircle,
      status: getKPIStatus(quality?.kpis.passRate || 0, KPI_THRESHOLDS.passRate),
      trend: 0,
      subtitle: `${quality?.kpis.totalInspections || 0} inspections`
    },
    {
      title: 'Taux de Rejet',
      value: `${(quality?.kpis.rejectRate || 0).toFixed(1)}%`,
      target: '<5%',
      icon: AlertTriangle,
      status: getKPIStatus(quality?.kpis.rejectRate || 0, KPI_THRESHOLDS.rejectRate, false),
      trend: -(quality?.kpis.rejectRate || 0),
      subtitle: `${quality?.kpis.failedInspections || 0} rejets`
    },
    {
      title: 'Stock Total',
      value: `${((stock?.kpis.totalStockKg || 0) / 1000).toFixed(1)}T`,
      target: '-',
      icon: Boxes,
      status: 'optimal' as const,
      trend: 0,
      subtitle: `${stock?.kpis.rawMaterialCoverageDays || 0}j couverture MP`
    },
    {
      title: 'Coût/kg',
      value: `${(cost?.kpis.costPerKg || 0).toFixed(2)} TND`,
      target: `${cost?.kpis.targetCostPerKg || 0} TND`,
      icon: DollarSign,
      status: (cost?.kpis.costVariancePercent || 0) <= 0 ? 'optimal' as const : 
              (cost?.kpis.costVariancePercent || 0) <= 10 ? 'warning' as const : 'critical' as const,
      trend: cost?.kpis.costVariancePercent || 0,
      subtitle: 'vs objectif'
    },
    {
      title: 'Ordres Terminés',
      value: production?.kpis.ordersCompleted || 0,
      target: `${production?.kpis.ordersTotal || 0} total`,
      icon: Target,
      status: 'optimal' as const,
      trend: production?.kpis.ordersTotal ? ((production?.kpis.ordersCompleted || 0) / production?.kpis.ordersTotal) * 100 : 0,
      subtitle: `${production?.kpis.ordersInProgress || 0} en cours`
    },
    {
      title: 'Non-conformités',
      value: quality?.kpis.totalNonConformities || 0,
      target: '0',
      icon: Shield,
      status: (quality?.kpis.criticalNonConformities || 0) > 0 ? 'critical' as const : 
              (quality?.kpis.totalNonConformities || 0) > 5 ? 'warning' as const : 'optimal' as const,
      trend: 0,
      subtitle: `${quality?.kpis.criticalNonConformities || 0} critiques`
    },
    {
      title: 'Occupation Zones',
      value: `${(stock?.kpis.avgZoneOccupancy || 0).toFixed(0)}%`,
      target: '<80%',
      icon: BarChart3,
      status: getKPIStatus(stock?.kpis.avgZoneOccupancy || 0, KPI_THRESHOLDS.zoneOccupancy, false),
      trend: 0,
      subtitle: `${stock?.kpis.expiringLots || 0} lots à surveiller`
    }
  ];

  return (
    <div className="space-y-6">
      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpiCards.map((kpi) => (
          <Card key={kpi.title} className="relative overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-2">
                <div className={`p-2 rounded-lg ${KPI_STATUS_BG[kpi.status]}`}>
                  <kpi.icon className={`h-4 w-4 ${KPI_STATUS_COLORS[kpi.status]}`} />
                </div>
                {kpi.trend !== 0 && (
                  <Badge 
                    variant="outline" 
                    className={kpi.trend > 0 ? 'text-emerald-600 border-emerald-200' : 'text-red-600 border-red-200'}
                  >
                    {kpi.trend > 0 ? <ArrowUpRight className="h-3 w-3 mr-1" /> : <ArrowDownRight className="h-3 w-3 mr-1" />}
                    {Math.abs(kpi.trend).toFixed(1)}%
                  </Badge>
                )}
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{kpi.title}</p>
                <p className="text-2xl font-bold mt-1">{kpi.value}</p>
                <div className="flex items-center justify-between mt-2 text-xs">
                  <span className="text-muted-foreground">{kpi.subtitle}</span>
                  <span className={KPI_STATUS_COLORS[kpi.status]}>Cible: {kpi.target}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Production vs Planned */}
        <Card className="overflow-hidden border-0 shadow-lg bg-gradient-to-br from-background to-muted/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-primary/10">
                <Factory className="h-4 w-4 text-primary" />
              </div>
              Production: Planifié vs Réel
            </CardTitle>
            <CardDescription>Évolution quotidienne</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={production?.dailyTrend || []}>
                  <defs>
                    <linearGradient id="colorPlanned" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(221, 83%, 53%)" stopOpacity={0.4}/>
                      <stop offset="100%" stopColor="hsl(221, 83%, 53%)" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0.4}/>
                      <stop offset="100%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0}/>
                    </linearGradient>
                    <filter id="glow">
                      <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                      <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
                    </filter>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} vertical={false} />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} 
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis 
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} 
                    tickFormatter={(v) => `${(v/1000).toFixed(0)}T`}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip 
                    formatter={(value: number) => [`${value.toLocaleString('fr-FR')} kg`, '']}
                    contentStyle={modernTooltipStyle}
                    cursor={{ stroke: 'hsl(var(--primary))', strokeWidth: 1, strokeDasharray: '5 5' }}
                  />
                  <Legend 
                    wrapperStyle={{ paddingTop: '20px' }}
                    formatter={(value) => <span className="text-sm font-medium">{value}</span>}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="planned" 
                    stroke="hsl(221, 83%, 53%)" 
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#colorPlanned)"
                    name="Planifié"
                    dot={false}
                    activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="actual" 
                    stroke="hsl(142, 76%, 36%)" 
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#colorActual)"
                    name="Réel"
                    dot={false}
                    activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff', filter: 'url(#glow)' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Cost Breakdown */}
        <Card className="overflow-hidden border-0 shadow-lg bg-gradient-to-br from-background to-muted/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-emerald-500/10">
                <DollarSign className="h-4 w-4 text-emerald-500" />
              </div>
              Décomposition des Coûts
            </CardTitle>
            <CardDescription>Répartition par catégorie</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <defs>
                    {cost?.costBreakdown?.map((entry, index) => (
                      <linearGradient key={`gradient-${index}`} id={`pieGradient-${index}`} x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor={entry.color} stopOpacity={1}/>
                        <stop offset="100%" stopColor={entry.color} stopOpacity={0.7}/>
                      </linearGradient>
                    ))}
                    <filter id="pieShadow" x="-20%" y="-20%" width="140%" height="140%">
                      <feDropShadow dx="0" dy="4" stdDeviation="4" floodOpacity="0.15"/>
                    </filter>
                  </defs>
                  <Pie
                    data={cost?.costBreakdown || []}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={95}
                    paddingAngle={3}
                    dataKey="amount"
                    nameKey="label"
                    cornerRadius={6}
                    filter="url(#pieShadow)"
                  >
                    {cost?.costBreakdown?.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={`url(#pieGradient-${index})`}
                        stroke="rgba(255,255,255,0.5)"
                        strokeWidth={2}
                      />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number) => [`${value.toLocaleString('fr-FR')} TND`, '']}
                    contentStyle={modernTooltipStyle}
                  />
                  <Legend 
                    formatter={(value) => <span className="text-sm">{value}</span>}
                    wrapperStyle={{ paddingTop: '10px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quality Trend */}
        <Card className="overflow-hidden border-0 shadow-lg bg-gradient-to-br from-background to-emerald-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-emerald-500/10">
                <CheckCircle className="h-4 w-4 text-emerald-500" />
              </div>
              Tendance Qualité
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={quality?.qualityTrend?.filter(d => d.inspections > 0) || []}>
                  <defs>
                    <linearGradient id="qualityGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0.3}/>
                      <stop offset="100%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.3} vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} domain={[0, 100]} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={modernTooltipStyle} />
                  <Area 
                    type="monotone" 
                    dataKey="passRate" 
                    stroke="hsl(142, 76%, 36%)" 
                    strokeWidth={2.5}
                    fill="url(#qualityGradient)"
                    name="Taux conformité (%)"
                    dot={false}
                    activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Grade Distribution */}
        <Card className="overflow-hidden border-0 shadow-lg bg-gradient-to-br from-background to-amber-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-amber-500/10">
                <Target className="h-4 w-4 text-amber-500" />
              </div>
              Répartition par Grade
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {quality?.gradeDistribution?.slice(0, 5).map((grade, index) => (
                <div key={grade.label} className="space-y-1.5 group">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full ring-2 ring-offset-2 ring-offset-background transition-transform group-hover:scale-125" 
                        style={{ backgroundColor: grade.color, boxShadow: `0 0 8px ${grade.color}40` }}
                      />
                      <span className="font-medium">{grade.label}</span>
                    </div>
                    <span className="font-bold tabular-nums">{grade.count} lots</span>
                  </div>
                  <div className="relative h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
                      style={{ 
                        width: `${grade.percentage}%`, 
                        background: `linear-gradient(90deg, ${grade.color}, ${grade.color}99)`,
                        boxShadow: `0 0 10px ${grade.color}40`
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Downtime Breakdown */}
        <Card className="overflow-hidden border-0 shadow-lg bg-gradient-to-br from-background to-red-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-red-500/10">
                <Zap className="h-4 w-4 text-red-500" />
              </div>
              Analyse des Arrêts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={production?.downtimeBreakdown || []} layout="vertical">
                  <defs>
                    {production?.downtimeBreakdown?.map((entry, index) => (
                      <linearGradient key={`bar-gradient-${index}`} id={`barGradient-${index}`} x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor={entry.color} stopOpacity={0.8}/>
                        <stop offset="100%" stopColor={entry.color} stopOpacity={1}/>
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.3} horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <YAxis dataKey="label" type="category" width={100} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <Tooltip 
                    formatter={(value: number) => [`${value}h`, '']}
                    contentStyle={modernTooltipStyle}
                    cursor={{ fill: 'hsl(var(--muted))', opacity: 0.3 }}
                  />
                  <Bar dataKey="hours" radius={[0, 8, 8, 0]} barSize={20}>
                    {production?.downtimeBreakdown?.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={`url(#barGradient-${index})`} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alerts Summary */}
      {((stock?.kpis.lowStockAlerts || 0) > 0 || 
        (quality?.kpis.criticalNonConformities || 0) > 0 || 
        (stock?.kpis.expiringLots || 0) > 0) && (
        <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <AlertTriangle className="h-6 w-6 text-amber-600" />
              <div className="flex-1">
                <p className="font-semibold text-amber-800 dark:text-amber-200">Alertes Direction</p>
                <div className="flex flex-wrap gap-3 mt-2">
                  {(quality?.kpis.criticalNonConformities || 0) > 0 && (
                    <Badge variant="destructive">
                      {quality?.kpis.criticalNonConformities} NC critiques
                    </Badge>
                  )}
                  {(stock?.kpis.lowStockAlerts || 0) > 0 && (
                    <Badge variant="outline" className="bg-red-100 text-red-700 border-red-300">
                      {stock?.kpis.lowStockAlerts} alertes stock bas
                    </Badge>
                  )}
                  {(stock?.kpis.expiringLots || 0) > 0 && (
                    <Badge variant="outline" className="bg-orange-100 text-orange-700 border-orange-300">
                      {stock?.kpis.expiringLots} lots proches péremption
                    </Badge>
                  )}
                </div>
              </div>
              <Badge className="bg-amber-600">
                {(quality?.kpis.criticalNonConformities || 0) + 
                 (stock?.kpis.lowStockAlerts || 0) + 
                 (stock?.kpis.expiringLots || 0)} total
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
