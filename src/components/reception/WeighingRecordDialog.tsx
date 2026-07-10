/**
 * WeighingRecordDialog — RT-02 / T-504
 * Enregistre le poids brut (GROSS) ou la tare (TARE) d'un lot de réception.
 * - Lecture automatique simulée via ScaleTelemetry (source = SCALE)
 * - Saisie manuelle avec superviseur obligatoire (source = MANUAL)
 * - Calcul du net affiché dès que brut + tare sont connus
 * - Appelle POST /api/reception-lots/:lotId/weighing
 */

import { useState } from 'react';
import { Scale, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScaleTelemetry } from './ScaleTelemetry';
import { useWeighings, useRecordWeighing } from '@/hooks/useWeighing';
import type { WeighingType, WeighingRecord } from '@/hooks/useWeighing';
import type { ReceptionLot } from '@/types/reception';

interface WeighingRecordDialogProps {
  lot: ReceptionLot;
  onClose: () => void;
  onWeighingRecorded?: (lot: any) => void;
}

// ── helpers ───────────────────────────────────────────────────────────────────

const fmt = (kg: number | null | undefined) =>
  kg != null ? `${kg.toFixed(3)} kg` : '—';

function WeighingSummary({ weighings }: { weighings: WeighingRecord[] }) {
  const gross = weighings.find((w) => w.type === 'GROSS');
  const tare  = weighings.find((w) => w.type === 'TARE');
  const net   = gross && tare ? Number(gross.weight_kg) - Number(tare.weight_kg) : null;

  return (
    <div className="grid grid-cols-3 gap-2 text-center text-sm">
      <div className={`rounded-lg p-3 ${gross ? 'bg-emerald-50 border border-emerald-200' : 'bg-muted/40 border border-dashed'}`}>
        <p className="text-xs text-muted-foreground uppercase tracking-wide">Brut</p>
        <p className="font-bold text-base mt-1 text-emerald-700">{fmt(gross?.weight_kg)}</p>
        {gross && <p className="text-[11px] text-muted-foreground mt-0.5">{gross.source}</p>}
      </div>
      <div className={`rounded-lg p-3 ${tare ? 'bg-blue-50 border border-blue-200' : 'bg-muted/40 border border-dashed'}`}>
        <p className="text-xs text-muted-foreground uppercase tracking-wide">Tare</p>
        <p className="font-bold text-base mt-1 text-blue-700">{fmt(tare?.weight_kg)}</p>
        {tare && <p className="text-[11px] text-muted-foreground mt-0.5">{tare.source}</p>}
      </div>
      <div className={`rounded-lg p-3 ${
        net != null && net > 0 ? 'bg-purple-50 border border-purple-200' :
        net != null && net <= 0 ? 'bg-red-50 border border-red-300' :
        'bg-muted/40 border border-dashed'
      }`}>
        <p className="text-xs text-muted-foreground uppercase tracking-wide">Net</p>
        <p className={`font-bold text-base mt-1 ${
          net != null && net > 0 ? 'text-purple-700' :
          net != null ? 'text-red-600' : 'text-muted-foreground'
        }`}>{fmt(net)}</p>
        {net != null && net <= 0 && (
          <p className="text-[11px] text-red-600 mt-0.5 font-semibold">Invalide ≤ 0</p>
        )}
      </div>
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────

export function WeighingRecordDialog({
  lot,
  onClose,
  onWeighingRecorded,
}: WeighingRecordDialogProps) {
  const [tab, setTab] = useState<WeighingType>('GROSS');
  const [grossValidated, setGrossValidated] = useState(false);
  const [tareValidated, setTareValidated]   = useState(false);
  const [grossMeta, setGrossMeta]           = useState<any>(null);
  const [tareMeta, setTareMeta]             = useState<any>(null);
  const [isSaving, setIsSaving]             = useState(false);

  const { weighings, isLoading, refetch } = useWeighings(lot.id);
  const { mutate: recordWeighing }         = useRecordWeighing();

  const existingGross = weighings.find((w) => w.type === 'GROSS');
  const existingTare  = weighings.find((w) => w.type === 'TARE');
  const bothDone = !!(existingGross && existingTare);

  const handleSave = async (type: WeighingType, meta: {
    weight: number;
    supervisor: string;
    source: 'SCALE' | 'MANUAL';
    manualReason?: string | null;
    witness1?: string | null;
    witness2?: string | null;
  }) => {
    setIsSaving(true);
    try {
      const result = await recordWeighing(lot.id, {
        type,
        weight_kg: meta.weight,
        source: meta.source,
        supervisor: meta.supervisor || null,
        notes: meta.manualReason
          ? `Saisie manuelle — motif : ${meta.manualReason}${meta.witness1 ? ` | Témoin 1 : ${meta.witness1}` : ''}${meta.witness2 ? ` | Témoin 2 : ${meta.witness2}` : ''}`
          : null,
      });
      await refetch();
      if (result?.lot) onWeighingRecorded?.(result.lot);
      if (type === 'GROSS') { setGrossValidated(true); setGrossMeta(meta); }
      else                  { setTareValidated(true);  setTareMeta(meta); }
    } finally {
      setIsSaving(false);
    }
  };

  const targetWeight = tab === 'GROSS'
    ? Number((lot as any).gross_weight_kg ?? (lot as any).declared_weight_kg ?? 0)
    : Number((lot as any).tare_weight_kg ?? 0);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-emerald-600" />
            Pesée — {(lot as any).lot_internal ?? lot.id.slice(0, 8)}
          </DialogTitle>
          <DialogDescription>
            Enregistrez le poids brut puis la tare. Le poids net sera calculé automatiquement.
          </DialogDescription>
        </DialogHeader>

        {/* Current state summary */}
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Chargement des pesées…</p>
        ) : (
          <WeighingSummary weighings={weighings} />
        )}

        {bothDone ? (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            <span>
              Les deux pesées sont enregistrées. Net calculé :{' '}
              <strong>
                {fmt(Number(existingGross!.weight_kg) - Number(existingTare!.weight_kg))}
              </strong>
            </span>
          </div>
        ) : (
          <Tabs value={tab} onValueChange={(v) => setTab(v as WeighingType)}>
            <TabsList className="w-full">
              <TabsTrigger value="GROSS" className="flex-1 gap-2">
                Poids brut
                {existingGross && (
                  <Badge className="bg-emerald-600 text-white text-[11px] px-1.5 py-0">✓</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="TARE" className="flex-1 gap-2">
                Tare
                {existingTare && (
                  <Badge className="bg-blue-600 text-white text-[11px] px-1.5 py-0">✓</Badge>
                )}
              </TabsTrigger>
            </TabsList>

            {(['GROSS', 'TARE'] as WeighingType[]).map((t) => {
              const alreadyDone = t === 'GROSS' ? !!existingGross : !!existingTare;
              const validated   = t === 'GROSS' ? grossValidated  : tareValidated;
              const meta        = t === 'GROSS' ? grossMeta        : tareMeta;

              return (
                <TabsContent key={t} value={t} className="mt-3">
                  {alreadyDone && !validated ? (
                    <div className="flex flex-col gap-3 items-center py-4">
                      <CheckCircle2 className="h-10 w-10 text-emerald-500" />
                      <p className="text-sm text-emerald-700 font-medium">
                        {t === 'GROSS' ? 'Poids brut' : 'Tare'} déjà enregistré(e)
                      </p>
                      <Button size="sm" variant="outline" onClick={async () => { await refetch(); }}>
                        <RefreshCw className="h-4 w-4 mr-1.5" /> Actualiser
                      </Button>
                    </div>
                  ) : (
                    <ScaleTelemetry
                      targetWeight={targetWeight}
                      isValidated={validated}
                      validationMeta={meta}
                      onWeightValidated={(payload) => handleSave(t, payload)}
                      onWeightReset={() => {
                        if (t === 'GROSS') { setGrossValidated(false); setGrossMeta(null); }
                        else               { setTareValidated(false);  setTareMeta(null); }
                      }}
                    />
                  )}

                  {isSaving && (
                    <p className="text-xs text-muted-foreground mt-2 text-center animate-pulse">
                      Enregistrement en cours…
                    </p>
                  )}
                </TabsContent>
              );
            })}
          </Tabs>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {bothDone ? 'Fermer' : 'Annuler'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
