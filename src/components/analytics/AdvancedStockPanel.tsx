import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Package,
  Boxes,
  Factory,
  ShoppingCart,
  AlertTriangle,
  Clock,
  MapPin,
  TrendingUp,
  Calendar,
  CheckCircle,
  XCircle,
  RotateCcw,
  Gauge
} from 'lucide-react';
import { useAdvancedStockAnalytics } from '@/hooks/useAdvancedAnalytics';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, 
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  RadialBarChart, RadialBar
} from 'recharts';
import { KPI_THRESHOLDS, getKPIStatus, KPI_STATUS_COLORS, KPI_STATUS_BG } from '@/types/analytics';

export const AdvancedStockPanel = () => {
  const { data, isLoading } = useAdvancedStockAnalytics();

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
  const occupancyStatus = getKPIStatus(kpis?.avgZoneOccupancy || 0, KPI_THRESHOLDS.zoneOccupancy, false);
  const fifoStatus = getKPIStatus(kpis?.fifoCompliance || 0, KPI_THRESHOLDS.fifoCompliance);

  const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))'];

  const categoryData = [
    { name: 'Matières Premières', value: kpis?.rawMaterialsKg || 0, icon: Package, color: COLORS[0] },
    { name: 'En-cours (WIP)', value: kpis?.wipKg || 0, icon: Factory, color: COLORS[1] },
    { name: 'Produits Finis', value: kpis?.finishedProductsKg || 0, icon: ShoppingCart, color: COLORS[2] },
    { name: 'Emballages', value: kpis?.packagingKg || 0, icon: Boxes, color: COLORS[3] }
  ];

  return (
    <div className="space-y-6">
      {/* Main KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* Total Stock */}
        <Card className="col-span-2 md:col-span-1">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-primary/10">
                <Boxes className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-3xl font-bold">{((kpis?.totalStockKg || 0) / 1000).toFixed(1)}T</p>
                <p className="text-xs text-muted-foreground">Stock Total</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Raw Materials */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Package className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{((kpis?.rawMaterialsKg || 0) / 1000).toFixed(1)}T</p>
                <p className="text-xs text-muted-foreground">Matières 1ères</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Coverage Days */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Calendar className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{kpis?.rawMaterialCoverageDays || 0}j</p>
                <p className="text-xs text-muted-foreground">Couverture MP</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* FIFO Compliance */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${KPI_STATUS_BG[fifoStatus]}`}>
                <RotateCcw className={`h-5 w-5 ${KPI_STATUS_COLORS[fifoStatus]}`} />
              </div>
              <div>
                <p className={`text-2xl font-bold ${KPI_STATUS_COLORS[fifoStatus]}`}>
                  {(kpis?.fifoCompliance || 0).toFixed(0)}%
                </p>
                <p className="text-xs text-muted-foreground">Respect FIFO</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Expiring Lots */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${(kpis?.expiringLots || 0) > 0 ? 'bg-orange-500/10' : 'bg-emerald-500/10'}`}>
                <Clock className={`h-5 w-5 ${(kpis?.expiringLots || 0) > 0 ? 'text-orange-500' : 'text-emerald-500'}`} />
              </div>
              <div>
                <p className={`text-2xl font-bold ${(kpis?.expiringLots || 0) > 0 ? 'text-orange-600' : 'text-emerald-600'}`}>
                  {kpis?.expiringLots || 0}
                </p>
                <p className="text-xs text-muted-foreground">Lots à surveiller</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quarantine */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${(kpis?.quarantineKg || 0) > 0 ? 'bg-red-500/10' : 'bg-emerald-500/10'}`}>
                <AlertTriangle className={`h-5 w-5 ${(kpis?.quarantineKg || 0) > 0 ? 'text-red-500' : 'text-emerald-500'}`} />
              </div>
              <div>
                <p className={`text-2xl font-bold ${(kpis?.quarantineKg || 0) > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                  {((kpis?.quarantineKg || 0) / 1000).toFixed(2)}T
                </p>
                <p className="text-xs text-muted-foreground">Quarantaine</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Stock by Category */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="h-4 w-4 text-primary" />
              Répartition par Catégorie
            </CardTitle>
            <CardDescription>Distribution du stock</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData.filter(c => c.value > 0)}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    nameKey="name"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number) => [`${(value / 1000).toFixed(2)} T`, '']}
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

        {/* Zone Occupancy */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="h-4 w-4 text-amber-500" />
              Occupation des Zones
            </CardTitle>
            <CardDescription>Capacité par emplacement</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[320px]">
              {data?.zoneOccupancy && data.zoneOccupancy.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.zoneOccupancy.slice(0, 8)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}%`} />
                    <YAxis dataKey="zone" type="category" width={80} tick={{ fontSize: 10 }} />
                    <Tooltip 
                      formatter={(value: number, name: string, props: { payload: Record<string, number> }) => [
                        `${value}% (${(props.payload.current / 1000).toFixed(1)}T / ${(props.payload.capacity / 1000).toFixed(1)}T)`,
                        'Occupation'
                      ]}
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--background))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Bar dataKey="occupancy" radius={[0, 4, 4, 0]}>
                      {data.zoneOccupancy.slice(0, 8).map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={
                            entry.occupancy > 90 ? 'hsl(var(--destructive))' : 
                            entry.occupancy > 70 ? 'hsl(45, 93%, 47%)' : 
                            'hsl(142, 76%, 36%)'
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  Aucune zone configurée
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stock Aging & Category Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Stock Aging */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-orange-500" />
              Vieillissement du Stock
            </CardTitle>
            <CardDescription>Analyse par durée de stockage</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data?.stockAging?.map((aging) => (
                <div key={aging.range} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: aging.color }}
                      />
                      <span className="text-sm font-medium">{aging.label}</span>
                      <Badge 
                        variant={aging.riskLevel === 'high' ? 'destructive' : aging.riskLevel === 'medium' ? 'secondary' : 'outline'}
                        className="text-xs"
                      >
                        {aging.riskLevel === 'high' ? 'Risque élevé' : aging.riskLevel === 'medium' ? 'À surveiller' : 'OK'}
                      </Badge>
                    </div>
                    <span className="font-bold">{(aging.quantityKg / 1000).toFixed(2)} T</span>
                  </div>
                  <Progress value={aging.percentage} className="h-2" />
                  <p className="text-xs text-muted-foreground text-right">{aging.percentage.toFixed(1)}% du stock</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Category Details */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Détail par Catégorie</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              {categoryData.map((cat, index) => (
                <div 
                  key={cat.name}
                  className="p-4 rounded-lg border hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div 
                      className="p-2 rounded-lg"
                      style={{ backgroundColor: `${cat.color}20` }}
                    >
                      <cat.icon className="h-4 w-4" style={{ color: cat.color }} />
                    </div>
                    <span className="font-medium text-sm">{cat.name}</span>
                  </div>
                  <p className="text-2xl font-bold">{(cat.value / 1000).toFixed(2)} T</p>
                  <p className="text-xs text-muted-foreground">
                    {kpis?.totalStockKg ? ((cat.value / kpis.totalStockKg) * 100).toFixed(1) : 0}% du total
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alerts */}
      {((kpis?.lowStockAlerts || 0) > 0 || (kpis?.expiringLots || 0) > 0 || (kpis?.overstockAlerts || 0) > 0) && (
        <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <AlertTriangle className="h-6 w-6 text-amber-600" />
              <div className="flex-1">
                <p className="font-semibold text-amber-800 dark:text-amber-200">Alertes Stock</p>
                <div className="flex flex-wrap gap-3 mt-2">
                  {(kpis?.lowStockAlerts || 0) > 0 && (
                    <Badge variant="destructive">
                      {kpis?.lowStockAlerts} alertes stock bas
                    </Badge>
                  )}
                  {(kpis?.overstockAlerts || 0) > 0 && (
                    <Badge variant="outline" className="bg-purple-100 text-purple-700 border-purple-300">
                      {kpis?.overstockAlerts} alertes surstock
                    </Badge>
                  )}
                  {(kpis?.expiringLots || 0) > 0 && (
                    <Badge variant="outline" className="bg-orange-100 text-orange-700 border-orange-300">
                      {kpis?.expiringLots} lots proches péremption
                    </Badge>
                  )}
                  {(kpis?.quarantineKg || 0) > 0 && (
                    <Badge variant="outline" className="bg-red-100 text-red-700 border-red-300">
                      {(kpis.quarantineKg / 1000).toFixed(1)}T en quarantaine
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

