import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, ArrowLeft, ArrowRight, Check, CheckCircle2, CloudOff, Loader2, Shield, Truck, WifiOff } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';
import { usePurchaseOrders } from '@/hooks/usePurchasing';
import { useReceptionDraft } from '@/hooks/useReceptionDraft';
import { useCreateReceptionIntake, type ReceptionIntakeResponse } from '@/hooks/useReceptionIntake';
import { useSiteSettings } from '@/hooks/useSettings';
import { useSuppliers } from '@/hooks/useSuppliers';
import { ApiRequestError } from '@/lib/axiosClient';
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

const STAGES: Array<{ id: IntakeStage; label: string; shortLabel: string }> = [
  { id: 1, label: 'Fournisseur & livraison', shortLabel: 'Livraison' },
  { id: 2, label: 'Lot & pesée', shortLabel: 'Pesée' },
  { id: 3, label: 'Vérification', shortLabel: 'Contrôle' },
];

const startOfToday = () => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
};

const SummaryRow = ({ label, value }: { label: string; value: string | null | undefined }) => (
  <div className="flex items-start justify-between gap-4 border-b border-border/50 py-2 text-sm last:border-0">
    <span className="text-muted-foreground">{label}</span>
    <span className="text-right font-medium">{value || '—'}</span>
  </div>
);

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
  const { response, offline, sessionExpired } = outcome;
  if (offline) {
    return (
      <div className="mx-auto max-w-xl space-y-4 rounded-2xl border border-amber-200 bg-amber-50 p-6" role="status">
        <div className="flex items-center gap-3">
          {sessionExpired ? <AlertTriangle className="h-6 w-6 text-amber-700" /> : <CloudOff className="h-6 w-6 text-amber-700" />}
          <h2 className="text-lg font-semibold">
            {sessionExpired ? 'Session expirée : réception gardée sur cet appareil'
              : !navigator.onLine ? 'Pas de connexion : réception gardée sur cet appareil'
                : 'Confirmation en attente : réception gardée sur cet appareil'}
          </h2>
        </div>
        <p className="text-sm text-amber-950">
          Ce n'est pas encore une réception enregistrée : aucun numéro, lot ni stock n'existe tant que le serveur ne l'a pas confirmée.
          {sessionExpired
            ? ' Reconnectez-vous avec le même compte : elle sera envoyée automatiquement.'
            : !navigator.onLine
              ? ' Elle sera envoyée automatiquement au retour de la connexion.'
              : ' Une nouvelle tentative d’envoi est prévue automatiquement.'}
        </p>
        {response.queue_error && <p className="text-sm text-amber-950">{response.queue_error}</p>}
        <p className="text-sm text-amber-950">Le suivi s'affiche en bas de l'écran et dans « En attente ».</p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={onNew}>Nouvelle réception</Button>
          <Button variant="outline" onClick={onClose}>Retour aux réceptions</Button>
        </div>
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-xl space-y-4 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-6" role="status">
      <div className="flex items-center gap-3">
        <CheckCircle2 className="h-7 w-7 text-emerald-600" />
        <div>
          <h2 className="text-lg font-semibold">Réception confirmée</h2>
          <p className="font-mono text-xl font-bold" data-testid="reception-number">{response.reception.reception_number}</p>
        </div>
      </div>
      <div className="space-y-1">
        {response.lots.map((lot) => (
          <div key={lot.id} className="flex items-center justify-between rounded-lg bg-background px-3 py-2 text-sm">
            <span className="font-mono font-medium">{lot.lot_internal}</span>
            <span>{lot.quantity} kg</span>
          </div>
        ))}
      </div>
      <p className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
        <Shield className="mt-0.5 h-4 w-4 shrink-0" />
        En quarantaine, en attente du contrôle qualité. Ces lots ne sont pas disponibles pour la production.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => onOpenReception(response.reception.id, 'workspace')}>Ouvrir la réception</Button>
        {canRunQc && <Button variant="outline" onClick={() => onOpenReception(response.reception.id, 'qc')}>Lancer le contrôle qualité</Button>}
        <Button variant="outline" onClick={onNew}>Nouvelle réception</Button>
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
      <div className="space-y-3 rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">
        <p>{loadError}</p>
        <Button variant="outline" onClick={onClose}>Retour aux réceptions</Button>
      </div>
    );
  }
  if (closedReceptionId !== null) {
    return (
      <div className="space-y-3 rounded-2xl border bg-muted/40 p-6 text-sm">
        <p>Cette réception a déjà été confirmée sur un autre poste.</p>
        <div className="flex gap-2">
          {closedReceptionId && <Button onClick={() => onOpenReception(closedReceptionId, 'workspace')}>Ouvrir la réception</Button>}
          <Button variant="outline" onClick={onClose}>Retour aux réceptions</Button>
        </div>
      </div>
    );
  }
  if (!draft) {
    return <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Chargement du brouillon…</div>;
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
        setSubmitError({ message: error instanceof Error ? error.message : 'La réception n\'a pas pu être confirmée.' });
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
    ? 'Enregistrement…'
    : saveState === 'shared'
      ? 'Brouillon partagé avec les autres postes'
      : saveState === 'device'
        ? 'Brouillon gardé sur cet appareil'
        : '';

  // Sticky needs a scrolling parent, which the phone shell lacks: there it sits above the bottom bar, as that bar does.
  const actionBar = (
    <div
      data-testid="intake-actions"
      className={cn(
        'border-t bg-card px-3 py-2',
        isMobile ? 'fixed inset-x-2 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-[9998]' : 'sticky bottom-0 z-30 -mx-3',
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        {draft.stage > 1 && (
          <Button type="button" variant="outline" disabled={confirming} onClick={() => goTo((draft.stage - 1) as IntakeStage)}>
            <ArrowLeft className="mr-1 h-4 w-4" />
            Retour
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          className="h-12 px-2 text-muted-foreground"
          disabled={confirming}
          onClick={() => {
            if (window.confirm('Abandonner cette réception ? La saisie sera perdue.')) void discard().then(onClose);
          }}
        >
          Abandonner
        </Button>
        <Button type="button" variant="outline" className="ml-auto h-12 px-3" disabled={confirming} onClick={() => void saveAndLeave()}>
          <span className="sm:hidden">Quitter</span>
          <span className="hidden sm:inline">Enregistrer et quitter</span>
        </Button>
        {draft.stage < 3 ? (
          <Button type="button" className="h-12 flex-1 px-6 sm:flex-none" disabled={!canContinue} onClick={() => goTo((draft.stage + 1) as IntakeStage)}>
            Continuer
            <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        ) : (
          <Button
            type="button"
            className="h-12 flex-1 px-6 sm:flex-none"
            disabled={allBlockers.length > 0 || confirming || createIntake.isPending || Boolean(conflict)}
            onClick={() => void confirm()}
          >
            {confirming || createIntake.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
            Confirmer la réception
          </Button>
        )}
      </div>
      {stageBlockers.length > 0 && (
        <p className="mt-1 truncate px-1 text-xs text-muted-foreground">Reste à faire : {stageBlockers[0]}</p>
      )}
    </div>
  );

  return (
    <div data-work-in-progress className={cn('space-y-4', isMobile && 'pb-36')}>
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" className="gap-2 px-2" disabled={confirming} onClick={() => void saveAndLeave()}>
          <ArrowLeft className="h-4 w-4" />
          Réceptions
        </Button>
        <h2 className="text-lg font-semibold">Nouvelle réception</h2>
        {draft.supplier_label && <span className="truncate text-sm text-muted-foreground">{draft.supplier_label}</span>}
        <span className="ml-auto text-xs text-muted-foreground" role="status">{saveLabel}</span>
      </div>

      <ol className="grid grid-cols-3 border-b" aria-label="Étapes de la réception">
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
                className={cn(
                  '-mb-px flex min-h-11 w-full items-center gap-2 border-b-2 px-1 py-2 text-left text-sm font-semibold',
                  current ? 'border-primary text-foreground' : done ? 'border-primary/40 text-primary hover:text-foreground' : 'border-transparent text-muted-foreground',
                )}
              >
                <span className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs', current && 'border-primary bg-primary text-primary-foreground')}>
                  {done ? <Check className="h-3.5 w-3.5" /> : stage.id}
                </span>
                <span className="truncate sm:hidden">{stage.shortLabel}</span>
                <span className="hidden truncate sm:inline">{stage.label}</span>
              </button>
            </li>
          );
        })}
      </ol>

      {conflict && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950" role="alert">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="flex-1">Un autre poste a modifié cette réception. Chargez sa version avant de continuer.</span>
          <Button size="sm" onClick={acceptConflict}>Charger la dernière version</Button>
        </div>
      )}

      {!navigator.onLine && (
        <p className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
          <WifiOff className="h-4 w-4 shrink-0" />
          Hors ligne : votre saisie reste sur cet appareil.
        </p>
      )}

      {draft.stage === 1 && (
        <StepDelivery draft={draft} update={update} policy={policy} varieties={varieties} lastDelivery={lastDelivery} sameVehicleToday={sameVehicleToday} />
      )}
      {draft.stage === 2 && (
        <StepLotWeighing draft={draft} update={update} declaredGap={declaredGap} orderGap={orderGap} expectedKg={expectedKg} />
      )}
      {draft.stage === 3 && (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-2xl border p-4">
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold"><Truck className="h-4 w-4 text-primary" />Livraison</h3>
            <SummaryRow label="Fournisseur" value={draft.supplier_label} />
            <SummaryRow label="Bon de commande" value={orderLine?.order?.order_number ?? 'Sans bon de commande'} />
            <SummaryRow label="Bon de livraison" value={draft.delivery_note_number} />
            <SummaryRow label="Véhicule" value={draft.vehicle_number} />
            <SummaryRow label="Variété" value={draft.variety} />
            <SummaryRow label="Maturité" value={draft.maturity_stage} />
            <SummaryRow label="Bio déclaré" value={draft.bio_declared ? 'Oui' : 'Non'} />
          </section>
          <section className="rounded-2xl border p-4">
            <h3 className="mb-2 text-sm font-semibold">Pesée et lot</h3>
            <SummaryRow label="Poids brut" value={draft.gross_weight_kg && `${draft.gross_weight_kg} kg`} />
            <SummaryRow label="Tare" value={draft.tare_weight_kg && `${draft.tare_weight_kg} kg`} />
            <SummaryRow label="Poids net" value={net !== null ? `${net} kg` : null} />
            <SummaryRow
              label="Provenance du poids"
              value={describeWeighingSource(draft.weighing_mode === 'CONNECTED' ? 'DEVICE' : getWeighingSource(draft))}
            />
            <SummaryRow label="Lots" value={draft.lots.map((lot) => `${lot.lot_supplier} (${lot.quantity} kg)`).join(', ')} />
            <SummaryRow label="Supports" value={`${draft.unit_count} ${draft.unit_type.toLowerCase()}`} />
            <SummaryRow label="Température" value={draft.arrival_temperature_c && `${draft.arrival_temperature_c} °C`} />
            <SummaryRow label="Zone temporaire" value={draft.storage_zone_code} />
            <SummaryRow label="Photos" value={String(draft.photos.length)} />
          </section>

          <section className="space-y-2 lg:col-span-2">
            {allBlockers.length > 0 ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4" role="alert">
                <p className="mb-2 text-sm font-semibold text-red-800">À compléter avant de confirmer</p>
                <ul className="space-y-1">
                  {allBlockers.map((blocker) => (
                    <li key={blocker.text} className="flex items-center justify-between gap-3 text-sm text-red-800">
                      <span>{blocker.text}</span>
                      <Button type="button" size="sm" variant="outline" onClick={() => goTo(blocker.stage)}>Corriger</Button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                <CheckCircle2 className="h-4 w-4" />
                Tout est renseigné. Après confirmation, les lots partent en quarantaine pour le contrôle qualité.
              </div>
            )}
            {declaredGap.level !== 'none' && (
              <Badge variant="outline" className="border-amber-300 text-amber-900">Écart BL {declaredGap.gapPercent} %</Badge>
            )}
            {submitError && (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">
                <p>{submitError.message}</p>
                {submitError.reception && (
                  <Button size="sm" variant="outline" className="mt-2" onClick={() => onOpenReception(submitError.reception!.id, 'workspace')}>
                    Ouvrir {submitError.reception.reception_number}
                  </Button>
                )}
              </div>
            )}
          </section>
        </div>
      )}

      {isMobile ? createPortal(actionBar, document.body) : actionBar}
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
