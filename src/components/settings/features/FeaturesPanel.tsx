import { useEffect, useState } from 'react';
import { useUpdateSiteSettings } from '@/hooks/useSettings';
import type { SiteSettings, SiteFeatures } from '@/types/settings';
import { FEATURE_META } from '@/types/settings';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface Props {
  settings: SiteSettings;
}

export function FeaturesPanel({ settings }: Props) {
  const update = useUpdateSiteSettings();
  const [features, setFeatures] = useState<SiteFeatures>({ ...settings.features });

  useEffect(() => {
    setFeatures({ ...settings.features });
  }, [settings.features]);

  const toggle = (key: keyof SiteFeatures) => {
    setFeatures(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    await update.mutateAsync({ features });
    toast.success('Modules mis à jour');
  };

  const enabledCount = Object.values(features).filter(Boolean).length;
  const totalCount = Object.keys(features).length;

  return (
    <div className="space-y-4 max-w-2xl">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Modules actifs</CardTitle>
            <Badge variant="outline" className="text-xs">
              {enabledCount}/{totalCount} activés
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="divide-y">
          {(Object.entries(FEATURE_META) as [keyof SiteFeatures, typeof FEATURE_META[keyof SiteFeatures]][]).map(([key, meta]) => (
            <div key={key} className="flex items-center justify-between py-4 first:pt-0 last:pb-0">
              <div className="space-y-0.5 pr-4">
                <Label className="text-sm font-medium cursor-pointer" htmlFor={key} onClick={() => toggle(key)}>
                  {meta.label}
                </Label>
                <p className="text-xs text-muted-foreground">{meta.description}</p>
                <Badge variant="secondary" className="text-[11px] h-4 mt-1">tab: {meta.tab}</Badge>
              </div>
              <Switch
                id={key}
                checked={features[key]}
                onCheckedChange={() => toggle(key)}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
        La désactivation d'un module masque l'onglet dans la navigation pour tous les utilisateurs. Les données existantes sont conservées.
      </div>

      <Button onClick={handleSave} disabled={update.isPending}>
        {update.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        Enregistrer les modules
      </Button>
    </div>
  );
}
