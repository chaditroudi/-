import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ProductionOrder, ProductionOrderStatus } from '@/types/production';
import { useProductionConfig } from '@/hooks/useProduction';
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle,
  Clock,
  Factory,
  Package,
  PlayCircle,
  TrendingUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProductionDashboardProps {
  orders: ProductionOrder[];
}

const STATUS_BADGE: Record<ProductionOrderStatus, string> = {
  draft: 'border-border bg-muted text-muted-foreground',
  planned: 'border-blue-200 bg-blue-50 text-blue-700',
  in_progress: 'border-amber-200 bg-amber-50 text-amber-700',
  completed: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  cancelled: 'border-red-200 bg-red-50 text-red-700',
};

export const ProductionDashboard = ({ orders }: ProductionDashboardProps) => {
  const { t } = useTranslation();
  const { orderStatusLabels } = useProductionConfig();

  const stats = useMemo(() => {
    const total = orders.length;
    const draft = orders.filter((order) => order.status === 'draft').length;
    const planned = orders.filter((order) => order.status === 'planned').length;
    const inProgress = orders.filter((order) => order.status === 'in_progress').length;
    const completed = orders.filter((order) => order.status === 'completed').length;
    const cancelled = orders.filter((order) => order.status === 'cancelled').length;
    const urgent = orders.filter((order) => order.priority === 3).length;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    return {
      total,
      draft,
      planned,
      inProgress,
      completed,
      cancelled,
      urgent,
      completionRate,
    };
  }, [orders]);

  const activeOrders = useMemo(
    () =>
      [...orders]
        .filter((order) => order.status === 'in_progress')
        .sort((left, right) => {
          if (right.priority !== left.priority) return right.priority - left.priority;
          return new Date(left.actual_start_date ?? left.created_at).getTime() - new Date(right.actual_start_date ?? right.created_at).getTime();
        }),
    [orders],
  );

  const plannedOrders = useMemo(
    () =>
      [...orders]
        .filter((order) => order.status === 'planned')
        .sort((left, right) => new Date(left.planned_start_date ?? left.created_at).getTime() - new Date(right.planned_start_date ?? right.created_at).getTime())
        .slice(0, 5),
    [orders],
  );

  const summaryTitle =
    stats.inProgress > 0
      ? `${stats.inProgress} ordre${stats.inProgress > 1 ? 's' : ''} en cours d'execution`
      : stats.planned > 0
        ? `${stats.planned} ordre${stats.planned > 1 ? 's' : ''} planifie${stats.planned > 1 ? 's' : ''} a lancer`
        : 'Aucune production en cours';

  const summaryBody =
    stats.urgent > 0
      ? `${stats.urgent} ordre${stats.urgent > 1 ? 's' : ''} prioritaire${stats.urgent > 1 ? 's' : ''} demande${stats.urgent > 1 ? 'nt' : ''} une attention immediate.`
      : stats.inProgress > 0
        ? 'Suivez les ordres actifs et les ordres planifies depuis ce tableau de pilotage.'
        : 'Le tableau de bord est pret pour la prochaine vague d ordres de fabrication.';

  return (
    <div className="space-y-6">
      <Card className="surface-card border-border">
        <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <Badge variant="outline" className="rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.14em]">
              Pilotage production
            </Badge>
            <h3 className="mt-3 text-xl font-semibold text-foreground">{summaryTitle}</h3>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{summaryBody}</p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <ProductionStatCard
              label={t('common.total')}
              value={stats.total}
              helper="Ordres suivis"
              icon={Factory}
              tone="default"
            />
            <ProductionStatCard
              label={t('production.status.inProgress')}
              value={stats.inProgress}
              helper="Execution active"
              icon={PlayCircle}
              tone={stats.inProgress > 0 ? 'warning' : 'muted'}
            />
            <ProductionStatCard
              label={t('production.status.completed')}
              value={stats.completed}
              helper={`${stats.completionRate}% de cloture`}
              icon={CheckCircle}
              tone={stats.completed > 0 ? 'success' : 'muted'}
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <ProductionMetricCard
          label={t('production.status.planned')}
          value={stats.planned}
          icon={Clock}
          helper="A demarrer"
        />
        <ProductionMetricCard
          label={t('production.status.inProgress')}
          value={stats.inProgress}
          icon={TrendingUp}
          helper="En execution"
          tone="warning"
        />
        <ProductionMetricCard
          label={t('production.status.completed')}
          value={stats.completed}
          icon={CheckCircle}
          helper="Ordres termines"
          tone="success"
        />
        <ProductionMetricCard
          label={t('purchasing.status.draft')}
          value={stats.draft}
          icon={Package}
          helper="A finaliser"
        />
        <ProductionMetricCard
          label={t('production.priorities.urgent')}
          value={stats.urgent}
          icon={AlertTriangle}
          helper="Priorite haute"
          tone={stats.urgent > 0 ? 'danger' : 'muted'}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,1fr)]">
        <Card className="surface-card border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base font-semibold">
                  {t('production.status.inProgress')}
                </CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Vue directe des ordres actuellement en fabrication.
                </p>
              </div>
              <Badge variant="outline" className="rounded-full px-2.5 py-1 text-xs">
                {activeOrders.length} actif{activeOrders.length > 1 ? 's' : ''}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {activeOrders.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-muted/20 px-6 py-12 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <Factory className="h-5 w-5" />
                </div>
                <p className="mt-4 text-sm font-semibold text-foreground">Aucun ordre en cours</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Lancez un ordre planifie pour alimenter la ligne de production.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {activeOrders.map((order) => (
                  <ProductionOrderRow key={order.id} order={order} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="surface-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">File planifiee</CardTitle>
            <p className="text-sm text-muted-foreground">
              Les prochains ordres a lancer et les signaux de charge.
            </p>
          </CardHeader>
          <CardContent className="space-y-4 pt-0">
            <div className="rounded-xl border border-border bg-muted/20 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">Taux de cloture</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Pourcentage d ordres termines sur l ensemble du portefeuille.
                  </p>
                </div>
                <span className="text-2xl font-semibold text-foreground">{stats.completionRate}%</span>
              </div>
              <Progress value={stats.completionRate} className="mt-4 h-2" />
            </div>

            <div className="rounded-xl border border-border bg-card">
              <div className="border-b border-border px-4 py-3">
                <p className="text-sm font-semibold text-foreground">{t('production.status.planned')}</p>
              </div>
              <div className="divide-y divide-border">
                {plannedOrders.length === 0 ? (
                  <div className="px-4 py-6 text-sm text-muted-foreground">
                    Aucun ordre planifie pour le moment.
                  </div>
                ) : (
                  plannedOrders.map((order) => (
                    <div key={order.id} className="flex items-start justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <p className="font-mono text-sm font-semibold text-foreground">{order.order_number}</p>
                        <p className="truncate text-sm text-muted-foreground">{order.product_name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {order.planned_start_date
                            ? `${t('production.startDate')}: ${formatDate(order.planned_start_date)}`
                            : 'Date de lancement non definie'}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <PriorityBadge priority={order.priority} />
                        <p className="mt-2 text-sm font-medium text-foreground">
                          {order.target_quantity} {order.unit}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {stats.cancelled > 0 && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {stats.cancelled} ordre{stats.cancelled > 1 ? 's' : ''} annule{stats.cancelled > 1 ? 's' : ''}.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

function ProductionMetricCard({
  label,
  value,
  icon: Icon,
  helper,
  tone = 'default',
}: {
  label: string;
  value: number;
  icon: typeof Factory;
  helper: string;
  tone?: 'default' | 'warning' | 'success' | 'danger' | 'muted';
}) {
  return (
    <Card
      className={cn(
        'border-border bg-card shadow-card',
        tone === 'warning' && 'border-amber-200 bg-amber-50/60',
        tone === 'success' && 'border-emerald-200 bg-emerald-50/70',
        tone === 'danger' && 'border-red-200 bg-red-50/70',
      )}
    >
      <CardContent className="flex items-start gap-3 p-4">
        <div
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
            tone === 'warning' && 'bg-amber-100 text-amber-700',
            tone === 'success' && 'bg-emerald-100 text-emerald-700',
            tone === 'danger' && 'bg-red-100 text-red-700',
            tone === 'default' && 'bg-primary/10 text-primary',
            tone === 'muted' && 'bg-muted text-muted-foreground',
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-2xl font-semibold text-foreground">{value}</p>
          <p className="mt-2 text-sm font-medium text-foreground">{label}</p>
          <p className="mt-1 text-xs text-muted-foreground">{helper}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function ProductionStatCard({
  label,
  value,
  helper,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  helper: string;
  icon: typeof Factory;
  tone: 'default' | 'warning' | 'success' | 'muted';
}) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3 shadow-card">
      <div className="flex items-center gap-3">
        <div
          className={cn(
            'flex h-9 w-9 items-center justify-center rounded-lg',
            tone === 'default' && 'bg-primary/10 text-primary',
            tone === 'warning' && 'bg-amber-100 text-amber-700',
            tone === 'success' && 'bg-emerald-100 text-emerald-700',
            tone === 'muted' && 'bg-muted text-muted-foreground',
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <p className="text-xl font-semibold text-foreground">{value}</p>
          <p className="text-sm font-medium text-foreground">{label}</p>
          <p className="text-xs text-muted-foreground">{helper}</p>
        </div>
      </div>
    </div>
  );
}

function ProductionOrderRow({ order }: { order: ProductionOrder }) {
  const progress = getOrderProgress(order);
  const completedSteps = order.steps?.filter((step) => step.status === 'completed').length ?? 0;
  const totalSteps = order.steps?.length ?? 0;

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-card">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-mono text-sm font-semibold text-foreground">{order.order_number}</p>
            <Badge className={cn('rounded-full border px-2 py-0.5 text-[11px] font-semibold', STATUS_BADGE[order.status])}>
              {orderStatusLabels[order.status]}
            </Badge>
            <PriorityBadge priority={order.priority} />
          </div>

          <p className="mt-2 text-sm font-medium text-foreground">{order.product_name}</p>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1">
              <Package className="h-3 w-3" />
              {order.actual_quantity || 0} / {order.target_quantity} {order.unit}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1">
              <CalendarDays className="h-3 w-3" />
              {order.actual_start_date ? formatDate(order.actual_start_date) : 'Demarrage non renseigne'}
            </span>
            {totalSteps > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1">
                <CheckCircle className="h-3 w-3" />
                {completedSteps}/{totalSteps} etapes terminees
              </span>
            )}
          </div>
        </div>

        <div className="w-full max-w-xs">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Progression</span>
            <span className="font-semibold text-foreground">{progress}%</span>
          </div>
          <Progress value={progress} className="mt-2 h-2" />
        </div>
      </div>
    </div>
  );
}

function PriorityBadge({ priority }: { priority: number }) {
  const label = priority >= 3 ? 'Urgent' : priority === 2 ? 'Normal' : 'Basse';

  return (
    <Badge
      variant="outline"
      className={cn(
        'rounded-full px-2 py-0.5 text-[11px] font-semibold',
        priority >= 3 && 'border-red-200 bg-red-50 text-red-700',
        priority === 2 && 'border-amber-200 bg-amber-50 text-amber-700',
        priority <= 1 && 'border-border bg-muted text-muted-foreground',
      )}
    >
      {label}
    </Badge>
  );
}

function getOrderProgress(order: ProductionOrder) {
  const steps = order.steps ?? [];

  if (steps.length > 0) {
    const completedSteps = steps.filter((step) => step.status === 'completed').length;
    const skippedSteps = steps.filter((step) => step.status === 'skipped').length;
    const activeSteps = steps.filter((step) => step.status === 'in_progress').length;
    const ratio = (completedSteps + skippedSteps + activeSteps * 0.5) / steps.length;
    return Math.max(0, Math.min(100, Math.round(ratio * 100)));
  }

  if (order.target_quantity > 0 && order.actual_quantity > 0) {
    return Math.max(0, Math.min(100, Math.round((order.actual_quantity / order.target_quantity) * 100)));
  }

  if (order.status === 'completed') return 100;
  if (order.status === 'in_progress') return 15;
  if (order.status === 'planned') return 5;
  return 0;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
