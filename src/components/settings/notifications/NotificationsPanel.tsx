import { useEffect, useState } from 'react';
import { useUpdateSiteSettings } from '@/hooks/useSettings';
import type { SiteSettings } from '@/types/settings';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface Props {
  settings: SiteSettings;
}

export function NotificationsPanel({ settings }: Props) {
  const update = useUpdateSiteSettings();
  const [form, setForm] = useState({ ...settings.notifications });

  useEffect(() => {
    setForm({ ...settings.notifications });
  }, [settings]);

  const setField = (key: keyof typeof form, value: string | number | boolean) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    await update.mutateAsync({
      notifications: {
        ...form,
        expiry_alert_days: Number(form.expiry_alert_days || 0),
        escalation_after_minutes: Number(form.escalation_after_minutes || 0),
      },
    });
    toast.success('Paramètres alertes mis à jour');
  };

  return (
    <div className="max-w-3xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Canaux & digest</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3">
          <label className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
            Notifications navigateur
            <Switch checked={form.browser_notifications_enabled} onCheckedChange={(checked) => setField('browser_notifications_enabled', checked)} />
          </label>
          <label className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
            Notifications email
            <Switch checked={form.email_notifications_enabled} onCheckedChange={(checked) => setField('email_notifications_enabled', checked)} />
          </label>
          <label className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
            Digest quotidien
            <Switch checked={form.daily_digest_enabled} onCheckedChange={(checked) => setField('daily_digest_enabled', checked)} />
          </label>
          <div className="space-y-1.5 rounded-lg border px-3 py-2">
            <Label className="text-xs">Heure du digest</Label>
            <Input type="time" value={form.digest_hour} onChange={(e) => setField('digest_hour', e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Règles d’alerte</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
              Stock bas
              <Switch checked={form.low_stock_alert_enabled} onCheckedChange={(checked) => setField('low_stock_alert_enabled', checked)} />
            </label>
            <label className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
              Péremption
              <Switch checked={form.expiry_alert_enabled} onCheckedChange={(checked) => setField('expiry_alert_enabled', checked)} />
            </label>
            <label className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
              Qualité / QC
              <Switch checked={form.qc_alert_enabled} onCheckedChange={(checked) => setField('qc_alert_enabled', checked)} />
            </label>
            <label className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
              Retards production
              <Switch checked={form.production_delay_alert_enabled} onCheckedChange={(checked) => setField('production_delay_alert_enabled', checked)} />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Alerte péremption avant (jours)</Label>
              <Input type="number" min={1} value={form.expiry_alert_days} onChange={(e) => setField('expiry_alert_days', Number(e.target.value || 1))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Escalade après (minutes)</Label>
              <Input type="number" min={1} value={form.escalation_after_minutes} onChange={(e) => setField('escalation_after_minutes', Number(e.target.value || 1))} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={update.isPending}>
        {update.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Enregistrer les notifications
      </Button>
    </div>
  );
}
