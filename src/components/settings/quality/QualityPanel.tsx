import { useEffect, useState } from 'react';
import { useUpdateSiteSettings } from '@/hooks/useSettings';
import type { SiteSettings } from '@/types/settings';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface Props {
  settings: SiteSettings;
}

export function QualityPanel({ settings }: Props) {
  const update = useUpdateSiteSettings();
  const [quality, setQuality] = useState({ ...settings.quality });

  useEffect(() => {
    setQuality({ ...settings.quality });
  }, [settings]);

  const setField = (key: keyof typeof quality, value: string | number | boolean) => {
    setQuality((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    await update.mutateAsync({
      quality: {
        ...quality,
        default_qc_sample_percent: Number(quality.default_qc_sample_percent || 0),
        deviation_escalation_hours: Number(quality.deviation_escalation_hours || 0),
        recall_coordinator: quality.recall_coordinator || null,
      },
    });
    toast.success('Paramètres qualité & traçabilité mis à jour');
  };

  return (
    <div className="max-w-3xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Traçabilité & libération</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3">
          <label className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
            Blocage QC à la réception
            <Switch
              checked={quality.qc_hold_on_reception}
              onCheckedChange={(checked) => setField('qc_hold_on_reception', checked)}
            />
          </label>
          <label className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
            Lot fournisseur obligatoire
            <Switch
              checked={quality.supplier_lot_required}
              onCheckedChange={(checked) => setField('supplier_lot_required', checked)}
            />
          </label>
          <label className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
            Origine obligatoire
            <Switch
              checked={quality.origin_tracking_required}
              onCheckedChange={(checked) => setField('origin_tracking_required', checked)}
            />
          </label>
          <label className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
            Libération lot après QC
            <Switch
              checked={quality.lot_release_requires_qc}
              onCheckedChange={(checked) => setField('lot_release_requires_qc', checked)}
            />
          </label>
          <label className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
            Suivi allergènes
            <Switch
              checked={quality.allergen_tracking_enabled}
              onCheckedChange={(checked) => setField('allergen_tracking_enabled', checked)}
            />
          </label>
          <label className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
            Monitoring chaîne du froid
            <Switch
              checked={quality.cold_chain_monitoring_enabled}
              onCheckedChange={(checked) => setField('cold_chain_monitoring_enabled', checked)}
            />
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Règles qualité</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Suivi DLC / DDM</Label>
            <Select value={quality.expiry_tracking_mode} onValueChange={(value) => setField('expiry_tracking_mode', value)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="optional">Optionnel</SelectItem>
                <SelectItem value="recommended">Recommandé</SelectItem>
                <SelectItem value="required">Obligatoire</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Échantillonnage QC (%)</Label>
            <Input
              type="number"
              min={0}
              max={100}
              value={quality.default_qc_sample_percent}
              onChange={(e) => setField('default_qc_sample_percent', Number(e.target.value || 0))}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Escalade écart après (heures)</Label>
            <Input
              type="number"
              min={1}
              value={quality.deviation_escalation_hours}
              onChange={(e) => setField('deviation_escalation_hours', Number(e.target.value || 1))}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Responsable rappel</Label>
            <Input
              value={quality.recall_coordinator ?? ''}
              onChange={(e) => setField('recall_coordinator', e.target.value)}
              placeholder="Nom, fonction ou email"
            />
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={update.isPending}>
        {update.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Enregistrer qualité & traçabilité
      </Button>
    </div>
  );
}
