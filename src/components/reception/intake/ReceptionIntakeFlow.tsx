import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, ArrowLeft, ArrowRight, Check, CheckCircle2, CloudOff, Loader2, Scale, Shield, Truck, WifiOff } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ReviewList } from '@/components/shared/task';
import { useIsMobile } from '@/hooks/use-mobile';
import { usePurchaseOrders } from '@/hooks/usePurchasing';
import { useReceptionDraft } from '@/hooks/useReceptionDraft';
import { useCreateReceptionIntake, type ReceptionIntakeResponse } from '@/hooks/useReceptionIntake';
import { useSiteSettings } from '@/hooks/useSettings';
import { useSuppliers } from '@/hooks/useSuppliers';
import { ApiRequestError } from '@/lib/axiosClient';
import { formatNumber } from '@/lib/format';
import {
  assessWeightGap,
  buildIntakePayload,
  DEFAULT_INTAKE_POLICY,
  describeWeighingSource,
  getDeliveryBlockers,
  getNetWeightKg,
  getWeighingBlockers,
  getWeighingSource,
  type IntakeDraft,
  type IntakePolicy,
  type IntakeStage,
} from '@/lib/receptionIntake';
import { computeReceptionDraftSignals, hasValidBioCertification } from '@/lib/royalPalmPhase1';
import { cn } from '@/lib/utils';
import { getPurchaseOrderLineRemainingQuantity } from '@/types/purchasing';
import { useSearchReceptionsQuery } from '@/store/api/receptionsApi';
import type { ReceptionV2 } from '@/types/reception';

import { StepDelivery } from './StepDelivery';
import { StepLotWeighing } from './StepLotWeighing';

const STAGES: Array<{ id: IntakeStage; key: 'delivery' | 'weighing' | 'review' }> = [
  { id: 1, key: 'delivery' },
  { id: 2, key: 'weighing' },
  { id: 3, key: 'review' },
];

const startOfToday = () => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
};

interface IntakeOutcome {
  response: ReceptionIntakeResponse;
  offline: boolean;
  sessionExpired: boolean;
}

