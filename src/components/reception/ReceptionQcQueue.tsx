import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useOnline } from '@/hooks/useOnline';
import { Camera, FlaskConical, QrCode, Shield, ShieldCheck } from 'lucide-react';

import { Button } from '@/components/ui/button';
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

const samplingKey = (quantityTotal: number) =>
  quantityTotal <= 1000 ? 'qcQueue.sampling.small' : quantityTotal > 5000 ? 'qcQueue.sampling.large' : 'qcQueue.sampling.medium';

const Stat = ({ label, value }: { label: string; value: number }) => (
  <div className={cn('rounded-xl border bg-card px-4 py-2.5 shadow-sm', value > 0 && 'border-amber-300 bg-sand/60')}>
    <p className="text-xs font-medium text-muted-foreground">{label}</p>
    <p className="font-display text-2xl font-semibold tabular-nums">{value}</p>
  </div>
);

/** QC handoff: what quality has to inspect. The decisions stay in QCInspectionDialog. */
export const ReceptionQcQueue = ({ receptions, onOpenStorage }: {
  receptions: ReceptionV2[];
  onOpenStorage: (receptionId: string) => void;
}) => {
  const { t } = useTranslation();
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
        setScanMessage(t('qcQueue.notFound'));
        return;
      }
      setSelectedReception(match.reception);
      setScanMessage(t('qcQueue.loaded', { lot: match.lot_internal || match.lot_supplier || normalizedValue, guidance: t(samplingKey(match.reception.quantity_total)) }));
      setQcDialogOpen(true);
    } catch (error) {
      setScanMessage(error instanceof Error ? error.message : t('qcQueue.scanError'));
    } finally {
      setIsScanLoading(false);
    }
  }, [scanValue, t]);

  const LotCard = ({ reception, action }: { reception: ReceptionV2; action: 'start' | 'resume' }) => (
    <li className="flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <LotReference value={reception.reception_number} className="text-base font-semibold" />
          <p className="truncate text-sm text-muted-foreground">{reception.supplier?.name || reception.supplier_name_snapshot || '—'}</p>
        </div>
        <p className="shrink-0 text-xl font-semibold tabular-nums" dir="ltr">
          <QuantityDisplay value={reception.quantity_total} unit={reception.unit || 'kg'} />
        </p>
      </div>
      <p className="text-xs text-muted-foreground">{t(samplingKey(reception.quantity_total))}</p>
      <Button type="button" size="lg" className={cn('w-full', action === 'resume' && 'bg-sky-700 hover:bg-sky-800')} disabled={!online}
        onClick={(e) => { e.stopPropagation(); handleStartQC(reception); }}>
        <Shield className="h-4 w-4" />
        {action === 'start' ? t('qcQueue.start') : t('qcQueue.resume')}
      </Button>
    </li>
  );

  return (
    <>
      <div className="space-y-5">
        <div className="grid grid-cols-3 gap-2">
          <Stat label={t('qcQueue.stat.toInspect')} value={awaitingQc.length} />
          <Stat label={t('qcQueue.stat.inProgress')} value={inQc.length} />
          <Stat label={t('qcQueue.stat.lab')} value={labPendingInspections.length} />
        </div>

        <section className="space-y-3 rounded-2xl border bg-card p-4 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={scanValue}
              onChange={(e) => setScanValue(e.target.value)}
              placeholder={t('qcQueue.scanPlaceholder')}
              aria-label={t('qcQueue.scanLabel')}
              className="min-h-12 flex-1 text-base"
              dir="ltr"
              onKeyDown={(e) => { if (e.key === 'Enter') void handleScanLot(); }}
            />
            <Button type="button" variant="outline" size="lg" className="shrink-0" onClick={() => setScannerOpen(true)}>
              <Camera className="h-4 w-4" />
              {t('qcQueue.camera')}
            </Button>
            <Button type="button" size="lg" className="shrink-0 font-semibold" onClick={() => void handleScanLot()} disabled={isScanLoading || !scanValue.trim()}>
              <QrCode className="h-4 w-4" />
              {isScanLoading ? t('qcQueue.loading') : t('qcQueue.scan')}
            </Button>
          </div>
          {scanMessage && (
            <div role="status" className={cn('rounded-xl border p-4 text-sm',
              selectedReception ? 'border-emerald-200 bg-accent text-accent-foreground' : 'border-amber-200 bg-sand text-sand-foreground')}>
              {scanMessage}
            </div>
          )}
          <p className="text-xs text-muted-foreground">{t('qcQueue.sampling.rule')}</p>
        </section>

        {awaitingQc.length === 0 && inQc.length === 0 && labPendingInspections.length === 0 && (
          <EmptyState title={t('qcQueue.emptyTitle')} description={t('qcQueue.emptyBody')} icon={<ShieldCheck className="h-6 w-6" />} />
        )}

        {!online && (awaitingQc.length > 0 || inQc.length > 0) && (
          <p role="status" className="rounded-xl border border-amber-300 bg-sand px-4 py-3 text-sm text-sand-foreground">{t('qcQueue.offline')}</p>
        )}

        {awaitingQc.length > 0 && (
          <section className="space-y-2">
            <h3 className="font-display text-lg font-semibold">{t('qcQueue.toInspect', { count: awaitingQc.length })}</h3>
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {awaitingQc.map((r) => <LotCard key={r.id} reception={r} action="start" />)}
            </ul>
          </section>
        )}

        {inQc.length > 0 && (
          <section className="space-y-2">
            <h3 className="font-display text-lg font-semibold">{t('qcQueue.inProgress', { count: inQc.length })}</h3>
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {inQc.map((r) => <LotCard key={r.id} reception={r} action="resume" />)}
            </ul>
          </section>
        )}

        {/* Lab pending results — RG-Q07 */}
        {labPendingInspections.length > 0 && (
          <section className="space-y-2">
            <h3 className="font-display text-lg font-semibold">{t('qcQueue.labPending', { count: labPendingInspections.length })}</h3>
            <ul className="divide-y overflow-hidden rounded-2xl border bg-card shadow-sm">
              {labPendingInspections.slice(0, 5).map((insp) => {
                const rec = receptions.find((r) => r.id === insp.reception_id);
                if (!rec) return null;
                return (
                  <li key={insp.id} className="flex min-h-16 w-full items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <span className="block whitespace-nowrap font-mono font-semibold" dir="ltr">{rec.reception_number}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {rec.supplier?.name || rec.supplier_name_snapshot || '—'} • {(insp.lab_analyses ?? []).join(', ')}
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="shrink-0 border-sky-300 text-sky-800 hover:bg-sky-50"
                      onClick={() => {
                        setSelectedReception(rec);
                        setSelectedInspection(insp as QCInspection);
                        setLabDialogOpen(true);
                      }}
                    >
                      <FlaskConical className="h-4 w-4" />
                      {t('qcQueue.enterResults')}
                    </Button>
                  </li>
                );
              })}
            </ul>
            {labPendingInspections.length > 5 && (
              <p className="text-center text-xs text-muted-foreground">{t('qcQueue.moreLab', { count: labPendingInspections.length - 5 })}</p>
            )}
          </section>
        )}
      </div>

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
