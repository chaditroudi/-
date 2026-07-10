import {
  usePhase2ActiveAlerts,
  usePhase2AllAlerts,
  useAcknowledgePhase2Alert,
  useAcknowledgeAllPhase2Alerts,
  usePhase2AlertKpis,
  formatSla,
  type Phase2Notification,
} from '@/hooks/usePhase2Alerts';
import { PHASE2_ALERT_CATALOG, Phase2AlertCode, Phase2AlertLevel } from '@/types/phase2';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertTriangle, Bell, BellOff, CheckCheck, Clock, Loader2, ShieldAlert } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useCallback, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';

const LEVEL_ICON: Record<Phase2AlertLevel, typeof AlertTriangle> = {
  URGENCE: ShieldAlert,
  CRITIQUE: AlertTriangle,
  IMPORTANT: AlertTriangle,
  PREVENTIF: Bell,
};

const LEVEL_BADGE: Record<Phase2AlertLevel, string> = {
  URGENCE: 'border-red-200 bg-red-600 text-white',
  CRITIQUE: 'border-red-200 bg-red-50 text-red-700',
  IMPORTANT: 'border-amber-200 bg-amber-50 text-amber-700',
  PREVENTIF: 'border-yellow-200 bg-yellow-50 text-yellow-700',
};

const LEVEL_ROW: Record<Phase2AlertLevel, string> = {
  URGENCE: 'border-red-200 bg-red-50/70',
  CRITIQUE: 'border-red-100 bg-red-50/40',
  IMPORTANT: 'border-amber-100 bg-amber-50/50',
  PREVENTIF: 'border-yellow-100 bg-yellow-50/40',
};

const LEVEL_ICON_BOX: Record<Phase2AlertLevel, string> = {
  URGENCE: 'bg-red-100 text-red-700',
  CRITIQUE: 'bg-red-50 text-red-600',
  IMPORTANT: 'bg-amber-50 text-amber-600',
  PREVENTIF: 'bg-yellow-50 text-yellow-600',
};

const LEVEL_ORDER: Record<Phase2AlertLevel, number> = {
  URGENCE: 0,
  CRITIQUE: 1,
  IMPORTANT: 2,
  PREVENTIF: 3,
};

const MODULE_FILTER_OPTIONS = ['Tous', 'Fumigation', 'Nettoyage', 'Hydratation', 'Triage', 'Conditionnement', 'Global'] as const;
type ModuleFilter = typeof MODULE_FILTER_OPTIONS[number];

type AlertListItem = Phase2Notification;

