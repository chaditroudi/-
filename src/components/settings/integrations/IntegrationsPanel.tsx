import { useEffect, useState } from 'react';
import { useUpdateSiteSettings } from '@/hooks/useSettings';
import type { SiteSettings } from '@/types/settings';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface Props {
  settings: SiteSettings;
}

export function IntegrationsPanel({ settings }: Props) {
  const update = useUpdateSiteSettings();
  const [integrations, setIntegrations] = useState({ ...settings.integrations });

  useEffect(() => {
    setIntegrations({ ...settings.integrations });
  }, [settings]);

  const setField = (key: keyof typeof integrations, value: string | boolean | number | null) => {
    setIntegrations((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    await update.mutateAsync({ integrations });
    toast.success('Paramètres intégrations & IA mis à jour');
  };

  return (
    <div className="max-w-3xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Matériel & capture</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3">
          <label className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
            Capture balance active
            <Switch checked={integrations.scale_capture_enabled} onCheckedChange={(checked) => setField('scale_capture_enabled', checked)} />
          </label>
          <label className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
            Scanner code-barres
            <Switch checked={integrations.barcode_scanner_enabled} onCheckedChange={(checked) => setField('barcode_scanner_enabled', checked)} />
          </label>
          <label className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
            Imprimante étiquettes
            <Switch checked={integrations.label_printer_enabled} onCheckedChange={(checked) => setField('label_printer_enabled', checked)} />
          </label>
          <label className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
            QR labels activés
            <Switch checked={integrations.qr_labels_enabled} onCheckedChange={(checked) => setField('qr_labels_enabled', checked)} />
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Synchronisation & IA</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs">Mode de synchronisation ERP</label>
            <Select value={integrations.erp_sync_mode} onValueChange={(value) => setField('erp_sync_mode', value)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="disabled">Désactivé</SelectItem>
                <SelectItem value="manual">Manuel</SelectItem>
                <SelectItem value="scheduled">Planifié</SelectItem>
                <SelectItem value="near_real_time">Quasi temps réel</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
              Sync maintenance active
              <Switch checked={integrations.maintenance_sync_enabled} onCheckedChange={(checked) => setField('maintenance_sync_enabled', checked)} />
            </label>
            <label className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
              Assistant IA actif
              <Switch checked={integrations.ai_assistant_enabled} onCheckedChange={(checked) => setField('ai_assistant_enabled', checked)} />
            </label>
            <label className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
              Vision IA triage
              <Switch checked={integrations.ai_vision_sorting_enabled} onCheckedChange={(checked) => setField('ai_vision_sorting_enabled', checked)} />
            </label>
            <label className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
              Webhooks API actifs
              <Switch checked={integrations.api_webhooks_enabled} onCheckedChange={(checked) => setField('api_webhooks_enabled', checked)} />
            </label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Transport & cartographie</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
            Tracking transport actif
            <Switch checked={integrations.transport_tracking_enabled} onCheckedChange={(checked) => setField('transport_tracking_enabled', checked)} />
          </label>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs">Clé Google Maps</label>
              <Input
                value={integrations.google_maps_api_key ?? ''}
                onChange={(event) => setField('google_maps_api_key', event.target.value || null)}
                placeholder="AIza..."
              />
              <p className="text-xs text-muted-foreground">
                Facultatif. Si vide, la carte utilise l’embed Google Maps simple avec coordonnées/destination.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs">Zoom carte par défaut</label>
              <Input
                type="number"
                min={3}
                max={18}
                value={integrations.maps_default_zoom}
                onChange={(event) => setField('maps_default_zoom', Number(event.target.value || 10))}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs">Fréquence refresh tracking (sec)</label>
              <Input
                type="number"
                min={5}
                max={300}
                value={integrations.tracking_refresh_seconds}
                onChange={(event) => setField('tracking_refresh_seconds', Number(event.target.value || 30))}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs">Alerte ETA en retard (min)</label>
              <Input
                type="number"
                min={0}
                max={240}
                value={integrations.mission_eta_alert_minutes}
                onChange={(event) => setField('mission_eta_alert_minutes', Number(event.target.value || 0))}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={update.isPending}>
        {update.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Enregistrer intégrations & IA
      </Button>
    </div>
  );
}
