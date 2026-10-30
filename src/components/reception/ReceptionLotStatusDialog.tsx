import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { NumericSignaturePad } from '@/components/shared/NumericSignatureDialog';
import { useAuthContext } from '@/contexts/AuthContext';
import { useQuarantineReceptionLot, useReleaseReceptionLot } from '@/hooks/useReceptionsV2';
import { ReceptionLot, stockStatusLabels } from '@/types/reception';
import { AlertTriangle, ShieldCheck } from 'lucide-react';

interface ReceptionLotStatusDialogProps {
  lot: ReceptionLot | null;
  receptionId: string;
  mode: 'quarantine' | 'release';
  onClose: () => void;
}

/**
 * Post-QC lot status change. A release is signed with the personal PIN, like
 * the QC release, inside this same dialog; the action is recorded under the signed-in user.
 */
export function ReceptionLotStatusDialog({
  lot,
  receptionId,
  mode,
  onClose,
}: ReceptionLotStatusDialogProps) {
  const { profile, user } = useAuthContext();
  const quarantineLot = useQuarantineReceptionLot();
  const releaseLot = useReleaseReceptionLot();
  const [reason, setReason] = useState('');

  useEffect(() => {
    setReason('');
  }, [lot, mode]);

  const actorLabel = profile?.full_name?.trim() || user?.email || '—';
  const isPending = mode === 'quarantine' ? quarantineLot.isPending : releaseLot.isPending;
  const isRelease = mode === 'release';

  const handleClose = () => {
    setReason('');
    onClose();
  };

  const run = async (pin?: string) => {
    if (!lot) return;
    const payload = { receptionId, lotId: lot.id, reason: reason.trim() || null, pin: pin ?? null };
    try {
      if (isRelease) await releaseLot.mutateAsync(payload);
      else await quarantineLot.mutateAsync(payload);
      handleClose();
    } catch {
      // The hook already shows the server message; keep the dialog open with the input.
    }
  };

  return (
    <Dialog open={!!lot} onOpenChange={(open) => { if (!open && !isPending) handleClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isRelease ? (
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            )}
            {isRelease ? 'Libérer le lot' : 'Mettre en quarantaine'} — {lot?.lot_internal || lot?.lot_supplier}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {lot && (
            <div className="rounded-lg border border-muted bg-muted/40 px-3 py-2 text-xs text-muted-foreground space-y-0.5">
              <p>
                Quantité : <strong className="text-foreground">{lot.quantity.toLocaleString('fr-FR')} {lot.unit}</strong>
              </p>
              <p>Lot fournisseur : {lot.lot_supplier || '-'}</p>
              <p>Statut actuel : {stockStatusLabels[lot.stock_status] ?? lot.stock_status}</p>
              {lot.quarantine_reason && <p>Motif actuel : {lot.quarantine_reason}</p>}
              <p>Responsable : <strong className="text-foreground">{actorLabel}</strong></p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="reception-lot-reason">
              {isRelease ? 'Justification de la libération' : 'Motif de quarantaine'}
              {!isRelease && <span className="text-red-500"> *</span>}
            </Label>
            <Textarea
              id="reception-lot-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
              autoFocus
              placeholder={
                isRelease
                  ? 'Ex. : résultats laboratoire conformes, ré-inspection favorable...'
                  : 'Décrivez la non-conformité ou le risque détecté...'
              }
            />
          </div>

          {isRelease && (
            <NumericSignaturePad
              title="Code signature"
              subtitle="La libération rend le lot disponible en stock : signez avec votre code personnel."
              confirmLabel={isPending ? 'Libération…' : 'Signer et libérer'}
              pending={isPending}
              onCancel={handleClose}
              onConfirm={async (pin) => { await run(pin); }}
            />
          )}
        </div>

        {!isRelease && (
          <DialogFooter>
            <Button variant="outline" onClick={handleClose} disabled={isPending}>
              Annuler
            </Button>
            <Button
              className="bg-amber-600 hover:bg-amber-700"
              onClick={() => void run()}
              disabled={!reason.trim() || isPending}
            >
              {isPending ? 'Mise en quarantaine…' : 'Confirmer la quarantaine'}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
