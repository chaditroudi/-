import { canRead } from '@/lib/apiAccess';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Activity, Factory, CheckCircle, Boxes, DollarSign, Crown, Shield } from 'lucide-react';
import { ExecutiveDashboard } from './ExecutiveDashboard';
import { AdvancedProductionPanel } from './AdvancedProductionPanel';
import { AdvancedQualityPanel } from './AdvancedQualityPanel';
import { AdvancedStockPanel } from './AdvancedStockPanel';
import { AdvancedCostPanel } from './AdvancedCostPanel';
import { FounderAnalyticsDashboard } from './FounderAnalyticsDashboard';
import { ModuleHero } from '@/components/layout/ModuleHero';
import { useAuthContext } from '@/contexts/AuthContext';

type Period = 'week' | 'month' | 'quarter';

export const AnalyticsDashboard = () => {
  const { t } = useTranslation();
  const { hasAnyRole, roles } = useAuthContext();
  const [period, setPeriod] = useState<Period>('month');
  const [activeTab, setActiveTab] = useState('direction');

  const allowed = {
    production: canRead(roles, 'productionOrders'),
    quality: canRead(roles, 'receptions') && canRead(roles, 'stageLots'),
    stock: canRead(roles, 'stockLots'),
    costs: canRead(roles, 'costing'),
    direction: canRead(roles, 'productionOrders') && canRead(roles, 'receptions') && canRead(roles, 'stageLots') && canRead(roles, 'stockLots') && canRead(roles, 'costing'),
  };
  const visibleTab = allowed[activeTab as keyof typeof allowed] ? activeTab : Object.keys(allowed).find(key => allowed[key as keyof typeof allowed]);
  const isFounder = hasAnyRole(['directeur_general', 'administrateur_systeme', 'directeur_usine']);

  const periodLabels: Record<Period, string> = {
    week: t('common.thisWeek'),
    month: t('common.thisMonth'),
    quarter: t('analytics.trends')
  };

  if (isFounder) {
    return (
      <div className="space-y-4">
        <ModuleHero
          kicker="Direction"
          title="Vue de l’usine"
          description="Indicateurs issus des opérations enregistrées. La source et la période accompagnent les données."

        />
        <FounderAnalyticsDashboard />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ModuleHero
        kicker="Pilotage • Analytics"
        title={t('analytics.title')}
        description={t('analytics.overview')}
        stats={[
          { label: 'Période', value: periodLabels[period] },
          { label: 'Vue', value: activeTab },
        ]}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
          <div className="flex gap-1 rounded-lg border bg-muted/40 p-1">
            {([
              { value: 'week', label: t('common.thisWeek') },
              { value: 'month', label: t('common.thisMonth') },
              { value: 'quarter', label: t('analytics.trends') },
            ] as { value: Period; label: string }[]).map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setPeriod(value)}
                className={`rounded-xl px-4 py-1.5 text-xs font-semibold transition-all ${
                  period === value
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <Badge variant="outline" className="flex w-full items-center justify-center rounded-full px-4 py-2 sm:w-auto">
            <Activity className="h-3 w-3 me-2 text-emerald-500 animate-pulse" />
            {t('common.status')}
          </Badge>
        </div>
      </div>

      <Tabs value={visibleTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="flex w-full justify-start gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:w-auto lg:overflow-visible">
          {allowed.direction && <TabsTrigger value="direction" className="shrink-0 gap-2">
            <Crown className="h-4 w-4" />
            <span className="hidden sm:inline">{t('analytics.executive')}</span>
          </TabsTrigger>}
          {allowed.production && <TabsTrigger value="production" className="shrink-0 gap-2">
            <Factory className="h-4 w-4" />
            <span className="hidden sm:inline">{t('nav.production')}</span>
          </TabsTrigger>}
          {allowed.quality && <TabsTrigger value="quality" className="shrink-0 gap-2">
            <CheckCircle className="h-4 w-4" />
            <span className="hidden sm:inline">{t('nav.quality')}</span>
          </TabsTrigger>}
          {allowed.stock && <TabsTrigger value="stock" className="shrink-0 gap-2">
            <Boxes className="h-4 w-4" />
            <span className="hidden sm:inline">{t('nav.stock')}</span>
          </TabsTrigger>}
          {allowed.costs && <TabsTrigger value="costs" className="shrink-0 gap-2">
            <DollarSign className="h-4 w-4" />
            <span className="hidden sm:inline">{t('analytics.costs')}</span>
          </TabsTrigger>}
        </TabsList>

        <TabsContent value="direction"><ExecutiveDashboard period={period} /></TabsContent>
        <TabsContent value="production"><AdvancedProductionPanel period={period} /></TabsContent>
        <TabsContent value="quality"><AdvancedQualityPanel period={period} /></TabsContent>
        <TabsContent value="stock"><AdvancedStockPanel /></TabsContent>
        <TabsContent value="costs"><AdvancedCostPanel period={period} /></TabsContent>
      </Tabs>
    </div>
  );
};
