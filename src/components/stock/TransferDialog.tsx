import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useModule3StorageLocations, useMoveStorageStock } from '@/hooks/useStorageModule3';
import { StockLot } from '@/types/stock';
import { storageMovementReasonLabels, type StorageMovementReason } from '@/types/storage';
import { ArrowRight } from 'lucide-react';

interface TransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lot: StockLot;
}

export const TransferDialog = ({ open, onOpenChange, lot }: TransferDialogProps) => {
  const { data: locations = [] } = useModule3StorageLocations();
  const moveStorageStock = useMoveStorageStock();

  const [formData, setFormData] = useState({
    destination_location_id: '',
    quantity_kg: lot.current_quantity,
    quantity_palettes: 1,
    reason: 'RECEPTION' as StorageMovementReason,
    notes: ''
  });

  const currentLocation = (lot as any).storage_location || (lot.location as any);
  const sourceStorageLocationId = lot.storage_location_id || undefined;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    await moveStorageStock.mutateAsync({
      movementType: sourceStorageLocationId ? 'TRANSFERT' : 'ENTREE_ZONE',
      lotId: lot.id,
      lotCode: lot.lot_number,
      sourceLocationId: sourceStorageLocationId,
      destinationLocationId: formData.destination_location_id,
      quantityPalettes: formData.quantity_palettes,
      quantityKg: formData.quantity_kg,
      reason: formData.reason,
      notes: formData.notes || undefined
    });
    
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Transfert de Lot</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Info lot */}
          <div className="bg-muted p-4 rounded-lg">
            <p className="font-mono font-bold">{lot.lot_number}</p>
            <p className="text-sm text-muted-foreground">
              {(lot.product as any)?.name} • {lot.current_quantity} {lot.unit}
            </p>
          </div>

          {/* Transfert */}
          <div className="flex items-center gap-4">
            <div className="flex-1 p-3 bg-muted rounded-lg text-center">
              <p className="text-sm text-muted-foreground">Source</p>
              <p className="font-medium">
                {currentLocation?.code || 'Non assigné'}
              </p>
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground" />
            <div className="flex-1">
              <Label>Destination *</Label>
              <Select 
                value={formData.destination_location_id} 
                onValueChange={(v) => setFormData(prev => ({ ...prev, destination_location_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner" />
                </SelectTrigger>
                <SelectContent>
                  {locations
                    .filter(loc => loc.id !== lot.storage_location_id && loc.location_status !== 'blocked')
                    .map(loc => (
                      <SelectItem key={loc.id} value={loc.id}>
                        {loc.code} - {loc.name} ({loc.occupied_palettes}/{loc.capacity_palettes})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Quantité kg</Label>
              <Input
                type="number"
                value={formData.quantity_kg}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  quantity_kg: Math.min(Number(e.target.value), lot.current_quantity) 
                }))}
                max={lot.current_quantity}
              />
              <p className="text-xs text-muted-foreground">
                Max: {lot.current_quantity} {lot.unit}
              </p>
            </div>
            <div className="space-y-2">
              <Label>Palettes</Label>
              <Input
                type="number"
                min="1"
                step="1"
                value={formData.quantity_palettes}
                onChange={(e) => setFormData(prev => ({ ...prev, quantity_palettes: Math.max(1, Number(e.target.value) || 1) }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Motif</Label>
            <Select
              value={formData.reason}
              onValueChange={(value: StorageMovementReason) => setFormData(prev => ({ ...prev, reason: value }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(storageMovementReasonLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Motif du transfert..."
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button 
              type="submit" 
              disabled={moveStorageStock.isPending || !formData.destination_location_id || formData.quantity_palettes <= 0}
            >
              {moveStorageStock.isPending ? 'Transfert...' : 'Confirmer le transfert'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
