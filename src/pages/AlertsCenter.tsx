import { useAuthContext } from '@/contexts/AuthContext';
import { canRead } from '@/lib/apiAccess';
import { useTranslation } from 'react-i18next';
import { AlertAnalyticsPanel, FactoryAlertsCenter, TraceabilityTimeline } from '@/components/alerts';
import { AlertsDashboard } from '@/components/batches/AlertsDashboard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Bell, BoxIcon, Clock, BarChart2 } from 'lucide-react';

/** Every alert in one place: the shell's Alertes tab and the /alerts route show the same thing. */
const AlertsCenter = ({ embedded = false }: { embedded?: boolean }) => {
  const { t } = useTranslation();
  const { roles } = useAuthContext();
  const canAudit = canRead(roles, 'auditLogs');
  
  return (
    <div className={embedded ? 'space-y-4' : 'container mx-auto space-y-4 py-6'}>
      <Tabs defaultValue="alerts" className="w-full">
        <TabsList className="flex flex-wrap gap-1">
          <TabsTrigger value="alerts" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            {t('alerts.realtimeAlerts')}
          </TabsTrigger>
          <TabsTrigger value="stock" className="flex items-center gap-2">
            <BoxIcon className="h-4 w-4" />
            Stock et DLC
          </TabsTrigger>
          {canAudit && <TabsTrigger value="traceability" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            {t('alerts.traceability')}
          </TabsTrigger>}
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <BarChart2 className="h-4 w-4" />
            {t('alerts.analytics', { defaultValue: 'Analytiques' })}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="alerts" className="mt-4">
          <FactoryAlertsCenter />
        </TabsContent>

        <TabsContent value="stock" className="mt-4">
          <AlertsDashboard />
        </TabsContent>

        <TabsContent value="traceability" className="mt-4">
          <TraceabilityTimeline maxHeight="700px" />
        </TabsContent>

        <TabsContent value="analytics" className="mt-4">
          <AlertAnalyticsPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AlertsCenter;
