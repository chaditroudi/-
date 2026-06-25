import { useState } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  AlertTriangle,
  CheckCircle,
  ClipboardList,
  FileText,
  FlaskConical,
  History,
  Lock,
  LockOpen,
  Package,
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useListReceptionAuditQuery } from '@/store/api/receptionsApi';
import { useQCInspections, useReceptionLots, useReceptionV2Detail } from '@/hooks/useReceptionsV2';
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
import { QCInspectionDialog } from './QCInspectionDialog';
import { StorageAssignment } from './StorageAssignment';
import { UnitsManagement } from './UnitsManagement';
import { WeighingRecordDialog } from './WeighingRecordDialog';
import { Gs1LabelPreview } from './Gs1LabelPreview';
import { ReceptionLotStatusDialog } from './ReceptionLotStatusDialog';

interface ReceptionDetailV2Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  receptionId: string;
}

const InfoRow = ({ label, value }: { label: string; value: string | number | null | undefined }) => (
  <div className="flex items-start justify-between gap-3 text-sm">
    <span className="text-muted-foreground">{label}</span>
    <span className="text-right font-medium">{value || '-'}</span>
  </div>
);

export const ReceptionDetailV2 = ({ open, onOpenChange, receptionId }: ReceptionDetailV2Props) => {
  const { data: reception, isLoading } = useReceptionV2Detail(receptionId);
  const { data: lots = [] } = useReceptionLots(receptionId);
  const { data: inspections = [] } = useQCInspections(receptionId);

  const { data: auditLogs = [] } = useListReceptionAuditQuery(receptionId, { skip: !receptionId });

  const [labelDialogOpen, setLabelDialogOpen] = useState(false);
  const [bonDialogOpen, setBonDialogOpen] = useState(false);
  const [expeditionDialogOpen, setExpeditionDialogOpen] = useState(false);
  const [rapportQCOpen, setRapportQCOpen] = useState(false);
  const [reclamationOpen, setReclamationOpen] = useState(false);
  const [qcDialogOpen, setQcDialogOpen] = useState(false);
  const [selectedUnitForLabel, setSelectedUnitForLabel] = useState<ReceptionUnit | null>(null);
  const [selectedLotForLabel, setSelectedLotForLabel] = useState<ReceptionLot | null>(null);
  const [weighingLot, setWeighingLot] = useState<ReceptionLot | null>(null);
  const [gs1Lot, setGs1Lot] = useState<ReceptionLot | null>(null);
  const [lotToQuarantine, setLotToQuarantine] = useState<ReceptionLot | null>(null);
  const [lotToRelease, setLotToRelease] = useState<ReceptionLot | null>(null);

  if (isLoading || !reception) return null;

  const canStartQC = reception.status === 'EN_ATTENTE_QC' || reception.status === 'EN_QC';

  const handlePrintLabel = (unit: ReceptionUnit, lot: ReceptionLot) => {
    setSelectedUnitForLabel(unit);
    setSelectedLotForLabel(lot);
    setLabelDialogOpen(true);
  };

  const timelineEntries = [
    { label: 'Arrivee portail', value: reception.gate_arrival_at },
    { label: 'Pesee brut', value: reception.gross_weight_captured_at },
    { label: 'Debut dechargement', value: reception.unloading_started_at },
    { label: 'Fin dechargement', value: reception.unloading_completed_at },
    { label: 'Pesee tare', value: reception.tare_weight_captured_at },
    { label: 'Validation', value: reception.validated_at || reception.created_at },
  ];

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl max-h-[92vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <div className="flex flex-wrap items-center gap-3">
              <DialogTitle className="font-mono text-lg">{reception.reception_number}</DialogTitle>
              <Badge className={receptionStatusColors[reception.status]}>
                {receptionStatusLabels[reception.status]}
              </Badge>
              {reception.variety && <Badge variant="outline">{reception.variety}</Badge>}
              {reception.storage_zone_code && <Badge variant="outline">Zone {reception.storage_zone_code}</Badge>}
            </div>
          </DialogHeader>

          <Tabs defaultValue="overview" className="flex-1 overflow-hidden">
            <TabsList className="grid w-full grid-cols-7 text-xs">
              <TabsTrigger value="overview"><FileText className="mr-1 h-3.5 w-3.5" />Fiche</TabsTrigger>
              <TabsTrigger value="timeline"><Truck className="mr-1 h-3.5 w-3.5" />Processus</TabsTrigger>
              <TabsTrigger value="lots"><Package className="mr-1 h-3.5 w-3.5" />Lots</TabsTrigger>
              <TabsTrigger value="qc" className="relative">
                <Shield className="mr-1 h-3.5 w-3.5" />Qualité
                {inspections.length > 0 && <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-500" />}
              </TabsTrigger>
              <TabsTrigger value="stock"><Warehouse className="mr-1 h-3.5 w-3.5" />Entrepôt</TabsTrigger>
              <TabsTrigger value="audit"><ClipboardList className="mr-1 h-3.5 w-3.5" />Audit</TabsTrigger>
              <TabsTrigger value="documents"><Printer className="mr-1 h-3.5 w-3.5" />Documents</TabsTrigger>
            </TabsList>

            <ScrollArea className="mt-4 flex-1">
              <TabsContent value="overview" className="m-0 space-y-4">
                <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr_1fr]">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Identification du lot</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <InfoRow label="Reception" value={reception.reception_number} />
                      <InfoRow label="Code fournisseur" value={reception.supplier_code_snapshot || reception.supplier?.code} />
                      <InfoRow label="Fournisseur" value={reception.supplier?.name || reception.supplier_name_snapshot} />
                      <InfoRow label="Oasis" value={reception.origin_oasis || reception.supplier?.oasis_name} />
                      <InfoRow label="GPS oasis" value={reception.origin_gps} />
                      <InfoRow label="BL" value={reception.delivery_note_number} />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Pesée & produit</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <InfoRow label="Poids brut" value={reception.gross_weight_kg != null ? `${reception.gross_weight_kg} kg` : '-'} />
                      <InfoRow label="Poids tare" value={reception.tare_weight_kg != null ? `${reception.tare_weight_kg} kg` : '-'} />
                      <InfoRow label="Poids net" value={`${reception.quantity_total} ${reception.unit}`} />
                      <InfoRow label="Ecart poids" value={reception.weight_gap_percent != null ? `${reception.weight_gap_percent}%` : '-'} />
                      <InfoRow label="Variete" value={reception.variety} />
                      <InfoRow label="Presentation" value={reception.presentation} />
                      <InfoRow label="Maturite" value={reception.maturity_stage} />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Transport & controle rapide</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <InfoRow label="Vehicule" value={reception.vehicle_number} />
                      <InfoRow label="Chauffeur" value={reception.driver_name} />
                      <InfoRow label="Temperature arrivee" value={reception.arrival_temperature_c != null ? `${reception.arrival_temperature_c}°C` : '-'} />
                      <InfoRow label="Transport" value={reception.transport_condition} />
                      <InfoRow label="Etat visuel" value={reception.quick_visual_state} />
                      <InfoRow label="Bio declare" value={reception.bio_declared ? 'Oui' : 'Non'} />
                      <InfoRow label="Zone temporaire" value={reception.storage_zone_code} />
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <QrCode className="h-4 w-4" />
                      Traçabilité Royal Palm
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-4 md:grid-cols-3">
                    <div className="rounded-2xl bg-muted/35 p-4">
                      <p className="text-sm text-muted-foreground">LOT-ID preview</p>
                      <p className="mt-1 break-all font-mono">{lots[0]?.lot_internal || reception.reception_number}</p>
                    </div>
                    <div className="rounded-2xl bg-muted/35 p-4">
                      <p className="text-sm text-muted-foreground">Palette(s) / unites</p>
                      <p className="mt-1 font-medium">{reception.pallet_count || reception.crate_count || '-'}</p>
                    </div>
                    <div className="rounded-2xl bg-muted/35 p-4">
                      <p className="text-sm text-muted-foreground">Cycle reception</p>
                      <p className="mt-1 font-medium">{reception.reception_duration_minutes ?? '-'} min</p>
                    </div>
                  </CardContent>
                </Card>

                {(reception.quick_check_notes || reception.remarks || (reception.phase1_alerts && reception.phase1_alerts.length > 0)) && (
                  <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Observations operateur</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4 text-sm">
                        {reception.quick_check_notes && <p>{reception.quick_check_notes}</p>}
                        {reception.remarks && (
                          <>
                            {reception.quick_check_notes && <Separator />}
                            <p>{reception.remarks}</p>
                          </>
                        )}
                      </CardContent>
                    </Card>

                    <Card className={reception.phase1_alerts?.length ? 'border-amber-200 bg-amber-50/70' : ''}>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Alertes phase 1</CardTitle>
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

              <TabsContent value="timeline" className="m-0">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Timeline reception Royal Palm</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {timelineEntries.map((entry, index) => (
                      <div key={entry.label} className="flex items-start gap-3 rounded-2xl border bg-card px-4 py-3">
                        <div className="mt-1 h-3 w-3 rounded-full bg-primary" />
                        <div className="flex-1">
                          <p className="font-medium">{entry.label}</p>
                          <p className="text-sm text-muted-foreground">
                            {entry.value ? format(new Date(entry.value), 'dd/MM/yyyy HH:mm', { locale: fr }) : 'Non renseigné'}
                          </p>
                        </div>
                        <Badge variant="outline">{index + 1}</Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="lots" className="m-0 space-y-4">
                {lots.length === 0 ? (
                  <div className="py-10 text-center text-muted-foreground">Aucun lot enregistré pour cette réception.</div>
                ) : (
                  lots.map((lot) => {
                    const hasNet = (lot as any).net_weight_kg != null;
                    const hasLabel = !!(lot as any).label_printed_at;
                    return (
                      <Card key={lot.id}>
                        <CardHeader className="pb-2">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <CardTitle className="text-base font-mono">{lot.lot_internal}</CardTitle>
                              <p className="text-sm text-muted-foreground">Réf. fournisseur : {lot.lot_supplier || '—'}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge className={stockStatusColors[lot.stock_status]}>
                                {stockStatusLabels[lot.stock_status]}
                              </Badge>
                              {hasNet && (
                                <Badge variant="outline" className="border-emerald-300 text-emerald-700 text-xs">
                                  Net : {(lot as any).net_weight_kg} kg
                                </Badge>
                              )}
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid gap-4 md:grid-cols-4">
                            <InfoRow label="Quantité" value={`${lot.quantity} ${lot.unit}`} />
                            <InfoRow label="Origine" value={lot.origin_farm || lot.origin_country} />
                            <InfoRow label="Date récolte" value={lot.harvest_date} />
                            <InfoRow label="RFID" value={lot.rfid_tag} />
                          </div>

                          {lot.stock_status === 'EN_QUARANTAINE' && lot.quarantine_reason && (
                            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                              <p className="font-medium">Motif de quarantaine</p>
                              <p className="mt-1">{lot.quarantine_reason}</p>
                            </div>
                          )}

                          {/* Pesée + Étiquette GS1 actions */}
                          <div className="flex flex-wrap gap-2 pt-1 border-t border-dashed border-muted-foreground/20">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="gap-1.5 rounded-xl"
                              onClick={() => setWeighingLot(lot)}
                            >
                              <Scale className="h-3.5 w-3.5 text-emerald-600" />
                              {hasNet ? 'Voir pesée' : 'Peser le lot'}
                            </Button>
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
                              {hasLabel ? 'Ré-imprimer GS1' : 'Étiquette GS1'}
                            </Button>
                            {lot.stock_status === 'EN_QUARANTAINE' ? (
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
                            ) : lot.stock_status !== 'STOCK_REJETE' ? (
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
                              <p className="font-medium">QR payload</p>
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

              <TabsContent value="qc" className="m-0 space-y-4">
                {/* QC decision summary */}
                {reception.qc_decision ? (
                  <Card className={reception.qc_decision === 'ACCEPTE' ? 'border-emerald-200 bg-emerald-50/50' : reception.qc_decision === 'REJETE' ? 'border-red-200 bg-red-50/50' : 'border-amber-200 bg-amber-50/50'}>
                    <CardContent className="flex items-center justify-between gap-3 p-4">
                      <div className="flex items-center gap-3">
                        <CheckCircle className="h-6 w-6 text-primary" />
                        <div>
                          <p className="font-medium">{qcDecisionLabels[reception.qc_decision]}</p>
                          <p className="text-sm text-muted-foreground">
                            Score {reception.qc_score ?? '-'} • Grade {reception.qc_grade || '-'}
                          </p>
                        </div>
                      </div>
                      {canStartQC && (
                        <Button size="sm" variant="outline" onClick={() => setQcDialogOpen(true)}>
                          <Play className="h-3.5 w-3.5 mr-1.5" />
                          Reprendre QC
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ) : canStartQC ? (
                  <Card className="border-sky-200 bg-sky-50/50">
                    <CardContent className="flex items-center justify-between gap-3 p-4">
                      <div className="flex items-center gap-3">
                        <Shield className="h-6 w-6 text-sky-600" />
                        <div>
                          <p className="font-medium text-sky-800">
                            {reception.status === 'EN_QC' ? 'Inspection QC en cours' : 'Prêt pour contrôle qualité'}
                          </p>
                          <p className="text-sm text-sky-600">{reception.quantity_total} {reception.unit}</p>
                        </div>
                      </div>
                      <Button size="sm" onClick={() => setQcDialogOpen(true)}>
                        <Play className="h-3.5 w-3.5 mr-1.5" />
                        {reception.status === 'EN_QC' ? 'Reprendre' : 'Lancer QC'}
                      </Button>
                    </CardContent>
                  </Card>
                ) : null}

                {inspections.length === 0 ? (
                  <div className="py-10 text-center text-muted-foreground">Aucune inspection QC enregistrée.</div>
                ) : (
                  inspections.map((inspection) => (
                    <Card key={inspection.id}>
                      <CardHeader className="pb-2">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <CardTitle className="text-base font-mono">{inspection.inspection_number}</CardTitle>
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
                        <InfoRow label="Début" value={format(new Date(inspection.started_at), 'dd/MM/yyyy HH:mm', { locale: fr })} />
                        <InfoRow label="Délai inspection" value={inspection.inspection_delay_hours != null ? `${inspection.inspection_delay_hours} h` : '-'} />
                        {inspection.comment && (
                          <div className="rounded-xl bg-muted/35 p-3">
                            {inspection.comment}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))
                )}
              </TabsContent>

              <TabsContent value="stock" className="m-0">
                <StorageAssignment reception={reception} lots={lots} />
              </TabsContent>

              <TabsContent value="audit" className="m-0 space-y-2">
                {auditLogs.length === 0 ? (
                  <div className="py-10 text-center text-muted-foreground">Aucun événement d'audit enregistré.</div>
                ) : (
                  (auditLogs as Array<{ id?: string; action?: string; performed_by?: string; created_at?: string; new_state?: Record<string, unknown> }>).map((log, idx) => (
                    <div key={log.id ?? idx} className="flex items-start gap-3 rounded-xl border bg-card px-4 py-3 text-sm">
                      <History className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">{log.action || '—'}</span>
                          {log.performed_by && <span className="text-xs text-muted-foreground">par {log.performed_by}</span>}
                        </div>
                        {log.new_state && (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">
                            {JSON.stringify(log.new_state)}
                          </p>
                        )}
                      </div>
                      {log.created_at && (
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {format(new Date(log.created_at), 'dd/MM HH:mm', { locale: fr })}
                        </span>
                      )}
                    </div>
                  ))
                )}
              </TabsContent>

              {/* ── DOCUMENTS ── */}
              <TabsContent value="documents" className="m-0 space-y-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Documents de réception</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Button
                      variant="outline"
                      className="w-full justify-start gap-2 text-sm"
                      onClick={() => setBonDialogOpen(true)}
                    >
                      <Printer className="h-4 w-4" />
                      <div className="text-left">
                        <div className="font-medium">Bon de Réception Achat</div>
                        <div className="text-xs text-muted-foreground">Formulaire Royal Palm — produit entrant, pesée, lots</div>
                      </div>
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full justify-start gap-2 text-sm"
                      onClick={() => setExpeditionDialogOpen(true)}
                    >
                      <Truck className="h-4 w-4" />
                      <div className="text-left">
                        <div className="font-medium">Bon d'Expédition Fournisseur</div>
                        <div className="text-xs text-muted-foreground">Bon livraison accompagnant le camion fournisseur</div>
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
                        <Button
                          variant="outline"
                          className="w-full justify-start gap-2 text-sm"
                          onClick={() => setRapportQCOpen(true)}
                        >
                          <FlaskConical className="h-4 w-4 text-purple-600" />
                          <div className="text-left">
                            <div className="font-medium">Rapport Contrôle Qualité</div>
                            <div className="text-xs text-muted-foreground">
                              {inspections[0]?.inspection_number} — {inspections[0]?.decision ? `Décision : ${qcDecisionLabels[inspections[0].decision]}` : 'En cours'}
                            </div>
                          </div>
                        </Button>
                        {(inspections.some(i => i.decision === 'REJETE') || (reception.weight_gap_percent != null && Math.abs(reception.weight_gap_percent) > 2)) && (
                          <Button
                            variant="outline"
                            className="w-full justify-start gap-2 text-sm border-red-200"
                            onClick={() => setReclamationOpen(true)}
                          >
                            <AlertTriangle className="h-4 w-4 text-red-600" />
                            <div className="text-left">
                              <div className="font-medium text-red-700">Réclamation Fournisseur</div>
                              <div className="text-xs text-muted-foreground">
                                {inspections.some(i => i.decision === 'REJETE') ? 'QC rejeté' : `Écart poids : ${reception.weight_gap_percent?.toFixed(1)}%`}
                              </div>
                            </div>
                          </Button>
                        )}
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground py-2">Aucune inspection QC enregistrée.</p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </ScrollArea>
          </Tabs>

          <div className="border-t pt-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4" />
              Enregistrement cree le {format(new Date(reception.created_at), 'dd/MM/yyyy HH:mm', { locale: fr })} par {reception.created_by || 'systeme'}.
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <LabelPrintDialog
        open={labelDialogOpen}
        onOpenChange={setLabelDialogOpen}
        unit={selectedUnitForLabel}
        reception={reception}
        lot={selectedLotForLabel}
      />

      <BonReceptionDialog
        open={bonDialogOpen}
        onOpenChange={setBonDialogOpen}
        reception={reception}
        lots={lots}
      />
      <BonExpeditionDialog
        open={expeditionDialogOpen}
        onOpenChange={setExpeditionDialogOpen}
        reception={reception}
        lots={lots}
      />
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

      {weighingLot && (
        <WeighingRecordDialog
          lot={weighingLot}
          onClose={() => setWeighingLot(null)}
        />
      )}

      {gs1Lot && (
        <Gs1LabelPreview
          lot={gs1Lot}
          onClose={() => setGs1Lot(null)}
        />
      )}

      <ReceptionLotStatusDialog
        lot={lotToQuarantine}
        receptionId={reception.id}
        mode="quarantine"
        onClose={() => setLotToQuarantine(null)}
      />

      <ReceptionLotStatusDialog
        lot={lotToRelease}
        receptionId={reception.id}
        mode="release"
        onClose={() => setLotToRelease(null)}
      />

      {reception && qcDialogOpen && (
        <QCInspectionDialog
          open={qcDialogOpen}
          onOpenChange={setQcDialogOpen}
          reception={reception}
        />
      )}
    </>
  );
};
