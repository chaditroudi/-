import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useOrderLotAllocations, useProductionOrder, useProductionConfig, useUpdateOrderStatus } from '@/hooks/useProduction';
import { ProductionStepCard } from './ProductionStepCard';
import { LotAllocationPanel } from './LotAllocationPanel';
import { OutputLotPanel } from './OutputLotPanel';
import { ProductionOrder, ProductionOrderStatus } from '@/types/production';
import { useAuthContext } from '@/contexts/AuthContext';
import {
  Calendar,
  CheckCircle,
  ClipboardList,
  FileText,
  Loader2,
  Package,
  Play,
  User,
  XCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProductionOrderDetailProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
}

const STATUS_BADGE: Record<ProductionOrderStatus, string> = {
  draft: 'border-border bg-muted text-muted-foreground',
  planned: 'border-blue-200 bg-blue-50 text-blue-700',
  in_progress: 'border-amber-200 bg-amber-50 text-amber-700',
  completed: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  cancelled: 'border-red-200 bg-red-50 text-red-700',
};

export const ProductionOrderDetail = ({ open, onOpenChange, orderId }: ProductionOrderDetailProps) => {
  const { t, i18n } = useTranslation();
  const { fluxCodeLabels, fluxCodeColors, orderStatusLabels } = useProductionConfig();
  const { data: order, isLoading } = useProductionOrder(orderId);
  const updateStatus = useUpdateOrderStatus();
  const { data: lotAllocations = [] } = useOrderLotAllocations(orderId);
  const { user, profile } = useAuthContext();

  const actorName = profile?.full_name || user?.email || undefined;

  const getDateLocale = () => {
    switch (i18n.language) {
      case 'ar':
        return 'ar-SA';
      case 'en':
        return 'en-US';
      default:
        return 'fr-FR';
    }
  };

  const sortedSteps = useMemo(
    () => [...(order?.steps ?? [])].sort((left, right) => left.sequence_order - right.sequence_order),
    [order?.steps],
  );

  const completedSteps = sortedSteps.filter((step) => step.status === 'completed').length;
  const skippedSteps = sortedSteps.filter((step) => step.status === 'skipped').length;
  const inProgressSteps = sortedSteps.filter((step) => step.status === 'in_progress').length;
  const totalSteps = sortedSteps.length;
  const progress = getOrderProgress(order);
  const activeStepIndex = sortedSteps.findIndex((step) => step.status === 'in_progress');
  const nextPendingIndex = activeStepIndex === -1 ? sortedSteps.findIndex((step) => step.status === 'pending') : -1;
  const highlightedStepIndex = activeStepIndex !== -1 ? activeStepIndex : nextPendingIndex;

  if (!orderId) return null;

  const handleStatusChange = (newStatus: ProductionOrderStatus) => {
    updateStatus.mutate({ id: orderId, status: newStatus, performed_by: actorName });
  };

  const statusMessage =
    order?.status === 'draft'
      ? 'Ordre en preparation avant planification.'
      : order?.status === 'planned'
        ? 'Pret a etre lance sur la ligne.'
        : order?.status === 'in_progress'
          ? 'Suivi d execution en temps reel.'
          : order?.status === 'completed'
            ? 'Ordre cloture et trace.'
            : 'Ordre retire du flux actif.';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-6xl overflow-hidden border-border bg-background p-0">
        {isLoading ? (
          <div className="flex min-h-[360px] items-center justify-center">
            <div className="flex flex-col items-center gap-3 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
              <p className="text-sm">Chargement de l ordre de fabrication...</p>
            </div>
          </div>
        ) : order ? (
          <div className="max-h-[92vh] overflow-y-auto">
            <DialogHeader className="border-b border-border px-6 py-5">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.14em]">
                      Ordre de fabrication
                    </Badge>
                    <Badge className={cn('rounded-full border px-2.5 py-1 text-xs font-semibold', STATUS_BADGE[order.status])}>
                      {orderStatusLabels[order.status]}
                    </Badge>
                    {order.flux_code && (
                      <Badge
                        className="rounded-md px-2 py-0.5 text-xs font-bold text-white"
                        style={{ backgroundColor: fluxCodeColors[order.flux_code] }}
                      >
                        {order.flux_code} — {fluxCodeLabels[order.flux_code]}
                      </Badge>
                    )}
                    <PriorityBadge priority={order.priority} />
                  </div>

                  <DialogTitle className="mt-3 text-2xl font-semibold text-foreground">
                    {order.order_number}
                  </DialogTitle>
                  <p className="mt-1 text-base text-foreground">{order.product_name}</p>
                  <p className="mt-2 text-sm text-muted-foreground">{statusMessage}</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {order.status === 'draft' && (
                    <ActionButton
                      loading={updateStatus.isPending && updateStatus.variables?.status === 'planned'}
                      onClick={() => handleStatusChange('planned')}
                    >
                      {t('common.planOrder')}
                    </ActionButton>
                  )}

                  {order.status === 'planned' && (
                    <ActionButton
                      loading={updateStatus.isPending && updateStatus.variables?.status === 'in_progress'}
                      onClick={() => handleStatusChange('in_progress')}
                      disabled={lotAllocations.length === 0}
                      title={lotAllocations.length === 0 ? 'RG-M5 — Allouez au moins un lot libéré avant de lancer' : undefined}
                    >
                      <Play className="mr-2 h-4 w-4" />
                      {t('common.startProduction')}
                    </ActionButton>
                  )}

                  {order.status === 'in_progress' && (
                    <>
                      <ActionButton
                        tone="success"
                        loading={updateStatus.isPending && updateStatus.variables?.status === 'completed'}
                        onClick={() => handleStatusChange('completed')}
                      >
                        <CheckCircle className="mr-2 h-4 w-4" />
                        {t('common.completeOrder')}
                      </ActionButton>
                      <ActionButton
                        tone="danger"
                        loading={updateStatus.isPending && updateStatus.variables?.status === 'cancelled'}
                        onClick={() => handleStatusChange('cancelled')}
                      >
                        <XCircle className="mr-2 h-4 w-4" />
                        {t('common.cancel')}
                      </ActionButton>
                    </>
                  )}
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-5 p-6">
              <CardSection>
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 lg:max-w-xl">
                    <p className="text-sm font-semibold text-foreground">{t('common.progress')}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {completedSteps + skippedSteps}/{totalSteps} etapes cloturees
                      {inProgressSteps > 0 ? ` · ${inProgressSteps} en cours` : ''}
                      {skippedSteps > 0 ? ` · ${skippedSteps} ignoree${skippedSteps > 1 ? 's' : ''}` : ''}
                    </p>
                    <div className="mt-4">
                      <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                        <span>Execution globale</span>
                        <span className="font-semibold text-foreground">{progress}%</span>
                      </div>
                      <Progress value={progress} className="h-2.5" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 lg:min-w-[360px] lg:grid-cols-2">
                    <DetailMetric
                      label={t('production.targetQuantity')}
                      value={`${order.target_quantity} ${order.unit}`}
                      icon={Package}
                    />
                    <DetailMetric
                      label={t('production.actualQuantity')}
                      value={`${order.actual_quantity || 0} ${order.unit}`}
                      icon={Package}
                    />
                    <DetailMetric
                      label={t('production.steps')}
                      value={`${totalSteps}`}
                      helper={`${completedSteps + skippedSteps} cloturees`}
                      icon={ClipboardList}
                    />
                    <DetailMetric
                      label={t('production.startDate')}
                      value={
                        order.planned_start_date
                          ? new Date(order.planned_start_date).toLocaleDateString(getDateLocale())
                          : 'Non planifiee'
                      }
                      icon={Calendar}
                    />
                  </div>
                </div>
              </CardSection>

              <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.9fr)]">
                <CardSection>
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">{t('common.linkedToReception')}</p>
                      {order.reception ? (
                        <p className="mt-1 text-sm text-muted-foreground">
                          <span className="font-semibold text-foreground">{order.reception.reception_number}</span>
                          {order.reception.material && ` · ${order.reception.material.name}`}
                          {order.reception.supplier && ` · ${order.reception.supplier.name}`}
                          {order.reception.variety && ` · ${order.reception.variety}`}
                        </p>
                      ) : order.reception_number_snapshot ? (
                        <p className="mt-1 text-sm text-muted-foreground">
                          <span className="font-semibold text-foreground">{order.reception_number_snapshot}</span>
                          {order.supplier_name_snapshot && ` · ${order.supplier_name_snapshot}`}
                        </p>
                      ) : (
                        <p className="mt-1 text-sm text-muted-foreground">Aucune reception liee.</p>
                      )}
                    </div>
                  </div>
                </CardSection>

                <CardSection>
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <User className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">{t('production.createdBy')}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{order.created_by || 'Utilisateur non renseigne'}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Cree le {new Date(order.created_at).toLocaleString(getDateLocale())}
                      </p>
                    </div>
                  </div>
                </CardSection>
              </div>

              {order.notes && (
                <CardSection>
                  <p className="text-sm font-semibold text-foreground">{t('common.notes')}</p>
                  <p className="mt-2 text-sm text-muted-foreground">{order.notes}</p>
                </CardSection>
              )}

              <CardSection>
                <div className="p-5">
                  <LotAllocationPanel
                    orderId={order.id}
                    targetQuantity={order.target_quantity}
                    targetUnit={order.unit}
                    orderStatus={order.status}
                  />
                </div>
              </CardSection>

              {(order.status === 'in_progress' || order.status === 'completed') && (
                <CardSection>
                  <div className="p-5">
                    <OutputLotPanel
                      orderId={order.id}
                      orderNumber={order.order_number}
                      targetUnit={order.unit}
                      orderStatus={order.status}
                      actorName={actorName}
                    />
                  </div>
                </CardSection>
              )}

              <CardSection>
                <div className="flex flex-col gap-2 border-b border-border px-5 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-base font-semibold text-foreground">{t('production.steps')}</h3>
                    <Badge variant="outline" className="rounded-full px-2.5 py-1 text-xs">
                      {totalSteps} etape{totalSteps > 1 ? 's' : ''}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Chaque etape presente les donnees operateur, l avancement et les actions de pilotage.
                  </p>
                </div>
                <div className="space-y-4 p-5">
                  {sortedSteps.map((step, index) => (
                    <ProductionStepCard
                      key={step.id}
                      step={step}
                      isActive={index === highlightedStepIndex}
                      allSteps={sortedSteps}
                    />
                  ))}
                </div>
              </CardSection>
            </div>
          </div>
        ) : (
          <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 px-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <FileText className="h-5 w-5" />
            </div>
            <p className="text-base font-semibold text-foreground">{t('common.orderNotFound')}</p>
            <p className="max-w-md text-sm text-muted-foreground">
              L ordre demande est introuvable ou n est plus disponible.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

function CardSection({ children }: { children: React.ReactNode }) {
  return <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">{children}</section>;
}

function DetailMetric({
  label,
  value,
  helper,
  icon: Icon,
}: {
  label: string;
  value: string;
  helper?: string;
  icon: typeof Package;
}) {
  return (
    <div className="rounded-xl border border-border bg-muted/20 p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-background text-muted-foreground">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
          <p className="mt-2 text-sm font-semibold text-foreground">{value}</p>
          {helper && <p className="mt-1 text-xs text-muted-foreground">{helper}</p>}
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
        'rounded-full px-2.5 py-1 text-xs font-semibold',
        priority >= 3 && 'border-red-200 bg-red-50 text-red-700',
        priority === 2 && 'border-amber-200 bg-amber-50 text-amber-700',
        priority <= 1 && 'border-border bg-muted text-muted-foreground',
      )}
    >
      Priorite {label}
    </Badge>
  );
}

