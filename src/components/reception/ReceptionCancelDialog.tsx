import { useEffect, useState } from 'react';
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
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ban className="h-5 w-5 text-red-600" />
            Annuler la réception {reception.reception_number}
          </DialogTitle>
          <DialogDescription>
            Les lots sont retirés du stock (mouvement d'ajustement tracé)
            {reception.purchase_order_id ? ' et la quantité est rendue au bon de commande' : ''}.
            L'historique est conservé.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5 py-2">
          <Label htmlFor="reception-cancel-reason">
            Motif d'annulation <span className="text-red-500">*</span>
          </Label>
          <Textarea
            id="reception-cancel-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={3}
            autoFocus
            placeholder="Ex. : mauvais fournisseur sélectionné, livraison refusée au portail..."
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={cancelReception.isPending}>
            Retour
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!reason.trim() || cancelReception.isPending}
          >
            {cancelReception.isPending ? 'Annulation…' : 'Confirmer l\'annulation'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
