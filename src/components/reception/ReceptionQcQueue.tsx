import { useCallback, useMemo, useState } from 'react';
import { useOnline } from '@/hooks/useOnline';
import { Camera, FlaskConical, QrCode, Shield } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/shared/EmptyState';
import { LotReference } from '@/components/shared/LotReference';
import { QuantityDisplay } from '@/components/shared/QuantityDisplay';
import { findReceptionLotByScan, useLabPendingInspections } from '@/hooks/useReceptionsV2';
import { cn } from '@/lib/utils';
import type { QCInspection, ReceptionV2 } from '@/types/reception';

import { LabResultsDialog } from './LabResultsDialog';
import { QCInspectionDialog } from './QCInspectionDialog';
import { QrScannerDialog } from './QrScannerDialog';

const getSamplingGuidance = (quantityTotal: number) => {
  if (quantityTotal <= 1000) return "Échantillonnage recommandé: minimum 2 kg pour un lot jusqu'à 1 tonne.";
  if (quantityTotal > 5000) return 'Échantillonnage recommandé: minimum 5 kg pour un lot au-delà de 5 tonnes.';
  return 'Échantillonnage recommandé: entre 2 kg et 5 kg selon la représentativité du lot.';
};

/** QC handoff: what quality has to inspect. The decisions stay in QCInspectionDialog. */
export const ReceptionQcQueue = ({ receptions, onOpenStorage }: {
  receptions: ReceptionV2[];
  onOpenStorage: (receptionId: string) => void;
}) => {
  const [scanValue, setScanValue] = useState('');
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [isScanLoading, setIsScanLoading] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [selectedReception, setSelectedReception] = useState<ReceptionV2 | null>(null);
  const [selectedInspection, setSelectedInspection] = useState<QCInspection | null>(null);
  const [qcDialogOpen, setQcDialogOpen] = useState(false);
  const [labDialogOpen, setLabDialogOpen] = useState(false);
  const { data: labPendingInspections = [] } = useLabPendingInspections();
  // A decision is made on the server, so inspections need the connection.
  const online = useOnline();

  const awaitingQc = useMemo(() => receptions.filter((r) => r.status === 'EN_ATTENTE_QC'), [receptions]);
  const inQc = useMemo(() => receptions.filter((r) => r.status === 'EN_QC'), [receptions]);
  const handleStartQC = useCallback((reception: ReceptionV2) => { setSelectedReception(reception); setQcDialogOpen(true); }, []);

  const handleScanLot = useCallback(async (explicitValue?: string) => {
    const normalizedValue = (explicitValue ?? scanValue).trim();
    if (!normalizedValue) return;
    setIsScanLoading(true);
    setScanMessage(null);
    if (explicitValue) setScanValue(normalizedValue);
    try {
      const match = await findReceptionLotByScan(normalizedValue);
      if (!match?.reception) {
        setScanMessage("Aucun LOT-ID ou QR code correspondant n'a été trouvé.");
        return;
      }
      setSelectedReception(match.reception);
      setScanMessage(`${match.lot_internal || match.lot_supplier || normalizedValue} chargé. ${getSamplingGuidance(match.reception.quantity_total)}`);
      setQcDialogOpen(true);
    } catch (error) {
      setScanMessage(error instanceof Error ? error.message : 'Erreur pendant la recherche du LOT-ID.');
    } finally {
      setIsScanLoading(false);
    }
  }, [scanValue]);

  return (
    <>
            <Card className="surface-card rounded-lg">
              <CardContent className="space-y-3 p-3">
                {/* Scan row */}
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    value={scanValue}
                    onChange={(e) => setScanValue(e.target.value)}
                    placeholder="Scanner ou saisir un numéro de lot"
                    aria-label="Numéro de lot à contrôler"
                    className="min-h-12 flex-1 text-base"
                    onKeyDown={(e) => { if (e.key === 'Enter') void handleScanLot(); }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-12 shrink-0"
                    onClick={() => setScannerOpen(true)}
                  >
                    <Camera className="me-2 h-4 w-4" />
                    Caméra QR
                  </Button>
                  <Button
                    type="button"
                    className="min-h-12 shrink-0 font-semibold"
                    onClick={() => void handleScanLot()}
                    disabled={isScanLoading || !scanValue.trim()}
                  >
                    <QrCode className="me-2 h-4 w-4" />
                    {isScanLoading ? 'Chargement…' : 'Scanner'}
                  </Button>
                </div>

                {scanMessage && (
                  <div className={cn(
                    'rounded-lg border p-4 text-sm',
                    selectedReception ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-amber-200 bg-amber-50 text-amber-900',
                  )}>
                    {scanMessage}
                  </div>
                )}

                <p className="text-xs text-muted-foreground">
                  Prélèvement : minimum 2 kg jusqu&apos;à 1 tonne, minimum 5 kg au-delà de 5 tonnes, représentatif entre les deux.
                </p>

                {awaitingQc.length === 0 && inQc.length === 0 && labPendingInspections.length === 0 && (
                  <EmptyState
                    title="Aucun lot en attente de contrôle"
                    description="Scannez un lot ou attendez qu’une réception validée arrive en file QC."
                    icon={<Shield className="h-6 w-6" />}
                  />
                )}

                {!online && (awaitingQc.length > 0 || inQc.length > 0) && (
                  <p className="rounded-lg border border-amber-300 bg-card px-3 py-2 text-sm text-amber-950">
                    Hors ligne : le contrôle qualité reprend dès le retour du réseau. Les décisions restent côté serveur.
                  </p>
                )}

                {awaitingQc.length > 0 && (
                  <div>
                    <h3 className="pb-1 text-sm font-semibold">À inspecter ({awaitingQc.length})</h3>
                    <div className="divide-y rounded-lg border">
                    {awaitingQc.map((r) => (
                      <div key={r.id} className="flex min-h-14 w-full items-center justify-between gap-3 px-3 py-2">
                        <div className="min-w-0">
                          <LotReference value={r.reception_number} className="font-semibold" />
                          <span className="block truncate text-xs text-muted-foreground">
                            {r.supplier?.name || r.supplier_name_snapshot || '—'} ·{' '}
                            <QuantityDisplay value={r.quantity_total} unit={r.unit || 'kg'} className="font-medium" />
                          </span>
                        </div>
                        <Button type="button" className="min-h-11 shrink-0" disabled={!online} onClick={(e) => { e.stopPropagation(); handleStartQC(r); }}>
                          <Shield className="me-1.5 h-4 w-4" />
                          Lancer QC
                        </Button>
                      </div>
                    ))}
                    </div>
                  </div>
                )}

                {inQc.length > 0 && (
                  <div>
                    <h3 className="pb-1 text-sm font-semibold">En cours ({inQc.length})</h3>
                    <div className="divide-y rounded-lg border">
                    {inQc.map((r) => (
                      <div key={r.id} className="flex min-h-14 w-full items-center justify-between gap-3 px-3 py-2">
                        <div className="min-w-0">
                          <LotReference value={r.reception_number} className="font-semibold" />
                          <span className="block truncate text-xs text-muted-foreground">
                            {r.supplier?.name || r.supplier_name_snapshot || '—'} ·{' '}
                            <QuantityDisplay value={r.quantity_total} unit={r.unit || 'kg'} className="font-medium" />
                          </span>
                        </div>
                        <Button type="button" className="min-h-11 shrink-0 bg-sky-700 hover:bg-sky-800" disabled={!online} onClick={(e) => { e.stopPropagation(); handleStartQC(r); }}>
                          <Shield className="me-1.5 h-4 w-4" />
                          Reprendre
                        </Button>
                      </div>
                    ))}
                    </div>
                  </div>
                )}

                {/* Lab pending results — RG-Q07 */}
                {labPendingInspections.length > 0 && (
                  <div>
                    <h3 className="pb-1 text-sm font-semibold">Résultats labo en attente ({labPendingInspections.length})</h3>
                    <div className="divide-y rounded-lg border">
                    {labPendingInspections.slice(0, 5).map((insp) => {
                      const rec = receptions.find((r) => r.id === insp.reception_id);
                      if (!rec) return null;
                      return (
                        <div
                          key={insp.id}
                          className="flex w-full items-center justify-between gap-3 px-3 py-2 text-start hover:bg-muted/60"
                        >
                          <div className="min-w-0">
                            <span className="block whitespace-nowrap font-mono text-sm font-semibold">{rec.reception_number}</span>
                            <span className="ms-2 text-xs text-muted-foreground">
                              {rec.supplier?.name || rec.supplier_name_snapshot || '—'} • {(insp.lab_analyses ?? []).join(', ')}
                            </span>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="text-xs border-sky-300 text-sky-700 hover:bg-sky-50 shrink-0"
                            onClick={() => {
                              setSelectedReception(rec);
                              setSelectedInspection(insp as QCInspection);
                              setLabDialogOpen(true);
                            }}
                          >
                            <FlaskConical className="me-1 h-3 w-3" />
                            Saisir résultats
                          </Button>
                        </div>
                      );
                    })}
                    </div>
                    {labPendingInspections.length > 5 && (
                      <p className="text-center text-xs text-muted-foreground">
                        + {labPendingInspections.length - 5} autres en attente
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

      <QrScannerDialog
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onDetected={(value) => { void handleScanLot(value); }}
      />
      {selectedReception && (
        <>
          <QCInspectionDialog
            open={qcDialogOpen}
            onOpenChange={setQcDialogOpen}
            reception={selectedReception}
            onAssignStorage={() => onOpenStorage(selectedReception.id)}
          />
          {selectedInspection && (
            <LabResultsDialog
              open={labDialogOpen}
              onOpenChange={setLabDialogOpen}
              inspection={selectedInspection}
              reception={selectedReception}
            />
          )}
        </>
      )}
    </>
  );
};
