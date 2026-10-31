import { useEffect, useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  CheckCircle,
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
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuthContext } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import {
  describeReceptionAuditEvent,
  getReceptionNextStep,
  getReceptionPermissions,
  type ReceptionAuditLog,
} from '@/lib/receptionWorkflow';
import { describeWeighingSource } from '@/lib/receptionIntake';
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
  qcDecisionLabels,
  receptionStatusColors,
  receptionStatusLabels,
  ReceptionLot,
  ReceptionUnit,
  stockStatusColors,
  stockStatusLabels,
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

const InfoRow = ({ label, value }: { label: string; value: string | number | null | undefined }) => (
  <div className="flex items-start justify-between gap-3 text-sm">
    <span className="text-muted-foreground">{label}</span>
    <span className="text-right font-medium">{value || '-'}</span>
  </div>
);

const formatDateTime = (value?: string | null) =>
  value ? format(new Date(value), 'dd/MM/yyyy HH:mm', { locale: fr }) : null;

const NEXT_STEP_STYLES = {
  action: 'border-primary/30 bg-primary/5',
  waiting: 'border-amber-200 bg-amber-50/70',
  done: 'border-emerald-200 bg-emerald-50/70',
  closed: 'border-border bg-muted/40',
} as const;

/**
 * Reception workspace: one page for a delivery, from weighing to storage. Each
 * role sees the next step it can perform; dialogs open over this page, never over another dialog.
 */
