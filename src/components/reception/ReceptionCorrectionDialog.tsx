import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { MIN_MANUAL_REASON_LENGTH } from '@/lib/receptionIntake';
import { useCorrectReceptionMutation } from '@/store/api/receptionsApi';
import type { ReceptionV2 } from '@/types/reception';

const FIELDS = [
  { key: 'delivery_note_number', label: 'N° bon de livraison' },
  { key: 'vehicle_number', label: 'Immatriculation' },
  { key: 'driver_name', label: 'Chauffeur' },
  { key: 'remarks', label: 'Remarques' },
] as const;

type FieldKey = typeof FIELDS[number]['key'];

const readFields = (reception: ReceptionV2) =>
  Object.fromEntries(FIELDS.map(({ key }) => [key, String(reception[key] ?? '')])) as Record<FieldKey, string>;

/**
 * Supervisor correction of delivery facts. Quantities, weights, supplier and QC
 * are not here on purpose: they go through their own audited procedures.
 */
export const ReceptionCorrectionDialog = ({ reception, open, onOpenChange }: {
  reception: ReceptionV2;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  const [correct, { isLoading }] = useCorrectReceptionMutation();
  const [fields, setFields] = useState(() => readFields(reception));
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (!open) return;
    setFields(readFields(reception));
    setReason('');
  }, [open, reception]);

  const original = readFields(reception);
  const changed = Object.fromEntries(FIELDS.map(({ key }) => [key, fields[key]]).filter(([key, value]) => value !== original[key as FieldKey]));
  const valid = Object.keys(changed).length > 0 && reason.trim().length >= MIN_MANUAL_REASON_LENGTH;

  const submit = async () => {
    try {
      await correct({ id: reception.id, reason: reason.trim(), fields: changed }).unwrap();
      toast.success('Correction enregistrée dans l\'historique');
      onOpenChange(false);
    } catch (error) {
      toast.error(typeof error === 'string' ? error : 'Correction refusée');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Corriger la réception {reception.reception_number}</DialogTitle>
          <DialogDescription>
            L'ancienne valeur, la nouvelle et votre motif restent dans le journal. Pesées, quantités et qualité ne se modifient pas ici.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          {FIELDS.map(({ key, label }) => (
            <div key={key} className="space-y-1.5">
              <Label htmlFor={`correction-${key}`}>{label}</Label>
              <Input
                id={`correction-${key}`}
                value={fields[key]}
                onChange={(event) => setFields((current) => ({ ...current, [key]: event.target.value }))}
              />
            </div>
          ))}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="correction-reason">Motif de la correction</Label>
          <Textarea id="correction-reason" rows={2} value={reason} onChange={(event) => setReason(event.target.value)} />
          <p className="text-xs text-muted-foreground">{MIN_MANUAL_REASON_LENGTH} caractères minimum.</p>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button type="button" disabled={!valid || isLoading} onClick={() => void submit()}>Enregistrer la correction</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
