import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle } from 'lucide-react';
import { StockLot } from '@/types/stock';
import { useValidateLot } from '@/hooks/useStock';

interface Props {
  lot: StockLot | null;
  onClose: () => void;
}

export function StockLotQCDialog({ lot, onClose }: Props) {
  const [validatorName, setValidatorName] = useState('');
  const [notes, setNotes] = useState('');
  const validateLot = useValidateLot();

  const handleConfirm = async () => {
    if (!lot || !validatorName.trim()) return;
    await validateLot.mutateAsync({
      lotId: lot.id,
      validatedBy: validatorName.trim(),
      notes: notes.trim() || undefined,
    });
    setValidatorName('');
    setNotes('');
    onClose();
  };

  const handleClose = () => {
    setValidatorName('');
    setNotes('');
    onClose();
  };

  return (
    <Dialog open={!!lot} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            Validation QC — {lot?.lot_number}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="qc-validator">
              Validateur <span className="text-red-500">*</span>
            </Label>
            <Input
              id="qc-validator"
              placeholder="Nom du responsable qualité"
              value={validatorName}
              onChange={(e) => setValidatorName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && validatorName.trim()) handleConfirm(); }}
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="qc-notes">Notes QC</Label>
            <Textarea
              id="qc-notes"
              placeholder="Résultats d'analyse, observations, dérogations…"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {lot && (
            <div className="rounded-lg border border-muted bg-muted/40 px-3 py-2 text-xs text-muted-foreground space-y-0.5">
              <p>
                Quantité : <strong className="text-foreground">{lot.current_quantity.toLocaleString('fr-FR')} {lot.unit}</strong>
              </p>
              {lot.variety && <p>Variété : {lot.variety}</p>}
              {(lot as any).origin_country && <p>Origine : {(lot as any).origin_country}</p>}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={validateLot.isPending}>
            Annuler
          </Button>
          <Button
            className="bg-green-600 hover:bg-green-700"
            onClick={handleConfirm}
            disabled={!validatorName.trim() || validateLot.isPending}
          >
            <CheckCircle className="h-4 w-4 mr-1.5" />
            {validateLot.isPending ? 'Validation…' : 'Valider le lot'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
