import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuthContext } from '@/contexts/AuthContext';
import { useQuarantineReceptionLot, useReleaseReceptionLot } from '@/hooks/useReceptionsV2';
import { ReceptionLot } from '@/types/reception';
import { AlertTriangle, ShieldCheck } from 'lucide-react';

interface ReceptionLotStatusDialogProps {
  lot: ReceptionLot | null;
  receptionId: string;
  mode: 'quarantine' | 'release';
  onClose: () => void;
}

const resolveActorName = (fullName?: string | null, email?: string | null) =>
  fullName?.trim() || email?.split('@')[0] || '';

export function ReceptionLotStatusDialog({
  lot,
  receptionId,
  mode,
  onClose,
}: ReceptionLotStatusDialogProps) {
  const { profile, user } = useAuthContext();
  const quarantineLot = useQuarantineReceptionLot();
  const releaseLot = useReleaseReceptionLot();
  const [actorName, setActorName] = useState('');
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (!lot) {
      setActorName('');
      setReason('');
      return;
    }

    setActorName(resolveActorName(profile?.full_name, user?.email));
    setReason('');
  }, [lot, mode, profile?.full_name, user?.email]);

  const handleClose = () => {
    setReason('');
    onClose();
  };

  const handleConfirm = async () => {
    if (!lot || !actorName.trim()) return;

    if (mode === 'quarantine') {
      if (!reason.trim()) return;
      await quarantineLot.mutateAsync({
        receptionId,
        lotId: lot.id,
        actorName: actorName.trim(),
        reason: reason.trim(),
      });
    } else {
      await releaseLot.mutateAsync({
        receptionId,
        lotId: lot.id,
        actorName: actorName.trim(),
      });
    }

    handleClose();
  };

  const isPending = mode === 'quarantine' ? quarantineLot.isPending : releaseLot.isPending;

  return (
    <Dialog open={!!lot} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {mode === 'quarantine' ? (
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            ) : (
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
            )}
            {mode === 'quarantine' ? 'Mettre en quarantaine' : 'Libérer le lot'} — {lot?.lot_internal || lot?.lot_supplier}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {lot && (
            <div className="rounded-lg border border-muted bg-muted/40 px-3 py-2 text-xs text-muted-foreground space-y-0.5">
              <p>
                Quantité : <strong className="text-foreground">{lot.quantity.toLocaleString('fr-FR')} {lot.unit}</strong>
              </p>
              <p>Lot fournisseur : {lot.lot_supplier || '-'}</p>
              <p>Statut actuel : {lot.stock_status}</p>
              {lot.quarantine_reason && <p>Motif actuel : {lot.quarantine_reason}</p>}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="reception-lot-actor">
              Responsable <span className="text-red-500">*</span>
            </Label>
            <Input
              id="reception-lot-actor"
              value={actorName}
              onChange={(event) => setActorName(event.target.value)}
              placeholder="Nom du responsable"
              autoFocus
            />
          </div>

          {mode === 'quarantine' && (
            <div className="space-y-1.5">
              <Label htmlFor="reception-lot-reason">
                Motif de quarantaine <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="reception-lot-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                rows={4}
                placeholder="Décrivez la non-conformité ou le risque détecté..."
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isPending}>
            Annuler
          </Button>
          <Button
            className={mode === 'quarantine' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-600 hover:bg-emerald-700'}
            onClick={handleConfirm}
            disabled={!actorName.trim() || (mode === 'quarantine' && !reason.trim()) || isPending}
          >
            {isPending
              ? mode === 'quarantine' ? 'Mise en quarantaine…' : 'Libération…'
              : mode === 'quarantine' ? 'Confirmer la quarantaine' : 'Libérer le lot'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
