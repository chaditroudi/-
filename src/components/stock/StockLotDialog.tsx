import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useProducts, useCreateStockLot } from '@/hooks/useStock';
import { useModule3StorageLocations, useMoveStorageStock } from '@/hooks/useStorageModule3';
import { useSuppliers } from '@/hooks/useSuppliers';
import { format } from 'date-fns';

interface StockLotDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const StockLotDialog = ({ open, onOpenChange }: StockLotDialogProps) => {
  const { data: products = [] } = useProducts();
  const { data: locations = [] } = useModule3StorageLocations();
  const { data: suppliers = [] } = useSuppliers();
  const createLot = useCreateStockLot();
  const moveStorageStock = useMoveStorageStock();

  const [formData, setFormData] = useState({
    product_id: '',
    supplier_id: '',
    initial_quantity: 0,
    unit: 'kg',
    origin_farm: '',
    origin_country: 'Tunisie',
    variety: '',
    harvest_date: '',
    reception_date: format(new Date(), 'yyyy-MM-dd'),
    dluo_date: '',
    dlc_date: '',
    storage_location_id: '',
    position: '',
    humidity_measured: '',
    temperature_measured: '',
    quality_notes: '',
    created_by: ''
  });

  const selectedProduct = products.find(p => p.id === formData.product_id);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const createdLot = await createLot.mutateAsync({
      product_id: formData.product_id,
      supplier_id: formData.supplier_id || undefined,
      initial_quantity: formData.initial_quantity,
      current_quantity: formData.initial_quantity,
      unit: formData.unit,
      origin_farm: formData.origin_farm || undefined,
      origin_country: formData.origin_country,
      variety: formData.variety || undefined,
      harvest_date: formData.harvest_date || undefined,
      reception_date: formData.reception_date,
      dluo_date: formData.dluo_date || undefined,
      dlc_date: formData.dlc_date || undefined,
      position: formData.position || undefined,
      humidity_measured: formData.humidity_measured ? Number(formData.humidity_measured) : undefined,
      temperature_measured: formData.temperature_measured ? Number(formData.temperature_measured) : undefined,
      quality_notes: formData.quality_notes || undefined,
      created_by: formData.created_by || undefined
    });

    if (formData.storage_location_id) {
      await moveStorageStock.mutateAsync({
        movementType: 'ENTREE_ZONE',
        lotId: createdLot.id,
        lotCode: createdLot.lot_number,
        destinationLocationId: formData.storage_location_id,
        quantityPalettes: 1,
        quantityKg: formData.initial_quantity,
        reason: 'AUTRE',
        notes: formData.position
          ? `Creation manuelle lot de stock. Position: ${formData.position}`
          : 'Creation manuelle lot de stock',
      });
    }
    
