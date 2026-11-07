import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Ban,
  CheckCircle,
  ChevronDown,
  CircleCheck,
  Clock3,
  FileText,
  FlaskConical,
  History,
  Image as ImageIcon,
  Lock,
  LockOpen,
  Package,
  Pencil,
  Play,
  Printer,
  QrCode,
  Scale,
  Shield,
  Truck,
  Warehouse,
  XCircle,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ReviewList } from '@/components/shared/task';
import { useAuthContext } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { formatDateTime as formatLocalDateTime, formatNumber } from '@/lib/format';
import {
  describeReceptionAuditEvent,
  getReceptionNextStep,
  getReceptionPermissions,
  type ReceptionAuditLog,
} from '@/lib/receptionWorkflow';
import { useReceptionLabels } from '@/lib/receptionLabels';
import { useListReceptionAuditQuery } from '@/store/api/receptionsApi';
import {
  receptionErrorMessage,
  useQCInspections,
  useReceptionLots,
  useReceptionV2Detail,
  useUpdateReceptionV2Status,
} from '@/hooks/useReceptionsV2';
import {
  qcDecisionColors,
  receptionStatusColors,
  ReceptionLot,
  ReceptionUnit,
  stockStatusColors,
} from '@/types/reception';

import { LabelPrintDialog } from './LabelPrintDialog';
import { BonReceptionDialog } from './BonReceptionDialog';
import { BonExpeditionDialog } from './BonExpeditionDialog';
import { RapportQCDialog } from './RapportQCDialog';
import { ReclamationFournisseurDialog } from './ReclamationFournisseurDialog';
import { BonReclamationDialog } from './BonReclamationDialog';
import { QCInspectionDialog } from './QCInspectionDialog';
import { StorageAssignment } from './StorageAssignment';
import { UnitsManagement } from './UnitsManagement';
import { WeighingRecordDialog } from './WeighingRecordDialog';
import { Gs1LabelPreview } from './Gs1LabelPreview';
import { LotCostCard } from './LotCostCard';
import { ReceptionLotStatusDialog } from './ReceptionLotStatusDialog';
import { ReceptionCancelDialog } from './ReceptionCancelDialog';
import { ReceptionCorrectionDialog } from './ReceptionCorrectionDialog';

export type ReceptionWorkspaceSection = 'overview' | 'lots' | 'qc' | 'stock' | 'documents' | 'history';

interface ReceptionDetailV2Props {
  receptionId: string;
  onBack: () => void;
  /** Section shown first, e.g. « stock » when coming back from a QC release. */
  initialSection?: ReceptionWorkspaceSection;
  /** Opens the QC inspection as soon as the reception is loaded (wizard « Lancer le contrôle QC »). */
  autoStartQc?: boolean;
}

const formatDateTime = (value?: string | null) => (value ? formatLocalDateTime(value) : null);
/** A number with its unit, kept left-to-right inside Arabic text. */
const qty = (value: number | null | undefined, unit: string, digits = 1) =>
  value != null ? <bdi dir="ltr">{formatNumber(value, digits)} {unit}</bdi> : undefined;

/** A titled block of the workspace. One style for every section. */
function Section({ title, icon, action, children, className }: { title: string; icon?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('space-y-3 rounded-2xl border bg-card p-4 sm:p-5', className)}>
      <div className="flex flex-wrap items-center gap-2">
        {icon && <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-accent-foreground [&_svg]:h-4 [&_svg]:w-4">{icon}</span>}
        <h3 className="font-display text-lg font-semibold">{title}</h3>
        {action && <div className="ms-auto">{action}</div>}
      </div>
      {children}
    </section>
  );
}

const TONE = {
  action: { panel: 'border-transparent bg-gradient-to-br from-primary-strong to-primary text-primary-foreground', icon: Play },
  waiting: { panel: 'border-warning/30 bg-sand', icon: Clock3 },
  done: { panel: 'border-primary/30 bg-accent', icon: CircleCheck },
  closed: { panel: 'border-border bg-muted/60', icon: Ban },
} as const;

/**
 * Reception workspace: one page for a delivery, from weighing to storage. Each
 * role sees the next step it can perform; dialogs open over this page, never over another dialog.
 */
