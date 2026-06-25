import { useTranslation } from 'react-i18next';
import { AlertAnalyticsPanel, FactoryAlertsCenter, TraceabilityTimeline } from '@/components/alerts';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Bell, Clock, BarChart2 } from 'lucide-react';

const AlertsCenter = () => {
  const { t } = useTranslation();
  
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('alerts.title')}</h1>
          <p className="text-muted-foreground">{t('alerts.realtimeMonitoring')}</p>
        </div>
      </div>
      
      <Tabs defaultValue="alerts" className="w-full">
        <TabsList className="grid w-full max-w-lg grid-cols-3">
          <TabsTrigger value="alerts" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            {t('alerts.realtimeAlerts')}
          </TabsTrigger>
          <TabsTrigger value="traceability" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            {t('alerts.traceability')}
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <BarChart2 className="h-4 w-4" />
            {t('alerts.analytics', { defaultValue: 'Analytiques' })}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="alerts" className="mt-6">
          <FactoryAlertsCenter />
        </TabsContent>

        <TabsContent value="traceability" className="mt-6">
          <TraceabilityTimeline maxHeight="700px" />
        </TabsContent>

        <TabsContent value="analytics" className="mt-6">
          <AlertAnalyticsPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AlertsCenter;
