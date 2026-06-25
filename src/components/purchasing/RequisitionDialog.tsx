import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PurchaseRequisition, UrgencyLevel } from '@/types/purchasing';
import { Material, Supplier } from '@/types/mes';
import { buildRequisitionNotes, parseRequisitionMeta } from './requisitionMeta';

type RequisitionFormValues = {
  requester_name: string;
  department: string;
  site: string;
  desired_date: string;
  material_id: string;
  material_name: string;
  quantity: number;
  unit: string;
  urgency: UrgencyLevel;
  justification: string;
  estimated_cost: string;
  preferred_supplier_id: string;
  notes: string;
  status: string;
};

type RequisitionSavePayload = {
  requester_name: string;
  department: string | null;
  material_id: string | null;
  material_name: string;
  quantity: number;
  unit: string;
  urgency: UrgencyLevel;
  justification: string | null;
  estimated_cost: number | null;
  preferred_supplier_id: string | null;
  notes: string | null;
  status: string;
};
 
interface RequisitionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requisition?: PurchaseRequisition | null;
  materials: Material[];
  suppliers: Supplier[];
  onSave: (data: RequisitionSavePayload) => void;
  isLoading?: boolean;
}

export const RequisitionDialog = ({
  open,
  onOpenChange,
  requisition,
  materials,
  suppliers,
  onSave,
  isLoading,
}: RequisitionDialogProps) => {
  const { register, handleSubmit, reset, setValue, watch } = useForm<RequisitionFormValues>({
    defaultValues: {
      requester_name: '',
      department: '',
      site: '',
      desired_date: '',
      material_id: '',
      material_name: '',
      quantity: 1,
      unit: 'kg',
      urgency: 'normal' as UrgencyLevel,
      justification: '',
      estimated_cost: '',
      preferred_supplier_id: '',
      notes: '',
      status: 'pending_approval'
    }
  });

  const materialId = watch('material_id');

  useEffect(() => {
    if (requisition) {
      const { plainNotes, meta } = parseRequisitionMeta(requisition.notes);
      reset({
        requester_name: requisition.requester_name,
        department: requisition.department || '',
        site: meta.site || requisition.department || '',
        desired_date: meta.desiredDate || '',
        material_id: requisition.material_id || '',
        material_name: requisition.material_name,
        quantity: requisition.quantity,
        unit: requisition.unit,
        urgency: requisition.urgency,
        justification: requisition.justification || '',
        estimated_cost: requisition.estimated_cost?.toString() || '',
        preferred_supplier_id: requisition.preferred_supplier_id || '',
        notes: plainNotes,
        status: requisition.status
      });
    } else {
      reset({
        requester_name: '',
        department: '',
        site: '',
        desired_date: '',
        material_id: '',
        material_name: '',
        quantity: 1,
        unit: 'kg',
        urgency: 'normal',
        justification: '',
        estimated_cost: '',
        preferred_supplier_id: '',
        notes: '',
        status: 'pending_approval'
      });
    }
  }, [requisition, reset]);

  // Auto-fill material name when material is selected
  useEffect(() => {
    if (materialId) {
      const material = materials.find(m => m.id === materialId);
      if (material) {
        setValue('material_name', material.name);
        setValue('unit', material.unit);
      }
    }
  }, [materialId, materials, setValue]);

  const onSubmit = (data: RequisitionFormValues) => {
    const status = requisition ? requisition.status : 'pending_approval';
    const notes = buildRequisitionNotes(data.notes || '', {
      site: data.site || '',
      desiredDate: data.desired_date || ''
    });

    onSave({
      requester_name: data.requester_name,
      department: data.department || null,
      material_name: data.material_name,
      unit: data.unit,
      urgency: data.urgency,
      justification: data.justification || null,
      status,
      notes,
      material_id: data.material_id || null,
      preferred_supplier_id: data.preferred_supplier_id || null,
      estimated_cost: data.estimated_cost ? parseFloat(data.estimated_cost) : null,
      quantity: Number(data.quantity)
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {requisition ? 'Mettre à jour la demande d\'achat' : 'Préparer une demande d\'achat'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
            Le magasinier suit uniquement les quantités disponibles. La demande d'achat est consolidée et validée
            par l'équipe stock après planification, puis transmise aux achats selon le workflow établi.
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Référent stock / préparateur *</Label>
              <Input
                {...register('requester_name', { required: true })}
                placeholder="Nom du responsable ayant consolidé le besoin"
              />
            </div>
            <div className="space-y-2">
              <Label>Site *</Label>
              <Select value={watch('site')} onValueChange={(v) => setValue('site', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner le site..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="usine-principale">Usine Principale</SelectItem>
                  <SelectItem value="depot-nord">Dépôt Nord</SelectItem>
                  <SelectItem value="depot-sud">Dépôt Sud</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Date souhaitée *</Label>
              <Input type="date" {...register('desired_date', { required: true })} />
            </div>
            <div className="space-y-2">
              <Label>Département concerné</Label>
              <Select value={watch('department')} onValueChange={(v) => setValue('department', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="production">Production</SelectItem>
                  <SelectItem value="stock">Stock</SelectItem>
                  <SelectItem value="qualite">Qualité</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                  <SelectItem value="logistique">Logistique</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Matière / Article</Label>
              <Select value={watch('material_id')} onValueChange={(v) => setValue('material_id', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un article..." />
                </SelectTrigger>
                <SelectContent>
                  {materials.map(m => (
                    <SelectItem key={m.id} value={m.id}>{m.code} - {m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Description article *</Label>
              <Input {...register('material_name', { required: true })} placeholder="Nom ou description" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Quantité *</Label>
              <Input type="number" step="0.01" {...register('quantity', { required: true, min: 0.01 })} />
            </div>
            <div className="space-y-2">
              <Label>Unité</Label>
              <Select value={watch('unit')} onValueChange={(v) => setValue('unit', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="kg">kg</SelectItem>
                  <SelectItem value="unité">unité</SelectItem>
                  <SelectItem value="palette">palette</SelectItem>
                  <SelectItem value="caisse">caisse</SelectItem>
                  <SelectItem value="litre">litre</SelectItem>
                  <SelectItem value="m">mètre</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Urgence</Label>
              <Select value={watch('urgency')} onValueChange={(v) => setValue('urgency', v as UrgencyLevel)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Basse</SelectItem>
                  <SelectItem value="normal">Normale</SelectItem>
                  <SelectItem value="high">Haute</SelectItem>
                  <SelectItem value="critical">Critique</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Fournisseur préféré</Label>
              <Select value={watch('preferred_supplier_id')} onValueChange={(v) => setValue('preferred_supplier_id', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Optionnel..." />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.filter(s => s.is_active).map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Coût estimé (TND)</Label>
              <Input type="number" step="0.01" {...register('estimated_cost')} placeholder="Optionnel" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Justification du besoin</Label>
            <Textarea
              {...register('justification')}
              placeholder="Contexte de planification, niveau de stock, consommation prévue..."
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea {...register('notes')} placeholder="Notes supplémentaires..." rows={2} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Enregistrement...' : requisition ? 'Mettre à jour' : 'Créer la DA'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
