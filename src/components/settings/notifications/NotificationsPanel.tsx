import { useEffect, useState } from 'react';
import { useUpdateSiteSettings } from '@/hooks/useSettings';
import type { SiteSettings } from '@/types/settings';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Loader2, Mail } from 'lucide-react';

interface Props {
  settings: SiteSettings;
}

export function NotificationsPanel({ settings }: Props) {
  const update = useUpdateSiteSettings();
  const [form, setForm] = useState({
    ...settings.notifications,
    supplier_po_email_enabled: settings.notifications.supplier_po_email_enabled ?? true,
  });

  useEffect(() => {
    setForm({
      ...settings.notifications,
      supplier_po_email_enabled: settings.notifications.supplier_po_email_enabled ?? true,
    });
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

      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Mail className="h-4 w-4 text-primary" />
            Email fournisseur (achat)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-xs leading-relaxed text-muted-foreground">
            Quand un bon de commande est envoyé, le fournisseur reçoit un email aux couleurs de
            cette usine (<strong>{settings.company_name}</strong>
            {settings.plant_name ? ` · ${settings.plant_name}` : ""}). Produit standard multi-usine
            — configurez le branding dans Paramètres (Royale Palm, EcoDatte, Bioscha, …).
          </p>
          <label className="flex items-center justify-between rounded-lg border px-3 py-2">
            Email BC au fournisseur
            <Switch
              checked={Boolean(form.supplier_po_email_enabled)}
              onCheckedChange={(checked) => setField('supplier_po_email_enabled', checked)}
              disabled={!form.email_notifications_enabled}
            />
          </label>
          {!form.email_notifications_enabled && (
            <p className="text-xs text-amber-700">
              Activez d&apos;abord « Notifications email », puis configurez SMTP sur le serveur
              (<code className="mx-1 rounded bg-muted px-1">SMTP_HOST</code> /
              <code className="rounded bg-muted px-1">SMTP_FROM</code>.
            </p>
          )}
          {!settings.plant_email && (
            <p className="text-xs text-muted-foreground">
              Conseil: renseignez l&apos;email usine (Paramètres → Usine) pour le champ Reply-To.
            </p>
          )}
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
