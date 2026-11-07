import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pencil } from 'lucide-react';
import { failureMessage } from '@/lib/apiErrors';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { MIN_MANUAL_REASON_LENGTH } from '@/lib/receptionIntake';
import { useCorrectReceptionMutation } from '@/store/api/receptionsApi';
import { cn } from '@/lib/utils';
import type { ReceptionV2 } from '@/types/reception';

const FIELDS = [
  { key: 'delivery_note_number' },
  { key: 'vehicle_number' },
  { key: 'driver_name' },
  { key: 'remarks' },
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
  const { t } = useTranslation();
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
  const reasonLength = reason.trim().length;

  const submit = async () => {
    try {
      await correct({ id: reception.id, reason: reason.trim(), fields: changed }).unwrap();
      toast.success(t('receptionCorrection.saved'));
      onOpenChange(false);
    } catch (error) {
      toast.error(failureMessage(error, t('receptionCorrection.refused')));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader className="text-start">
          <span className="mb-1 flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-accent-foreground">
            <Pencil className="h-5 w-5" aria-hidden />
          </span>
          <DialogTitle className="font-display text-xl">{t('receptionCorrection.title', { number: reception.reception_number })}</DialogTitle>
          <DialogDescription>{t('receptionCorrection.description')}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          {FIELDS.map(({ key }) => (
            <div key={key} className="space-y-1.5">
              <Label htmlFor={`correction-${key}`} className="text-sm font-medium">{t(`receptionCorrection.fields.${key}`)}</Label>
              <Input
                id={`correction-${key}`}
                className={cn('h-12 text-base', fields[key] !== original[key] && 'border-primary')}
                value={fields[key]}
                onChange={(event) => setFields((current) => ({ ...current, [key]: event.target.value }))}
              />
            </div>
          ))}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="correction-reason" className="text-sm font-medium">{t('receptionCorrection.reason')}</Label>
          <Textarea id="correction-reason" rows={2} className="text-base" value={reason} onChange={(event) => setReason(event.target.value)} />
          <p className={cn('text-sm', reasonLength >= MIN_MANUAL_REASON_LENGTH ? 'text-muted-foreground' : 'text-warning')}>
            {t('receptionCorrection.minLength', { n: MIN_MANUAL_REASON_LENGTH, typed: reasonLength })}
          </p>
        </div>
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" className="min-h-12" onClick={() => onOpenChange(false)}>{t('receptionCorrection.cancel')}</Button>
          <Button type="button" className="min-h-12 font-semibold" disabled={!valid || isLoading} onClick={() => void submit()}>{t('receptionCorrection.save')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
