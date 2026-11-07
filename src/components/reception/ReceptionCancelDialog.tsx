import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Ban } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useCancelReception } from '@/hooks/useReceptionsV2';
import type { ReceptionV2 } from '@/types/reception';

interface ReceptionCancelDialogProps {
  reception: ReceptionV2;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Cancels a delivery before any QC decision; the server reverses stock and the purchase order. */
export function ReceptionCancelDialog({ reception, open, onOpenChange }: ReceptionCancelDialogProps) {
  const { t } = useTranslation();
  const cancelReception = useCancelReception();
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (open) setReason('');
  }, [open]);

  const handleConfirm = async () => {
    if (!reason.trim()) return;
    try {
      await cancelReception.mutateAsync({ id: reception.id, reason: reason.trim() });
      onOpenChange(false);
    } catch {
      // The hook shows the server message; keep the typed reason.
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!cancelReception.isPending) onOpenChange(next); }}>
      <DialogContent className="max-w-md">
        <DialogHeader className="text-start">
          <span className="mb-1 flex h-11 w-11 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
            <Ban className="h-5 w-5" aria-hidden />
          </span>
          <DialogTitle className="font-display text-xl">
            {t('receptionCancel.title', { number: reception.reception_number })}
          </DialogTitle>
          <DialogDescription>
            {reception.purchase_order_id ? t('receptionCancel.descriptionWithOrder') : t('receptionCancel.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5 py-2">
          <Label htmlFor="reception-cancel-reason" className="text-sm font-medium">
            {t('receptionCancel.reason')} <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id="reception-cancel-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={3}
            autoFocus
            className="text-base"
            placeholder={t('receptionCancel.placeholder')}
          />
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" className="min-h-12" onClick={() => onOpenChange(false)} disabled={cancelReception.isPending}>
            {t('receptionCancel.back')}
          </Button>
          <Button
            variant="destructive"
            className="min-h-12 font-semibold"
            onClick={handleConfirm}
            disabled={!reason.trim() || cancelReception.isPending}
          >
            {cancelReception.isPending ? t('receptionCancel.pending') : t('receptionCancel.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
