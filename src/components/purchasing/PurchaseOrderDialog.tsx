import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, AlertTriangle } from 'lucide-react';
import { PurchaseOrder, PurchaseRequisition } from '@/types/purchasing';
import { Material, Supplier } from '@/types/mes';

interface OrderLine {
  material_id?: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
}

type PurchaseOrderFormValues = {
  supplier_id: string;
  order_type: string;
  order_date: string;
  expected_delivery_date: string;
  currency: string;
  tax_amount: string;
  payment_terms: string;
  advance_paid: string;
  delivery_address: string;
  delivery_site: string;
  transport_mode: string;
  incoterm: string;
  supplier_reference: string;
  variety: string;
  quality_expected: string;
  tolerance_pct: string;
  notes: string;
  created_by: string;
};

export type PurchaseOrderSavePayload = {
  supplier_id: string;
  requisition_id: string | null;
  order_type: string | null;
  order_date: string;
  expected_delivery_date: string | null;
  currency: string;
  tax_amount: number;
  subtotal: number;
  total_amount: number;
  payment_terms: string | null;
  advance_paid: number | null;
  delivery_address: string | null;
  delivery_site: string | null;
  transport_mode: string | null;
  incoterm: string | null;
  supplier_reference: string | null;
  variety: string | null;
  quality_expected: string | null;
  bio_required: boolean;
  tolerance_pct: number | null;
  notes: string | null;
  created_by: string;
};

interface PurchaseOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order?: PurchaseOrder | null;
  fromRequisition?: PurchaseRequisition | null;
  materials: Material[];
  suppliers: Supplier[];
  onSave: (order: PurchaseOrderSavePayload, lines: OrderLine[]) => void;
  isLoading?: boolean;
}

const APPROVAL_THRESHOLD = 50000;

const defaultFormValues = (): PurchaseOrderFormValues => ({
  supplier_id: '',
  order_type: 'ferme',
  order_date: new Date().toISOString().split('T')[0],
  expected_delivery_date: '',
  currency: 'TND',
  tax_amount: '0',
  payment_terms: 'immediat',
  advance_paid: '',
  delivery_address: '',
  delivery_site: '',
  transport_mode: '',
  incoterm: '',
  supplier_reference: '',
  variety: '',
  quality_expected: '',
  tolerance_pct: '5',
  notes: '',
  created_by: '',
});

