import { useEffect, useState } from 'react';
import { useUpdateSiteSettings } from '@/hooks/useSettings';
import type { SiteSettings } from '@/types/settings';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

const LANGUAGES = [
  { value: 'fr', label: 'Français' },
  { value: 'en', label: 'English' },
  { value: 'ar', label: 'العربية' },
];

const CURRENCIES = ['TND', 'EUR', 'USD', 'MAD', 'DZD', 'SAR', 'AED'];

const TIMEZONES = [
  'Africa/Tunis',
  'Africa/Casablanca',
  'Africa/Algiers',
  'Europe/Paris',
  'Asia/Riyadh',
  'Asia/Dubai',
  'UTC',
];

interface Props {
  settings: SiteSettings;
}

export function PlantInfoPanel({ settings }: Props) {
  const update = useUpdateSiteSettings();
  const [form, setForm] = useState({
    company_legal_name: settings.company_legal_name ?? '',
    site_code: settings.site_code,
    country_code: settings.country_code,
    plant_name: settings.plant_name,
    plant_address: settings.plant_address ?? '',
    plant_phone: settings.plant_phone ?? '',
    plant_email: settings.plant_email ?? '',
    default_language: settings.default_language,
    currency: settings.currency,
    timezone: settings.timezone,
  });

  useEffect(() => {
    setForm({
      company_legal_name: settings.company_legal_name ?? '',
      site_code: settings.site_code,
      country_code: settings.country_code,
      plant_name: settings.plant_name,
      plant_address: settings.plant_address ?? '',
      plant_phone: settings.plant_phone ?? '',
      plant_email: settings.plant_email ?? '',
      default_language: settings.default_language,
      currency: settings.currency,
      timezone: settings.timezone,
    });
  }, [settings]);

  const set = (key: string, value: string) => setForm(p => ({ ...p, [key]: value }));

  const handleSave = async () => {
    await update.mutateAsync({
      ...form,
      company_legal_name: form.company_legal_name || null,
      plant_address: form.plant_address || null,
      plant_phone: form.plant_phone || null,
      plant_email: form.plant_email || null,
    });
    toast.success('Infos usine mises à jour');
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <Card>
        <CardHeader><CardTitle className="text-sm">Identification de l'usine</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Raison sociale</Label>
            <Input value={form.company_legal_name} onChange={(e) => set('company_legal_name', e.target.value)} placeholder="Royal Palm Dates SARL" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Code site</Label>
              <Input value={form.site_code} onChange={(e) => set('site_code', e.target.value)} placeholder="RP-TOZ" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Code pays</Label>
              <Input value={form.country_code} onChange={(e) => set('country_code', e.target.value.toUpperCase())} placeholder="TN" maxLength={2} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Nom de l'usine / site</Label>
            <Input value={form.plant_name} onChange={(e) => set('plant_name', e.target.value)} placeholder="Usine Tozeur" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Adresse</Label>
            <Input value={form.plant_address} onChange={(e) => set('plant_address', e.target.value)} placeholder="Zone Industrielle, Tozeur 2200" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Téléphone</Label>
              <Input value={form.plant_phone} onChange={(e) => set('plant_phone', e.target.value)} placeholder="+216 76 000 000" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Email</Label>
              <Input type="email" value={form.plant_email} onChange={(e) => set('plant_email', e.target.value)} placeholder="usine@royalpalm.tn" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Localisation & format</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Langue par défaut</Label>
              <Select value={form.default_language} onValueChange={(v) => set('default_language', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map(l => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Devise</Label>
              <Select value={form.currency} onValueChange={(v) => set('currency', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Fuseau horaire</Label>
              <Select value={form.timezone} onValueChange={(v) => set('timezone', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map(tz => <SelectItem key={tz} value={tz}>{tz}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={update.isPending}>
        {update.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        Enregistrer les infos usine
      </Button>
    </div>
  );
}
