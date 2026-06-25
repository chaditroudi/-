import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuthContext } from '@/contexts/AuthContext';
import { useBlockLot, useReleaseBlockedLot } from '@/hooks/useStock';
import { StockLot } from '@/types/stock';
import { AlertTriangle, ShieldCheck } from 'lucide-react';

interface StockLotBlockDialogProps {
  lot: StockLot | null;
  mode: 'block' | 'release';
  onClose: () => void;
}

const resolveActorName = (fullName?: string | null, email?: string | null) =>
  fullName?.trim() || email?.split('@')[0] || '';

export function StockLotBlockDialog({ lot, mode, onClose }: StockLotBlockDialogProps) {
  const { profile, user } = useAuthContext();
  const blockLot = useBlockLot();
  const releaseLot = useReleaseBlockedLot();
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
  }, [lot, profile?.full_name, user?.email, mode]);

  const handleClose = () => {
    setReason('');
    onClose();
  };

  const handleConfirm = async () => {
    if (!lot || !actorName.trim()) return;

    if (mode === 'block') {
      if (!reason.trim()) return;
      await blockLot.mutateAsync({
        lotId: lot.id,
        lotNumber: lot.lot_number,
        blockedBy: actorName.trim(),
        reason: reason.trim(),
        currentNotes: lot.quality_notes,
      });
    } else {
      await releaseLot.mutateAsync({
        lotId: lot.id,
        lotNumber: lot.lot_number,
        releasedBy: actorName.trim(),
        releaseComment: reason.trim() || undefined,
        currentNotes: lot.quality_notes,
      });
    }

    handleClose();
  };

  const isPending = mode === 'block' ? blockLot.isPending : releaseLot.isPending;
  const title = mode === 'block' ? 'Bloquer le lot' : 'Débloquer le lot';

  return (
    <Dialog open={!!lot} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {mode === 'block' ? (
              <AlertTriangle className="h-5 w-5 text-red-600" />
            ) : (
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
            )}
            {title} — {lot?.lot_number}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {lot && (
            <div className="rounded-lg border border-muted bg-muted/40 px-3 py-2 text-xs text-muted-foreground space-y-0.5">
              <p>
                Quantité : <strong className="text-foreground">{lot.current_quantity.toLocaleString('fr-FR')} {lot.unit}</strong>
              </p>
              <p>Produit : {(lot.product as { name?: string } | undefined)?.name || '-'}</p>
              {lot.variety && <p>Variété : {lot.variety}</p>}
              {mode === 'release' && (lot.block_reason || lot.quality_notes) && (
                <p>
                  Motif actuel : <strong className="text-foreground">{lot.block_reason || lot.quality_notes}</strong>
                </p>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="lot-actor">
              Responsable <span className="text-red-500">*</span>
            </Label>
            <Input
              id="lot-actor"
              value={actorName}
              onChange={(event) => setActorName(event.target.value)}
              placeholder="Nom du responsable"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="lot-reason">
              {mode === 'block' ? 'Motif du blocage' : 'Commentaire de déblocage'}
              {mode === 'block' ? <span className="text-red-500"> *</span> : null}
            </Label>
            <Textarea
              id="lot-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={4}
              placeholder={
                mode === 'block'
                  ? 'Décrivez pourquoi ce lot doit être bloqué...'
                  : 'Expliquez pourquoi le lot peut être remis en circulation...'
              }
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isPending}>
            Annuler
          </Button>
          <Button
            className={mode === 'block' ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'}
            onClick={handleConfirm}
            disabled={!actorName.trim() || (mode === 'block' && !reason.trim()) || isPending}
          >
            {isPending
              ? mode === 'block' ? 'Blocage…' : 'Déblocage…'
              : mode === 'block' ? 'Bloquer le lot' : 'Débloquer le lot'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
