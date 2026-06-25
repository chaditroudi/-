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

export function OperationsPanel({ settings }: Props) {
  const update = useUpdateSiteSettings();
  const [interfaceSettings, setInterfaceSettings] = useState({ ...settings.interface });
  const [operations, setOperations] = useState({ ...settings.operations });

  useEffect(() => {
    setInterfaceSettings({ ...settings.interface });
    setOperations({ ...settings.operations });
  }, [settings]);

  const setInterfaceField = (key: keyof typeof interfaceSettings, value: string | number | boolean) => {
    setInterfaceSettings((prev) => ({ ...prev, [key]: value }));
  };

  const setOperationsField = (key: keyof typeof operations, value: string | boolean) => {
    setOperations((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    await update.mutateAsync({
      interface: {
        ...interfaceSettings,
        rows_per_page: Number(interfaceSettings.rows_per_page || 25),
      },
      operations,
    });
    toast.success('Paramètres exploitation & UX mis à jour');
  };

  return (
    <div className="max-w-3xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Expérience opérateur</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Espace de travail par défaut</Label>
              <Select
                value={interfaceSettings.default_home_tab}
                onValueChange={(value) => setInterfaceField('default_home_tab', value)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="home">Accueil</SelectItem>
                  <SelectItem value="sage-operations">SAGE Hub</SelectItem>
                  <SelectItem value="production">Production</SelectItem>
                  <SelectItem value="receptions">Réceptions</SelectItem>
                  <SelectItem value="analytics">Analytics</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Densité de l’interface</Label>
              <Select
                value={interfaceSettings.ui_density}
                onValueChange={(value) => setInterfaceField('ui_density', value)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="compact">Compacte</SelectItem>
                  <SelectItem value="comfortable">Confort</SelectItem>
                  <SelectItem value="spacious">Aérée</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Lignes par page</Label>
              <Input
                type="number"
                min={10}
                max={200}
                value={interfaceSettings.rows_per_page}
                onChange={(e) => setInterfaceField('rows_per_page', Number(e.target.value || 25))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3 pt-6">
              <label className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                KPI visibles
                <Switch
                  checked={interfaceSettings.show_kpi_cards}
                  onCheckedChange={(checked) => setInterfaceField('show_kpi_cards', checked)}
                />
              </label>
              <label className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                Animations
                <Switch
                  checked={interfaceSettings.enable_animations}
                  onCheckedChange={(checked) => setInterfaceField('enable_animations', checked)}
                />
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Règles d’exploitation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
              Livraison spontanée autorisée
              <Switch
                checked={operations.allow_spontaneous_reception}
                onCheckedChange={(checked) => setOperationsField('allow_spontaneous_reception', checked)}
              />
            </label>
            <label className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
              BC obligatoire à la réception
              <Switch
                checked={operations.require_purchase_order_for_reception}
                onCheckedChange={(checked) => setOperationsField('require_purchase_order_for_reception', checked)}
              />
            </label>
            <label className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
              Immatriculation obligatoire
              <Switch
                checked={operations.require_vehicle_number_on_reception}
                onCheckedChange={(checked) => setOperationsField('require_vehicle_number_on_reception', checked)}
              />
            </label>
            <label className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
              Matière auto-associée depuis BC
              <Switch
                checked={operations.auto_assign_material_from_po}
                onCheckedChange={(checked) => setOperationsField('auto_assign_material_from_po', checked)}
              />
            </label>
            <label className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
              Auto-démarrage étape suivante
              <Switch
                checked={operations.production_auto_start_next_step}
                onCheckedChange={(checked) => setOperationsField('production_auto_start_next_step', checked)}
              />
            </label>
            <label className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
              Scan final requis au conditionnement
              <Switch
                checked={operations.packaging_requires_final_scan}
                onCheckedChange={(checked) => setOperationsField('packaging_requires_final_scan', checked)}
              />
            </label>
            <label className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
              Stock négatif autorisé
              <Switch
                checked={operations.allow_negative_stock}
                onCheckedChange={(checked) => setOperationsField('allow_negative_stock', checked)}
              />
            </label>
            <label className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
              Réservation stock activée
              <Switch
                checked={operations.stock_reservation_enabled}
                onCheckedChange={(checked) => setOperationsField('stock_reservation_enabled', checked)}
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Modèle d’équipe</Label>
              <Select value={operations.shift_model} onValueChange={(value) => setOperationsField('shift_model', value)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1x8">1x8</SelectItem>
                  <SelectItem value="2x8">2x8</SelectItem>
                  <SelectItem value="3x8">3x8</SelectItem>
                  <SelectItem value="custom">Personnalisé</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <label className="mt-6 flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
              Notes de relève obligatoires
              <Switch
                checked={operations.shift_handover_notes_required}
                onCheckedChange={(checked) => setOperationsField('shift_handover_notes_required', checked)}
              />
            </label>
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={update.isPending}>
        {update.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Enregistrer exploitation & UX
      </Button>
    </div>
  );
}
