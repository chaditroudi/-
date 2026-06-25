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
  const { data, isLoading } = useAdvancedCostAnalytics(period);

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
  const isOverBudget = (kpis?.costVariancePercent || 0) > 0;

  const costPerTonData = [
    { name: 'Main-d\'œuvre', value: kpis?.laborCostPerTon || 0, icon: Users, color: 'hsl(var(--chart-1))' },
    { name: 'Énergie', value: kpis?.energyCostPerTon || 0, icon: Zap, color: 'hsl(var(--chart-2))' },
    { name: 'Matières', value: kpis?.materialCostPerTon || 0, icon: Package, color: 'hsl(var(--chart-3))' },
    { name: 'Frais généraux', value: kpis?.overheadCostPerTon || 0, icon: BarChart3, color: 'hsl(var(--chart-4))' }
  ];

  return (
    <div className="space-y-6">
      {/* Main KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* Cost per Kg - Main KPI */}
        <Card className="col-span-2 md:col-span-1">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-xl ${isOverBudget ? 'bg-red-500/10' : 'bg-emerald-500/10'}`}>
                <DollarSign className={`h-6 w-6 ${isOverBudget ? 'text-red-500' : 'text-emerald-500'}`} />
              </div>
              <div>
                <p className="text-3xl font-bold">{(kpis?.costPerKg || 0).toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">TND/kg</p>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Cible: {kpis?.targetCostPerKg || 0} TND</span>
              <Badge variant={isOverBudget ? 'destructive' : 'default'}>
                {isOverBudget ? <ArrowUpRight className="h-3 w-3 mr-1" /> : <ArrowDownRight className="h-3 w-3 mr-1" />}
                {Math.abs(kpis?.costVariancePercent || 0).toFixed(1)}%
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
                <p className="text-2xl font-bold">{(kpis?.laborCostPerTon || 0).toFixed(0)}</p>
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
                <p className="text-2xl font-bold">{(kpis?.energyCostPerTon || 0).toFixed(0)}</p>
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
                <p className="text-2xl font-bold">{((kpis?.maintenanceCost || 0) / 1000).toFixed(1)}k</p>
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
                <p className="text-2xl font-bold">{(kpis?.lossPercentOfRevenue || 0).toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground">Pertes/Revenu</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                      <span className="font-bold">{item.value.toFixed(0)} TND/T</span>
                    </div>
                    <Progress 
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
          <CardContent className="space-y-6">
            {/* Main Variance */}
            <div className={`p-4 rounded-lg ${isOverBudget ? 'bg-red-50 dark:bg-red-900/20' : 'bg-emerald-50 dark:bg-emerald-900/20'}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Écart Coût vs Objectif</span>
                <Badge variant={isOverBudget ? 'destructive' : 'default'} className="text-lg px-3 py-1">
                  {isOverBudget ? '+' : ''}{(kpis?.costVariancePercent || 0).toFixed(1)}%
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div>
                  <p className="text-xs text-muted-foreground">Coût Réel</p>
                  <p className="text-xl font-bold">{(kpis?.costPerKg || 0).toFixed(2)} TND/kg</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Objectif</p>
                  <p className="text-xl font-bold">{(kpis?.targetCostPerKg || 0).toFixed(2)} TND/kg</p>
                </div>
              </div>
            </div>

            {/* Trend Indicators */}
            <div className="space-y-3">
              <p className="text-sm font-medium">Tendances par Catégorie</p>
              {data?.costBreakdown?.slice(0, 4).map((item) => (
                <div key={item.label} className="flex items-center justify-between">
                  <span className="text-sm">{item.label}</span>
                  <Badge 
                    variant={item.trend > 0 ? 'destructive' : item.trend < 0 ? 'default' : 'secondary'}
                  >
                    {item.trend > 0 ? <TrendingUp className="h-3 w-3 mr-1" /> : 
                     item.trend < 0 ? <TrendingDown className="h-3 w-3 mr-1" /> : null}
                    {item.trend > 0 ? '+' : ''}{item.trend.toFixed(1)}%
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Efficiency Alert */}
      {isOverBudget && (
        <Card className="border-red-200 bg-red-50/50 dark:bg-red-950/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <AlertTriangle className="h-6 w-6 text-red-600" />
              <div className="flex-1">
                <p className="font-semibold text-red-800 dark:text-red-200">Alerte Dépassement Budget</p>
                <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                  Le coût de production actuel dépasse l'objectif de {Math.abs(kpis?.costVariancePercent || 0).toFixed(1)}%. 
                  Analysez les postes Main-d'œuvre et Énergie pour identifier les opportunités d'optimisation.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