const IntakeResult = ({ outcome, canRunQc, onOpenReception, onNew, onClose }: {
  outcome: IntakeOutcome;
  canRunQc: boolean;
  onOpenReception: (id: string, next: 'workspace' | 'qc') => void;
  onNew: () => void;
  onClose: () => void;
}) => {
  const { t } = useTranslation();
  const { response, offline, sessionExpired } = outcome;
  if (offline) {
    return (
      <div className="mx-auto max-w-xl space-y-4 rounded-2xl border border-amber-200 bg-sand p-6 text-sand-foreground shadow-sm" role="status">
        <div className="flex items-center gap-3">
          {sessionExpired ? <AlertTriangle className="h-7 w-7 shrink-0" /> : <CloudOff className="h-7 w-7 shrink-0" />}
          <h2 className="font-display text-xl font-semibold text-inherit">
            {sessionExpired ? t('intake.result.keptExpired')
              : !navigator.onLine ? t('intake.result.keptOffline')
                : t('intake.result.keptPending')}
          </h2>
        </div>
        <p className="text-sm">
          {t('intake.result.notYet')}
          {sessionExpired ? t('intake.result.reconnect') : !navigator.onLine ? t('intake.result.whenOnline') : t('intake.result.retrying')}
        </p>
        {response.queue_error && <p className="text-sm">{response.queue_error}</p>}
        <p className="text-sm">{t('intake.result.tracking')}</p>
        <div className="flex flex-wrap gap-2">
          <Button size="lg" onClick={onNew}>{t('intake.newReception')}</Button>
          <Button size="lg" variant="outline" onClick={onClose}>{t('intake.backToList')}</Button>
        </div>
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-xl space-y-5 rounded-2xl border bg-card p-6 shadow-md" role="status">
      <div className="flex items-center gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent text-primary"><CheckCircle2 className="h-7 w-7" /></span>
        <div>
          <h2 className="font-display text-xl font-semibold">{t('intake.result.confirmed')}</h2>
          <p className="font-mono text-2xl font-bold" dir="ltr" data-testid="reception-number">{response.reception.reception_number}</p>
        </div>
      </div>
      <ul className="space-y-1.5">
        {response.lots.map((lot) => (
          <li key={lot.id} className="flex items-center justify-between rounded-xl border bg-secondary px-4 py-2.5">
            <span className="font-mono font-semibold" dir="ltr">{lot.lot_internal}</span>
            <span className="tabular-nums">{formatNumber(lot.quantity)} kg</span>
          </li>
        ))}
      </ul>
      <p className="flex items-start gap-2 rounded-xl border border-amber-200 bg-sand p-3 text-sm text-sand-foreground">
        <Shield className="mt-0.5 h-4 w-4 shrink-0" />
        {t('intake.result.quarantine')}
      </p>
      <div className="flex flex-wrap gap-2">
        {canRunQc && <Button size="lg" onClick={() => onOpenReception(response.reception.id, 'qc')}>{t('intake.startQc')}<ArrowRight /></Button>}
        <Button size="lg" variant={canRunQc ? 'outline' : 'default'} onClick={() => onOpenReception(response.reception.id, 'workspace')}>{t('intake.openReception')}</Button>
        <Button size="lg" variant="outline" onClick={onNew}>{t('intake.newReception')}</Button>
      </div>
    </div>
  );
};

const FlowBody = ({ draftId, prefillPurchaseOrderId, canRunQc, onClose, onOpenReception, onNew }: {
  draftId?: string | null;
  prefillPurchaseOrderId?: string;
  canRunQc: boolean;
  onClose: () => void;
  onOpenReception: (id: string, next: 'workspace' | 'qc') => void;
  onNew: () => void;
}) => {
  const { t } = useTranslation();
  const { draft, update, share, getServerVersion, saveState, conflict, acceptConflict, reportConflict, closedReceptionId, loadError, discard } = useReceptionDraft(draftId);
  const isMobile = useIsMobile();
  const { data: settings } = useSiteSettings();
  const { data: suppliers = [] } = useSuppliers();
  const { data: orders = [] } = usePurchaseOrders();
  const [todayStart] = useState(startOfToday);
  const { data: todayPage } = useSearchReceptionsQuery({ from: todayStart, limit: 100 });
  const { data: lastPage } = useSearchReceptionsQuery(
    { supplierId: draft?.supplier_id, limit: 1 },
    { skip: !draft?.supplier_id },
  );
  const createIntake = useCreateReceptionIntake();
  const [outcome, setOutcome] = useState<IntakeOutcome | null>(null);
  const [submitError, setSubmitError] = useState<{ message: string; reception?: ReceptionV2 } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [abandonOpen, setAbandonOpen] = useState(false);
  const submitting = useRef(false);

  const operations = settings?.operations;
  const policy = useMemo<IntakePolicy>(() => ({
    allowSpontaneous: operations?.allow_spontaneous_reception ?? DEFAULT_INTAKE_POLICY.allowSpontaneous,
    requirePurchaseOrder: operations?.require_purchase_order_for_reception ?? DEFAULT_INTAKE_POLICY.requirePurchaseOrder,
    requireVehicleNumber: operations?.require_vehicle_number_on_reception ?? DEFAULT_INTAKE_POLICY.requireVehicleNumber,
    weightGapWarningPct: operations?.reception_weight_gap_warning_pct ?? DEFAULT_INTAKE_POLICY.weightGapWarningPct,
    weightGapCriticalPct: operations?.reception_weight_gap_critical_pct ?? DEFAULT_INTAKE_POLICY.weightGapCriticalPct,
  }), [operations]);
  const varieties = useMemo(
    () => (operations?.reception_varieties ?? []).map((name) => name.trim()).filter(Boolean),
    [operations],
  );

  const prefilled = useRef(false);
  useEffect(() => {
    if (prefilled.current || !prefillPurchaseOrderId || !draft || orders.length === 0 || suppliers.length === 0) return;
    prefilled.current = true;
    const order = orders.find((row) => row.id === prefillPurchaseOrderId);
    if (!order) return;
    const supplier = suppliers.find((row) => row.id === order.supplier_id);
    const openLines = (order.lines ?? []).filter((line) => getPurchaseOrderLineRemainingQuantity(line) > 0.0001);
    update({
      supplier_id: order.supplier_id ?? '',
      supplier_label: supplier ? `${supplier.code} · ${supplier.name}` : '',
      purchase_order_id: order.id,
      purchase_order_line_id: openLines.length === 1 ? openLines[0].id : '',
    });
  }, [draft, orders, prefillPurchaseOrderId, suppliers, update]);

  const supplier = useMemo(() => suppliers.find((row) => row.id === draft?.supplier_id) ?? null, [draft?.supplier_id, suppliers]);
  const orderLine = useMemo(() => {
    if (!draft?.purchase_order_line_id) return null;
    const order = orders.find((row) => row.id === draft.purchase_order_id);
    return { order, line: order?.lines?.find((row) => row.id === draft.purchase_order_line_id) ?? null };
  }, [draft?.purchase_order_id, draft?.purchase_order_line_id, orders]);
  const expectedKg = orderLine?.line ? getPurchaseOrderLineRemainingQuantity(orderLine.line) : null;
  const net = draft ? getNetWeightKg(draft) : null;
  const declaredGap = useMemo(
    () => assessWeightGap(net, draft?.declared_weight_kg ? Number(draft.declared_weight_kg.replace(',', '.')) : null, policy),
    [draft?.declared_weight_kg, net, policy],
  );
  const orderGap = useMemo(() => assessWeightGap(net, expectedKg, policy), [expectedKg, net, policy]);

  const todayRows = todayPage?.rows ?? [];
  const lastDelivery = lastPage?.rows[0] ?? null;
  const plate = draft?.vehicle_number.trim().toUpperCase();
  const sameVehicleToday = plate ? todayRows.filter((row) => row.vehicle_number?.trim().toUpperCase() === plate).length : 0;

  if (loadError) {
    return (
      <div className="space-y-3 rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-800" role="alert">
        <p>{loadError}</p>
        <Button variant="outline" onClick={onClose}>{t('intake.backToList')}</Button>
      </div>
    );
  }
  if (closedReceptionId !== null) {
    return (
      <div className="space-y-3 rounded-2xl border bg-card p-6 text-sm shadow-sm">
        <p>{t('intake.closedElsewhere')}</p>
        <div className="flex flex-wrap gap-2">
          {closedReceptionId && <Button onClick={() => onOpenReception(closedReceptionId, 'workspace')}>{t('intake.openReception')}</Button>}
          <Button variant="outline" onClick={onClose}>{t('intake.backToList')}</Button>
        </div>
      </div>
    );
  }
  if (!draft) {
    return <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground" role="status"><Loader2 className="h-4 w-4 animate-spin" />{t('intake.loadingDraft')}</div>;
  }
  if (outcome) {
    return <IntakeResult outcome={outcome} canRunQc={canRunQc} onOpenReception={onOpenReception} onNew={onNew} onClose={onClose} />;
  }

  const deliveryBlockers = getDeliveryBlockers(draft, policy, { hasBioCertification: hasValidBioCertification(supplier) });
  const weighingBlockers = getWeighingBlockers(draft);

  const goTo = (stage: IntakeStage) => {
    if (submitting.current) return;
    const next: IntakeDraft = { ...draft, stage };
    update({ stage });
    void share(next);
    window.scrollTo({ top: 0 });
  };

  const saveAndLeave = async () => {
    if (submitting.current) return;
    await share();
    onClose();
  };

  const confirm = async () => {
    if (submitting.current) return;
    submitting.current = true;
    setConfirming(true);
    setSubmitError(null);
    try {
      const signals = computeReceptionDraftSignals({
        netWeightKg: net ?? 0,
        declaredWeightKg: null,
        arrivalTemperatureC: Number(draft.arrival_temperature_c.replace(',', '.')),
        departureTime: draft.departure_time,
        actualArrivalDate: draft.gate_arrival_at,
        bioDeclared: draft.bio_declared,
        supplier,
      });
      // Alert texts are stored with the reception: they stay in French, the factory's record language.
      const alerts = [
        ...(signals.temperatureAlert === 'critical' ? ['Température à l\'arrivée supérieure à 35 °C'] : []),
        ...(getWeighingSource(draft) === 'MANUAL' ? ['RG-R08 — Poids saisi sans bascule : validation direction requise'] : []),
      ];
      // A shared draft is confirmed at the version just saved. Offline it stays unversioned on this device.
      await share(undefined, { rejectConflicts: true });
      const response = await createIntake.mutateAsync(buildIntakePayload({ ...draft, version: getServerVersion() }, alerts));
      setOutcome({ response, offline: Boolean(response.offline_queued), sessionExpired: Boolean(response.session_expired) });
    } catch (error) {
      if (error instanceof ApiRequestError && error.code === 'DRAFT_STALE') {
        const newer = (error.details as { draft?: { payload?: IntakeDraft; id: string; version: number } } | undefined)?.draft;
        if (newer?.payload) reportConflict({ ...newer.payload, id: newer.id, version: newer.version });
        setSubmitError({ message: error.message });
      } else if (error instanceof ApiRequestError && error.code === 'IDEMPOTENT_PAYLOAD_MISMATCH') {
        const existing = (error.details as { response?: { reception?: ReceptionV2 } } | undefined)?.response?.reception;
        setSubmitError({ message: error.message, reception: existing });
      } else {
        setSubmitError({ message: error instanceof Error ? error.message : t('intake.review.failed') });
      }
    } finally {
      submitting.current = false;
      setConfirming(false);
    }
  };

  const allBlockers = [
    ...deliveryBlockers.map((text) => ({ text, stage: 1 as IntakeStage })),
    ...weighingBlockers.map((text) => ({ text, stage: 2 as IntakeStage })),
  ];
  const stageBlockers = draft.stage === 1 ? deliveryBlockers : draft.stage === 2 ? weighingBlockers : [];
  const canContinue = stageBlockers.length === 0;
  const saveLabel = saveState === 'saving'
    ? t('intake.saving')
    : saveState === 'shared'
      ? t('intake.savedShared')
      : saveState === 'device'
        ? t('intake.savedDevice')
        : '';
  const currentStage = STAGES.find((stage) => stage.id === draft.stage) ?? STAGES[0];
  const netLabel = net !== null ? `${formatNumber(net)} kg` : '—';

  // Sticky needs a scrolling parent, which the phone shell lacks: there it sits above the dock, as the dock does.
  const actionBar = (
    <div
      data-testid="intake-actions"
      className={cn(
        'border-t bg-card/95 px-3 py-3 backdrop-blur sm:px-5',
        isMobile ? 'fixed inset-x-2 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[44] rounded-2xl border shadow-lg' : 'above-dock sticky z-30 rounded-b-2xl',
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        {draft.stage > 1 && (
          <Button type="button" variant="outline" size="lg" disabled={confirming} onClick={() => goTo((draft.stage - 1) as IntakeStage)}>
            <ArrowLeft className="h-4 w-4" />
            {t('intake.previous')}
          </Button>
        )}
        <Button type="button" variant="ghost" size="lg" className="px-3 text-muted-foreground" disabled={confirming} onClick={() => setAbandonOpen(true)}>
          {t('intake.abandon')}
        </Button>
        {draft.stage > 1 && (
          <span className="flex items-center gap-1.5 rounded-xl bg-accent px-3 py-2 text-sm font-semibold text-accent-foreground" data-testid="intake-net">
            <Scale className="h-4 w-4" aria-hidden />
            {t('intake.net')} <span className="tabular-nums" dir="ltr">{netLabel}</span>
          </span>
        )}
        <Button type="button" variant="outline" size="lg" className="ms-auto px-4" disabled={confirming} onClick={() => void saveAndLeave()}>
          <span className="sm:hidden">{t('intake.quit')}</span>
          <span className="hidden sm:inline">{t('intake.saveAndQuit')}</span>
        </Button>
        {draft.stage < 3 ? (
          <Button type="button" size="lg" className="flex-1 px-7 sm:flex-none" disabled={!canContinue} onClick={() => goTo((draft.stage + 1) as IntakeStage)}>
            {t('intake.continue')}
            <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            type="button"
            size="lg"
            className="flex-1 px-7 sm:flex-none"
            disabled={allBlockers.length > 0 || confirming || createIntake.isPending || Boolean(conflict)}
            onClick={() => void confirm()}
          >
            {confirming || createIntake.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {t('intake.confirm')}
          </Button>
        )}
      </div>
      {stageBlockers.length > 0 && (
        <ul className="mt-2 space-y-1 px-1 text-sm text-foreground">
          {stageBlockers.map((text) => (
            <li key={text}>{t('intake.remaining', { text })}</li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <div data-work-in-progress className={cn('mx-auto w-full max-w-5xl space-y-4', isMobile && 'pb-48')}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Button variant="ghost" className="gap-2 px-2" disabled={confirming} onClick={() => void saveAndLeave()}>
          <ArrowLeft className="h-4 w-4" />
          {t('intake.back')}
        </Button>
        <span className="ms-auto text-xs text-muted-foreground" role="status">{saveLabel}</span>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-semibold text-primary">
          <Truck className="me-1.5 inline h-4 w-4 align-[-2px]" aria-hidden />
          {t('intake.title')}{draft.supplier_label && <span className="font-normal text-muted-foreground"> · {draft.supplier_label}</span>}
        </p>
        <p className="text-sm text-muted-foreground">{t('task.stepOf', { current: draft.stage, total: STAGES.length })}</p>
        <ol className="grid grid-cols-3 gap-2" aria-label={t('intake.stepsLabel')}>
          {STAGES.map((stage) => {
            const done = stage.id < draft.stage;
            const current = stage.id === draft.stage;
            return (
              <li key={stage.id}>
                <button
                  type="button"
                  disabled={confirming || stage.id > draft.stage}
                  aria-current={current ? 'step' : undefined}
                  onClick={() => goTo(stage.id)}
                  className="group flex min-h-11 w-full flex-col gap-1.5 text-start disabled:cursor-default"
                >
                  <span className={cn('h-1.5 w-full rounded-full', done ? 'bg-primary' : current ? 'bg-primary/60' : 'bg-border')} />
                  <span className={cn('flex items-center gap-1.5 text-sm font-semibold',
                    current ? 'text-foreground' : done ? 'text-primary group-hover:underline' : 'text-muted-foreground')}>
                    {done && <Check className="h-3.5 w-3.5 shrink-0" aria-hidden />}
                    <span className="truncate sm:hidden">{t(`intake.stages.${stage.key}Short`)}</span>
                    <span className="hidden truncate sm:inline">{t(`intake.stages.${stage.key}`)}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      {conflict && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-300 bg-sand p-3 text-sm text-sand-foreground" role="alert">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="flex-1">{t('intake.conflict')}</span>
          <Button size="sm" onClick={acceptConflict}>{t('intake.loadLatest')}</Button>
        </div>
      )}

      {!navigator.onLine && (
        <p className="flex items-center gap-2 rounded-xl border border-amber-200 bg-sand p-3 text-sm text-sand-foreground" role="status">
          <WifiOff className="h-4 w-4 shrink-0" />
          {t('intake.offline')}
        </p>
      )}

      <div className="rounded-2xl border bg-card shadow-sm">
        <header className="border-b px-4 py-4 sm:px-6">
          <h2 className="font-display text-2xl font-semibold">{t(`intake.stages.${currentStage.key}`)}</h2>
        </header>
        <div className="px-4 py-5 sm:px-6">
          {draft.stage === 1 && (
            <StepDelivery draft={draft} update={update} policy={policy} varieties={varieties} lastDelivery={lastDelivery} sameVehicleToday={sameVehicleToday} />
          )}
          {draft.stage === 2 && (
            <StepLotWeighing draft={draft} update={update} declaredGap={declaredGap} orderGap={orderGap} expectedKg={expectedKg} />
          )}
          {draft.stage === 3 && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-end justify-between gap-3 rounded-2xl bg-accent px-5 py-4 text-accent-foreground">
                <div>
                  <p className="text-sm font-medium">{t('intake.netWeight')}</p>
                  <p className="font-display text-4xl font-semibold tabular-nums" dir="ltr">{netLabel}</p>
                </div>
                {declaredGap.level !== 'none' && (
                  <Badge variant="outline" className="border-amber-400 bg-sand text-sand-foreground">{t('intake.review.gapBadge', { pct: declaredGap.gapPercent })}</Badge>
                )}
              </div>
              <section className="space-y-2">
                <h3 className="flex items-center gap-2 font-display text-lg font-semibold"><Truck className="h-4 w-4 text-primary" />{t('intake.review.delivery')}</h3>
                <ReviewList items={[
                  { label: t('intake.review.supplier'), value: draft.supplier_label, wide: true },
                  { label: t('intake.review.order'), value: orderLine?.order?.order_number ?? t('intake.review.noOrder') },
                  { label: t('intake.review.deliveryNote'), value: draft.delivery_note_number },
                  { label: t('intake.review.vehicle'), value: draft.vehicle_number },
                  { label: t('intake.review.variety'), value: draft.variety },
                  { label: t('intake.review.maturity'), value: draft.maturity_stage },
                  { label: t('intake.review.bio'), value: draft.bio_declared ? t('intake.review.yes') : t('intake.review.no') },
                ]} />
              </section>
              <section className="space-y-2">
                <h3 className="flex items-center gap-2 font-display text-lg font-semibold"><Scale className="h-4 w-4 text-primary" />{t('intake.review.weighing')}</h3>
                <ReviewList items={[
                  { label: t('intake.review.gross'), value: draft.gross_weight_kg && `${draft.gross_weight_kg} kg` },
                  { label: t('intake.review.tare'), value: draft.tare_weight_kg && `${draft.tare_weight_kg} kg` },
                  { label: t('intake.review.source'), value: describeWeighingSource(draft.weighing_mode === 'CONNECTED' ? 'DEVICE' : getWeighingSource(draft)), wide: true },
                  { label: t('intake.review.lots'), value: draft.lots.map((lot) => `${lot.lot_supplier} (${lot.quantity} kg)`).join(', '), wide: true },
                  { label: t('intake.review.units'), value: `${draft.unit_count} ${draft.unit_type.toLowerCase()}` },
                  { label: t('intake.review.temperature'), value: draft.arrival_temperature_c && `${draft.arrival_temperature_c} °C` },
                  { label: t('intake.review.zone'), value: draft.storage_zone_code },
                  { label: t('intake.review.photos'), value: String(draft.photos.length) },
                ]} />
              </section>

              {allBlockers.length > 0 ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4" role="alert">
                  <p className="mb-2 font-semibold text-red-800">{t('intake.review.missingTitle')}</p>
                  <ul className="space-y-2">
                    {allBlockers.map((blocker) => (
                      <li key={blocker.text} className="flex items-center justify-between gap-3 text-sm text-red-800">
                        <span>{blocker.text}</span>
                        <Button type="button" size="sm" variant="outline" onClick={() => goTo(blocker.stage)}>{t('intake.review.fix')}</Button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-accent p-4 text-sm text-accent-foreground">
                  <CheckCircle2 className="h-5 w-5 shrink-0" />
                  {t('intake.review.ready')}
                </div>
              )}
              {submitError && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">
                  <p>{submitError.message}</p>
                  {submitError.reception && (
                    <Button size="sm" variant="outline" className="mt-2" onClick={() => onOpenReception(submitError.reception!.id, 'workspace')}>
                      {t('intake.review.open', { number: submitError.reception.reception_number })}
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
        {!isMobile && actionBar}
      </div>

      {isMobile && createPortal(actionBar, document.body)}

      <AlertDialog open={abandonOpen} onOpenChange={setAbandonOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('intake.abandonTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('intake.abandonBody')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('intake.keep')}</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => void discard().then(onClose)}>
              {t('intake.abandonConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export const ReceptionIntakeFlow = (props: {
  draftId?: string | null;
  prefillPurchaseOrderId?: string;
  canRunQc: boolean;
  onClose: () => void;
  onOpenReception: (id: string, next: 'workspace' | 'qc') => void;
}) => {
  // A new key is a new delivery: nothing of the previous one can leak into it.
  const [run, setRun] = useState(0);
  return (
    <FlowBody
      key={`${props.draftId ?? 'new'}-${run}`}
      {...props}
      draftId={run === 0 ? props.draftId : null}
      prefillPurchaseOrderId={run === 0 ? props.prefillPurchaseOrderId : undefined}
      onNew={() => setRun((value) => value + 1)}
    />
  );
};
