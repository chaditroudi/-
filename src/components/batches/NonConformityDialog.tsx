import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useCreateNonConformity, useStorageZones, useUpdateBatchStatus } from '@/hooks/useBatches';
import { 
  Batch, 
  NonConformityAction, 
  AlertSeverity,
  QualityGrade,
  nonConformityActionLabels,
  qualityGradeLabels
} from '@/types/batch';
import { AlertTriangle, Undo2, Trash2, RefreshCw, ShieldAlert } from 'lucide-react';

interface NonConformityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  batch: Batch;
}

export const NonConformityDialog = ({ open, onOpenChange, batch }: NonConformityDialogProps) => {
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<AlertSeverity>('warning');
  const [action, setAction] = useState<NonConformityAction>('quarantine');
  const [newGrade, setNewGrade] = useState<string>('');
  const [createdBy, setCreatedBy] = useState('');

  const createNC = useCreateNonConformity();
  const { data: zones = [] } = useStorageZones();
  const updateStatus = useUpdateBatchStatus();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    createNC.mutate({
      batch_id: batch.id,
      reason,
      description: description || undefined,
      severity,
      action_taken: action,
      created_by: createdBy || undefined,
      original_grade: batch.quality_grade || undefined,
      new_grade: newGrade ? newGrade as QualityGrade : undefined
    }, {
      onSuccess: () => {
        // If quarantine, move to quarantine zone
        if (action === 'quarantine') {
          const quarantineZone = zones.find(z => z.zone_type === 'quarantine');
          if (quarantineZone) {
            updateStatus.mutate({
              id: batch.id,
              status: 'quarantine',
              storage_zone_id: quarantineZone.id,
              performed_by: createdBy
            });
          }
        }
        onOpenChange(false);
      }
    });
  };

  const actionIcons: Record<NonConformityAction, React.ReactNode> = {
    return_to_supplier: <Undo2 className="h-4 w-4" />,
    destruction: <Trash2 className="h-4 w-4" />,
    reclassification: <RefreshCw className="h-4 w-4" />,
    quarantine: <ShieldAlert className="h-4 w-4" />
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Non-Conformité - {batch.batch_number}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="reason">Motif de non-conformité *</Label>
            <Input
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex: Contamination moisissure >5%"
              required
            />
          </div>

          <div>
            <Label htmlFor="description">Description détaillée</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Détails de la non-conformité..."
              rows={3}
            />
          </div>

          <div>
            <Label>Gravité</Label>
            <RadioGroup 
              value={severity} 
              onValueChange={(val) => setSeverity(val as AlertSeverity)}
              className="flex gap-4 mt-2"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="info" id="info" />
                <Label htmlFor="info" className="text-blue-600">Info</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="warning" id="warning" />
                <Label htmlFor="warning" className="text-yellow-600">Attention</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="critical" id="critical" />
                <Label htmlFor="critical" className="text-red-600">Critique</Label>
              </div>
            </RadioGroup>
          </div>

          <div>
            <Label>Action à prendre *</Label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {(Object.keys(nonConformityActionLabels) as NonConformityAction[]).map((act) => (
                <Button
                  key={act}
                  type="button"
                  variant={action === act ? 'default' : 'outline'}
                  className="justify-start"
                  onClick={() => setAction(act)}
                >
                  {actionIcons[act]}
                  <span className="ml-2">{nonConformityActionLabels[act]}</span>
                </Button>
              ))}
            </div>
          </div>

          {action === 'reclassification' && (
            <div>
              <Label>Nouveau grade</Label>
              <Select value={newGrade} onValueChange={setNewGrade}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner le nouveau grade" />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(qualityGradeLabels) as QualityGrade[])
                    .filter(g => g !== batch.quality_grade && g !== 'rejected')
                    .map((grade) => (
                      <SelectItem key={grade} value={grade}>
                        {qualityGradeLabels[grade]}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label htmlFor="createdBy">Déclaré par</Label>
            <Input
              id="createdBy"
              value={createdBy}
              onChange={(e) => setCreatedBy(e.target.value)}
              placeholder="Nom de l'opérateur"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button 
              type="submit" 
              disabled={createNC.isPending}
              variant="destructive"
            >
              {createNC.isPending ? 'Enregistrement...' : 'Déclarer la NC'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
