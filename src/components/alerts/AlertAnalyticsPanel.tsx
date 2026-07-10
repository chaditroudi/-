import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useNotificationStats } from '@/hooks/useNotifications';
import {
  Activity,
  AlertTriangle,
  Bell,
  CheckCircle,
  Clock,
  FileText,
  TrendingDown,
  TrendingUp,
  XCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const CATEGORY_COLORS: Record<string, string> = {
  RECEPTION: 'bg-purple-500',
  PRODUCTION: 'bg-blue-500',
  QUALITY: 'bg-orange-500',
  STOCK: 'bg-cyan-500',
  SYSTEM: 'bg-gray-500',
  PURCHASING: 'bg-green-500',
};

const SEVERITY_META = {
  error: { label: 'Critique', color: 'bg-red-500', text: 'text-red-600', Icon: XCircle },
  warning: { label: 'Avertissement', color: 'bg-orange-500', text: 'text-orange-600', Icon: AlertTriangle },
  info: { label: 'Information', color: 'bg-blue-500', text: 'text-blue-600', Icon: Bell },
  success: { label: 'Succès', color: 'bg-green-500', text: 'text-green-600', Icon: CheckCircle },
} as const;

export const AlertAnalyticsPanel = () => {
  const { t } = useTranslation();
  const { data: stats, isLoading } = useNotificationStats();

  if (isLoading || !stats) {
    return (
      <div className="grid gap-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6 h-24" />
          </Card>
        ))}
      </div>
    );
  }

  const totalSeverity = Object.values(stats.bySeverity).reduce((a, b) => a + b, 0) || 1;
  const totalCategory = Object.values(stats.byCategory).reduce((a, b) => a + b, 0) || 1;

  return (
    <div className="space-y-4">
      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-blue-100">
                <Bell className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">{t('alerts.totalAlerts', { defaultValue: 'Total alertes' })}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={cn(stats.last24h > 0 && 'border-amber-400')}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-amber-100">
                <Activity className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-600">{stats.last24h}</p>
                <p className="text-xs text-muted-foreground">{t('alerts.last24h', { defaultValue: 'Dernières 24h' })}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-green-100">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600">{stats.resolutionRate}%</p>
                <p className="text-xs text-muted-foreground">{t('alerts.resolutionRate', { defaultValue: 'Taux résolution' })}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-purple-100">
                <Clock className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-purple-600">
                  {stats.avgAckTimeMinutes != null ? `${stats.avgAckTimeMinutes}m` : '—'}
                </p>
                <p className="text-xs text-muted-foreground">{t('alerts.avgAckTime', { defaultValue: 'Délai moy. acquittement' })}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Severity breakdown */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              {t('alerts.severityBreakdown', { defaultValue: 'Répartition par sévérité (24h)' })}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(Object.entries(stats.bySeverity) as [keyof typeof SEVERITY_META, number][]).map(([sev, count]) => {
              const meta = SEVERITY_META[sev];
              const pct = Math.round((count / totalSeverity) * 100);
              return (
                <div key={sev} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <meta.Icon className={cn('h-3.5 w-3.5', meta.text)} />
                      <span>{meta.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={cn('font-bold', meta.text)}>{count}</span>
                      <Badge variant="outline" className="text-[11px] px-1">{pct}%</Badge>
                    </div>
                  </div>
                  <Progress value={pct} className="h-1.5" />
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Category breakdown */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileText className="h-4 w-4" />
              {t('alerts.categoryBreakdown', { defaultValue: 'Répartition par catégorie (24h)' })}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.keys(stats.byCategory).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                {t('alerts.noAlertsLast24h', { defaultValue: 'Aucune alerte dans les dernières 24h' })}
              </p>
            ) : (
              Object.entries(stats.byCategory)
                .sort(([, a], [, b]) => b - a)
                .map(([cat, count]) => {
                  const pct = Math.round((count / totalCategory) * 100);
                  const color = CATEGORY_COLORS[cat] || 'bg-gray-400';
                  return (
                    <div key={cat} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span className={cn('w-2 h-2 rounded-full', color)} />
                          <span>{cat}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold">{count}</span>
                          <Badge variant="outline" className="text-[11px] px-1">{pct}%</Badge>
                        </div>
                      </div>
                      <Progress value={pct} className="h-1.5" />
                    </div>
                  );
                })
            )}
          </CardContent>
        </Card>
      </div>

      {/* Resolution & audit summary */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingDown className="h-4 w-4" />
            {t('alerts.operationalHealth', { defaultValue: 'Santé opérationnelle' })}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span>{t('alerts.alertsRead', { defaultValue: 'Alertes acquittées' })}</span>
              <span className="font-semibold">{stats.resolutionRate}%</span>
            </div>
            <Progress value={stats.resolutionRate} className="h-2" />
          </div>
          <div className="grid grid-cols-3 gap-4 pt-2 border-t text-center">
            <div>
              <p className="text-xl font-bold">{stats.unread}</p>
              <p className="text-xs text-muted-foreground">{t('alerts.unread', { defaultValue: 'Non lues' })}</p>
            </div>
            <div>
              <p className="text-xl font-bold text-blue-600">{stats.auditLogsLast24h}</p>
              <p className="text-xs text-muted-foreground">{t('alerts.auditEvents24h', { defaultValue: 'Événements audit (24h)' })}</p>
            </div>
            <div>
              <p className="text-xl font-bold text-amber-600">{stats.bySeverity.error + stats.bySeverity.warning}</p>
              <p className="text-xs text-muted-foreground">{t('alerts.criticalWarning', { defaultValue: 'Critiques + Avert.' })}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
