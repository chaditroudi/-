import { useEffect, useMemo, useState } from 'react';
import { useUpdateSiteSettings } from '@/hooks/useSettings';
import type { SiteSettings } from '@/types/settings';
import {
  FICHES_TECHNIQUES,
  type FicheId,
  type FicheOverride,
  type FicheOverridesMap,
  type FicheTechnique,
} from '@/lib/fichesTechniques';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Loader2, RotateCcw, Save } from 'lucide-react';

interface Props {
  settings: SiteSettings;
}

function linesToList(text: string): string[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

function limitsToText(limits: { label: string; value: string }[]): string {
  return limits.map((l) => `${l.label} | ${l.value}`).join('\n');
}

function textToLimits(text: string): { label: string; value: string }[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const [label, ...rest] = line.split('|');
      return { label: (label || '').trim(), value: rest.join('|').trim() || '—' };
    })
    .filter((l) => l.label);
}

export function FichesCmsPanel({ settings }: Props) {
  const update = useUpdateSiteSettings();
  const [selectedId, setSelectedId] = useState<FicheId>(FICHES_TECHNIQUES[0].id);
  const [overrides, setOverrides] = useState<FicheOverridesMap>({ ...(settings.fiche_overrides || {}) });

  useEffect(() => {
    setOverrides({ ...(settings.fiche_overrides || {}) });
  }, [settings.fiche_overrides]);

  const base = useMemo(
    () => FICHES_TECHNIQUES.find((f) => f.id === selectedId) as FicheTechnique,
    [selectedId],
  );

  const draft: Required<Pick<FicheOverride, 'title' | 'purpose' | 'poste' | 'durationMin' | 'ifBlocked'>> & {
    toolsText: string;
    stepsText: string;
    limitsText: string;
    documentsText: string;
  } = useMemo(() => {
    const o = overrides[selectedId] || {};
    return {
      title: o.title ?? base.title,
      purpose: o.purpose ?? base.purpose,
      poste: o.poste ?? base.poste,
      durationMin: o.durationMin ?? base.durationMin,
      ifBlocked: o.ifBlocked ?? base.ifBlocked,
      toolsText: (o.tools ?? base.tools).join('\n'),
      stepsText: (o.steps ?? base.steps).join('\n'),
      limitsText: limitsToText(o.criticalLimits ?? base.criticalLimits),
      documentsText: (o.documents ?? base.documents).join('\n'),
    };
  }, [overrides, selectedId, base]);

  const [form, setForm] = useState(draft);
  useEffect(() => {
    setForm(draft);
  }, [draft]);

  const hasOverride = Boolean(overrides[selectedId]);

  const buildOverrideFromForm = (): FicheOverride => ({
    title: form.title.trim(),
    purpose: form.purpose.trim(),
    poste: form.poste.trim(),
    durationMin: Number(form.durationMin) || base.durationMin,
    ifBlocked: form.ifBlocked.trim(),
    tools: linesToList(form.toolsText),
    steps: linesToList(form.stepsText),
    criticalLimits: textToLimits(form.limitsText),
    documents: linesToList(form.documentsText),
  });

  const handleSave = async () => {
    const next: FicheOverridesMap = {
      ...overrides,
      [selectedId]: buildOverrideFromForm(),
    };
    await update.mutateAsync({ fiche_overrides: next });
    setOverrides(next);
    toast.success(`Fiche ${base.code} enregistrée pour le site`);
  };

  const handleReset = async () => {
    const next = { ...overrides };
    delete next[selectedId];
    await update.mutateAsync({ fiche_overrides: next });
    setOverrides(next);
    toast.success(`Fiche ${base.code} rétablie au pack standard`);
  };

  return (
    <div className="space-y-4">
      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle className="text-base">Fiches techniques — CMS site</CardTitle>
          <CardDescription>
            Adaptez les consignes (limites °C, tolérances, escalades) à votre usine. Les employés voient
            immédiatement la version site sur Parcours.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {FICHES_TECHNIQUES.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setSelectedId(f.id)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  selectedId === f.id
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'hover:bg-muted/50'
                }`}
              >
                {f.code}
                {overrides[f.id] ? ' •' : ''}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="font-mono">
              {base.code}
            </Badge>
            {hasOverride ? (
              <Badge className="bg-amber-600">Personnalisée</Badge>
            ) : (
              <Badge variant="secondary">Pack standard</Badge>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Titre</Label>
              <Input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Poste</Label>
              <Input value={form.poste} onChange={(e) => setForm((p) => ({ ...p, poste: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Durée (min)</Label>
              <Input
                type="number"
                min={1}
                value={form.durationMin}
                onChange={(e) => setForm((p) => ({ ...p, durationMin: Number(e.target.value) }))}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Objectif</Label>
              <Textarea
                rows={2}
                value={form.purpose}
                onChange={(e) => setForm((p) => ({ ...p, purpose: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Étapes (une par ligne)</Label>
              <Textarea
                rows={6}
                value={form.stepsText}
                onChange={(e) => setForm((p) => ({ ...p, stepsText: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Limites critiques (format: Libellé | Règle)</Label>
              <Textarea
                rows={4}
                value={form.limitsText}
                onChange={(e) => setForm((p) => ({ ...p, limitsText: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Outils (une par ligne)</Label>
              <Textarea
                rows={4}
                value={form.toolsText}
                onChange={(e) => setForm((p) => ({ ...p, toolsText: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Documents (une par ligne)</Label>
              <Textarea
                rows={4}
                value={form.documentsText}
                onChange={(e) => setForm((p) => ({ ...p, documentsText: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Si bloqué</Label>
              <Textarea
                rows={2}
                value={form.ifBlocked}
                onChange={(e) => setForm((p) => ({ ...p, ifBlocked: e.target.value }))}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" className="gap-2" onClick={() => void handleSave()} disabled={update.isPending}>
              {update.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Enregistrer pour le site
            </Button>
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              onClick={() => void handleReset()}
              disabled={update.isPending || !hasOverride}
            >
              <RotateCcw className="h-4 w-4" />
              Rétablir le pack standard
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
