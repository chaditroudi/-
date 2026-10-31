import { useState } from 'react';
import { AlertTriangle, Scale } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useRecordWeighing, useWeighings, type WeighingType } from '@/hooks/useWeighing';
import { describeWeighingSource, MIN_MANUAL_REASON_LENGTH } from '@/lib/receptionIntake';
import type { ReceptionLot } from '@/types/reception';

interface WeighingRecordDialogProps {
  lot: ReceptionLot;
  /** Supervisors only, as on the server: a correction after confirmation needs a reason and stays in history. */
  canCorrect: boolean;
  onClose: () => void;
}

/** The weighing evidence of a lot, oldest first. Nothing here overwrites an earlier record. */
export const WeighingRecordDialog = ({ lot, canCorrect, onClose }: WeighingRecordDialogProps) => {
  const { weighings, isLoading, refetch } = useWeighings(lot.id);
  const { mutate: record, isPending: saving } = useRecordWeighing();
  const [type, setType] = useState<WeighingType>('GROSS');
  const [weight, setWeight] = useState('');
  const [reason, setReason] = useState('');

  const weightKg = Number(weight.replace(',', '.'));
  const valid = weight.trim() !== '' && Number.isFinite(weightKg) && weightKg >= 0
    && reason.trim().length >= MIN_MANUAL_REASON_LENGTH;

  const submit = async () => {
    try {
      await record(lot.id, { type, weight_kg: weightKg, source: 'MANUAL', manual_reason: reason.trim() });
      setWeight('');
      setReason('');
      await refetch();
    } catch {
      // The hook already showed the server's reason; what was typed stays for correction.
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Scale className="h-5 w-5" />Pesée du lot {lot.lot_internal}</DialogTitle>
          <DialogDescription>Quantité en stock : {lot.quantity} {lot.unit}</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {isLoading ? (
            <p className="py-4 text-center text-sm text-muted-foreground">Chargement…</p>
          ) : weighings.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Aucune pesée détaillée pour ce lot : réception enregistrée avant la conservation des preuves de pesée.
            </p>
          ) : weighings.map((weighing) => (
            <div key={weighing.id} className="flex items-start justify-between gap-3 rounded-xl border p-3 text-sm">
              <div className="min-w-0">
                <p className="font-medium">{weighing.type === 'GROSS' ? 'Brut' : 'Tare'} · {weighing.weight_kg} kg</p>
                <p className="text-xs text-muted-foreground">{describeWeighingSource(weighing.source, weighing.signature_verified)}</p>
                {weighing.device_ref && <p className="text-xs text-muted-foreground">Bascule {weighing.device_ref}</p>}
                {weighing.manual_reason && <p className="text-xs text-muted-foreground">Motif : {weighing.manual_reason}</p>}
              </div>
              <time className="whitespace-nowrap text-xs text-muted-foreground">
                {new Date(weighing.created_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
              </time>
            </div>
          ))}
        </div>

        {canCorrect && (
          <div className="space-y-3 border-t pt-3">
            <p className="text-sm font-semibold">Corriger une pesée</p>
            <p className="flex items-start gap-2 text-xs text-muted-foreground">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              La correction s'ajoute à l'historique et ne change pas le stock. Si le net diffère, une alerte est créée pour décision.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={type} onValueChange={(value) => setType(value as WeighingType)}>
                  <SelectTrigger aria-label="Type de pesée"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GROSS">Brut</SelectItem>
                    <SelectItem value="TARE">Tare</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="weighing-correction-kg">Poids (kg)</Label>
                <Input id="weighing-correction-kg" inputMode="decimal" value={weight} onChange={(event) => setWeight(event.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="weighing-correction-reason">Motif de la correction</Label>
              <Textarea id="weighing-correction-reason" rows={2} value={reason} onChange={(event) => setReason(event.target.value)} />
            </div>
            <Button type="button" disabled={!valid || saving} onClick={() => void submit()}>Enregistrer la correction</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
