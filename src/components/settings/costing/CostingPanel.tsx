import { useEffect, useState } from 'react';
import { useUpdateSiteSettings } from '@/hooks/useSettings';
import type { SiteSettings } from '@/types/settings';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface Props {
  settings: SiteSettings;
}

export function CostingPanel({ settings }: Props) {
  const update = useUpdateSiteSettings();
  const [costing, setCosting] = useState({ ...settings.costing });

  useEffect(() => {
    setCosting({ ...settings.costing });
  }, [settings]);

  const setField = (key: keyof typeof costing, value: number) => {
    setCosting((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    await update.mutateAsync({
      costing: {
        labour_rate_tnd_per_hour: Number(costing.labour_rate_tnd_per_hour || 0),
        energy_tariff_tnd_per_kwh: Number(costing.energy_tariff_tnd_per_kwh || 0),
        overhead_tnd_per_kg: Number(costing.overhead_tnd_per_kg || 0),
        target_cost_tnd_per_kg: Number(costing.target_cost_tnd_per_kg || 0),
      },
    });
    toast.success('Tarifs de coût standard mis à jour');
  };

  return (
    <div className="max-w-3xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Coûts standard (Wave B)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Ces tarifs alimentent l&apos;absorption main-d&apos;œuvre / énergie / overhead sur le
            triage et le conditionnement. Ce ne sont pas des coûts réels mesurés — le libellé
            « standard » reste attaché aux écritures.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Main-d&apos;œuvre (TND / h)</Label>
              <Input
                type="number"
                min={0}
                step={0.1}
                value={costing.labour_rate_tnd_per_hour}
                onChange={(e) => setField('labour_rate_tnd_per_hour', Number(e.target.value || 0))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Énergie (TND / kWh)</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={costing.energy_tariff_tnd_per_kwh}
                onChange={(e) => setField('energy_tariff_tnd_per_kwh', Number(e.target.value || 0))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Overhead (TND / kg bon)</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={costing.overhead_tnd_per_kg}
                onChange={(e) => setField('overhead_tnd_per_kg', Number(e.target.value || 0))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Coût cible (TND / kg)</Label>
              <Input
                type="number"
                min={0}
                step={0.1}
                value={costing.target_cost_tnd_per_kg}
                onChange={(e) => setField('target_cost_tnd_per_kg', Number(e.target.value || 0))}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={update.isPending}>
        {update.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Enregistrer les tarifs coût
      </Button>
    </div>
  );
}