export const PurchaseOrderDialog = ({
  open,
  onOpenChange,
  order,
  fromRequisition,
  materials,
  suppliers,
  onSave,
  isLoading
}: PurchaseOrderDialogProps) => {
  const [lines, setLines] = useState<OrderLine[]>([]);
  const [bioRequired, setBioRequired] = useState(false);

  const { register, handleSubmit, reset, setValue, watch } = useForm<PurchaseOrderFormValues>({
    defaultValues: defaultFormValues(),
  });

  const watchedOrderType = watch('order_type');
  const watchedPaymentTerms = watch('payment_terms');

  useEffect(() => {
    if (watchedOrderType === 'sur_pied') {
      setValue('tolerance_pct', '15');
    } else if (watchedOrderType === 'ferme') {
      setValue('tolerance_pct', '5');
    }
  }, [watchedOrderType, setValue]);

  useEffect(() => {
    if (fromRequisition) {
      reset({
        ...defaultFormValues(),
        supplier_id: fromRequisition.preferred_supplier_id || '',
        notes: `Depuis DA: ${fromRequisition.requisition_number}`,
      });
      setBioRequired(false);
      setLines([{
        material_id: fromRequisition.material_id || undefined,
        description: fromRequisition.material_name,
        quantity: fromRequisition.quantity,
        unit: fromRequisition.unit,
        unit_price: fromRequisition.estimated_cost
          ? fromRequisition.estimated_cost / fromRequisition.quantity
          : 0
      }]);
    } else if (order) {
      reset({
        supplier_id: order.supplier_id,
        order_type: order.order_type || 'ferme',
        order_date: order.order_date,
        expected_delivery_date: order.expected_delivery_date || '',
        currency: order.currency || 'TND',
        tax_amount: order.tax_amount?.toString() || '0',
        payment_terms: order.payment_terms || 'immediat',
        advance_paid: order.advance_paid?.toString() || '',
        delivery_address: order.delivery_address || '',
        delivery_site: order.delivery_site || '',
        transport_mode: order.transport_mode || '',
        incoterm: order.incoterm || '',
        supplier_reference: order.supplier_reference || '',
        variety: order.variety || '',
        quality_expected: order.quality_expected || '',
        tolerance_pct: order.tolerance_pct?.toString() || '5',
        notes: order.notes || '',
        created_by: order.created_by || '',
      });
      setBioRequired(order.bio_required ?? false);
      setLines(order.lines?.map(l => ({
        material_id: l.material_id || undefined,
        description: l.description,
        quantity: l.quantity,
        unit: l.unit,
        unit_price: l.unit_price
      })) || []);
    } else {
      reset(defaultFormValues());
      setBioRequired(false);
      setLines([]);
    }
  }, [order, fromRequisition, reset]);

  const addLine = () => {
    setLines([...lines, { description: '', quantity: 1, unit: 'kg', unit_price: 0 }]);
  };

  const updateLine = (index: number, field: keyof OrderLine, value: string | number) => {
    const newLines = [...lines];
    newLines[index] = { ...newLines[index], [field]: value };
    if (field === 'material_id' && value) {
      const material = materials.find(m => m.id === value);
      if (material) {
        newLines[index].description = material.name;
        newLines[index].unit = material.unit;
      }
    }
    setLines(newLines);
  };

  const removeLine = (index: number) => {
    setLines(lines.filter((_, i) => i !== index));
  };

  const subtotal = lines.reduce((sum, l) => sum + (l.quantity * l.unit_price), 0);
  const taxAmount = parseFloat(watch('tax_amount') || '0') || 0;
  const total = subtotal + taxAmount;
  const needsApproval = total >= APPROVAL_THRESHOLD;

  const onSubmit = (data: PurchaseOrderFormValues) => {
    if (lines.length === 0) {
      alert('Ajoutez au moins une ligne');
      return;
    }
    onSave({
      supplier_id: data.supplier_id,
      requisition_id: fromRequisition?.id || null,
      order_type: data.order_type || null,
      order_date: data.order_date,
      expected_delivery_date: data.expected_delivery_date || null,
      currency: data.currency,
      tax_amount: taxAmount,
      subtotal,
      total_amount: total,
      payment_terms: data.payment_terms || null,
      advance_paid: data.advance_paid ? parseFloat(data.advance_paid) : null,
      delivery_address: data.delivery_address || null,
      delivery_site: data.delivery_site || null,
      transport_mode: data.transport_mode || null,
      incoterm: data.incoterm || null,
      supplier_reference: data.supplier_reference || null,
      variety: data.variety || null,
      quality_expected: data.quality_expected || null,
      bio_required: bioRequired,
      tolerance_pct: data.tolerance_pct ? parseFloat(data.tolerance_pct) : null,
      notes: data.notes || null,
      created_by: data.created_by,
    }, lines);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {order ? 'Modifier le bon de commande' : 'Nouveau bon de commande'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

          {/* Bloc 1: Identification */}
          <div className="space-y-1">
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Identification</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Fournisseur *</Label>
                <Select value={watch('supplier_id')} onValueChange={(v) => setValue('supplier_id', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner..." />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.filter(s => s.is_active).map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Type de commande</Label>
                <Select value={watch('order_type')} onValueChange={(v) => setValue('order_type', v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ferme">Commande ferme</SelectItem>
                    <SelectItem value="sur_pied">Sur pied (شجرة) — tolérance 15 %</SelectItem>
                    <SelectItem value="ouverte">Commande ouverte (cadre)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 pt-1">
              <div className="space-y-2">
                <Label>Date commande</Label>
                <Input type="date" {...register('order_date')} />
              </div>
              <div className="space-y-2">
                <Label>Livraison prévue</Label>
                <Input type="date" {...register('expected_delivery_date')} />
              </div>
              <div className="space-y-2">
                <Label>Créé par *</Label>
                <Input {...register('created_by', { required: true })} placeholder="Votre nom" />
              </div>
            </div>
          </div>

          {/* Bloc 2: Produit */}
          <div className="rounded-xl border bg-muted/20 p-4 space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Produit</p>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Variété</Label>
                <Input {...register('variety')} placeholder="Ex: Deglet Nour, Medjool..." />
              </div>
              <div className="space-y-2">
                <Label>Qualité attendue</Label>
                <Select value={watch('quality_expected')} onValueChange={(v) => setValue('quality_expected', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Extra">Extra</SelectItem>
                    <SelectItem value="Cat.I">Catégorie I</SelectItem>
                    <SelectItem value="Cat.II">Catégorie II</SelectItem>
                    <SelectItem value="Mixte">Mixte</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tolérance quantité (%)</Label>
                <Input
                  type="number"
                  step="1"
                  min="0"
                  max="50"
                  {...register('tolerance_pct')}
                  className="font-mono"
                />
                <p className="text-[11px] text-muted-foreground">
                  {watchedOrderType === 'sur_pied' ? 'Sur pied → 15 % (RG-ACH12)' : 'Défaut 5 % pour commande ferme'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 pt-1">
              <Checkbox
                id="bio_required"
                checked={bioRequired}
                onCheckedChange={(checked) => setBioRequired(!!checked)}
              />
              <Label htmlFor="bio_required" className="cursor-pointer font-normal">
                Bio requis (certification obligatoire du fournisseur — RG-ACH05)
              </Label>
              {bioRequired && (
                <Badge className="bg-emerald-600 text-white text-xs ml-2">Bio</Badge>
              )}
            </div>
          </div>

          {/* Bloc 3: Prix & Paiement */}
          <div className="space-y-1">
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Prix &amp; Paiement</p>
            <div className="grid grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Devise</Label>
                <Select value={watch('currency')} onValueChange={(v) => setValue('currency', v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TND">TND</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>TVA (montant)</Label>
                <Input type="number" step="0.01" {...register('tax_amount')} />
              </div>
              <div className="space-y-2">
                <Label>Conditions paiement</Label>
                <Select value={watch('payment_terms')} onValueChange={(v) => setValue('payment_terms', v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="immediat">Immédiat</SelectItem>
                    <SelectItem value="15j">15 jours</SelectItem>
                    <SelectItem value="30j">30 jours</SelectItem>
                    <SelectItem value="avance_solde">Avance + solde</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Avance versée (TND)</Label>
                <Input
                  type="number"
                  step="0.01"
                  {...register('advance_paid')}
                  disabled={watchedPaymentTerms !== 'avance_solde'}
                  placeholder={watchedPaymentTerms !== 'avance_solde' ? '—' : '0.00'}
                />
              </div>
            </div>
          </div>

          {/* Bloc 4: Livraison */}
          <div className="space-y-1">
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Livraison</p>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Site de livraison</Label>
                <Input {...register('delivery_site')} placeholder="Usine / dépôt / quai" />
              </div>
              <div className="space-y-2">
                <Label>Mode de transport</Label>
                <Select value={watch('transport_mode')} onValueChange={(v) => setValue('transport_mode', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="camion">Camion</SelectItem>
                    <SelectItem value="vehicule_fournisseur">Véhicule fournisseur</SelectItem>
                    <SelectItem value="propre_moyen">Propres moyens</SelectItem>
                    <SelectItem value="autre">Autre</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Incoterm</Label>
                <Input {...register('incoterm')} placeholder="EXW, FCA, DDP..." />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 pt-1">
              <div className="space-y-2">
                <Label>Adresse livraison</Label>
                <Input {...register('delivery_address')} placeholder="Adresse complète" />
              </div>
              <div className="space-y-2">
                <Label>Réf. fournisseur</Label>
                <Input {...register('supplier_reference')} placeholder="Confirmation / devis fournisseur" />
              </div>
            </div>
          </div>

          {/* Order Lines */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label className="text-base font-semibold">Lignes de commande</Label>
              <Button type="button" size="sm" variant="outline" onClick={addLine}>
                <Plus className="h-4 w-4 mr-1" />
                Ajouter ligne
              </Button>
            </div>

            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Article</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="w-24">Qté</TableHead>
                    <TableHead className="w-20">Unité</TableHead>
                    <TableHead className="w-28">Prix unit.</TableHead>
                    <TableHead className="w-28">Total</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-4">
                        Aucune ligne. Cliquez sur "Ajouter ligne".
                      </TableCell>
                    </TableRow>
                  ) : (
                    lines.map((line, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <Select
                            value={line.material_id || ''}
                            onValueChange={(v) => updateLine(i, 'material_id', v)}
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue placeholder="..." />
                            </SelectTrigger>
                            <SelectContent>
                              {materials.map(m => (
                                <SelectItem key={m.id} value={m.id}>{m.code}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Input
                            value={line.description}
                            onChange={(e) => updateLine(i, 'description', e.target.value)}
                            placeholder="Description"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.01"
                            value={line.quantity}
                            onChange={(e) => updateLine(i, 'quantity', parseFloat(e.target.value) || 0)}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={line.unit}
                            onChange={(e) => updateLine(i, 'unit', e.target.value)}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.01"
                            value={line.unit_price}
                            onChange={(e) => updateLine(i, 'unit_price', parseFloat(e.target.value) || 0)}
                          />
                        </TableCell>
                        <TableCell className="font-medium">
                          {(line.quantity * line.unit_price).toFixed(2)} TND
                        </TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeLine(i)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-between items-end">
              <div>
                {needsApproval && (
                  <div className="flex items-center gap-2 text-amber-600 text-sm">
                    <AlertTriangle className="h-4 w-4" />
                    Montant {'>'} {APPROVAL_THRESHOLD.toLocaleString('fr-FR')} TND — validation Direction requise (RG-ACH06)
                  </div>
                )}
              </div>
              <div className="space-y-1 text-right">
                <div className="text-sm text-muted-foreground">Sous-total : {subtotal.toFixed(2)} {watch('currency') || 'TND'}</div>
                <div className="text-sm text-muted-foreground">TVA : {taxAmount.toFixed(2)} {watch('currency') || 'TND'}</div>
                <div className="text-lg font-bold">
                  Total : {total.toFixed(2)} {watch('currency') || 'TND'}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea {...register('notes')} placeholder="Notes..." rows={2} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={isLoading || !watch('supplier_id')}>
              {isLoading ? 'Enregistrement...' : order ? 'Mettre à jour' : 'Créer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
