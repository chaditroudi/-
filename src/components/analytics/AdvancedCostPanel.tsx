import { formatMeasurement } from '@/lib/analyticsPresentation';
import { DataState } from '@/components/shared/DataState';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  DollarSign,
  TrendingUp,
  TrendingDown,
  Target,
  Zap,
  Users,
  Wrench,
  Package,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  PieChart as PieChartIcon
} from 'lucide-react';
import { useAdvancedCostAnalytics } from '@/hooks/useAdvancedAnalytics';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, 
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  ComposedChart, Line, Area
} from 'recharts';

interface AdvancedCostPanelProps {
  period: 'week' | 'month' | 'quarter';
}

export const AdvancedCostPanel = ({ period }: AdvancedCostPanelProps) => {
  const source = useAdvancedCostAnalytics(period);
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
  const hasProduction = (data?.totalProduced ?? 0) > 0;
  const isOverBudget = hasProduction && (kpis?.costVariancePercent || 0) > 0;
  const basisLabel = data?.basis === 'standard' ? 'Coûts standards (paramètres site)' : 'Coûts';


  const costPerTonData = [
    { name: 'Main-d\'œuvre', value: kpis?.laborCostPerTon || 0, icon: Users, color: 'hsl(var(--chart-1))' },
    { name: 'Énergie', value: kpis?.energyCostPerTon || 0, icon: Zap, color: 'hsl(var(--chart-2))' },
    { name: 'Matières', value: kpis?.materialCostPerTon || 0, icon: Package, color: 'hsl(var(--chart-3))' },
    { name: 'Frais généraux', value: kpis?.overheadCostPerTon || 0, icon: BarChart3, color: 'hsl(var(--chart-4))' }
  ];

  return (
    <DataState source={{ ...source, updatedAt: source.dataUpdatedAt }} data={data} what="les indicateurs">
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{basisLabel}</p>
        <Badge variant="outline">base standard</Badge>
      </div>
      {/* Main KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* Cost per Kg - Main KPI */}
        <Card className="col-span-2 md:col-span-1">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-xl bg-muted`}>
                <DollarSign className={`h-6 w-6 text-muted-foreground`} />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatMeasurement(kpis?.costPerKg, hasProduction, '', 2)}</p>
                <p className="text-xs text-muted-foreground">TND/kg</p>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Paramètre site : {kpis?.targetCostPerKg || 0} TND</span>
              <Badge variant="outline">
                {hasProduction && (isOverBudget ? <ArrowUpRight className="h-3 w-3 mr-1" /> : <ArrowDownRight className="h-3 w-3 mr-1" />)}
                {formatMeasurement(kpis ? Math.abs(kpis.costVariancePercent) : undefined, hasProduction, "%")}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Labor Cost */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Users className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatMeasurement(kpis?.laborCostPerTon, hasProduction, '', 0)}</p>
                <p className="text-xs text-muted-foreground">TND/Tonne MO</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Energy Cost */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Zap className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatMeasurement(kpis?.energyCostPerTon, hasProduction, '', 0)}</p>
                <p className="text-xs text-muted-foreground">TND/Tonne Énergie</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Loss Value */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/10">
                <AlertTriangle className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{((kpis?.lossValue || 0) / 1000).toFixed(1)}k</p>
                <p className="text-xs text-muted-foreground">TND Pertes</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Maintenance Cost */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <Wrench className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">Non mesuré</p>
                <p className="text-xs text-muted-foreground">TND Maintenance</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Loss % */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-500/10">
                <TrendingDown className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">Non mesuré</p>
                <p className="text-xs text-muted-foreground">Pertes/Revenu</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Cost Breakdown Pie */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <PieChartIcon className="h-4 w-4 text-primary" />
              Décomposition des Coûts
            </CardTitle>
            <CardDescription>Répartition par catégorie</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data?.costBreakdown || []}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="amount"
                    nameKey="label"
                  >
                    {data?.costBreakdown?.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number, name: string, props: { payload: Record<string, number> }) => [
                      `${value.toLocaleString('fr-FR')} TND (${props.payload.percentage.toFixed(1)}%)`,
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
            </div>
          </CardContent>
        </Card>

        {/* Cost Breakdown Bar */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              Coûts par Catégorie
            </CardTitle>
            <CardDescription>Montants et tendances</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data?.costBreakdown || []} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                  <YAxis dataKey="label" type="category" width={100} tick={{ fontSize: 10 }} />
                  <Tooltip 
                    formatter={(value: number) => [`${value.toLocaleString('fr-FR')} TND`, '']}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--background))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Bar dataKey="amount" radius={[0, 4, 4, 0]}>
                    {data?.costBreakdown?.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cost per Ton Details & Variance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Cost per Ton by Category */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Coût par Tonne - Détail</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {costPerTonData.map((item) => (
                <div key={item.name} className="flex items-center gap-4">
                  <div 
                    className="p-2 rounded-lg"
                    style={{ backgroundColor: `${item.color}20` }}
                  >
                    <item.icon className="h-5 w-5" style={{ color: item.color }} />
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-medium">{item.name}</span>
                      <span className="font-bold">{formatMeasurement(item.value, hasProduction, " TND/t", 0)}</span>
                    </div>
                    <Progress hidden={!hasProduction}
                      value={(item.value / (kpis?.materialCostPerTon || 1)) * 100} 
                      className="h-2" 
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Cost Variance Analysis */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Analyse des Écarts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Main Variance */}
            <div className={`p-4 rounded-lg bg-muted`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Écart standard / paramètre site</span>
                <Badge variant="outline" className="text-lg px-3 py-1">
                  {isOverBudget ? '+' : ''}{formatMeasurement(kpis?.costVariancePercent, hasProduction, "%")}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div>
                  <p className="text-xs text-muted-foreground">Coût standard calculé</p>
                  <p className="text-xl font-bold">{formatMeasurement(kpis?.costPerKg, hasProduction, '', 2)} TND/kg</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Objectif</p>
                  <p className="text-xl font-bold">{(kpis?.targetCostPerKg || 0).toFixed(2)} TND/kg</p>
                </div>
              </div>
            </div>

<p className="text-sm text-muted-foreground">Tendances non mesurées : aucune période de comparaison fournie.</p>
          </CardContent>
        </Card>
      </div>

      {/* Efficiency Alert */}
      {isOverBudget && (
        <Card className="border-border bg-muted/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <AlertTriangle className="h-6 w-6 text-red-600" />
              <div className="flex-1">
                <p className="font-semibold text-red-800 dark:text-red-200">Écart du modèle standard</p>
                <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                  Le coût standard calculé dépasse la référence du modèle de {formatMeasurement(kpis ? Math.abs(kpis.costVariancePercent) : undefined, hasProduction, "%")}.
                  La comparaison repose sur les paramètres standards ; les coûts réels restent à établir.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
    </DataState>
  );
};

