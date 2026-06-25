import { useEffect, useRef, useState } from 'react';
import { useUpdateSiteSettings } from '@/hooks/useSettings';
import type { SiteSettings } from '@/types/settings';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, Upload, X } from 'lucide-react';

interface Props {
  settings: SiteSettings;
}

export function BrandingPanel({ settings }: Props) {
  const update = useUpdateSiteSettings();
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    company_name: settings.company_name,
    company_short_name: settings.company_short_name,
    logo_url: settings.logo_url ?? '',
    primary_color: settings.primary_color,
    accent_color: settings.accent_color,
  });
  const [logoBase64, setLogoBase64] = useState<string | null>(settings.logo_base64);

  useEffect(() => {
    setForm({
      company_name: settings.company_name,
      company_short_name: settings.company_short_name,
      logo_url: settings.logo_url ?? '',
      primary_color: settings.primary_color,
      accent_color: settings.accent_color,
    });
    setLogoBase64(settings.logo_base64);
  }, [settings]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500 * 1024) {
      toast.error('Logo trop grand — max 500 KB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setLogoBase64(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    await update.mutateAsync({
      ...form,
      logo_url: form.logo_url || null,
      logo_base64: logoBase64,
    });
    toast.success('Marque mise à jour');
  };

  const logoSrc = logoBase64 || form.logo_url || null;

  return (
    <div className="space-y-6 max-w-2xl">
      <Card>
        <CardHeader><CardTitle className="text-sm">Identité visuelle</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Nom complet</Label>
              <Input value={form.company_name} onChange={(e) => setForm(p => ({ ...p, company_name: e.target.value }))} placeholder="Royal Palm Dates" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Abréviation</Label>
              <Input value={form.company_short_name} onChange={(e) => setForm(p => ({ ...p, company_short_name: e.target.value }))} placeholder="RP" maxLength={6} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Logo — URL externe</Label>
            <Input value={form.logo_url} onChange={(e) => setForm(p => ({ ...p, logo_url: e.target.value }))} placeholder="https://..." />
          </div>

          <div className="flex items-center gap-3">
            <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              <Upload className="h-3.5 w-3.5 mr-1.5" />
              Uploader un logo
            </Button>
            {logoBase64 && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setLogoBase64(null)}>
                <X className="h-3.5 w-3.5 mr-1" />
                Supprimer
              </Button>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
          </div>

          {logoSrc && (
            <div className="space-y-2">
              <div className="border rounded-lg p-3 bg-muted/30 inline-flex">
                <img src={logoSrc} alt="Logo preview" className="h-16 object-contain" />
              </div>
              <p className="text-xs text-muted-foreground">
                Ce logo sera utilisé dans le header, la sidebar, l’écran de connexion et les vues principales de l’application.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Palette de couleurs</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Couleur principale</Label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={form.primary_color}
                  onChange={(e) => setForm(p => ({ ...p, primary_color: e.target.value }))}
                  className="h-9 w-12 rounded border cursor-pointer p-1"
                />
                <Input
                  value={form.primary_color}
                  onChange={(e) => setForm(p => ({ ...p, primary_color: e.target.value }))}
                  placeholder="#107754"
                  className="font-mono text-sm"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Couleur secondaire</Label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={form.accent_color}
                  onChange={(e) => setForm(p => ({ ...p, accent_color: e.target.value }))}
                  className="h-9 w-12 rounded border cursor-pointer p-1"
                />
                <Input
                  value={form.accent_color}
                  onChange={(e) => setForm(p => ({ ...p, accent_color: e.target.value }))}
                  placeholder="#d97706"
                  className="font-mono text-sm"
                />
              </div>
            </div>
          </div>

          {/* Live preview */}
          <div className="rounded-lg border p-4 space-y-2">
            <div className="text-xs text-muted-foreground mb-2">Aperçu</div>
            <div className="flex gap-2 items-center">
              <div className="h-8 w-8 rounded-lg" style={{ background: form.primary_color }} />
              <div className="h-8 w-8 rounded-lg" style={{ background: form.accent_color }} />
              <div className="h-8 px-4 rounded-lg flex items-center text-white text-xs font-semibold" style={{ background: form.primary_color }}>
                Bouton primaire
              </div>
              <div className="h-8 px-4 rounded-lg flex items-center text-white text-xs font-semibold" style={{ background: form.accent_color }}>
                Bouton accent
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={update.isPending}>
        {update.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        Enregistrer la marque
      </Button>
    </div>
  );
}
