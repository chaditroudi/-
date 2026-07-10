import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAlerts, useAcknowledgeAlert, useResolveAlert } from '@/hooks/useBatches';
import { useReceptionAlerts, useAcknowledgeReceptionAlert, useResolveReceptionAlert } from '@/hooks/useReceptionsV2';
import { Alert as BatchAlert } from '@/types/batch';
import { ReceptionAlert } from '@/types/reception';
import {
  AlertCircle,
  AlertTriangle,
  Bell,
  Check,
  CheckCheck,
  Clock,
  Info,
  Package,
  RefreshCw,
  Search,
  ShieldCheck,
  TriangleAlert,
  XCircle,
} from 'lucide-react';
import { formatDistanceToNow, isToday } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useQueryClient } from '@tanstack/react-query';

// ── Unified alert model ────────────────────────────────────────────────────────

type Sev = 'critical' | 'warning' | 'info';
type Stat = 'active' | 'acknowledged' | 'resolved';

interface UnifiedAlert {
  id: string;
  rawId: string;
  source: 'batch' | 'reception';
  severity: Sev;
  status: Stat;
  title: string;
  message: string;
  alert_type: string;
  created_at: string;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  context: string | null;
}

const normSev = (s: string): Sev => {
  const l = s.toLowerCase();
  if (l === 'critical' || l === 'critique') return 'critical';
  if (l === 'warning' || l === 'majeur') return 'warning';
  return 'info';
};

const normStat = (s: string): Stat => {
  const l = s.toLowerCase();
  if (l === 'acknowledged') return 'acknowledged';
  if (l === 'resolved') return 'resolved';
  return 'active';
};

const fromBatch = (a: BatchAlert): UnifiedAlert => ({
  id: `batch-${a.id}`,
  rawId: a.id,
  source: 'batch',
  severity: normSev(a.severity),
  status: normStat(a.status),
  title: a.title,
  message: a.message,
  alert_type: a.alert_type,
  created_at: a.created_at,
  acknowledged_at: a.acknowledged_at,
  acknowledged_by: a.acknowledged_by,
  resolved_at: a.resolved_at,
  resolved_by: a.resolved_by,
  context: a.batch ? `Lot ${a.batch.batch_number}` : null,
});

const fromReception = (a: ReceptionAlert): UnifiedAlert => ({
  id: `rec-${a.id}`,
  rawId: a.id,
  source: 'reception',
  severity: normSev(a.severity),
  status: normStat(a.status),
  title: a.title,
  message: a.message,
  alert_type: a.alert_type,
  created_at: a.created_at,
  acknowledged_at: a.acknowledged_at,
  acknowledged_by: a.acknowledged_by,
  resolved_at: a.resolved_at,
  resolved_by: a.resolved_by,
  context: [
    a.current_value != null ? `Valeur: ${a.current_value}` : null,
    a.threshold_value != null ? `Seuil: ${a.threshold_value}` : null,
  ]
    .filter(Boolean)
    .join(' · ') || null,
});

// ── Severity config ────────────────────────────────────────────────────────────

const SEV_CONFIG: Record<Sev, { icon: React.ElementType; border: string; bg: string; label: string; stat: string }> = {
  critical: {
    icon: AlertCircle,
    border: 'border-l-red-500',
    bg: 'bg-red-50 dark:bg-red-950/20',
    label: 'Critique',
    stat: 'text-red-600',
  },
  warning: {
    icon: AlertTriangle,
    border: 'border-l-amber-500',
    bg: 'bg-amber-50 dark:bg-amber-950/20',
    label: 'Attention',
    stat: 'text-amber-600',
  },
  info: {
    icon: Info,
    border: 'border-l-blue-500',
    bg: 'bg-blue-50 dark:bg-blue-950/20',
    label: 'Info',
    stat: 'text-blue-600',
  },
};

// ── Sort: severity desc, date desc ─────────────────────────────────────────────

const SEV_ORDER: Record<Sev, number> = { critical: 0, warning: 1, info: 2 };

