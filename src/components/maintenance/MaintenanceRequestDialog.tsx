import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DEPARTMENTS, DEPARTMENT_LABELS } from '@/types/org';
import {
  MAINTENANCE_FINANCE_THRESHOLD,
  MAINTENANCE_PRIORITY_LABELS,
  type MaintenancePriority,
  type MaintenanceRequest,
} from '@/types/maintenance';

export type MaintenanceRequestSaveData = {
  title: string;
  description: string | null;
  equipment_name: string | null;
  department: string | null;
  priority: MaintenancePriority;
  estimated_cost: number | null;
};

interface MaintenanceRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request?: MaintenanceRequest | null;
  defaultDepartment?: string | null;
  onSave: (data: MaintenanceRequestSaveData) => void;
  isLoading?: boolean;
}

const PRIORITIES: MaintenancePriority[] = ['low', 'normal', 'high', 'critical'];

export const MaintenanceRequestDialog = ({
  open,
  onOpenChange,
  request,
  defaultDepartment,
  onSave,
  isLoading,
}: MaintenanceRequestDialogProps) => {
  const [title, setTitle] = useState('');
  const [equipmentName, setEquipmentName] = useState('');
  const [department, setDepartment] = useState<string>('');
  const [priority, setPriority] = useState<MaintenancePriority>('normal');
  const [estimatedCost, setEstimatedCost] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (!open) return;
    setTitle(request?.title ?? '');
    setEquipmentName(request?.equipment_name ?? '');
    setDepartment(String(request?.department ?? defaultDepartment ?? ''));
    setPriority((request?.priority as MaintenancePriority) ?? 'normal');
    setEstimatedCost(
      request?.estimated_cost != null ? String(request.estimated_cost) : '',
    );
    setDescription(request?.description ?? '');
  }, [open, request, defaultDepartment]);

  const cost = estimatedCost.trim() ? Number(estimatedCost) : null;
  const financeGate = cost != null && cost >= MAINTENANCE_FINANCE_THRESHOLD;
  const canSubmit = title.trim().length > 0 && department.trim().length > 0;

  const handleSave = () => {
    if (!canSubmit) return;
    onSave({
      title: title.trim(),
      description: description.trim() || null,
      equipment_name: equipmentName.trim() || null,
      department: department || null,
      priority,
      estimated_cost: cost != null && Number.isFinite(cost) ? cost : null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {request ? 'Modifier la demande' : 'Nouvelle demande de maintenance'}
          </DialogTitle>
          <DialogDescription>
            La demande est validée par votre responsable, puis par la Maintenance
            {financeGate ? ' et le DAF (montant élevé).' : '.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="mr-title">Objet *</Label>
            <Input
              id="mr-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Panne convoyeur ligne 2"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="mr-equipment">Équipement</Label>
              <Input
                id="mr-equipment"
                value={equipmentName}
                onChange={(event) => setEquipmentName(event.target.value)}
                placeholder="Convoyeur C-02"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Département demandeur *</Label>
              <Select value={department} onValueChange={setDepartment}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner" />
                </SelectTrigger>
                <SelectContent>
                  {DEPARTMENTS.map((code) => (
                    <SelectItem key={code} value={code}>
                      {DEPARTMENT_LABELS[code]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Priorité</Label>
              <Select value={priority} onValueChange={(value) => setPriority(value as MaintenancePriority)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {MAINTENANCE_PRIORITY_LABELS[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mr-cost">Coût estimé (TND)</Label>
              <Input
                id="mr-cost"
                type="number"
                min={0}
                value={estimatedCost}
                onChange={(event) => setEstimatedCost(event.target.value)}
                placeholder="0"
              />
              {financeGate && (
                <p className="text-xs text-amber-600">
                  ≥ {MAINTENANCE_FINANCE_THRESHOLD} TND — validation DAF requise.
                </p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="mr-desc">Description</Label>
            <Textarea
              id="mr-desc"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Décrivez la panne ou l'intervention nécessaire..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={!canSubmit || isLoading}>
            {request ? 'Enregistrer' : 'Créer et soumettre'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
