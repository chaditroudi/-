import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  CheckCircle,
  XCircle,
  AlertTriangle,
  Target,
  Shield,
  Award,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Droplets,
  ThermometerSun,
  AlertCircle,
  PieChart as PieChartIcon
} from 'lucide-react';
import { useAdvancedQualityAnalytics } from '@/hooks/useAdvancedAnalytics';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  AreaChart, Area, ComposedChart, Line 
} from 'recharts';
import { KPI_THRESHOLDS, getKPIStatus, KPI_STATUS_COLORS, KPI_STATUS_BG } from '@/types/analytics';

interface AdvancedQualityPanelProps {
  period: 'week' | 'month' | 'quarter';
}

export const AdvancedQualityPanel = ({ period }: AdvancedQualityPanelProps) => {
  const { data, isLoading } = useAdvancedQualityAnalytics(period);

  if (isLoading) {
    return (
      <div className="grid gap-6 animate-pulse">
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
  const passRateStatus = getKPIStatus(kpis?.passRate || 0, KPI_THRESHOLDS.passRate);
  const rejectRateStatus = getKPIStatus(kpis?.rejectRate || 0, KPI_THRESHOLDS.rejectRate, false);

  return (
    <div className="space-y-6">
      {/* Main KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* Pass Rate - Main KPI */}
        <Card className="col-span-2 md:col-span-1">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-xl ${KPI_STATUS_BG[passRateStatus]}`}>
                <Award className={`h-6 w-6 ${KPI_STATUS_COLORS[passRateStatus]}`} />
              </div>
              <div>
                <p className="text-3xl font-bold">{(kpis?.passRate || 0).toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground">Taux Conformité</p>
              </div>
            </div>
            <div className="mt-3">
              <Progress value={kpis?.passRate || 0} className="h-2" />
              <p className="text-xs text-muted-foreground mt-1">Cible: 95%</p>
            </div>
          </CardContent>
        </Card>

        {/* Total Inspections */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Target className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{kpis?.totalInspections || 0}</p>
                <p className="text-xs text-muted-foreground">Inspections</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Passed */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <CheckCircle className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{kpis?.passedInspections || 0}</p>
                <p className="text-xs text-muted-foreground">Conformes</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Reject Rate */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${KPI_STATUS_BG[rejectRateStatus]}`}>
                <XCircle className={`h-5 w-5 ${KPI_STATUS_COLORS[rejectRateStatus]}`} />
              </div>
              <div>
                <p className={`text-2xl font-bold ${KPI_STATUS_COLORS[rejectRateStatus]}`}>
                  {(kpis?.rejectRate || 0).toFixed(1)}%
                </p>
                <p className="text-xs text-muted-foreground">Taux Rejet</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Non-conformities */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{kpis?.totalNonConformities || 0}</p>
                <p className="text-xs text-muted-foreground">NC Total</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Critical NC */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${(kpis?.criticalNonConformities || 0) > 0 ? 'bg-red-500/10' : 'bg-emerald-500/10'}`}>
                <Shield className={`h-5 w-5 ${(kpis?.criticalNonConformities || 0) > 0 ? 'text-red-500' : 'text-emerald-500'}`} />
              </div>
              <div>
                <p className={`text-2xl font-bold ${(kpis?.criticalNonConformities || 0) > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                  {kpis?.criticalNonConformities || 0}
                </p>
                <p className="text-xs text-muted-foreground">NC Critiques</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quality Trend */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Évolution du Taux de Conformité
            </CardTitle>
            <CardDescription>Tendance quotidienne</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data?.qualityTrend?.filter(d => d.inspections > 0) || []}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 10 }} domain={[0, 'auto']} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--background))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Legend />
                  <Bar yAxisId="left" dataKey="passed" fill="hsl(var(--chart-3))" name="Conformes" stackId="stack" />
                  <Bar yAxisId="left" dataKey="failed" fill="hsl(var(--destructive))" name="Rejets" stackId="stack" />
                  <Line 
                    yAxisId="right" 
                    type="monotone" 
                    dataKey="passRate" 
                    stroke="hsl(var(--chart-4))" 
                    name="Taux (%)"
                    strokeWidth={2}
                    dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Grade Distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <PieChartIcon className="h-4 w-4 text-amber-500" />
              Répartition par Grade
            </CardTitle>
            <CardDescription>Distribution qualité des lots</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              {data?.gradeDistribution && data.gradeDistribution.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.gradeDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={90}
                      paddingAngle={2}
                      dataKey="count"
                      nameKey="label"
                    >
                      {data.gradeDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: number, name: string, props: { payload: Record<string, number> }) => [
                        `${value} lots (${props.payload.percentage.toFixed(1)}%)`,
                        ''
                      ]}
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--background))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  Aucune donnée disponible
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Loss Analysis & Supplier Quality */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Loss Pareto */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-500" />
              Analyse Pareto des Pertes
            </CardTitle>
            <CardDescription>Classification des types de pertes</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data?.lossBreakdown || []} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `${v} kg`} />
                  <YAxis dataKey="label" type="category" width={120} tick={{ fontSize: 10 }} />
                  <Tooltip 
                    formatter={(value: number, name: string, props: { payload: Record<string, number> }) => [
                      `${value} kg (${props.payload.percentage.toFixed(1)}%) - ${props.payload.costEstimate.toLocaleString('fr-FR')} TND`,
                      ''
                    ]}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--background))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Bar dataKey="quantityKg" radius={[0, 4, 4, 0]}>
                    {data?.lossBreakdown?.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Quality Summary */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Résumé Qualité</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Pass/Fail Summary */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-center">
                <CheckCircle className="h-8 w-8 mx-auto text-emerald-500 mb-2" />
                <p className="text-2xl font-bold text-emerald-600">{kpis?.passedInspections || 0}</p>
                <p className="text-xs text-muted-foreground">Inspections Conformes</p>
              </div>
              <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 text-center">
                <XCircle className="h-8 w-8 mx-auto text-red-500 mb-2" />
                <p className="text-2xl font-bold text-red-600">{kpis?.failedInspections || 0}</p>
                <p className="text-xs text-muted-foreground">Inspections Rejetées</p>
              </div>
            </div>

            {/* Grade Summary */}
            <div className="space-y-3">
              <p className="text-sm font-medium">Distribution par Grade</p>
              {data?.gradeDistribution?.slice(0, 4).map((grade) => (
                <div key={grade.label} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: grade.color }}
                      />
                      <span>{grade.label}</span>
                    </div>
                    <span className="font-medium">{grade.count} ({grade.percentage.toFixed(1)}%)</span>
                  </div>
                  <Progress value={grade.percentage} className="h-1.5" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Supplier Quality Table */}
      {data?.supplierQuality && data.supplierQuality.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              Performance Qualité par Fournisseur
            </CardTitle>
            <CardDescription>Analyse des réceptions par origine</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fournisseur</TableHead>
                  <TableHead className="text-right">Réceptions</TableHead>
                  <TableHead className="text-right">Quantité (kg)</TableHead>
                  <TableHead className="text-right">Tendance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.supplierQuality.slice(0, 5).map((supplier) => (
                  <TableRow key={supplier.supplierId}>
                    <TableCell className="font-medium">{supplier.supplierName}</TableCell>
                    <TableCell className="text-right">{supplier.totalReceptions}</TableCell>
                    <TableCell className="text-right">{supplier.totalQuantityKg.toLocaleString('fr-FR')}</TableCell>
                    <TableCell className="text-right">
                      <Badge 
                        variant={supplier.trend === 'up' ? 'default' : supplier.trend === 'down' ? 'destructive' : 'secondary'}
                      >
                        {supplier.trend === 'up' ? <TrendingUp className="h-3 w-3 mr-1" /> : 
                         supplier.trend === 'down' ? <TrendingDown className="h-3 w-3 mr-1" /> : null}
                        {supplier.trend === 'up' ? 'Hausse' : supplier.trend === 'down' ? 'Baisse' : 'Stable'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