export const ReceptionDetailV2 = ({ receptionId, onBack, initialSection = 'overview', autoStartQc = false }: ReceptionDetailV2Props) => {
  const { t } = useTranslation();
  const labels = useReceptionLabels();
  const { roles } = useAuthContext();
  const permissions = useMemo(() => getReceptionPermissions(roles), [roles]);
  const { data: reception, isLoading, isError } = useReceptionV2Detail(receptionId);
  const { data: lots = [] } = useReceptionLots(receptionId);
  const { data: inspections = [] } = useQCInspections(receptionId);
  const { data: auditLogs = [] } = useListReceptionAuditQuery(receptionId, { skip: !receptionId });
  const updateStatus = useUpdateReceptionV2Status();

  const [section, setSection] = useState<ReceptionWorkspaceSection>(initialSection);
  const [labelDialogOpen, setLabelDialogOpen] = useState(false);
  const [bonDialogOpen, setBonDialogOpen] = useState(false);
  const [expeditionDialogOpen, setExpeditionDialogOpen] = useState(false);
  const [rapportQCOpen, setRapportQCOpen] = useState(false);
  const [reclamationOpen, setReclamationOpen] = useState(false);
  const [bonReclamationOpen, setBonReclamationOpen] = useState(false);
  const [qcDialogOpen, setQcDialogOpen] = useState(false);
  const [selectedUnitForLabel, setSelectedUnitForLabel] = useState<ReceptionUnit | null>(null);
  const [selectedLotForLabel, setSelectedLotForLabel] = useState<ReceptionLot | null>(null);
  const [weighingLot, setWeighingLot] = useState<ReceptionLot | null>(null);
  const [gs1Lot, setGs1Lot] = useState<ReceptionLot | null>(null);
  const [lotToQuarantine, setLotToQuarantine] = useState<ReceptionLot | null>(null);
  const [lotToRelease, setLotToRelease] = useState<ReceptionLot | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [correctionOpen, setCorrectionOpen] = useState(false);

  // BLOQUE = quarantined delivery that can be re-inspected.
  const canStartQC = Boolean(reception) && permissions.canRunQc
    && ['EN_ATTENTE_QC', 'EN_QC', 'BLOQUE'].includes(reception!.status);

  const autoStarted = useRef(false);
  useEffect(() => {
    if (!autoStartQc || autoStarted.current || !reception) return;
    autoStarted.current = true;
    if (canStartQC) setQcDialogOpen(true);
  }, [autoStartQc, canStartQC, reception]);

  useEffect(() => {
    setSection(initialSection);
  }, [receptionId, initialSection]);

  const nextStep = useMemo(
    () => (reception ? getReceptionNextStep(reception, lots, permissions) : null),
    [reception, lots, permissions],
  );

  const backButton = (
    <Button variant="ghost" onClick={onBack} className="min-h-11 gap-2 px-2">
      <ArrowLeft className="h-4 w-4" />
      {t('receptionDetail.back')}
    </Button>
  );

  if (isError) {
    return (
      <div className="space-y-4">
        {backButton}
        <div role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-center text-sm text-destructive">
          {t('receptionDetail.loadError')}
        </div>
      </div>
    );
  }

  if (isLoading || !reception || !nextStep) {
    return (
      <div className="space-y-4">
        {backButton}
        <div role="status" className="py-10 text-center text-sm text-muted-foreground">{t('receptionDetail.loading')}</div>
      </div>
    );
  }

  // Cancellation is only possible before a QC decision has moved stock.
  const canCancel = permissions.canCancel && ['BROUILLON', 'EN_ATTENTE_QC', 'EN_QC'].includes(reception.status);
  const isCancelled = reception.status === 'ANNULE';
  // Lot-level release/quarantine applies once QC has decided; before that the QC inspection decides.
  const lotQualityEditable = permissions.canRunQc && Boolean(reception.qc_decision) && !isCancelled;
  const canEditLots = permissions.canRegister && !isCancelled;

  const handlePrintLabel = (unit: ReceptionUnit, lot: ReceptionLot) => {
    setSelectedUnitForLabel(unit);
    setSelectedLotForLabel(lot);
    setLabelDialogOpen(true);
  };

  const runNextStep = async () => {
    switch (nextStep.action) {
      case 'start_qc':
      case 'resume_qc':
      case 'reinspect':
        setQcDialogOpen(true);
        return;
      case 'assign_storage':
        setSection('stock');
        return;
      case 'submit_draft':
        try {
          await updateStatus.mutateAsync({ id: reception.id, status: 'EN_ATTENTE_QC' });
        } catch (error) {
          toast.error(receptionErrorMessage(error, t('receptionDetail.submitDraftFailed')));
        }
        return;
      default:
    }
  };

  const timelineEntries = [
    { key: 'gate', value: reception.gate_arrival_at },
    { key: 'gross', value: reception.gross_weight_captured_at },
    { key: 'unloadStart', value: reception.unloading_started_at },
    { key: 'unloadEnd', value: reception.unloading_completed_at },
    { key: 'tare', value: reception.tare_weight_captured_at },
    { key: 'recorded', value: reception.validated_at || reception.created_at },
  ];

  const hasClaimDocuments = inspections.some((inspection) => inspection.decision === 'REJETE')
    || (reception.weight_gap_percent != null && Math.abs(reception.weight_gap_percent) > 2);

  const supplierName = reception.supplier?.name || reception.supplier_name_snapshot || t('receptionDetail.noSupplier');
  const tone = TONE[nextStep.tone];
  const stepText = labels.nextStep(nextStep);
  const ToneIcon = tone.icon;
  const hero = nextStep.tone === 'action';
  const documentTile = 'flex min-h-16 w-full items-center gap-3 rounded-xl border bg-card px-4 py-3 text-start transition-colors hover:border-primary/40 hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

  const tabs: Array<{ value: ReceptionWorkspaceSection; icon: typeof FileText; badge?: number }> = [
    { value: 'overview', icon: FileText },
    { value: 'lots', icon: Package, badge: lots.length },
    { value: 'qc', icon: Shield },
    { value: 'stock', icon: Warehouse },
    { value: 'documents', icon: Printer },
    { value: 'history', icon: History },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4">
      {/* ── Header: what this delivery is, its weight, and the corrections available to this role ── */}
      <div className="flex flex-wrap items-center gap-2">
        {backButton}
        <div className="ms-auto flex flex-wrap gap-2">
          {permissions.canCancel && !isCancelled && (
            <Button type="button" variant="outline" className="min-h-11 gap-1.5" onClick={() => setCorrectionOpen(true)}>
              <Pencil className="h-4 w-4" />
              {t('receptionDetail.correct')}
            </Button>
          )}
          {canCancel && (
            <Button
              type="button"
              variant="outline"
              className="min-h-11 gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/5 hover:text-destructive"
              onClick={() => setCancelOpen(true)}
            >
              <Ban className="h-4 w-4" />
              {t('receptionDetail.cancel')}
            </Button>
          )}
        </div>
      </div>

      <header className="space-y-4 rounded-2xl border bg-card p-4 sm:p-6">
        <div className="flex flex-wrap items-start gap-3">
          <span className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground sm:flex">
            <Truck className="h-6 w-6" aria-hidden />
          </span>
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-sm font-semibold text-primary">
              {t('receptionDetail.eyebrow')} · <span className="font-mono">{reception.reception_number}</span>
            </p>
            <h2 className="font-display text-2xl font-semibold leading-tight sm:text-3xl">{supplierName}</h2>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Badge className={receptionStatusColors[reception.status]}>{labels.receptionStatus(reception.status)}</Badge>
              {reception.variety && <Badge variant="outline">{reception.variety}</Badge>}
              {reception.bio_declared && <Badge variant="outline">{t('receptionDetail.bio')}</Badge>}
            </div>
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-primary/20 bg-accent px-4 py-3">
            <dt className="text-sm text-muted-foreground">{t('receptionDetail.figures.net')}</dt>
            <dd className="text-2xl font-semibold tabular-nums"><bdi dir="ltr">{formatNumber(reception.quantity_total, 1)} {reception.unit}</bdi></dd>
          </div>
          <div className="rounded-xl border bg-secondary/60 px-4 py-3">
            <dt className="text-sm text-muted-foreground">{t('receptionDetail.figures.gross')}</dt>
            <dd className="text-lg font-semibold tabular-nums">{qty(reception.gross_weight_kg, 'kg') ?? '—'}</dd>
          </div>
          <div className="rounded-xl border bg-secondary/60 px-4 py-3">
            <dt className="text-sm text-muted-foreground">{t('receptionDetail.figures.lots')}</dt>
            <dd className="text-lg font-semibold tabular-nums">{lots.length}</dd>
          </div>
          <div className="rounded-xl border bg-secondary/60 px-4 py-3">
            <dt className="text-sm text-muted-foreground">{t('receptionDetail.figures.arrival')}</dt>
            <dd className="text-lg font-semibold">{formatDateTime(reception.gate_arrival_at || reception.created_at) ?? '—'}</dd>
          </div>
        </dl>
      </header>

      {/* ── Next step: the one thing this role can do now ── */}
      <section
        aria-label={t('receptionDetail.nextStep')}
        className={cn('relative flex flex-col gap-4 overflow-hidden rounded-2xl border p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6', tone.panel)}
      >
        <div className="flex items-start gap-3">
          <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl',
            hero ? 'bg-white/15 text-white' : nextStep.tone === 'waiting' ? 'bg-card text-warning' : nextStep.tone === 'done' ? 'bg-card text-primary' : 'bg-card text-muted-foreground')}>
            <ToneIcon className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className={cn('text-sm font-semibold', hero ? 'text-white/80' : 'text-muted-foreground')}>{t('receptionDetail.nextStep')}</p>
            <p className={cn('font-display text-xl font-semibold leading-tight', hero && 'text-white')}>{stepText.title}</p>
            <p className={cn('mt-1 text-sm', hero ? 'text-white/85' : 'text-muted-foreground')}>
              {isCancelled && reception.cancellation_reason
                ? t('receptionDetail.cancelledOn', { date: formatDateTime(reception.cancelled_at) ?? '—', reason: reception.cancellation_reason })
                : stepText.description}
            </p>
          </div>
        </div>
        {nextStep.action && nextStep.actionLabel && (
          <Button
            size="xl"
            variant={hero ? 'outline' : 'default'}
            className={cn('w-full shrink-0 sm:w-auto', hero && 'border-transparent bg-white text-primary-strong hover:bg-white/90 hover:text-primary-strong')}
            onClick={() => void runNextStep()}
            disabled={updateStatus.isPending}
          >
            {nextStep.action === 'assign_storage' ? <Warehouse aria-hidden /> : <Shield aria-hidden />}
            {stepText.actionLabel}
            <ArrowRight aria-hidden />
          </Button>
        )}
      </section>

      <Tabs value={section} onValueChange={(value) => setSection(value as ReceptionWorkspaceSection)}>
        <div className="-mx-1 overflow-x-auto px-1 pb-1 scrollbar-hide">
          <TabsList
            aria-label={t('receptionDetail.tabs.label')}
            className="flex h-auto min-w-max justify-start gap-1.5 rounded-2xl border bg-card p-1.5 shadow-sm max-sm:grid max-sm:w-full max-sm:min-w-0 max-sm:grid-cols-3"
          >
            {tabs.map((tab) => {
              const active = section === tab.value;
              return (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className={cn(
                    'relative -mb-0 flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-xl border-0 px-4 py-2 text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring data-[state=active]:shadow-none max-sm:min-h-14 max-sm:flex-col max-sm:gap-1 max-sm:px-1.5 max-sm:text-xs',
                    active ? 'bg-accent text-accent-foreground data-[state=active]:bg-accent' : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
                  )}
                >
                  <tab.icon className="h-4 w-4 shrink-0 max-sm:h-5 max-sm:w-5" aria-hidden />
                  <span>{t(`receptionDetail.tabs.${tab.value}`)}</span>
                  {tab.badge != null && tab.badge > 0 && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-bold leading-none text-primary-foreground max-sm:absolute max-sm:end-1 max-sm:top-1">
                      {tab.badge}
                    </span>
                  )}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>

        {/* ── FICHE ── */}
        <TabsContent value="overview" className="mt-4 space-y-4">
          <Section title={t('receptionDetail.overview.weighing')} icon={<Scale />}>
            <ReviewList
              className="grid-cols-2 lg:grid-cols-3"
              items={[
                { label: t('receptionDetail.overview.gross'), value: qty(reception.gross_weight_kg, 'kg'), emphasis: true },
                { label: t('receptionDetail.overview.tare'), value: qty(reception.tare_weight_kg, 'kg'), emphasis: true },
                { label: t('receptionDetail.overview.net'), value: qty(reception.quantity_total, reception.unit), emphasis: true },
                { label: t('receptionDetail.overview.weightSource'), value: labels.weighingSource(reception.weighing_source, reception.weighing_verified_device) },
                { label: t('receptionDetail.overview.noteGap'), value: reception.weight_gap_percent != null ? <bdi dir="ltr">{formatNumber(reception.weight_gap_percent)} %</bdi> : undefined },
                { label: t('receptionDetail.overview.variety'), value: reception.variety },
                { label: t('receptionDetail.overview.presentation'), value: reception.presentation },
                { label: t('receptionDetail.overview.maturity'), value: reception.maturity_stage },
              ]}
            />
          </Section>

          <div className="grid gap-4 lg:grid-cols-2">
            <Section title={t('receptionDetail.overview.supplierOrder')} icon={<FileText />}>
              <ReviewList
                className="grid-cols-2 lg:grid-cols-1 xl:grid-cols-2"
                items={[
                  { label: t('receptionDetail.overview.supplierCode'), value: reception.supplier_code_snapshot || reception.supplier?.code },
                  { label: t('receptionDetail.overview.supplier'), value: reception.supplier?.name || reception.supplier_name_snapshot },
                  { label: t('receptionDetail.overview.oasis'), value: reception.origin_oasis || reception.supplier?.oasis_name },
                  { label: t('receptionDetail.overview.gps'), value: reception.origin_gps },
                  { label: t('receptionDetail.overview.deliveryNote'), value: reception.delivery_note_number },
                  {
                    label: t('receptionDetail.overview.purchaseOrder'),
                    value: reception.purchase_order_number || (reception.purchase_order_id ? t('receptionDetail.overview.poLinked') : t('receptionDetail.overview.poSpontaneous')),
                  },
                  ...(reception.po_expected_kg != null
                    ? [
                        { label: t('receptionDetail.overview.poExpected'), value: qty(reception.po_expected_kg, 'kg') },
                        { label: t('receptionDetail.overview.poVariance'), value: qty(reception.po_variance_kg ?? 0, 'kg') },
                      ]
                    : []),
                ]}
              />
            </Section>

            <Section title={t('receptionDetail.overview.transport')} icon={<Truck />}>
              <ReviewList
                className="grid-cols-2 lg:grid-cols-1 xl:grid-cols-2"
                items={[
                  { label: t('receptionDetail.overview.vehicle'), value: reception.vehicle_number },
                  { label: t('receptionDetail.overview.driver'), value: reception.driver_name },
                  { label: t('receptionDetail.overview.arrivalTemp'), value: reception.arrival_temperature_c != null ? <bdi dir="ltr">{formatNumber(reception.arrival_temperature_c)} °C</bdi> : undefined },
                  { label: t('receptionDetail.overview.transportCondition'), value: reception.transport_condition },
                  { label: t('receptionDetail.overview.visualState'), value: reception.quick_visual_state },
                  { label: t('receptionDetail.overview.bio'), value: reception.bio_declared ? t('receptionDetail.yes') : t('receptionDetail.no') },
                  { label: t('receptionDetail.overview.zone'), value: reception.storage_zone_code },
                ]}
              />
            </Section>
          </div>

          <Section title={t('receptionDetail.overview.traceability')} icon={<QrCode />}>
            <ReviewList
              className="grid-cols-2 md:grid-cols-3"
              items={[
                { label: t('receptionDetail.overview.internalLot'), value: <span className="break-all font-mono">{lots.map((lot) => lot.lot_internal).filter(Boolean).join(', ') || '—'}</span> },
                { label: t('receptionDetail.overview.units'), value: reception.pallet_count || reception.crate_count || undefined },
                { label: t('receptionDetail.overview.duration'), value: reception.reception_duration_minutes != null ? t('receptionDetail.overview.minutes', { n: reception.reception_duration_minutes }) : undefined },
              ]}
            />
          </Section>

          {(reception.quick_check_notes || reception.remarks || (reception.phase1_alerts && reception.phase1_alerts.length > 0)) && (
            <div className="grid gap-4 lg:grid-cols-2">
              <Section title={t('receptionDetail.overview.notes')}>
                <div className="space-y-3 text-sm">
                  {reception.quick_check_notes && <p className="rounded-xl bg-secondary/60 px-4 py-3">{reception.quick_check_notes}</p>}
                  {reception.remarks && <p className="rounded-xl bg-secondary/60 px-4 py-3">{reception.remarks}</p>}
                  {!reception.quick_check_notes && !reception.remarks && <p className="text-muted-foreground">{t('receptionDetail.overview.noNotes')}</p>}
                </div>
              </Section>

              <Section title={t('receptionDetail.overview.alerts')} icon={<AlertTriangle />} className={reception.phase1_alerts?.length ? 'border-warning/30 bg-sand' : ''}>
                <div className="space-y-2 text-sm">
                  {reception.phase1_alerts?.length ? reception.phase1_alerts.map((alert) => (
                    <div key={alert} className="flex items-start gap-2 rounded-xl border border-warning/30 bg-card px-3 py-2.5">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
                      {alert}
                    </div>
                  )) : <p className="text-muted-foreground">{t('receptionDetail.overview.noAlerts')}</p>}
                </div>
              </Section>
            </div>
          )}
        </TabsContent>

        {/* ── LOTS ── */}
        <TabsContent value="lots" className="mt-4 space-y-4">
          {lots.length === 0 ? (
            <div className="rounded-2xl border border-dashed bg-card py-10 text-center text-muted-foreground">{t('receptionDetail.lots.empty')}</div>
          ) : (
            lots.map((lot) => {
              const hasNet = lot.net_weight_kg != null;
              const hasLabel = Boolean(lot.label_printed_at);
              return (
                <article key={lot.id} data-lot-id={lot.lot_internal || lot.id} className="space-y-4 rounded-2xl border bg-card p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="break-all font-mono text-lg font-semibold">{lot.lot_internal}</h3>
                      <p className="text-sm text-muted-foreground">{t('receptionDetail.lots.supplierRef', { ref: lot.lot_supplier || '—' })}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={stockStatusColors[lot.stock_status]}>{labels.stockStatus(lot.stock_status)}</Badge>
                      {lot.storage_zone_code && <Badge variant="outline">{t('receptionDetail.lots.zone', { zone: lot.storage_zone_code })}</Badge>}
                      {hasNet && (
                        <Badge variant="outline" className="border-success/40 text-success">
                          {t('receptionDetail.lots.net')} <bdi dir="ltr" className="ms-1">{formatNumber(lot.net_weight_kg, 1)} kg</bdi>
                        </Badge>
                      )}
                    </div>
                  </div>

                  <ReviewList
                    className="grid-cols-2 md:grid-cols-4"
                    items={[
                      { label: t('receptionDetail.lots.quantity'), value: qty(lot.quantity, lot.unit), emphasis: true },
                      { label: t('receptionDetail.lots.origin'), value: lot.origin_farm || lot.origin_country },
                      { label: t('receptionDetail.lots.harvestDate'), value: lot.harvest_date },
                      { label: 'RFID', value: lot.rfid_tag },
                    ]}
                  />

                  <LotCostCard lotId={lot.id} />

                  {lot.stock_status === 'EN_QUARANTAINE' && lot.quarantine_reason && (
                    <div role="status" className="flex items-start gap-3 rounded-xl border border-warning/30 bg-sand p-4 text-sm">
                      <Lock className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
                      <div>
                        <p className="font-semibold">{t('receptionDetail.lots.quarantineReason')}</p>
                        <p className="mt-1 text-muted-foreground">{lot.quarantine_reason}</p>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 border-t pt-4">
                    <Button type="button" variant="outline" className="min-h-11 gap-1.5" onClick={() => setWeighingLot(lot)}>
                      <Scale className="h-4 w-4 text-primary" />
                      {t('receptionDetail.lots.viewWeighing')}
                    </Button>
                    {canEditLots && (
                      <Button
                        type="button"
                        variant="outline"
                        className="min-h-11 gap-1.5"
                        disabled={!hasNet}
                        onClick={() => setGs1Lot(lot)}
                        title={!hasNet ? t('receptionDetail.lots.gs1NeedsNet') : undefined}
                      >
                        <QrCode className="h-4 w-4 text-info" />
                        {hasLabel ? t('receptionDetail.lots.gs1Reprint') : t('receptionDetail.lots.gs1')}
                      </Button>
                    )}
                    {!lotQualityEditable ? null : lot.stock_status === 'EN_QUARANTAINE' ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="min-h-11 gap-1.5 border-success/40 text-success hover:bg-accent hover:text-success"
                        onClick={() => setLotToRelease(lot)}
                      >
                        <LockOpen className="h-4 w-4" />
                        {t('receptionDetail.lots.release')}
                      </Button>
                    ) : lot.stock_status === 'STOCK_LIBERE' || lot.stock_status === 'NON_STOCKE' ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="min-h-11 gap-1.5 border-warning/40 text-warning hover:bg-sand hover:text-warning"
                        onClick={() => setLotToQuarantine(lot)}
                      >
                        <Lock className="h-4 w-4" />
                        {t('receptionDetail.lots.quarantine')}
                      </Button>
                    ) : null}
                  </div>

                  {lot.qr_code_payload && (
                    <details className="group rounded-xl bg-secondary/60 text-sm">
                      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-4 font-medium">
                        <QrCode className="h-4 w-4" aria-hidden />
                        {t('receptionDetail.lots.qrData')}
                        <ChevronDown className="ms-auto h-4 w-4 transition-transform group-open:rotate-180" aria-hidden />
                      </summary>
                      <p className="break-all px-4 pb-4 font-mono text-xs text-muted-foreground">{lot.qr_code_payload}</p>
                    </details>
                  )}

                  <UnitsManagement
                    lot={lot}
                    receptionNumber={reception.reception_number}
                    onPrintLabel={(unit) => handlePrintLabel(unit, lot)}
                  />
                </article>
              );
            })
          )}
        </TabsContent>

        {/* ── QUALITÉ ── */}
        <TabsContent value="qc" className="mt-4 space-y-4">
          {reception.qc_decision ? (
            <section className={cn('flex flex-col gap-4 rounded-2xl border p-5 sm:flex-row sm:items-center sm:justify-between',
              reception.qc_decision === 'ACCEPTE' ? 'border-primary/30 bg-accent' : reception.qc_decision === 'REJETE' ? 'border-destructive/30 bg-destructive/5' : 'border-warning/30 bg-sand')}>
              <div className="flex items-center gap-3">
                <span className={cn('flex h-12 w-12 items-center justify-center rounded-full bg-card',
                  reception.qc_decision === 'ACCEPTE' ? 'text-primary' : reception.qc_decision === 'REJETE' ? 'text-destructive' : 'text-warning')}>
                  {reception.qc_decision === 'ACCEPTE' ? <CheckCircle className="h-6 w-6" /> : reception.qc_decision === 'REJETE' ? <XCircle className="h-6 w-6" /> : <AlertTriangle className="h-6 w-6" />}
                </span>
                <div>
                  <p className="font-display text-xl font-semibold">{labels.qcDecided(reception.qc_decision)}</p>
                  <p className="text-sm text-muted-foreground">
                    {t('receptionDetail.qc.scoreGrade', { score: reception.qc_score ?? '-', grade: reception.qc_grade || '-' })}
                  </p>
                </div>
              </div>
              {canStartQC && (
                <Button className="min-h-11 w-full sm:w-auto" variant="outline" onClick={() => setQcDialogOpen(true)}>
                  <Play className="h-4 w-4" />
                  {reception.status === 'BLOQUE' ? t('receptionDetail.qc.reinspect') : t('receptionDetail.qc.resume')}
                </Button>
              )}
            </section>
          ) : !canStartQC && ['EN_ATTENTE_QC', 'EN_QC'].includes(reception.status) ? (
            <div role="status" className="flex items-start gap-3 rounded-2xl border border-warning/30 bg-sand p-4 text-sm">
              <Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-warning" aria-hidden />
              {t('receptionDetail.qc.byQualityTeam')}
            </div>
          ) : null}

          {inspections.length === 0 ? (
            <div className="rounded-2xl border border-dashed bg-card py-10 text-center text-muted-foreground">{t('receptionDetail.qc.none')}</div>
          ) : (
            inspections.map((inspection) => (
              <article key={inspection.id} className="space-y-3 rounded-2xl border bg-card p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="font-mono text-lg font-semibold">{inspection.inspection_number}</h3>
                  {inspection.decision ? (
                    <Badge className={qcDecisionColors[inspection.decision]}>{labels.qcDecided(inspection.decision)}</Badge>
                  ) : (
                    <Badge variant="outline" className="border-info/40 text-info">{t('receptionDetail.qc.inProgress')}</Badge>
                  )}
                </div>
                <ReviewList
                  className="grid-cols-2 md:grid-cols-3"
                  items={[
                    { label: t('receptionDetail.qc.inspector'), value: inspection.inspector_name },
                    { label: t('receptionDetail.qc.started'), value: formatDateTime(inspection.started_at) ?? undefined },
                    { label: t('receptionDetail.qc.delay'), value: inspection.inspection_delay_hours != null ? <bdi dir="ltr">{formatNumber(inspection.inspection_delay_hours)} h</bdi> : undefined },
                  ]}
                />
                {inspection.comment && <p className="rounded-xl bg-secondary/60 px-4 py-3 text-sm">{inspection.comment}</p>}
              </article>
            ))
          )}
        </TabsContent>

        {/* ── ENTREPÔT ── */}
        <TabsContent value="stock" className="mt-4">
          <StorageAssignment reception={reception} lots={lots} />
        </TabsContent>

        {/* ── DOCUMENTS ── */}
        <TabsContent value="documents" className="mt-4 space-y-4">
          {(reception.delivery_note_photos?.length ?? 0) > 0 && (
            <Section title={t('receptionDetail.documents.photos')} icon={<ImageIcon />}>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                {reception.delivery_note_photos?.map((photo, index) => (
                  <a key={index} href={photo} target="_blank" rel="noreferrer" className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <img src={photo} alt={t('receptionDetail.documents.photoAlt', { n: index + 1 })} className="aspect-square w-full rounded-xl border object-cover" />
                  </a>
                ))}
              </div>
            </Section>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <Section title={t('receptionDetail.documents.reception')} icon={<Printer />}>
              <div className="space-y-2">
                <button type="button" className={documentTile} onClick={() => setBonDialogOpen(true)}>
                  <Printer className="h-5 w-5 shrink-0 text-primary" aria-hidden />
                  <span>
                    <span className="block font-semibold">{t('receptionDetail.documents.bra')}</span>
                    <span className="block text-sm text-muted-foreground">{t('receptionDetail.documents.braHint')}</span>
                  </span>
                </button>
                <button type="button" className={documentTile} onClick={() => setExpeditionDialogOpen(true)}>
                  <Truck className="h-5 w-5 shrink-0 text-primary" aria-hidden />
                  <span>
                    <span className="block font-semibold">{t('receptionDetail.documents.shipping')}</span>
                    <span className="block text-sm text-muted-foreground">{t('receptionDetail.documents.shippingHint')}</span>
                  </span>
                </button>
              </div>
            </Section>

            <Section title={t('receptionDetail.documents.quality')} icon={<FlaskConical />}>
              {inspections.length > 0 ? (
                <div className="space-y-2">
                  <button type="button" className={documentTile} onClick={() => setRapportQCOpen(true)}>
                    <FlaskConical className="h-5 w-5 shrink-0 text-info" aria-hidden />
                    <span>
                      <span className="block font-semibold">{t('receptionDetail.documents.qcReport')}</span>
                      <span className="block text-sm text-muted-foreground">
                        {inspections[0]?.inspection_number} — {inspections[0]?.decision
                          ? t('receptionDetail.documents.decision', { decision: labels.qcDecided(inspections[0].decision) })
                          : t('receptionDetail.qc.inProgress')}
                      </span>
                    </span>
                  </button>
                  {hasClaimDocuments && (
                    <>
                      <button type="button" className={cn(documentTile, 'border-destructive/30')} onClick={() => setReclamationOpen(true)}>
                        <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" aria-hidden />
                        <span>
                          <span className="block font-semibold text-destructive">{t('receptionDetail.documents.claim')}</span>
                          <span className="block text-sm text-muted-foreground">
                            {inspections.some((inspection) => inspection.decision === 'REJETE')
                              ? t('receptionDetail.documents.claimRejected')
                              : t('receptionDetail.documents.claimGap', { gap: reception.weight_gap_percent?.toFixed(1) })}
                          </span>
                        </span>
                      </button>
                      <button type="button" className={cn(documentTile, 'border-destructive/30')} onClick={() => setBonReclamationOpen(true)}>
                        <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" aria-hidden />
                        <span>
                          <span className="block font-semibold text-destructive">{t('receptionDetail.documents.claimNote')}</span>
                          <span className="block text-sm text-muted-foreground">{t('receptionDetail.documents.claimNoteHint')}</span>
                        </span>
                      </button>
                    </>
                  )}
                </div>
              ) : (
                <p className="py-2 text-sm text-muted-foreground">{t('receptionDetail.documents.afterQc')}</p>
              )}
            </Section>
          </div>
        </TabsContent>

        {/* ── HISTORIQUE ── */}
        <TabsContent value="history" className="mt-4 space-y-4">
          <Section title={t('receptionDetail.history.timeline')} icon={<Clock3 />}>
            <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {timelineEntries.map((entry) => {
                const when = formatDateTime(entry.value);
                return (
                  <li key={entry.key} className="flex items-start gap-3 rounded-xl border bg-card px-4 py-3">
                    <span className={cn('mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full', when ? 'bg-primary' : 'bg-border')} aria-hidden />
                    <div>
                      <p className="text-sm font-semibold">{t(`receptionDetail.history.${entry.key}`)}</p>
                      <p className="text-sm text-muted-foreground">{when ?? t('receptionDetail.history.notSet')}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </Section>

          <Section title={t('receptionDetail.history.log')} icon={<History />}>
            <div className="space-y-2">
              {auditLogs.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">{t('receptionDetail.history.noActions')}</p>
              ) : (
                (auditLogs as ReceptionAuditLog[]).map((log, idx) => {
                  const event = describeReceptionAuditEvent(log);
                  return (
                    <div key={log.id ?? idx} className="flex items-start gap-3 rounded-xl border bg-card px-4 py-3 text-sm">
                      <History className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold">{event.label}</span>
                          <Badge variant="outline" className="text-xs">{event.target}</Badge>
                          {event.actor && <span className="text-xs text-muted-foreground">{t('receptionDetail.history.by', { actor: event.actor })}</span>}
                        </div>
                        {event.detail && <p className="mt-0.5 text-sm text-muted-foreground">{event.detail}</p>}
                      </div>
                      {log.created_at && (
                        <span className="whitespace-nowrap text-xs text-muted-foreground">{formatDateTime(log.created_at)}</span>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </Section>
        </TabsContent>
      </Tabs>

      <LabelPrintDialog
        open={labelDialogOpen}
        onOpenChange={setLabelDialogOpen}
        unit={selectedUnitForLabel}
        reception={reception}
        lot={selectedLotForLabel}
      />
      <BonReceptionDialog open={bonDialogOpen} onOpenChange={setBonDialogOpen} reception={reception} lots={lots} />
      <BonExpeditionDialog open={expeditionDialogOpen} onOpenChange={setExpeditionDialogOpen} reception={reception} lots={lots} />
      <RapportQCDialog
        open={rapportQCOpen}
        onOpenChange={setRapportQCOpen}
        reception={reception}
        lots={lots}
        inspection={inspections[0] ?? null}
      />
      <ReclamationFournisseurDialog
        open={reclamationOpen}
        onOpenChange={setReclamationOpen}
        reception={reception}
        lots={lots}
        inspection={inspections[0] ?? null}
      />
      <BonReclamationDialog
        open={bonReclamationOpen}
        onOpenChange={setBonReclamationOpen}
        reception={reception}
        lots={lots}
        inspection={inspections[0] ?? null}
      />

      {weighingLot && (
        <WeighingRecordDialog lot={weighingLot} canCorrect={permissions.canCancel && !isCancelled} onClose={() => setWeighingLot(null)} />
      )}
      {gs1Lot && <Gs1LabelPreview lot={gs1Lot} onClose={() => setGs1Lot(null)} />}

      <ReceptionCancelDialog reception={reception} open={cancelOpen} onOpenChange={setCancelOpen} />
      <ReceptionCorrectionDialog reception={reception} open={correctionOpen} onOpenChange={setCorrectionOpen} />
      <ReceptionLotStatusDialog lot={lotToQuarantine} receptionId={reception.id} mode="quarantine" onClose={() => setLotToQuarantine(null)} />
      <ReceptionLotStatusDialog lot={lotToRelease} receptionId={reception.id} mode="release" receptionType={reception.reception_type} onClose={() => setLotToRelease(null)} />

      {qcDialogOpen && (
        <QCInspectionDialog
          open={qcDialogOpen}
          onOpenChange={setQcDialogOpen}
          reception={reception}
          onAssignStorage={() => setSection('stock')}
        />
      )}
    </div>
  );
};