function ActionButton({
  children,
  onClick,
  loading,
  disabled,
  title,
  tone = 'default',
}: {
  children: React.ReactNode;
  onClick: () => void;
  loading: boolean;
  disabled?: boolean;
  title?: string;
  tone?: 'default' | 'success' | 'danger';
}) {
  return (
    <Button
      onClick={onClick}
      disabled={loading || disabled}
      title={title}
      className={cn(
        'rounded-lg',
        tone === 'success' && 'bg-emerald-600 hover:bg-emerald-700',
        tone === 'danger' && 'bg-red-600 hover:bg-red-700',
      )}
    >
      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {children}
    </Button>
  );
}

function getOrderProgress(order?: ProductionOrder) {
  const steps = order?.steps ?? [];

  if (steps.length > 0) {
    const completedSteps = steps.filter((step) => step.status === 'completed').length;
    const skippedSteps = steps.filter((step) => step.status === 'skipped').length;
    const activeSteps = steps.filter((step) => step.status === 'in_progress').length;
    const ratio = (completedSteps + skippedSteps + activeSteps * 0.5) / steps.length;
    return Math.max(0, Math.min(100, Math.round(ratio * 100)));
  }

  if (!order) return 0;
  if (order.target_quantity > 0 && order.actual_quantity > 0) {
    return Math.max(0, Math.min(100, Math.round((order.actual_quantity / order.target_quantity) * 100)));
  }
  if (order.status === 'completed') return 100;
  if (order.status === 'in_progress') return 15;
  if (order.status === 'planned') return 5;
  return 0;
}