const sortAlerts = (list: UnifiedAlert[]) =>
  [...list].sort((a, b) => {
    const sd = SEV_ORDER[a.severity] - SEV_ORDER[b.severity];
    if (sd !== 0) return sd;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

// ── Main component ─────────────────────────────────────────────────────────────

export const AlertsDashboard = () => {
  const queryClient = useQueryClient();

  const { data: batchAlerts = [], isFetching: batchFetching } = useAlerts();
  const { data: receptionAlerts = [], isFetching: recFetching } = useReceptionAlerts();

  const acknowledgeAlert = useAcknowledgeAlert();
  const resolveAlert = useResolveAlert();
  const acknowledgeReception = useAcknowledgeReceptionAlert();
  const resolveReception = useResolveReceptionAlert();

  const [sevFilter, setSevFilter] = useState<Sev | 'all'>('all');
  const [search, setSearch] = useState('');
  const [pending, setPending] = useState<{ type: 'acknowledge' | 'resolve'; alert: UnifiedAlert } | null>(null);
  const [actorName, setActorName] = useState('');

  const isLoading = batchFetching || recFetching;

  // Merge and filter
  const all: UnifiedAlert[] = useMemo(
    () => [
      ...batchAlerts.map(fromBatch),
      ...(receptionAlerts as ReceptionAlert[]).map(fromReception),
    ],
    [batchAlerts, receptionAlerts],
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return all.filter((a) => {
      if (sevFilter !== 'all' && a.severity !== sevFilter) return false;
      if (q && !a.title.toLowerCase().includes(q) && !a.message.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [all, sevFilter, search]);

  const active = useMemo(() => sortAlerts(filtered.filter((a) => a.status === 'active')), [filtered]);
  const acked = useMemo(() => sortAlerts(filtered.filter((a) => a.status === 'acknowledged')), [filtered]);
  const resolved = useMemo(() => sortAlerts(filtered.filter((a) => a.status === 'resolved')), [filtered]);

  // Stats (from full unfiltered set)
  const criticalActive = all.filter((a) => a.severity === 'critical' && a.status === 'active').length;
  const warningActive = all.filter((a) => a.severity === 'warning' && a.status === 'active').length;
  const infoActive = all.filter((a) => a.severity === 'info' && a.status === 'active').length;
  const resolvedToday = all.filter((a) => a.status === 'resolved' && a.resolved_at && isToday(new Date(a.resolved_at))).length;

  const handleAction = (type: 'acknowledge' | 'resolve', alert: UnifiedAlert) => {
    setActorName('');
    setPending({ type, alert });
  };

  const confirmAction = async () => {
    if (!pending) return;
    const { type, alert } = pending;
    const actor = actorName.trim() || 'Opérateur';

    if (type === 'acknowledge') {
      if (alert.source === 'batch') {
        await acknowledgeAlert.mutateAsync({ id: alert.rawId, acknowledged_by: actor });
      } else {
        await acknowledgeReception.mutateAsync({ alertId: alert.rawId, actorName: actor });
      }
    } else {
      if (alert.source === 'batch') {
        await resolveAlert.mutateAsync({ id: alert.rawId, resolved_by: actor });
      } else {
        await resolveReception.mutateAsync({ alertId: alert.rawId, actorName: actor });
      }
    }
    setPending(null);
  };

  const isMutating =
    acknowledgeAlert.isPending ||
    resolveAlert.isPending ||
    acknowledgeReception.isPending ||
    resolveReception.isPending;

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['alerts'] });
    queryClient.invalidateQueries({ queryKey: ['reception-alerts'] });
  };

  return (
    <div className="space-y-5">
      {/* ── Stats bar ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Critique"
          value={criticalActive}
          icon={XCircle}
          colorClass="text-red-600"
          bg="bg-red-50 dark:bg-red-950/20"
          border="border-red-200 dark:border-red-800"
          pulse={criticalActive > 0}
        />
        <StatCard
          label="Attention"
          value={warningActive}
          icon={TriangleAlert}
          colorClass="text-amber-600"
          bg="bg-amber-50 dark:bg-amber-950/20"
          border="border-amber-200 dark:border-amber-800"
        />
        <StatCard
          label="Info"
          value={infoActive}
          icon={Info}
          colorClass="text-blue-600"
          bg="bg-blue-50 dark:bg-blue-950/20"
          border="border-blue-200 dark:border-blue-800"
        />
        <StatCard
          label="Résolues aujourd'hui"
          value={resolvedToday}
          icon={ShieldCheck}
          colorClass="text-emerald-600"
          bg="bg-emerald-50 dark:bg-emerald-950/20"
          border="border-emerald-200 dark:border-emerald-800"
        />
      </div>

      {/* ── Filters ───────────────────────────────────────────────────────────── */}
      <Card>
        <CardContent className="py-3 px-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher une alerte…"
                className="h-8 pl-8 text-sm"
              />
            </div>
            <div className="flex gap-1">
              {(['all', 'critical', 'warning', 'info'] as const).map((s) => (
                <Button
                  key={s}
                  size="sm"
                  variant={sevFilter === s ? 'default' : 'outline'}
                  className="h-9 text-xs"
                  onClick={() => setSevFilter(s)}
                >
                  {s === 'all' ? 'Tout' : SEV_CONFIG[s].label}
                </Button>
              ))}
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="h-9 gap-1.5 text-xs"
              onClick={handleRefresh}
              disabled={isLoading}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              {isLoading ? 'Actualisation…' : 'Actualiser'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Main tabs ─────────────────────────────────────────────────────────── */}
      <Tabs defaultValue="active">
        <TabsList className="w-full grid grid-cols-3">
          <TabsTrigger value="active" className="gap-2">
            <Bell className="h-3.5 w-3.5" />
            Actives
            {active.length > 0 && (
              <Badge variant="destructive" className="rounded-full px-1.5 py-0 text-[10px]">
                {active.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="acked" className="gap-2">
            <Check className="h-3.5 w-3.5" />
            En traitement
            {acked.length > 0 && (
              <Badge variant="secondary" className="rounded-full px-1.5 py-0 text-[10px]">
                {acked.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="resolved" className="gap-2">
            <CheckCheck className="h-3.5 w-3.5" />
            Résolues
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-4">
          <AlertList
            alerts={active}
            emptyLabel="Aucune alerte active — système nominal."
            emptyIcon={ShieldCheck}
            onAction={(a) => handleAction('acknowledge', a)}
            actionLabel="Prendre en compte"
            actionVariant="outline"
          />
        </TabsContent>

        <TabsContent value="acked" className="mt-4">
          <AlertList
            alerts={acked}
            emptyLabel="Aucune alerte en cours de traitement."
            emptyIcon={Check}
            onAction={(a) => handleAction('resolve', a)}
            actionLabel="Marquer résolue"
            actionVariant="default"
          />
        </TabsContent>

        <TabsContent value="resolved" className="mt-4">
          <AlertList alerts={resolved} emptyLabel="Aucune alerte résolue." emptyIcon={CheckCheck} />
        </TabsContent>
      </Tabs>

      {/* ── Action confirmation dialog ─────────────────────────────────────────── */}
      <Dialog open={!!pending} onOpenChange={(open) => !open && setPending(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {pending?.type === 'acknowledge' ? "Prendre en compte l'alerte" : 'Marquer comme résolue'}
            </DialogTitle>
          </DialogHeader>
          {pending && (
            <div className="space-y-4">
              <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-sm">
                <p className="font-medium">{pending.alert.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{pending.alert.message}</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Votre nom / identifiant *</Label>
                <Input
                  value={actorName}
                  onChange={(e) => setActorName(e.target.value)}
                  placeholder="Opérateur responsable"
                  className="h-8 text-sm"
                  onKeyDown={(e) => e.key === 'Enter' && confirmAction()}
                  autoFocus
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setPending(null)}>
              Annuler
            </Button>
            <Button size="sm" onClick={confirmAction} disabled={isMutating}>
              {isMutating
                ? 'Enregistrement…'
                : pending?.type === 'acknowledge'
                  ? 'Confirmer'
                  : 'Résoudre'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon: Icon,
  colorClass,
  bg,
  border,
  pulse = false,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  colorClass: string;
  bg: string;
  border: string;
  pulse?: boolean;
}) {
  return (
    <Card className={`${bg} ${border}`}>
      <CardContent className="flex items-center gap-3 py-4 px-4">
        <div className="relative shrink-0">
          <Icon className={`h-6 w-6 ${colorClass}`} />
          {pulse && value > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-red-500 animate-pulse" />
          )}
        </div>
        <div>
          <p className={`text-2xl font-bold leading-none ${colorClass}`}>{value}</p>
          <p className="text-xs text-muted-foreground mt-1">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function AlertList({
  alerts,
  emptyLabel,
  emptyIcon: EmptyIcon,
  onAction,
  actionLabel,
  actionVariant,
}: {
  alerts: UnifiedAlert[];
  emptyLabel: string;
  emptyIcon: React.ElementType;
  onAction?: (a: UnifiedAlert) => void;
  actionLabel?: string;
  actionVariant?: 'outline' | 'default';
}) {
  if (alerts.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <EmptyIcon className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">{emptyLabel}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <ScrollArea className="h-[420px]">
      <div className="space-y-2 pr-1">
        {alerts.map((alert) => {
          const cfg = SEV_CONFIG[alert.severity];
          const SevIcon = cfg.icon;
          return (
            <div
              key={alert.id}
              className={`flex items-start gap-3 rounded-lg border border-l-4 ${cfg.border} ${cfg.bg} px-3.5 py-3`}
            >
              <SevIcon className={`mt-0.5 h-4 w-4 shrink-0 ${cfg.stat}`} />
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="text-sm font-semibold text-foreground leading-tight">{alert.title}</p>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 rounded-sm">
                    {alert.alert_type}
                  </Badge>
                  <Badge
                    className={`text-[10px] px-1.5 py-0 rounded-sm ${
                      alert.source === 'batch'
                        ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300'
                        : 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300'
                    }`}
                  >
                    {alert.source === 'batch' ? (
                      <><Package className="h-2.5 w-2.5 mr-0.5 inline" />Lot</>
                    ) : (
                      <><Bell className="h-2.5 w-2.5 mr-0.5 inline" />Réception</>
                    )}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{alert.message}</p>
                <div className="flex flex-wrap items-center gap-3 mt-1.5 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true, locale: fr })}
                  </span>
                  {alert.context && <span>{alert.context}</span>}
                  {alert.acknowledged_by && (
                    <span className="text-emerald-600">Pris en compte par {alert.acknowledged_by}</span>
                  )}
                  {alert.resolved_by && (
                    <span className="text-emerald-600">Résolu par {alert.resolved_by}</span>
                  )}
                </div>
              </div>
              {onAction && actionLabel && (
                <Button
                  size="sm"
                  variant={actionVariant ?? 'outline'}
                  className="h-9 shrink-0 text-xs"
                  onClick={() => onAction(alert)}
                >
                  {actionLabel}
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
