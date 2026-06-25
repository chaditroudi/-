import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCreateProduct, useUpdateProduct } from '@/hooks/useStock';
import { Product, ProductCategory, RotationRule } from '@/types/stock';

interface ProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product | null;
}

export const ProductDialog = ({ open, onOpenChange, product }: ProductDialogProps) => {
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const isEdit = !!product;

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    category: 'MP' as ProductCategory,
    unit: 'kg',
    variety: '',
    description: '',
    threshold_min: 0,
    threshold_security: 0,
    threshold_max: 0,
    storage_humidity_max: 18,
    rotation_rule: 'FIFO' as RotationRule,
    shelf_life_days: 0
  });

  useEffect(() => {
    if (product) {
      setFormData({
        code: product.code,
        name: product.name,
        category: product.category,
        unit: product.unit,
        variety: product.variety || '',
        description: product.description || '',
        threshold_min: product.threshold_min,
        threshold_security: product.threshold_security,
        threshold_max: product.threshold_max || 0,
        storage_humidity_max: product.storage_humidity_max || 18,
        rotation_rule: product.rotation_rule,
        shelf_life_days: product.shelf_life_days || 0
      });
    } else {
      setFormData({
        code: '',
        name: '',
        category: 'MP',
        unit: 'kg',
        variety: '',
        description: '',
        threshold_min: 0,
        threshold_security: 0,
        threshold_max: 0,
        storage_humidity_max: 18,
        rotation_rule: 'FIFO',
        shelf_life_days: 0
      });
    }
  }, [product]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const payload = {
      ...formData,
      threshold_max: formData.threshold_max || null,
      shelf_life_days: formData.shelf_life_days || null,
      is_active: true,
    };

    if (isEdit && product) {
      await updateProduct.mutateAsync({ id: product.id, ...payload } as any);
    } else {
      await createProduct.mutateAsync(payload as any);
    }

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? 'Modifier le produit' : 'Nouveau produit'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="code">Code *</Label>
              <Input
                id="code"
                value={formData.code}
                onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value }))}
                placeholder="MP-DEG-001"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Nom *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Dattes Deglet Nour"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Catégorie *</Label>
              <Select 
                value={formData.category} 
                onValueChange={(v) => setFormData(prev => ({ 
                  ...prev, 
                  category: v as ProductCategory,
                  rotation_rule: v === 'PF' ? 'FEFO' : 'FIFO'
                }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MP">Matière Première</SelectItem>
                  <SelectItem value="WIP">En-cours</SelectItem>
                  <SelectItem value="PF">Produit Fini</SelectItem>
                  <SelectItem value="EMB">Emballage</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Unité *</Label>
              <Select 
                value={formData.unit} 
                onValueChange={(v) => setFormData(prev => ({ ...prev, unit: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="kg">Kilogramme (kg)</SelectItem>
                  <SelectItem value="pièce">Pièce</SelectItem>
                  <SelectItem value="carton">Carton</SelectItem>
                  <SelectItem value="rouleau">Rouleau</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Rotation</Label>
              <Select 
                value={formData.rotation_rule} 
                onValueChange={(v) => setFormData(prev => ({ ...prev, rotation_rule: v as RotationRule }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FIFO">FIFO (Premier entré)</SelectItem>
                  <SelectItem value="FEFO">FEFO (Péremption)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="variety">Variété</Label>
            <Input
              id="variety"
              value={formData.variety}
              onChange={(e) => setFormData(prev => ({ ...prev, variety: e.target.value }))}
              placeholder="Deglet Nour, Allig, etc."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Description du produit..."
              rows={2}
            />
          </div>

          <div className="border rounded-lg p-4 space-y-4">
            <h4 className="font-medium">Seuils de stock</h4>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="threshold_min">Seuil minimum</Label>
                <Input
                  id="threshold_min"
                  type="number"
                  value={formData.threshold_min}
                  onChange={(e) => setFormData(prev => ({ ...prev, threshold_min: Number(e.target.value) }))}
                />
                <p className="text-xs text-muted-foreground">Alerte critique</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="threshold_security">Seuil sécurité</Label>
                <Input
                  id="threshold_security"
                  type="number"
                  value={formData.threshold_security}
                  onChange={(e) => setFormData(prev => ({ ...prev, threshold_security: Number(e.target.value) }))}
                />
                <p className="text-xs text-muted-foreground">Alerte préventive</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="threshold_max">Seuil maximum</Label>
                <Input
                  id="threshold_max"
                  type="number"
                  value={formData.threshold_max}
                  onChange={(e) => setFormData(prev => ({ ...prev, threshold_max: Number(e.target.value) }))}
                />
                <p className="text-xs text-muted-foreground">Surstock</p>
              </div>
            </div>
          </div>

          {formData.category === 'PF' && (
            <div className="border rounded-lg p-4 space-y-4">
              <h4 className="font-medium">Durée de vie (Produit Fini)</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="shelf_life_days">Durée de vie (jours)</Label>
                  <Input
                    id="shelf_life_days"
                    type="number"
                    value={formData.shelf_life_days}
                    onChange={(e) => setFormData(prev => ({ ...prev, shelf_life_days: Number(e.target.value) }))}
                    placeholder="365"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="storage_humidity_max">Humidité max (%)</Label>
                  <Input
                    id="storage_humidity_max"
                    type="number"
                    value={formData.storage_humidity_max}
                    onChange={(e) => setFormData(prev => ({ ...prev, storage_humidity_max: Number(e.target.value) }))}
                  />
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={createProduct.isPending || updateProduct.isPending}>
              {(createProduct.isPending || updateProduct.isPending) ? 'Enregistrement...' : isEdit ? 'Modifier' : 'Créer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
