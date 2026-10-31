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
  CheckCircle,
  FileText,
  Loader2,
  Play,
  XCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProductionOrderDetailProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-/i;

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
      ? 'En préparation, pas encore planifié.'
      : order?.status === 'planned'
        ? 'Prêt à être lancé sur la ligne.'
        : order?.status === 'in_progress'
          ? 'En cours d\'exécution.'
          : order?.status === 'completed'
            ? 'Clôturé et tracé.'
            : 'Annulé, retiré du flux actif.';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-6xl overflow-hidden p-0">
        {isLoading ? (
          <div className="flex min-h-[360px] items-center justify-center">
            <div className="flex flex-col items-center gap-3 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
              <p className="text-sm">Chargement de l'ordre de fabrication…</p>
            </div>
          </div>
        ) : order ? (
          <div className="max-h-[92vh] overflow-y-auto">
            <DialogHeader className="border-b px-4 py-3 pr-12 text-left">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <DialogTitle className="font-mono text-xl">{order.order_number}</DialogTitle>
                  <p className="text-sm text-foreground">{order.product_name}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Badge className={cn('rounded-full border px-2 py-0.5 text-xs font-semibold', STATUS_BADGE[order.status])}>
                      {orderStatusLabels[order.status]}
                    </Badge>
                    {order.flux_code && (
                      <Badge className="rounded-sm px-2 py-0.5 text-xs font-bold text-white" style={{ backgroundColor: fluxCodeColors[order.flux_code] }}>
                        {order.flux_code} — {fluxCodeLabels[order.flux_code]}
                      </Badge>
                    )}
                    <PriorityBadge priority={order.priority} />
                    <span className="text-sm text-muted-foreground">{statusMessage}</span>
                  </div>
                </div>

                <div className="flex flex-col items-start gap-1 lg:items-end">
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
                      >
                        <Play className="mr-2 h-4 w-4" />
                        {t('common.startProduction')}
                      </ActionButton>
                    )}

                    {order.status === 'in_progress' && (
                      <>
                        <ActionButton
                          tone="danger"
                          loading={updateStatus.isPending && updateStatus.variables?.status === 'cancelled'}
                          onClick={() => handleStatusChange('cancelled')}
                        >
                          <XCircle className="mr-2 h-4 w-4" />
                          {t('common.cancel')}
                        </ActionButton>
                        <ActionButton
                          tone="success"
                          loading={updateStatus.isPending && updateStatus.variables?.status === 'completed'}
                          onClick={() => handleStatusChange('completed')}
                        >
                          <CheckCircle className="mr-2 h-4 w-4" />
                          {t('common.completeOrder')}
                        </ActionButton>
                      </>
                    )}
                  </div>
                  {order.status === 'planned' && lotAllocations.length === 0 && (
                    <p className="text-sm font-medium text-amber-800">Allouez au moins un lot libéré avant de lancer.</p>
                  )}
                </div>
              </div>
            </DialogHeader>

            <div className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
              <div className="min-w-0 space-y-4">
                <section className="rounded-lg border bg-card p-3">
                  <LotAllocationPanel
                    orderId={order.id}
                    targetQuantity={order.target_quantity}
                    targetUnit={order.unit}
                    orderStatus={order.status}
                  />
                </section>

                {(order.status === 'in_progress' || order.status === 'completed') && (
                  <section className="rounded-lg border bg-card p-3">
                    <OutputLotPanel
                      orderId={order.id}
                      orderNumber={order.order_number}
                      targetUnit={order.unit}
                      orderStatus={order.status}
                      actorName={actorName}
                    />
                  </section>
                )}

                <section aria-labelledby="order-steps-title" className="space-y-2">
                  <h3 id="order-steps-title" className="text-base">{t('production.steps')}</h3>
                  {sortedSteps.length === 0 ? (
                    <p className="rounded-lg border bg-card py-6 text-center text-sm text-muted-foreground">Aucune étape pour cet ordre.</p>
                  ) : (
                    <div className="space-y-2">
                      {sortedSteps.map((step, index) => (
                        <ProductionStepCard
                          key={step.id}
                          step={step}
                          isActive={index === highlightedStepIndex}
                          allSteps={sortedSteps}
                        />
                      ))}
                    </div>
                  )}
                </section>
              </div>

              <aside className="min-w-0 xl:order-last">
                <dl className="divide-y rounded-lg border bg-card text-sm">
                  <div className="px-3 py-2">
                    <dt className="text-xs text-muted-foreground">{t('common.progress')}</dt>
                    <dd className="flex items-center gap-2 font-medium">
                      <Progress value={progress} className="h-2 flex-1" aria-label={t('common.progress')} />
                      {progress} %
                    </dd>
                    <dd className="text-xs text-muted-foreground">
                      {completedSteps + skippedSteps} sur {totalSteps} étapes clôturées
                      {inProgressSteps > 0 ? `, ${inProgressSteps} en cours` : ''}
                      {skippedSteps > 0 ? `, ${skippedSteps} ignorée${skippedSteps > 1 ? 's' : ''}` : ''}
                    </dd>
                  </div>
                  <Fact label={t('production.targetQuantity')} value={quantityText(order.target_quantity, order.unit)} />
                  <Fact label={t('production.actualQuantity')} value={quantityText(order.actual_quantity, order.unit)} />
                  <Fact
                    label={t('production.startDate')}
                    value={order.planned_start_date ? new Date(order.planned_start_date).toLocaleDateString(getDateLocale()) : 'Non planifiée'}
                  />
                  <Fact
                    label={t('common.linkedToReception')}
                    value={
                      order.reception
                        ? [order.reception.reception_number, order.reception.material?.name, order.reception.supplier?.name, order.reception.variety].filter(Boolean).join(', ')
                        : order.reception_number_snapshot
                          ? [order.reception_number_snapshot, order.supplier_name_snapshot].filter(Boolean).join(', ')
                          : 'Aucune réception liée'
                    }
                  />
                  <Fact
                    label={t('production.createdBy')}
                    value={order.created_by && !UUID_PATTERN.test(order.created_by) ? order.created_by : 'Non renseigné'}
                    helper={`Le ${new Date(order.created_at).toLocaleString(getDateLocale())}`}
                  />
                  {order.notes && <Fact label={t('common.notes')} value={order.notes} />}
                </dl>
              </aside>
            </div>
          </div>
        ) : (
          <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 px-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <FileText className="h-5 w-5" />
            </div>
            <p className="text-base font-semibold text-foreground">{t('common.orderNotFound')}</p>
            <p className="max-w-md text-sm text-muted-foreground">
              Cet ordre est introuvable ou n'est plus disponible.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

function Fact({ label, value, helper }: { label: string; value: string; helper?: string }) {
  return (
    <div className="px-3 py-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
      {helper && <dd className="text-xs text-muted-foreground">{helper}</dd>}
    </div>
  );
}

function quantityText(quantity: number | null | undefined, unit: string | null | undefined) {
  return quantity == null ? 'Non renseignée' : `${quantity} ${unit ?? ''}`.trim();
}

function PriorityBadge({ priority }: { priority: number }) {
  const label = priority >= 3 ? 'urgente' : priority === 2 ? 'normale' : 'basse';

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
      Priorité {label}
    </Badge>
  );
}

function ActionButton({
  children,
  onClick,
  loading,
  disabled,
  tone = 'default',
}: {
  children: React.ReactNode;
  onClick: () => void;
  loading: boolean;
  disabled?: boolean;
  tone?: 'default' | 'success' | 'danger';
}) {
  return (
    <Button
      onClick={onClick}
      disabled={loading || disabled}
      className={cn(
        tone === 'success' && 'bg-emerald-700 hover:bg-emerald-800',
        tone === 'danger' && 'bg-red-700 hover:bg-red-800',
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
