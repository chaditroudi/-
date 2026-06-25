import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Plus, Package, Box, QrCode } from 'lucide-react';
import { useReceptionUnits, useCreateReceptionUnit } from '@/hooks/useReceptionsV2';
import { ReceptionLot, ReceptionUnit, unitTypeLabels, stockStatusLabels, stockStatusColors, ReceptionUnitType } from '@/types/reception';

interface UnitsManagementProps {
  lot: ReceptionLot;
  receptionNumber: string;
  onPrintLabel: (unit: ReceptionUnit) => void;
}

export const UnitsManagement = ({ lot, receptionNumber, onPrintLabel }: UnitsManagementProps) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { data: units = [], isLoading } = useReceptionUnits(lot.id);
  const createUnit = useCreateReceptionUnit();

  const [unitType, setUnitType] = useState<ReceptionUnitType>('PALETTE');
  const [quantity, setQuantity] = useState<number>(0);
  const [unit, setUnit] = useState('kg');
  const [grossWeight, setGrossWeight] = useState<number | undefined>();
  const [netWeight, setNetWeight] = useState<number | undefined>();

  const handleCreateUnit = async () => {
    if (quantity <= 0) return;
    
    try {
      await createUnit.mutateAsync({
        reception_lot_id: lot.id,
        unit_type: unitType,
        quantity,
        unit,
        gross_weight: grossWeight,
        net_weight: netWeight
      });
      setDialogOpen(false);
      resetForm();
    } catch (error) {
      console.error('Error creating unit:', error);
    }
  };

  const resetForm = () => {
    setUnitType('PALETTE');
    setQuantity(0);
    setGrossWeight(undefined);
    setNetWeight(undefined);
  };

  const totalUnitsQuantity = units.reduce((sum, u) => sum + u.quantity, 0);
  const remainingQuantity = lot.quantity - totalUnitsQuantity;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="h-5 w-5 text-muted-foreground" />
          <span className="font-medium">Unités logistiques du lot d'entrée</span>
          <Badge variant="outline">{units.length} unité(s)</Badge>
        </div>
        <Button size="sm" onClick={() => setDialogOpen(true)} disabled={remainingQuantity <= 0}>
          <Plus className="h-4 w-4 mr-1" />
          Ajouter
        </Button>
      </div>

      {remainingQuantity > 0 && (
        <div className="text-sm text-amber-600 bg-amber-50 p-2 rounded">
          ⚠️ {remainingQuantity} {lot.unit} restent à affecter en unités logistiques
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-4 text-muted-foreground">Chargement...</div>
      ) : units.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground border-2 border-dashed rounded-lg">
          <Box className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>Aucune unité logistique</p>
          <p className="text-xs">Créez des palettes ou caisses liées à ce lot d'entrée</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {units.map((unitItem) => (
            <Card key={unitItem.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {unitItem.unit_type === 'PALETTE' ? (
                      <Package className="h-5 w-5 text-blue-500" />
                    ) : (
                      <Box className="h-5 w-5 text-gray-500" />
                    )}
                    <div>
                      <p className="font-mono text-sm font-medium">{unitItem.barcode}</p>
                      <p className="text-xs text-muted-foreground">{unitTypeLabels[unitItem.unit_type]}</p>
                    </div>
                  </div>
                  <Badge className={stockStatusColors[unitItem.unit_status]}>
                    {stockStatusLabels[unitItem.unit_status]}
                  </Badge>
                </div>
                
                <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                  <div>
                    <span className="text-muted-foreground">Quantité</span>
                    <p className="font-medium">{unitItem.quantity} {unitItem.unit}</p>
                  </div>
                  {unitItem.net_weight && (
                    <div>
                      <span className="text-muted-foreground">Poids net</span>
                      <p className="font-medium">{unitItem.net_weight} kg</p>
                    </div>
                  )}
                  {unitItem.location_id && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Emplacement</span>
                      <p className="font-medium">{unitItem.position || 'Non assigné'}</p>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs text-muted-foreground">
                    {unitItem.qr_code_payload ? 'QR prêt pour impression et scan.' : 'Code interne prêt pour impression.'}
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0"
                    onClick={() => onPrintLabel(unitItem)}
                  >
                    <QrCode className="h-4 w-4 mr-1" />
                    Étiquette QR
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Unit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouvelle unité logistique d'entrée</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="p-3 bg-muted rounded-lg text-sm">
              <p>Lot d'entrée: <strong>{lot.lot_internal || lot.lot_supplier}</strong></p>
              <p>Restant à affecter: <strong>{remainingQuantity} {lot.unit}</strong></p>
            </div>

            <div className="space-y-2">
              <Label>Type d'unité</Label>
              <Select value={unitType} onValueChange={(v) => setUnitType(v as ReceptionUnitType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
              <SelectContent>
                <SelectItem value="PALETTE">Palette</SelectItem>
                <SelectItem value="CAISSE">Caisse</SelectItem>
                <SelectItem value="VRAC">Vrac</SelectItem>
                <SelectItem value="PL">PL</SelectItem>
                <SelectItem value="GC">GC</SelectItem>
                <SelectItem value="PLOX">PLOX</SelectItem>
                <SelectItem value="LAMME">LAMME</SelectItem>
              </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Quantité *</Label>
                <Input 
                  type="number"
                  value={quantity || ''}
                  onChange={(e) => setQuantity(Math.min(Number(e.target.value), remainingQuantity))}
                  max={remainingQuantity}
                />
              </div>
              <div className="space-y-2">
                <Label>Unité</Label>
                <Select value={unit} onValueChange={setUnit}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="kg">kg</SelectItem>
                    <SelectItem value="cartons">cartons</SelectItem>
                    <SelectItem value="pieces">pièces</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Poids brut (kg)</Label>
                <Input 
                  type="number"
                  value={grossWeight || ''}
                  onChange={(e) => setGrossWeight(Number(e.target.value) || undefined)}
                />
              </div>
              <div className="space-y-2">
                <Label>Poids net (kg)</Label>
                <Input 
                  type="number"
                  value={netWeight || ''}
                  onChange={(e) => setNetWeight(Number(e.target.value) || undefined)}
                />
              </div>
            </div>

            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
              📋 Un code-barres unique sera généré automatiquement (PLT-YYYYMMDD-XXXXX)
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
            <Button onClick={handleCreateUnit} disabled={quantity <= 0 || createUnit.isPending}>
              {createUnit.isPending ? 'Création...' : 'Créer l\'unité'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