export function Phase2AlertsPanel() {
  const { data: activeAlerts = [], isLoading: loadingActive } = usePhase2ActiveAlerts();
  const { data: allAlerts = [], isLoading: loadingAll } = usePhase2AllAlerts();
  const acknowledge = useAcknowledgePhase2Alert();
  const acknowledgeAll = useAcknowledgeAllPhase2Alerts();
  const kpis = usePhase2AlertKpis();
  const [moduleFilter, setModuleFilter] = useState<ModuleFilter>('Tous');

  const filterByModule = useCallback((alerts: AlertListItem[]) =>
    moduleFilter === 'Tous'
      ? alerts
      : alerts.filter((alert) => PHASE2_ALERT_CATALOG[alert.notification_type as Phase2AlertCode]?.module === moduleFilter),
  [moduleFilter]);

  const sortAlerts = useCallback((alerts: AlertListItem[]) =>
    [...alerts].sort((left, right) => {
      const leftLevel = PHASE2_ALERT_CATALOG[left.notification_type as Phase2AlertCode]?.level ?? 'PREVENTIF';
      const rightLevel = PHASE2_ALERT_CATALOG[right.notification_type as Phase2AlertCode]?.level ?? 'PREVENTIF';
      const levelDiff = LEVEL_ORDER[leftLevel] - LEVEL_ORDER[rightLevel];
      if (levelDiff !== 0) return levelDiff;
      return new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
    }), []);

  const filteredActive = useMemo(
    () => sortAlerts(filterByModule(activeAlerts)),
    [activeAlerts, filterByModule, sortAlerts],
  );

  const filteredAcknowledged = useMemo(
    () => sortAlerts(filterByModule(allAlerts.filter((alert) => alert.is_read))).slice(0, 50),
    [allAlerts, filterByModule, sortAlerts],
  );

  const highestLevel = filteredActive[0]
    ? PHASE2_ALERT_CATALOG[filteredActive[0].notification_type as Phase2AlertCode]?.level ?? null
    : null;

  const summaryTitle =
    kpis.urgence > 0
      ? `${kpis.urgence} urgence${kpis.urgence > 1 ? 's' : ''} a traiter maintenant`
      : kpis.critique > 0
        ? `${kpis.critique} alerte${kpis.critique > 1 ? 's' : ''} critique${kpis.critique > 1 ? 's' : ''} en attente`
        : kpis.total > 0
          ? `${kpis.total} alerte${kpis.total > 1 ? 's' : ''} active${kpis.total > 1 ? 's' : ''}`
          : 'Aucune alerte active';

  const summaryBody =
    kpis.total > 0
      ? 'Traitez les urgences et les critiques en premier, puis acquittez les alertes resolues.'
      : 'La ligne Phase 2 est actuellement stable. Les nouvelles alertes apparaitront ici automatiquement.';

  const moduleCounts = useMemo(() => {
    const counts = new Map<ModuleFilter, number>();
    MODULE_FILTER_OPTIONS.forEach((module) => {
      counts.set(module, module === 'Tous' ? activeAlerts.length : activeAlerts.filter(
        (alert) => PHASE2_ALERT_CATALOG[alert.notification_type as Phase2AlertCode]?.module === module
      ).length);
    });
    return counts;
  }, [activeAlerts]);

  return (
    <div className="space-y-4">
      <Card className="surface-card border-border">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className={cn(
                  'rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.14em]',
                  highestLevel === 'URGENCE' && 'border-red-200 bg-red-50 text-red-700',
                  highestLevel === 'CRITIQUE' && 'border-red-100 bg-red-50 text-red-700',
                  highestLevel === 'IMPORTANT' && 'border-amber-200 bg-amber-50 text-amber-700',
                  (!highestLevel || highestLevel === 'PREVENTIF') && 'border-border bg-muted/60 text-muted-foreground',
                )}
              >
                Centre d'alertes phase 2
              </Badge>
              {moduleFilter !== 'Tous' && (
                <Badge variant="outline" className="rounded-full px-2.5 py-1 text-xs">
                  Filtre: {moduleFilter}
                </Badge>
              )}
            </div>
            <h3 className="mt-3 text-xl font-semibold text-foreground">{summaryTitle}</h3>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{summaryBody}</p>
          </div>

          {kpis.total > 0 && (
            <Button
              size="sm"
              variant="outline"
              className="h-9 shrink-0 rounded-lg border-border/80 bg-card"
              onClick={() => acknowledgeAll.mutate()}
              disabled={acknowledgeAll.isPending}
            >
              {acknowledgeAll.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCheck className="mr-2 h-4 w-4" />
              )}
              Tout acquitter ({kpis.total})
            </Button>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <AlertKpiCard
          label="Actives"
          value={kpis.total}
          icon={Bell}
          tone={kpis.total > 0 ? 'default' : 'muted'}
          helper="Alertes en attente"
        />
        <AlertKpiCard
          label="Urgence"
          value={kpis.urgence}
          icon={ShieldAlert}
          tone={kpis.urgence > 0 ? 'danger' : 'muted'}
          helper="Action immediate"
        />
        <AlertKpiCard
          label="Critique"
          value={kpis.critique}
          icon={AlertTriangle}
          tone={kpis.critique > 0 ? 'danger-soft' : 'muted'}
          helper="Sous surveillance"
        />
        <AlertKpiCard
          label="Important"
          value={kpis.important}
          icon={AlertTriangle}
          tone={kpis.important > 0 ? 'warning' : 'muted'}
          helper="A traiter au plus vite"
        />
        <AlertKpiCard
          label="Preventif"
          value={kpis.preventif}
          icon={Bell}
          tone={kpis.preventif > 0 ? 'neutral' : 'muted'}
          helper="Controle de routine"
        />
      </div>

      <Card className="surface-card border-border">
        <CardHeader className="space-y-4 pb-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="text-base font-semibold">Flux d'alertes</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Les alertes sont triees par severite puis par heure de creation.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {MODULE_FILTER_OPTIONS.map((module) => {
                const count = moduleCounts.get(module) ?? 0;
                const isActive = moduleFilter === module;

                return (
                  <button
                    key={module}
                    type="button"
                    onClick={() => setModuleFilter(module)}
                    className={cn(
                      'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                      isActive
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-background text-muted-foreground hover:bg-muted',
                    )}
                  >
                    <span>{module}</span>
                    <span className={cn('rounded-full px-1.5 py-0.5 text-[11px]', isActive ? 'bg-white/16 text-primary-foreground' : 'bg-muted text-foreground')}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          <Tabs defaultValue="active">
            <TabsList className="h-auto rounded-xl border border-border bg-muted/40 p-1">
              <TabsTrigger value="active" className="rounded-lg px-3 py-2 sm:text-sm">
                Actives
                <span className="ml-2 rounded-full bg-red-100 px-1.5 py-0.5 text-[11px] font-semibold text-red-700">
                  {filteredActive.length}
                </span>
              </TabsTrigger>
              <TabsTrigger value="history" className="rounded-lg px-3 py-2 sm:text-sm">
                Historique
                <span className="ml-2 rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-semibold text-foreground">
                  {filteredAcknowledged.length}
                </span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="active" className="mt-4">
              {loadingActive ? (
                <PanelState
                  icon={Loader2}
                  title="Chargement des alertes"
                  description="Recuperation des alertes actives en cours."
                  spinning
                />
              ) : filteredActive.length === 0 ? (
                <PanelState
                  icon={BellOff}
                  title="Aucune alerte active"
                  description={
                    moduleFilter !== 'Tous'
                      ? `Aucune alerte active pour ${moduleFilter}.`
                      : 'Tous les signaux de la phase 2 sont actuellement au vert.'
                  }
                />
              ) : (
                <div className="space-y-3">
                  {filteredActive.map((alert) => (
                    <AlertRow
                      key={alert.id}
                      alert={alert}
                      onAck={() => acknowledge.mutate(alert.id)}
                      isAcking={acknowledge.isPending && acknowledge.variables === alert.id}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="history" className="mt-4">
              {loadingAll ? (
                <PanelState
                  icon={Loader2}
                  title="Chargement de l'historique"
                  description="Recuperation des alertes acquittees."
                  spinning
                />
              ) : filteredAcknowledged.length === 0 ? (
                <PanelState
                  icon={BellOff}
                  title="Aucune alerte acquittee"
                  description={
                    moduleFilter !== 'Tous'
                      ? `Aucune alerte acquittee pour ${moduleFilter}.`
                      : 'L historique des alertes acquittees apparaitra ici.'
                  }
                />
              ) : (
                <div className="space-y-3">
                  {filteredAcknowledged.map((alert) => (
                    <AlertRow key={alert.id} alert={alert} acknowledged />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

function AlertKpiCard({
  label,
  value,
  icon: Icon,
  helper,
  tone,
}: {
  label: string;
  value: number;
  icon: typeof Bell;
  helper: string;
  tone: 'danger' | 'danger-soft' | 'warning' | 'neutral' | 'default' | 'muted';
}) {
  return (
    <Card
      className={cn(
        'border-border bg-card shadow-card',
        tone === 'danger' && 'border-red-200 bg-red-50/80',
        tone === 'danger-soft' && 'border-red-100 bg-red-50/40',
        tone === 'warning' && 'border-amber-200 bg-amber-50/60',
        tone === 'default' && 'border-primary/20 bg-primary/5',
      )}
    >
      <CardContent className="flex items-start gap-3 p-4">
        <div
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
            tone === 'danger' && 'bg-red-100 text-red-700',
            tone === 'danger-soft' && 'bg-red-50 text-red-600',
            tone === 'warning' && 'bg-amber-100 text-amber-700',
            tone === 'default' && 'bg-primary/10 text-primary',
            tone === 'neutral' && 'bg-muted text-foreground',
            tone === 'muted' && 'bg-muted text-muted-foreground',
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-2xl font-semibold leading-none text-foreground">{value}</p>
          <p className="mt-2 text-sm font-medium text-foreground">{label}</p>
          <p className="mt-1 text-xs text-muted-foreground">{helper}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function PanelState({
  icon: Icon,
  title,
  description,
  spinning = false,
}: {
  icon: typeof BellOff;
  title: string;
  description: string;
  spinning?: boolean;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 px-6 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className={cn('h-5 w-5', spinning && 'animate-spin')} />
      </div>
      <p className="mt-4 text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function AlertRow({
  alert,
  onAck,
  isAcking = false,
  acknowledged = false,
}: {
  alert: AlertListItem;
  onAck?: () => void;
  isAcking?: boolean;
  acknowledged?: boolean;
}) {
  const notificationCode = alert.notification_type as Phase2AlertCode;
  const catalog = PHASE2_ALERT_CATALOG[notificationCode];
  if (!catalog) return null;

  const level = catalog.level;
  const sla = formatSla(alert.created_at, catalog.sla_minutes);
  const Icon = LEVEL_ICON[level];

  return (
    <div
      className={cn(
        'flex flex-col gap-4 rounded-xl border p-4 transition-colors md:flex-row md:items-start md:justify-between',
        acknowledged ? 'border-border bg-muted/20' : LEVEL_ROW[level],
      )}
    >
      <div className="flex min-w-0 gap-3">
        <div
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
            acknowledged ? 'bg-muted text-muted-foreground' : LEVEL_ICON_BOX[level],
          )}
        >
          <Icon className={cn('h-4 w-4', level === 'URGENCE' && !acknowledged && 'animate-pulse')} />
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-foreground">{alert.title}</p>
            <Badge className={cn('rounded-full border px-2 py-0.5 text-[11px] font-semibold', LEVEL_BADGE[level])}>
              {level}
            </Badge>
            <Badge variant="outline" className="rounded-full px-2 py-0.5 text-[11px]">
              {catalog.module}
            </Badge>
            <span className="font-mono text-xs text-muted-foreground">{notificationCode}</span>
          </div>

          <p className="mt-2 text-sm text-muted-foreground">{alert.message}</p>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1 rounded-full bg-background/80 px-2 py-1 text-muted-foreground">
              <Clock className="h-3 w-3" />
              {format(new Date(alert.created_at), 'dd/MM HH:mm', { locale: fr })}
            </span>

            {!acknowledged ? (
              <span
                className={cn(
                  'inline-flex items-center rounded-full px-2 py-1 font-semibold',
                  sla.overdue
                    ? 'bg-red-100 text-red-700'
                    : 'bg-muted text-muted-foreground',
                )}
              >
                SLA {sla.label} {sla.overdue ? 'depasse' : 'restant'}
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-muted px-2 py-1 font-medium text-muted-foreground">
                Acquittee
              </span>
            )}
          </div>
        </div>
      </div>

      {!acknowledged && onAck ? (
        <Button
          size="sm"
          variant="outline"
          className="h-9 shrink-0 rounded-lg border-border/80 bg-card md:min-w-[112px]"
          onClick={onAck}
          disabled={isAcking}
        >
          {isAcking ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <CheckCheck className="mr-2 h-4 w-4" />
          )}
          Acquitter
        </Button>
      ) : null}
    </div>
  );
}
