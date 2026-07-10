import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ProductionStep, ProductionStepStatus } from '@/types/production';
import { useUpdateProductionStep, useQualityChecks, useProductionConfig } from '@/hooks/useProduction';
import {
  AlertTriangle,
  CheckCircle,
  ClipboardCheck,
  Loader2,
  Play,
  Scale,
  SkipForward,
  User,
  XCircle,
} from 'lucide-react';
import { QualityCheckDialog } from './QualityCheckDialog';
import { cn } from '@/lib/utils';

interface ProductionStepCardProps {
  step: ProductionStep;
  isActive: boolean;
  allSteps?: ProductionStep[];
}

const STEP_BADGE: Record<ProductionStepStatus, string> = {
  pending: 'border-border bg-muted text-muted-foreground',
  in_progress: 'border-amber-200 bg-amber-50 text-amber-700',
  completed: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  failed: 'border-red-200 bg-red-50 text-red-700',
  skipped: 'border-orange-200 bg-orange-50 text-orange-700',
};

export const ProductionStepCard = ({ step, isActive, allSteps }: ProductionStepCardProps) => {
  const { t, i18n } = useTranslation();
  const { stepStatusLabels } = useProductionConfig();
  const [operatorName, setOperatorName] = useState(step.operator_name || '');
  const [outputQuantity, setOutputQuantity] = useState(step.output_quantity?.toString() || '');
  const [wasteQuantity, setWasteQuantity] = useState(step.waste_quantity?.toString() || '0');
  const [notes, setNotes] = useState(step.notes || '');
  const [showQualityCheck, setShowQualityCheck] = useState(false);
  const updateStep = useUpdateProductionStep();
  const { data: existingChecks = [] } = useQualityChecks(step.id);

  useEffect(() => {
    setOperatorName(step.operator_name || '');
    setOutputQuantity(step.output_quantity?.toString() || '');
    setWasteQuantity(step.waste_quantity?.toString() || '0');
    setNotes(step.notes || '');
  }, [step.id, step.operator_name, step.output_quantity, step.waste_quantity, step.notes]);

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

  const handleStatusChange = (newStatus: ProductionStepStatus) => {
    updateStep.mutate({
      id: step.id,
      status: newStatus,
      operator_name: operatorName || undefined,
      output_quantity: outputQuantity ? parseFloat(outputQuantity) : undefined,
      waste_quantity: wasteQuantity ? parseFloat(wasteQuantity) : undefined,
      notes: notes || undefined,
    });
  };

  const handleSaveData = () => {
    updateStep.mutate({
      id: step.id,
      operator_name: operatorName || undefined,
      output_quantity: outputQuantity ? parseFloat(outputQuantity) : undefined,
      waste_quantity: wasteQuantity ? parseFloat(wasteQuantity) : undefined,
      notes: notes || undefined,
    });
  };

  const isPending = step.status === 'pending';
  const isInProgress = step.status === 'in_progress';
  const isCompleted = step.status === 'completed';
  const isFailed = step.status === 'failed';
  const isSkipped = step.status === 'skipped';
  const requiresQualityCheck = step.step_definition?.requires_quality_check;

  const previousStepsBlocking = allSteps
    ? allSteps.some((candidate) => candidate.sequence_order < step.sequence_order && candidate.status !== 'completed' && candidate.status !== 'skipped')
    : false;

  const qualityCheckRequired = requiresQualityCheck && existingChecks.length === 0;
  const canComplete = !qualityCheckRequired;

  const hasFormChanges = useMemo(
    () =>
      operatorName !== (step.operator_name || '') ||
      outputQuantity !== (step.output_quantity?.toString() || '') ||
      wasteQuantity !== (step.waste_quantity?.toString() || '0') ||
      notes !== (step.notes || ''),
    [notes, operatorName, outputQuantity, step.notes, step.operator_name, step.output_quantity, step.waste_quantity, wasteQuantity],
  );

  const statusHint =
    isActive && isPending
      ? 'Prochaine etape a lancer'
      : isInProgress
        ? 'Execution en cours'
        : isCompleted
          ? 'Etape cloturee'
          : isFailed
            ? 'Incident de production'
            : isSkipped
              ? 'Etape ignoree'
              : 'En attente';

  return (
    <>
      <Card
        className={cn(
          'border-border bg-card shadow-card transition-colors',
          isActive && !isCompleted && !isFailed && 'border-primary/40 ring-1 ring-primary/20',
          isCompleted && 'border-emerald-200 bg-emerald-50/30',
          isFailed && 'border-red-200 bg-red-50/40',
          isSkipped && 'border-orange-200 bg-orange-50/30',
        )}
      >
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.12em]">
                  Etape {step.sequence_order}
                </Badge>
                <Badge className={cn('rounded-full border px-2.5 py-1 text-xs font-semibold', STEP_BADGE[step.status])}>
                  {stepStatusLabels[step.status]}
                </Badge>
                {isActive && !isCompleted && !isFailed && (
                  <Badge variant="outline" className="rounded-full border-primary/20 bg-primary/5 px-2.5 py-1 text-xs font-semibold text-primary">
                    {statusHint}
                  </Badge>
                )}
                {requiresQualityCheck && (
                  <Badge variant="outline" className="rounded-full border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                    QC requis
                  </Badge>
                )}
                {existingChecks.length > 0 && (
                  <Badge variant="outline" className="rounded-full border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                    {existingChecks.length} controle{existingChecks.length > 1 ? 's' : ''}
                  </Badge>
                )}
              </div>

              <CardTitle className="mt-3 text-lg font-semibold text-foreground">
                {step.step_definition?.name || `Etape ${step.sequence_order}`}
              </CardTitle>
              {step.step_definition?.description && (
                <p className="mt-1 text-sm text-muted-foreground">{step.step_definition.description}</p>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2 text-xs">
            {step.operator_name && (
              <InfoPill icon={User} label={`${t('production.operator')}: ${step.operator_name}`} />
            )}
            {step.output_quantity != null && (
              <InfoPill icon={Scale} label={`${t('production.output')}: ${step.output_quantity}`} />
            )}
            {step.waste_quantity > 0 && (
              <InfoPill tone="danger" label={`${t('production.losses')}: ${step.waste_quantity}`} />
            )}
            {step.started_at && (
              <InfoPill label={`Debut: ${new Date(step.started_at).toLocaleString(getDateLocale())}`} />
            )}
            {step.completed_at && (
              <InfoPill label={`Fin: ${new Date(step.completed_at).toLocaleString(getDateLocale())}`} />
            )}
          </div>

          {(isActive || isInProgress) && !isCompleted && !isFailed && !isSkipped && (
            <div className="rounded-xl border border-border bg-muted/20 p-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label className="flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    <User className="h-3 w-3" />
                    {t('production.operator')}
                  </Label>
                  <Input
                    value={operatorName}
                    onChange={(event) => setOperatorName(event.target.value)}
                    placeholder={t('production.operatorName')}
                    className="bg-background"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    <Scale className="h-3 w-3" />
                    {t('production.outputQuantity')}
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={outputQuantity}
                    onChange={(event) => setOutputQuantity(event.target.value)}
                    className="bg-background"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    {t('production.waste')}
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={wasteQuantity}
                    onChange={(event) => setWasteQuantity(event.target.value)}
                    className="bg-background"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    {t('common.notes')}
                  </Label>
                  <Textarea
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder={t('production.observations')}
                    rows={2}
                    className="bg-background"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {previousStepsBlocking && (isPending || isInProgress) && (
              <InlineWarning>
                {t('production.previousStepsRequired', 'Les étapes précédentes doivent être terminées')}
              </InlineWarning>
            )}

            {qualityCheckRequired && isInProgress && (
              <InlineWarning tone="info">
                {t('production.qualityCheckRequired', 'Contrôle qualité requis avant de terminer')}
              </InlineWarning>
            )}

            <div className="flex flex-wrap gap-2">
              {isPending && isActive && (
                <Button
                  size="sm"
                  onClick={() => handleStatusChange('in_progress')}
                  disabled={updateStep.isPending || previousStepsBlocking}
                  className="rounded-lg"
                  title={previousStepsBlocking ? t('production.previousStepsRequired', 'Les étapes précédentes doivent être terminées') : undefined}
                >
                  {updateStep.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="mr-2 h-4 w-4" />
                  )}
                  {t('production.start')}
                </Button>
              )}

              {isInProgress && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleSaveData}
                    disabled={updateStep.isPending || !hasFormChanges}
                    className="rounded-lg"
                  >
                    {updateStep.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {t('common.save')}
                  </Button>

                  {requiresQualityCheck && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setShowQualityCheck(true)}
                      className="rounded-lg"
                    >
                      <ClipboardCheck className="mr-2 h-4 w-4" />
                      {t('production.qualityCheck')}
                      {existingChecks.length > 0 && ` (${existingChecks.length})`}
                    </Button>
                  )}

                  <Button
                    size="sm"
                    onClick={() => handleStatusChange('completed')}
                    disabled={updateStep.isPending || !canComplete}
                    className="rounded-lg bg-emerald-600 hover:bg-emerald-700"
                    title={!canComplete ? t('production.qualityCheckRequired', 'Contrôle qualité requis avant de terminer') : undefined}
                  >
                    {updateStep.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                    {t('production.complete')}
                  </Button>

                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleStatusChange('failed')}
                    disabled={updateStep.isPending}
                    className="rounded-lg"
                  >
                    {updateStep.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <XCircle className="mr-2 h-4 w-4" />}
                    {t('production.fail')}
                  </Button>

                  {!step.step_definition?.requires_quality_check && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleStatusChange('skipped')}
                      disabled={updateStep.isPending || previousStepsBlocking}
                      className="rounded-lg"
                    >
                      {updateStep.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <SkipForward className="mr-2 h-4 w-4" />}
                      {t('production.skip')}
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <QualityCheckDialog
        open={showQualityCheck}
        onOpenChange={setShowQualityCheck}
        stepId={step.id}
        stepName={step.step_definition?.name || ''}
      />
    </>
  );
};

function InfoPill({
  label,
  icon: Icon,
  tone = 'default',
}: {
  label: string;
  icon?: typeof User;
  tone?: 'default' | 'danger';
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs',
        tone === 'default' && 'bg-muted text-muted-foreground',
        tone === 'danger' && 'bg-red-100 text-red-700',
      )}
    >
      {Icon && <Icon className="h-3 w-3" />}
      {label}
    </span>
  );
}

function InlineWarning({
  children,
  tone = 'warning',
}: {
  children: React.ReactNode;
  tone?: 'warning' | 'info';
}) {
  return (
    <div
      className={cn(
        'flex items-start gap-2 rounded-lg border px-3 py-2 text-sm',
        tone === 'warning' && 'border-amber-200 bg-amber-50 text-amber-700',
        tone === 'info' && 'border-blue-200 bg-blue-50 text-blue-700',
      )}
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{children}</span>
    </div>
  );
}
