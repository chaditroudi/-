import { useCallback, useMemo, useState } from 'react';
import { Camera, FlaskConical, QrCode, Shield } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <QrCode className="h-5 w-5 text-primary" />
                  Contrôle Qualité Entrée
                </CardTitle>
                <CardDescription>
                  Scannez ou saisissez un LOT-ID pour charger la fiche et ouvrir le contrôle qualité entrant.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Scan row */}
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    value={scanValue}
                    onChange={(e) => setScanValue(e.target.value)}
                    placeholder="LOT-ID / QR code / référence lot"
                    className="h-12 flex-1 rounded-2xl bg-background/85"
                    onKeyDown={(e) => { if (e.key === 'Enter') void handleScanLot(); }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="h-12 rounded-2xl px-4 shrink-0"
                    onClick={() => setScannerOpen(true)}
                  >
                    <Camera className="mr-2 h-4 w-4" />
                    Caméra QR
                  </Button>
                  <Button
                    type="button"
                    className="h-12 rounded-2xl px-5 shrink-0"
                    onClick={() => void handleScanLot()}
                    disabled={isScanLoading || !scanValue.trim()}
                  >
                    <QrCode className="mr-2 h-4 w-4" />
                    {isScanLoading ? 'Chargement…' : 'Scanner'}
                  </Button>
                </div>

                {/* Scan result */}
                {scanMessage && (
                  <div className={cn(
                    'rounded-2xl border p-4 text-sm',
                    selectedReception ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-amber-200 bg-amber-50 text-amber-900',
                  )}>
                    {scanMessage}
                  </div>
                )}

                {/* Info panels side by side */}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-border/60 bg-muted/25 p-4 text-sm">
                    <p className="font-medium text-foreground">Règles d'échantillonnage</p>
                    <ul className="mt-2 space-y-1 text-muted-foreground text-xs leading-5">
                      <li>• Lot ≤ 1 tonne → minimum 2 kg</li>
                      <li>• Lot &gt; 5 tonnes → minimum 5 kg</li>
                      <li>• Entre les deux → prélèvement représentatif</li>
                    </ul>
                  </div>
                  <div className="rounded-2xl border border-border/60 bg-muted/25 p-4 text-sm">
                    <p className="font-medium text-foreground">Ce qui est chargé après scan</p>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">
                      Fournisseur, variété, poids, statut et lot — aucune ressaisie avant le contrôle.
                    </p>
                  </div>
                </div>

                {/* Awaiting QC mini-list */}
                {awaitingQc.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground">
                      Lots en attente QC ({awaitingQc.length})
                    </p>
                    {awaitingQc.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => handleStartQC(r)}
                        className="flex w-full items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50/60 px-4 py-3 text-left hover:bg-amber-50 transition-colors"
                      >
                        <div>
                          <span className="font-mono text-sm font-semibold">{r.reception_number}</span>
                          <span className="ml-2 text-xs text-muted-foreground">{r.supplier?.name || r.supplier_name_snapshot || '—'} • {r.quantity_total} {r.unit}</span>
                        </div>
                        <Button type="button" size="sm" className="h-9 rounded-xl text-xs" onClick={(e) => { e.stopPropagation(); handleStartQC(r); }}>
                          <Shield className="mr-1 h-3 w-3" />
                          Lancer QC
                        </Button>
                      </button>
                    ))}
                  </div>
                )}

                {/* In-progress QC mini-list — interrupted inspections stay findable here */}
                {inQc.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground">
                      Inspections en cours ({inQc.length})
                    </p>
                    {inQc.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => handleStartQC(r)}
                        className="flex w-full items-center justify-between gap-3 rounded-2xl border border-sky-200 bg-sky-50/60 px-4 py-3 text-left hover:bg-sky-50 transition-colors"
                      >
                        <div>
                          <span className="font-mono text-sm font-semibold">{r.reception_number}</span>
                          <span className="ml-2 text-xs text-muted-foreground">{r.supplier?.name || r.supplier_name_snapshot || '—'} • {r.quantity_total} {r.unit}</span>
                        </div>
                        <Button type="button" size="sm" className="h-9 rounded-xl bg-sky-600 text-xs hover:bg-sky-700" onClick={(e) => { e.stopPropagation(); handleStartQC(r); }}>
                          <Shield className="mr-1 h-3 w-3" />
                          Reprendre
                        </Button>
                      </button>
                    ))}
                  </div>
                )}

                {/* Lab pending results — RG-Q07 */}
                {labPendingInspections.length > 0 && (
                  <div className="space-y-2 pt-1">
                    <p className="text-xs font-semibold text-sky-700">
                      Résultats labo en attente ({labPendingInspections.length})
                    </p>
                    {labPendingInspections.slice(0, 5).map((insp) => {
                      const rec = receptions.find((r) => r.id === insp.reception_id);
                      if (!rec) return null;
                      return (
                        <div
                          key={insp.id}
                          className="flex w-full items-center justify-between gap-3 rounded-2xl border border-sky-200 bg-sky-50/60 px-4 py-3"
                        >
                          <div className="min-w-0">
                            <span className="font-mono text-sm font-semibold">{rec.reception_number}</span>
                            <span className="ml-2 text-xs text-muted-foreground">
                              {rec.supplier?.name || rec.supplier_name_snapshot || '—'} • {(insp.lab_analyses ?? []).join(', ')}
                            </span>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-9 rounded-xl text-xs border-sky-300 text-sky-700 hover:bg-sky-50 shrink-0"
                            onClick={() => {
                              setSelectedReception(rec);
                              setSelectedInspection(insp as QCInspection);
                              setLabDialogOpen(true);
                            }}
                          >
                            <FlaskConical className="mr-1 h-3 w-3" />
                            Saisir résultats
                          </Button>
                        </div>
                      );
                    })}
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
