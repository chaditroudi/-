import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useUpdateBatchStatus, useStorageZones } from '@/hooks/useBatches';
import { 
  Batch, 
  StorageZone,
  zoneTypeLabels,
  batchStatusLabels,
  batchStatusColors
} from '@/types/batch';
import { Warehouse, Thermometer, Droplets, MapPin } from 'lucide-react';

interface StorageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  batch: Batch;
}

export const StorageDialog = ({ open, onOpenChange, batch }: StorageDialogProps) => {
  const [selectedZoneId, setSelectedZoneId] = useState(batch.storage_zone_id || '');
  const [storagePosition, setStoragePosition] = useState(batch.storage_position || '');
  const [performedBy, setPerformedBy] = useState('');

  const { data: zones = [] } = useStorageZones();
  const updateStatus = useUpdateBatchStatus();

  const recommendedZoneType = batch.quality_grade === 'premium' ? 'cold_room' : 'ventilated';
  const availableZones = zones.filter(z => 
    z.zone_type !== 'quarantine' && 
    z.zone_type !== 'processing' &&
    z.current_load_kg + batch.current_weight_kg <= z.capacity_kg
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    updateStatus.mutate({
      id: batch.id,
      status: 'stored',
      storage_zone_id: selectedZoneId,
      performed_by: performedBy || undefined
    }, {
      onSuccess: () => {
        onOpenChange(false);
      }
    });
  };

  const selectedZone = zones.find(z => z.id === selectedZoneId);
  const loadPercentage = selectedZone 
    ? ((selectedZone.current_load_kg + batch.current_weight_kg) / selectedZone.capacity_kg) * 100 
    : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Warehouse className="h-5 w-5" />
            Stockage - {batch.batch_number}
          </DialogTitle>
        </DialogHeader>
        
        <div className="mb-4 p-3 bg-muted rounded-lg">
          <div className="flex items-center justify-between">
            <span>Poids du lot:</span>
            <span className="font-bold">{batch.current_weight_kg} kg</span>
          </div>
          <div className="flex items-center justify-between mt-1">
            <span>Grade qualité:</span>
            <Badge className={batchStatusColors[batch.status]}>
              {batch.quality_grade || 'Non défini'}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Recommandation: {recommendedZoneType === 'cold_room' ? 'Chambre froide' : 'Zone ventilée'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Zone de stockage *</Label>
            <Select value={selectedZoneId} onValueChange={setSelectedZoneId} required>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner une zone" />
              </SelectTrigger>
              <SelectContent>
                {availableZones.map((zone) => (
                  <SelectItem key={zone.id} value={zone.id}>
                    <div className="flex items-center gap-2">
                      <span className={zone.zone_type === recommendedZoneType ? 'font-bold text-green-600' : ''}>
                        {zone.code} - {zone.name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        ({zoneTypeLabels[zone.zone_type]})
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedZone && (
            <div className="p-3 border rounded-lg space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Capacité:</span>
                <span>{selectedZone.current_load_kg} / {selectedZone.capacity_kg} kg</span>
              </div>
              <Progress value={(selectedZone.current_load_kg / selectedZone.capacity_kg) * 100} className="h-2" />
              <p className={`text-xs ${loadPercentage > 90 ? 'text-red-500' : 'text-muted-foreground'}`}>
                Après stockage: {loadPercentage.toFixed(1)}%
              </p>
              
              <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                {selectedZone.temperature_min !== null && (
                  <div className="flex items-center gap-1">
                    <Thermometer className="h-3 w-3" />
                    {selectedZone.temperature_min}°C - {selectedZone.temperature_max}°C
                  </div>
                )}
                {selectedZone.humidity_min !== null && (
                  <div className="flex items-center gap-1">
                    <Droplets className="h-3 w-3" />
                    {selectedZone.humidity_min}% - {selectedZone.humidity_max}%
                  </div>
                )}
              </div>
            </div>
          )}

          <div>
            <Label htmlFor="storagePosition">
              <MapPin className="h-3 w-3 inline mr-1" />
              Position dans la zone
            </Label>
            <Input
              id="storagePosition"
              value={storagePosition}
              onChange={(e) => setStoragePosition(e.target.value)}
              placeholder="Ex: Allée 3, Rack B, Niveau 2"
            />
          </div>

          <div>
            <Label htmlFor="performedBy">Stocké par</Label>
            <Input
              id="performedBy"
              value={performedBy}
              onChange={(e) => setPerformedBy(e.target.value)}
              placeholder="Nom de l'opérateur"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={updateStatus.isPending || !selectedZoneId}>
              {updateStatus.isPending ? 'Stockage...' : 'Confirmer le stockage'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