    onOpenChange(false);
    // Reset form
    setFormData({
      product_id: '',
      supplier_id: '',
      initial_quantity: 0,
      unit: 'kg',
      origin_farm: '',
      origin_country: 'Tunisie',
      variety: '',
      harvest_date: '',
      reception_date: format(new Date(), 'yyyy-MM-dd'),
      dluo_date: '',
      dlc_date: '',
      storage_location_id: '',
      position: '',
      humidity_measured: '',
      temperature_measured: '',
      quality_notes: '',
      created_by: ''
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nouveau lot de stock</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
            <p className="font-medium">Quand utiliser cet écran ?</p>
            <p className="mt-1">
              Cet écran sert à créer un <strong>lot de stock</strong> géré par le magasin ou la production.
              Les <strong>lots d'entrée</strong> liés aux camions fournisseurs se créent dans le module Réception.
              Utilise donc cet écran surtout pour les cas magasin, transformation ou création manuelle exceptionnelle.
            </p>
          </div>

          {/* Produit */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Produit *</Label>
              <Select 
                value={formData.product_id} 
                onValueChange={(v) => {
                  const product = products.find(p => p.id === v);
                  setFormData(prev => ({ 
                    ...prev, 
                    product_id: v,
                    unit: product?.unit || 'kg'
                  }));
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un produit" />
                </SelectTrigger>
                <SelectContent>
                  {products.map(product => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.code} - {product.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Fournisseur</Label>
              <Select 
                value={formData.supplier_id} 
                onValueChange={(v) => setFormData(prev => ({ ...prev, supplier_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un fournisseur" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map(supplier => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.code} - {supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Quantité */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Quantité *</Label>
              <Input
                type="number"
                value={formData.initial_quantity}
                onChange={(e) => setFormData(prev => ({ ...prev, initial_quantity: Number(e.target.value) }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Unité</Label>
              <Input value={formData.unit} readOnly className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label>Variété</Label>
              <Input
                value={formData.variety}
                onChange={(e) => setFormData(prev => ({ ...prev, variety: e.target.value }))}
                placeholder="Deglet Nour, Allig..."
              />
            </div>
          </div>

          {/* Origine */}
          <div className="border rounded-lg p-4 space-y-4">
            <h4 className="font-medium">Origine</h4>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Palmeraie/Ferme</Label>
                <Input
                  value={formData.origin_farm}
                  onChange={(e) => setFormData(prev => ({ ...prev, origin_farm: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Pays</Label>
                <Input
                  value={formData.origin_country}
                  onChange={(e) => setFormData(prev => ({ ...prev, origin_country: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Date de récolte</Label>
                <Input
                  type="date"
                  value={formData.harvest_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, harvest_date: e.target.value }))}
                />
              </div>
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Date de réception *</Label>
              <Input
                type="date"
                value={formData.reception_date}
                onChange={(e) => setFormData(prev => ({ ...prev, reception_date: e.target.value }))}
                required
              />
            </div>
            {selectedProduct?.category === 'PF' && (
              <>
                <div className="space-y-2">
                  <Label>DLUO</Label>
                  <Input
                    type="date"
                    value={formData.dluo_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, dluo_date: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>DLC</Label>
                  <Input
                    type="date"
                    value={formData.dlc_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, dlc_date: e.target.value }))}
                  />
                </div>
              </>
            )}
          </div>

          {/* Emplacement */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Emplacement initial</Label>
              <Select 
                value={formData.storage_location_id} 
                onValueChange={(v) => setFormData(prev => ({ ...prev, storage_location_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un emplacement" />
                </SelectTrigger>
                <SelectContent>
                  {locations.filter((loc) => loc.location_status !== 'blocked').map(loc => (
                    <SelectItem key={loc.id} value={loc.id}>
                      {loc.code} - {loc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Position</Label>
              <Input
                value={formData.position}
                onChange={(e) => setFormData(prev => ({ ...prev, position: e.target.value }))}
                placeholder="A1, B2..."
              />
            </div>
          </div>

          {/* Qualité */}
          <div className="border rounded-lg p-4 space-y-4">
            <h4 className="font-medium">Contrôle Qualité Initial</h4>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Humidité mesurée (%)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={formData.humidity_measured}
                  onChange={(e) => setFormData(prev => ({ ...prev, humidity_measured: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Température (°C)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={formData.temperature_measured}
                  onChange={(e) => setFormData(prev => ({ ...prev, temperature_measured: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Opérateur</Label>
                <Input
                  value={formData.created_by}
                  onChange={(e) => setFormData(prev => ({ ...prev, created_by: e.target.value }))}
                  placeholder="Nom de l'opérateur"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes qualité</Label>
              <Textarea
                value={formData.quality_notes}
                onChange={(e) => setFormData(prev => ({ ...prev, quality_notes: e.target.value }))}
                placeholder="Observations, remarques..."
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={createLot.isPending || moveStorageStock.isPending || !formData.product_id}>
              {createLot.isPending || moveStorageStock.isPending ? 'Création...' : 'Créer le lot'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