export const ReceptionDetailV2 = ({ receptionId, onBack, initialSection = 'overview', autoStartQc = false }: ReceptionDetailV2Props) => {
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

  if (isError) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={onBack} className="gap-2"><ArrowLeft className="h-4 w-4" />Réceptions</Button>
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700">
          Impossible de charger cette réception. Vérifiez la connexion puis réessayez.
        </div>
      </div>
    );
  }

  if (isLoading || !reception || !nextStep) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={onBack} className="gap-2"><ArrowLeft className="h-4 w-4" />Réceptions</Button>
        <div className="py-10 text-center text-sm text-muted-foreground">Chargement de la réception…</div>
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
          toast.error(receptionErrorMessage(error, 'Impossible de soumettre le brouillon au contrôle.'));
        }
        return;
      default:
    }
  };

  const timelineEntries = [
    { label: 'Arrivée au portail', value: reception.gate_arrival_at },
    { label: 'Pesée brute', value: reception.gross_weight_captured_at },
    { label: 'Début déchargement', value: reception.unloading_started_at },
    { label: 'Fin déchargement', value: reception.unloading_completed_at },
    { label: 'Pesée tare', value: reception.tare_weight_captured_at },
    { label: 'Enregistrement', value: reception.validated_at || reception.created_at },
  ];

  const hasClaimDocuments = inspections.some((inspection) => inspection.decision === 'REJETE')
    || (reception.weight_gap_percent != null && Math.abs(reception.weight_gap_percent) > 2);

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" onClick={onBack} className="gap-2 px-2">
          <ArrowLeft className="h-4 w-4" />
          Réceptions
        </Button>
        <h2 className="font-mono text-lg font-semibold">{reception.reception_number}</h2>
        <Badge className={receptionStatusColors[reception.status]}>
          {receptionStatusLabels[reception.status]}
        </Badge>
        {reception.variety && <Badge variant="outline">{reception.variety}</Badge>}
        <span className="text-sm text-muted-foreground">
          {reception.supplier?.name || reception.supplier_name_snapshot || 'Fournisseur non renseigné'} · {reception.quantity_total} {reception.unit}
        </span>
        {canCancel && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="ml-auto gap-1.5 border-red-200 text-red-700 hover:bg-red-50"
            onClick={() => setCancelOpen(true)}
          >
            <Ban className="h-3.5 w-3.5" />
            Annuler la réception
          </Button>
        )}
        {permissions.canCancel && !isCancelled && (
          <Button type="button" size="sm" variant="outline" className={cn('gap-1.5', !canCancel && 'ml-auto')} onClick={() => setCorrectionOpen(true)}>
            <Pencil className="h-3.5 w-3.5" />
            Corriger
          </Button>
        )}
      </div>

      {/* ── Next step ── */}
      <div className={cn('flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between', NEXT_STEP_STYLES[nextStep.tone])}>
        <div className="flex items-start gap-3">
          {nextStep.tone === 'done' ? (
            <CircleCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
          ) : nextStep.tone === 'waiting' ? (
            <Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          ) : nextStep.tone === 'closed' ? (
            <Ban className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
          ) : (
            <Play className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          )}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Prochaine étape</p>
            <p className="font-semibold">{nextStep.title}</p>
            <p className="text-sm text-muted-foreground">
              {isCancelled && reception.cancellation_reason
                ? `Annulée le ${formatDateTime(reception.cancelled_at) ?? '—'} — ${reception.cancellation_reason}`
                : nextStep.description}
            </p>
          </div>
        </div>
        {nextStep.action && nextStep.actionLabel && (
          <Button className="shrink-0" onClick={() => void runNextStep()} disabled={updateStatus.isPending}>
            {nextStep.action === 'assign_storage' ? <Warehouse className="mr-2 h-4 w-4" /> : <Shield className="mr-2 h-4 w-4" />}
            {nextStep.actionLabel}
          </Button>
        )}
      </div>

      <Tabs value={section} onValueChange={(value) => setSection(value as ReceptionWorkspaceSection)}>
        <TabsList className="h-auto w-full flex-wrap justify-start">
          <TabsTrigger value="overview"><FileText className="mr-1 h-3.5 w-3.5" />Fiche</TabsTrigger>
          <TabsTrigger value="lots"><Package className="mr-1 h-3.5 w-3.5" />Lots ({lots.length})</TabsTrigger>
          <TabsTrigger value="qc"><Shield className="mr-1 h-3.5 w-3.5" />Qualité</TabsTrigger>
          <TabsTrigger value="stock"><Warehouse className="mr-1 h-3.5 w-3.5" />Entrepôt</TabsTrigger>
          <TabsTrigger value="documents"><Printer className="mr-1 h-3.5 w-3.5" />Documents</TabsTrigger>
          <TabsTrigger value="history"><History className="mr-1 h-3.5 w-3.5" />Historique</TabsTrigger>
        </TabsList>

        {/* ── FICHE ── */}
        <TabsContent value="overview" className="mt-4 space-y-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Fournisseur & commande</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <InfoRow label="Code fournisseur" value={reception.supplier_code_snapshot || reception.supplier?.code} />
                <InfoRow label="Fournisseur" value={reception.supplier?.name || reception.supplier_name_snapshot} />
                <InfoRow label="Oasis" value={reception.origin_oasis || reception.supplier?.oasis_name} />
                <InfoRow label="GPS oasis" value={reception.origin_gps} />
                <InfoRow label="Bon de livraison" value={reception.delivery_note_number} />
                <InfoRow
                  label="Bon de commande"
                  value={reception.purchase_order_number || (reception.purchase_order_id ? 'Lié' : 'Livraison spontanée')}
                />
                {reception.po_expected_kg != null && (
                  <>
                    <InfoRow label="Attendu sur la commande" value={`${reception.po_expected_kg} kg`} />
                    <InfoRow label="Écart avec la commande" value={reception.po_variance_kg != null ? `${reception.po_variance_kg} kg` : '0 kg'} />
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Pesée & produit</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <InfoRow label="Poids brut" value={reception.gross_weight_kg != null ? `${reception.gross_weight_kg} kg` : '-'} />
                <InfoRow label="Tare" value={reception.tare_weight_kg != null ? `${reception.tare_weight_kg} kg` : '-'} />
                <InfoRow label="Poids net" value={`${reception.quantity_total} ${reception.unit}`} />
                <InfoRow label="Provenance du poids" value={describeWeighingSource(reception.weighing_source, reception.weighing_verified_device)} />
                <InfoRow label="Écart avec le BL" value={reception.weight_gap_percent != null ? `${reception.weight_gap_percent} %` : '-'} />
                <InfoRow label="Variété" value={reception.variety} />
                <InfoRow label="Présentation" value={reception.presentation} />
                <InfoRow label="Maturité" value={reception.maturity_stage} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Transport & contrôle rapide</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <InfoRow label="Véhicule" value={reception.vehicle_number} />
                <InfoRow label="Chauffeur" value={reception.driver_name} />
                <InfoRow label="Température à l'arrivée" value={reception.arrival_temperature_c != null ? `${reception.arrival_temperature_c} °C` : '-'} />
                <InfoRow label="Transport" value={reception.transport_condition} />
                <InfoRow label="État visuel" value={reception.quick_visual_state} />
                <InfoRow label="Bio déclaré" value={reception.bio_declared ? 'Oui' : 'Non'} />
                <InfoRow label="Zone de réception" value={reception.storage_zone_code} />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <QrCode className="h-4 w-4" />
                Traçabilité
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl bg-muted/35 p-4">
                <p className="text-sm text-muted-foreground">Lot interne</p>
                <p className="mt-1 break-all font-mono">{lots.map((lot) => lot.lot_internal).filter(Boolean).join(', ') || '—'}</p>
              </div>
              <div className="rounded-2xl bg-muted/35 p-4">
                <p className="text-sm text-muted-foreground">Palettes / unités</p>
                <p className="mt-1 font-medium">{reception.pallet_count || reception.crate_count || '-'}</p>
              </div>
              <div className="rounded-2xl bg-muted/35 p-4">
                <p className="text-sm text-muted-foreground">Durée de réception</p>
                <p className="mt-1 font-medium">{reception.reception_duration_minutes != null ? `${reception.reception_duration_minutes} min` : '-'}</p>
              </div>
            </CardContent>
          </Card>

          {(reception.quick_check_notes || reception.remarks || (reception.phase1_alerts && reception.phase1_alerts.length > 0)) && (
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Observations opérateur</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  {reception.quick_check_notes && <p>{reception.quick_check_notes}</p>}
                  {reception.remarks && (
                    <>
                      {reception.quick_check_notes && <Separator />}
                      <p>{reception.remarks}</p>
                    </>
                  )}
                  {!reception.quick_check_notes && !reception.remarks && <p className="text-muted-foreground">Aucune observation.</p>}
                </CardContent>
              </Card>

              <Card className={reception.phase1_alerts?.length ? 'border-amber-200 bg-amber-50/70' : ''}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Alertes à la réception</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {reception.phase1_alerts?.length ? reception.phase1_alerts.map((alert) => (
                    <div key={alert} className="rounded-xl border border-amber-200 bg-white px-3 py-2 text-amber-900">
                      {alert}
                    </div>
                  )) : <p className="text-muted-foreground">Aucune alerte active.</p>}
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* ── LOTS ── */}
        <TabsContent value="lots" className="mt-4 space-y-4">
          {lots.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">Aucun lot enregistré pour cette réception.</div>
          ) : (
            lots.map((lot) => {
              const hasNet = lot.net_weight_kg != null;
              const hasLabel = Boolean(lot.label_printed_at);
              return (
                <Card key={lot.id} data-lot-id={lot.lot_internal || lot.id}>
                  <CardHeader className="pb-2">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <CardTitle className="font-mono text-base">{lot.lot_internal}</CardTitle>
                        <p className="text-sm text-muted-foreground">Réf. fournisseur : {lot.lot_supplier || '—'}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={stockStatusColors[lot.stock_status]}>
                          {stockStatusLabels[lot.stock_status]}
                        </Badge>
                        {lot.storage_zone_code && <Badge variant="outline">Zone {lot.storage_zone_code}</Badge>}
                        {hasNet && (
                          <Badge variant="outline" className="border-emerald-300 text-xs text-emerald-700">
                            Net : {lot.net_weight_kg} kg
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-4">
                      <InfoRow label="Quantité" value={`${lot.quantity} ${lot.unit}`} />
                      <InfoRow label="Origine" value={lot.origin_farm || lot.origin_country} />
                      <InfoRow label="Date de récolte" value={lot.harvest_date} />
                      <InfoRow label="RFID" value={lot.rfid_tag} />
                    </div>

                    <LotCostCard lotId={lot.id} />

                    {lot.stock_status === 'EN_QUARANTAINE' && lot.quarantine_reason && (
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                        <p className="font-medium">Motif de quarantaine</p>
                        <p className="mt-1">{lot.quarantine_reason}</p>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2 border-t border-dashed border-muted-foreground/20 pt-1">
                      <Button type="button" size="sm" variant="outline" className="gap-1.5 rounded-xl" onClick={() => setWeighingLot(lot)}>
                        <Scale className="h-3.5 w-3.5 text-emerald-600" />
                        Voir la pesée
                      </Button>
                      {canEditLots && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="gap-1.5 rounded-xl"
                          disabled={!hasNet}
                          onClick={() => setGs1Lot(lot)}
                          title={!hasNet ? 'La pesée nette est requise avant de générer l\'étiquette GS1' : undefined}
                        >
                          <QrCode className="h-3.5 w-3.5 text-purple-600" />
                          {hasLabel ? 'Réimprimer l\'étiquette GS1' : 'Étiquette GS1'}
                        </Button>
                      )}
                      {!lotQualityEditable ? null : lot.stock_status === 'EN_QUARANTAINE' ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="gap-1.5 rounded-xl border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                          onClick={() => setLotToRelease(lot)}
                        >
                          <LockOpen className="h-3.5 w-3.5" />
                          Libérer
                        </Button>
                      ) : lot.stock_status === 'STOCK_LIBERE' || lot.stock_status === 'NON_STOCKE' ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="gap-1.5 rounded-xl border-amber-300 text-amber-800 hover:bg-amber-50"
                          onClick={() => setLotToQuarantine(lot)}
                        >
                          <Lock className="h-3.5 w-3.5" />
                          Mettre en quarantaine
                        </Button>
                      ) : null}
                    </div>

                    {lot.qr_code_payload && (
                      <div className="rounded-2xl bg-muted/35 p-4 text-sm">
                        <p className="font-medium">Données du code QR</p>
                        <p className="mt-2 break-all font-mono text-xs text-muted-foreground">{lot.qr_code_payload}</p>
                      </div>
                    )}

                    <UnitsManagement
                      lot={lot}
                      receptionNumber={reception.reception_number}
                      onPrintLabel={(unit) => handlePrintLabel(unit, lot)}
                    />
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        {/* ── QUALITÉ ── */}
        <TabsContent value="qc" className="mt-4 space-y-4">
          {reception.qc_decision ? (
            <Card className={reception.qc_decision === 'ACCEPTE' ? 'border-emerald-200 bg-emerald-50/50' : reception.qc_decision === 'REJETE' ? 'border-red-200 bg-red-50/50' : 'border-amber-200 bg-amber-50/50'}>
              <CardContent className="flex items-center justify-between gap-3 p-4">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-6 w-6 text-primary" />
                  <div>
                    <p className="font-medium">{qcDecisionLabels[reception.qc_decision]}</p>
                    <p className="text-sm text-muted-foreground">
                      Score {reception.qc_score ?? '-'} · Classement {reception.qc_grade || '-'}
                    </p>
                  </div>
                </div>
                {canStartQC && (
                  <Button size="sm" variant="outline" onClick={() => setQcDialogOpen(true)}>
                    <Play className="mr-1.5 h-3.5 w-3.5" />
                    {reception.status === 'BLOQUE' ? 'Ré-inspecter' : 'Reprendre le contrôle'}
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : !canStartQC && ['EN_ATTENTE_QC', 'EN_QC'].includes(reception.status) ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              Le contrôle qualité est réalisé par le service qualité. Les lots restent en quarantaine jusqu'à sa décision.
            </div>
          ) : null}

          {inspections.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">Aucune inspection qualité enregistrée.</div>
          ) : (
            inspections.map((inspection) => (
              <Card key={inspection.id}>
                <CardHeader className="pb-2">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <CardTitle className="font-mono text-base">{inspection.inspection_number}</CardTitle>
                    {inspection.decision ? (
                      <Badge className={qcDecisionColors[inspection.decision]}>
                        {qcDecisionLabels[inspection.decision]}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-sky-300 text-sky-700">En cours</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <InfoRow label="Inspecteur" value={inspection.inspector_name} />
                  <InfoRow label="Début" value={formatDateTime(inspection.started_at)} />
                  <InfoRow label="Délai d'inspection" value={inspection.inspection_delay_hours != null ? `${inspection.inspection_delay_hours} h` : '-'} />
                  {inspection.comment && <div className="rounded-xl bg-muted/35 p-3">{inspection.comment}</div>}
                </CardContent>
              </Card>
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
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm"><ImageIcon className="h-4 w-4" />Photos à l'arrivée</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-2 md:grid-cols-4">
                {reception.delivery_note_photos?.map((photo, index) => (
                  <a key={index} href={photo} target="_blank" rel="noreferrer">
                    <img src={photo} alt={`Photo d'arrivée ${index + 1}`} className="aspect-square w-full rounded-xl border object-cover" />
                  </a>
                ))}
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Documents de réception</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="h-auto w-full justify-start gap-2 py-3 text-sm" onClick={() => setBonDialogOpen(true)}>
                <Printer className="h-4 w-4" />
                <div className="text-left">
                  <div className="font-medium">Bon de réception achat</div>
                  <div className="text-xs text-muted-foreground">Produit entrant, pesée, lots</div>
                </div>
              </Button>
              <Button variant="outline" className="h-auto w-full justify-start gap-2 py-3 text-sm" onClick={() => setExpeditionDialogOpen(true)}>
                <Truck className="h-4 w-4" />
                <div className="text-left">
                  <div className="font-medium">Bon d'expédition fournisseur</div>
                  <div className="text-xs text-muted-foreground">Bon de livraison accompagnant le camion</div>
                </div>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Documents qualité</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {inspections.length > 0 ? (
                <>
                  <Button variant="outline" className="h-auto w-full justify-start gap-2 py-3 text-sm" onClick={() => setRapportQCOpen(true)}>
                    <FlaskConical className="h-4 w-4 text-purple-600" />
                    <div className="text-left">
                      <div className="font-medium">Rapport de contrôle qualité</div>
                      <div className="text-xs text-muted-foreground">
                        {inspections[0]?.inspection_number} — {inspections[0]?.decision ? `Décision : ${qcDecisionLabels[inspections[0].decision]}` : 'En cours'}
                      </div>
                    </div>
                  </Button>
                  {hasClaimDocuments && (
                    <>
                      <Button variant="outline" className="h-auto w-full justify-start gap-2 border-red-200 py-3 text-sm" onClick={() => setReclamationOpen(true)}>
                        <AlertTriangle className="h-4 w-4 text-red-600" />
                        <div className="text-left">
                          <div className="font-medium text-red-700">Réclamation fournisseur</div>
                          <div className="text-xs text-muted-foreground">
                            {inspections.some((inspection) => inspection.decision === 'REJETE') ? 'Contrôle qualité rejeté' : `Écart de poids : ${reception.weight_gap_percent?.toFixed(1)} %`}
                          </div>
                        </div>
                      </Button>
                      <Button variant="outline" className="h-auto w-full justify-start gap-2 border-red-200 py-3 text-sm" onClick={() => setBonReclamationOpen(true)}>
                        <AlertTriangle className="h-4 w-4 text-red-600" />
                        <div className="text-left">
                          <div className="font-medium text-red-700">Bon de réclamation fournisseur</div>
                          <div className="text-xs text-muted-foreground">Écart de poids, déclassement, conclusion qualité, prix</div>
                        </div>
                      </Button>
                    </>
                  )}
                </>
              ) : (
                <p className="py-2 text-sm text-muted-foreground">Disponibles après le contrôle qualité.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── HISTORIQUE ── */}
        <TabsContent value="history" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Déroulé de la réception</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {timelineEntries.map((entry) => (
                <div key={entry.label} className="rounded-xl border bg-card px-3 py-2">
                  <p className="text-sm font-medium">{entry.label}</p>
                  <p className="text-sm text-muted-foreground">{formatDateTime(entry.value) ?? 'Non renseigné'}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Journal des actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {auditLogs.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">Aucune action enregistrée.</p>
              ) : (
                (auditLogs as ReceptionAuditLog[]).map((log, idx) => {
                  const event = describeReceptionAuditEvent(log);
                  return (
                    <div key={log.id ?? idx} className="flex items-start gap-3 rounded-xl border bg-card px-4 py-3 text-sm">
                      <History className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{event.label}</span>
                          <Badge variant="outline" className="text-[11px]">{event.target}</Badge>
                          {event.actor && <span className="text-xs text-muted-foreground">par {event.actor}</span>}
                        </div>
                        {event.detail && <p className="mt-0.5 text-xs text-muted-foreground">{event.detail}</p>}
                      </div>
                      {log.created_at && (
                        <span className="whitespace-nowrap text-xs text-muted-foreground">
                          {format(new Date(log.created_at), 'dd/MM HH:mm', { locale: fr })}
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
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
