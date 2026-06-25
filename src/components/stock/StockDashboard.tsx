import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useStockSummary, useStockAlerts } from '@/hooks/useStock';
import { useModule3StorageZones } from '@/hooks/useStorageModule3';
import { 
  Package, 
  Factory, 
  ShoppingCart, 
  Box,
  AlertTriangle,
  TrendingUp,
  Thermometer,
  Droplets
} from 'lucide-react';
import { productCategoryLabels, productCategoryColors, ProductCategory } from '@/types/stock';
import { ModuleHero } from '@/components/layout/ModuleHero';

export const StockDashboard = () => {
  const { t } = useTranslation();
  const { data: summary } = useStockSummary();
  const { data: zones = [] } = useModule3StorageZones();
  const { data: alerts = [] } = useStockAlerts('active');

  const categoryIcons: Record<ProductCategory, React.ReactNode> = {
    MP: <Package className="h-5 w-5" />,
    WIP: <Factory className="h-5 w-5" />,
    PF: <ShoppingCart className="h-5 w-5" />,
    EMB: <Box className="h-5 w-5" />
  };

  const categories: ProductCategory[] = ['MP', 'WIP', 'PF', 'EMB'];

  return (
    <div className="space-y-6">
      <ModuleHero
        kicker="Stock • Occupation & vigilance"
        title="Vision simple du stock et des zones"
        description="Cette page doit aider les equipes a voir tout de suite les categories chargees, les alertes de stock et les zones qui approchent de la saturation."
        stats={[
          { label: 'Alertes', value: alerts.length },
          { label: 'Zones', value: zones.length },
          { label: 'Catégories', value: categories.length },
        ]}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {categories.map(cat => {
          const data = summary?.[cat] || { total: 0, inQuarantine: 0, alertsMin: 0, alertsSecurity: 0 };
          const hasAlerts = data.alertsMin > 0 || data.alertsSecurity > 0;
          
          return (
            <Card key={cat} className={`metric-tile ${hasAlerts ? 'border-orange-300 bg-orange-50' : ''}`}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {productCategoryLabels[cat]}
                </CardTitle>
                <div className={`p-2 rounded-full ${productCategoryColors[cat]} text-white`}>
                  {categoryIcons[cat]}
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {data.total.toLocaleString()} kg
                </div>
                <div className="flex items-center gap-2 mt-2">
                  {data.inQuarantine > 0 && (
                    <Badge variant="outline" className="bg-yellow-100 text-yellow-800">
                      {data.inQuarantine.toLocaleString()} kg {t('receptions.status.quarantine').toLowerCase()}
                    </Badge>
                  )}
                </div>
                {hasAlerts && (
                  <div className="flex items-center gap-1 mt-2 text-sm text-orange-600">
                    <AlertTriangle className="h-4 w-4" />
                    {data.alertsMin > 0 && <span>{data.alertsMin} {t('stock.minStock').toLowerCase()}</span>}
                    {data.alertsSecurity > 0 && <span>{data.alertsSecurity} {t('alerts.severity.critical').toLowerCase()}</span>}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Alertes actives */}
      {alerts.length > 0 && (
        <Card className="surface-card border-red-200 bg-red-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2 text-red-700">
              <AlertTriangle className="h-5 w-5" />
              {t('alerts.active')} ({alerts.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {alerts.slice(0, 5).map(alert => (
                <div key={alert.id} className="flex items-center justify-between p-2 bg-white rounded border">
                  <div>
                    <p className="font-medium">{alert.title}</p>
                    <p className="text-sm text-muted-foreground">{alert.message}</p>
                  </div>
                  <Badge 
                    variant={alert.severity === 'critical' ? 'destructive' : 'secondary'}
                  >
                    {t(`alerts.severity.${alert.severity}`)}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Occupation physique des zones */}
      <Card className="surface-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Zones physiques de stockage
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {zones.map(zone => {
              const capacityPalettes = Number(zone.capacity_palettes || 0);
              const currentPalettes = Number(zone.current_load_palettes || 0);
              const capacityKg = Number(zone.capacity_kg || 0);
              const currentKg = Number(zone.current_load_kg || 0);
              const occupancy = capacityPalettes > 0
                ? Math.min(100, Math.round((currentPalettes / capacityPalettes) * 1000) / 10)
                : capacityKg > 0
                  ? Math.min(100, Math.round((currentKg / capacityKg) * 1000) / 10)
                  : 0;
              const isOverloaded = occupancy > 90;
              const isHigh = occupancy > 70;
              const badgeClass =
                zone.storage_family === 'cold' ? 'bg-sky-600' :
                zone.storage_family === 'fumigation' ? 'bg-purple-600' :
                zone.storage_family === 'export' ? 'bg-emerald-600' :
                'bg-slate-700';
              
              return (
                <div 
                  key={zone.id} 
                  className={`rounded-2xl border p-4 shadow-sm ${
                    isOverloaded ? 'border-red-300 bg-red-50' :
                    isHigh ? 'border-orange-300 bg-orange-50' :
                    'border-gray-200 bg-white'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-medium">{zone.code}</p>
                      <p className="text-sm text-muted-foreground">{zone.name}</p>
                    </div>
                    <Badge className={`${badgeClass} text-white`}>
                      {zone.storage_family || zone.zone_type}
                    </Badge>
                  </div>
                  
                  <Progress 
                    value={occupancy} 
                    className={`h-2 ${
                      isOverloaded ? '[&>div]:bg-red-500' :
                      isHigh ? '[&>div]:bg-orange-500' :
                      ''
                    }`}
                  />
                  
                  <div className="flex justify-between items-center mt-2 text-sm">
                    <span>
                      {currentPalettes.toLocaleString('fr-FR')} / {capacityPalettes.toLocaleString('fr-FR')} pal.
                    </span>
                    <span className="font-medium">{occupancy}%</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {currentKg.toLocaleString('fr-FR')} / {capacityKg.toLocaleString('fr-FR')} kg
                  </p>
                  
                  {/* Conditions */}
                  <div className="flex gap-3 mt-2 text-xs text-muted-foreground">
                    {(zone.temperature_min !== null || zone.temperature_max !== null) && (
                      <span className="flex items-center gap-1">
                        <Thermometer className="h-3 w-3 text-blue-500" />
                        {zone.temperature_min ?? '-'} / {zone.temperature_max ?? '-'}°C
                      </span>
                    )}
                    {zone.humidity_max !== null && (
                      <span className="flex items-center gap-1">
                        <Droplets className="h-3 w-3 text-cyan-500" />
                        max {zone.humidity_max}%
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
