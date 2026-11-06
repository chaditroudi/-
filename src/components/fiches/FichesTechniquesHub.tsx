import { useEffect, useMemo, useState } from 'react';
import { BookOpen, Clock3, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import type { AppNavigateFn } from '@/lib/appNavigate';
import type { AppTab } from '@/lib/roleAccess';
import { useSiteSettings } from '@/hooks/useSettings';
import {
  ficheStageLabel,
  listResolvedFichesForTabs,
  resolveFicheById,
  type FicheId,
  type FicheTechnique,
} from '@/lib/fichesTechniques';
import { FicheTechniqueSheet } from './FicheTechniqueSheet';

interface FichesTechniquesHubProps {
  onNavigate: AppNavigateFn;
  accessibleTabs: AppTab[];
  initialFicheId?: string;
}

export function FichesTechniquesHub({
  onNavigate,
  accessibleTabs,
  initialFicheId,
}: FichesTechniquesHubProps) {
  const { data: settings } = useSiteSettings();
  const overrides = settings?.fiche_overrides;
  const fiches = useMemo(
    () => listResolvedFichesForTabs(accessibleTabs, overrides),
    [accessibleTabs, overrides],
  );
  const [query, setQuery] = useState('');
  const [active, setActive] = useState<FicheTechnique | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!initialFicheId) return;
    const resolved = resolveFicheById(initialFicheId, overrides);
    if (resolved) {
      setActive(resolved);
      setOpen(true);
    }
  }, [initialFicheId, overrides]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return fiches;
    return fiches.filter(
      (f) =>
        f.title.toLowerCase().includes(q) ||
        f.code.toLowerCase().includes(q) ||
        f.poste.toLowerCase().includes(q) ||
        f.purpose.toLowerCase().includes(q),
    );
  }, [fiches, query]);

  const openFiche = (fiche: FicheTechnique) => {
    setActive(resolveFicheById(fiche.id, overrides) || fiche);
    setOpen(true);
  };

  const processFiches = filtered.filter((f) => f.stage);
  const docFiches = filtered.filter((f) => !f.stage);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5">
      <Card className="surface-card overflow-hidden rounded-lg border-primary/20">
        <CardHeader className="space-y-3 border-b bg-muted/20 pb-4">
          <div>
            <p className="text-xs font-semibold text-muted-foreground/70">
              Aide atelier
            </p>
            <CardTitle className="mt-1 flex items-center gap-2 text-xl">
              <BookOpen className="h-5 w-5 text-primary" />
              Fiches techniques A→Z
            </CardTitle>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Une fiche courte par poste — étapes, limites critiques, documents. Cochez au fur et à mesure.
            </p>
          </div>
          <div className="relative max-w-md">
            <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="ps-9"
              placeholder="Chercher une fiche (QC, fumigation, BRA…)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-5">
          <section className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground">
              Parcours lot (1 → 8)
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {processFiches.map((fiche, index) => (
                <FicheCard
                  key={fiche.id}
                  fiche={fiche}
                  index={index + 1}
                  onOpen={() => openFiche(fiche)}
                />
              ))}
              {processFiches.length === 0 && (
                <p className="text-sm text-muted-foreground sm:col-span-2">
                  Aucune fiche processus pour votre profil.
                </p>
              )}
            </div>
          </section>

          {docFiches.length > 0 && (
            <section className="space-y-3">
              <p className="text-xs font-semibold text-muted-foreground">
                Documents (BRA / BDE)
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {docFiches.map((fiche) => (
                  <FicheCard key={fiche.id} fiche={fiche} onOpen={() => openFiche(fiche)} />
                ))}
              </div>
            </section>
          )}

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => onNavigate('home')}>
              Retour Parcours
            </Button>
            {(accessibleTabs.includes('receptions') || accessibleTabs.includes('logistics')) && (
              <Button
                type="button"
                variant="secondary"
                onClick={() =>
                  openFiche(
                    resolveFicheById(
                      (accessibleTabs.includes('receptions') ? 'FT-BRA' : 'FT-BDE') as FicheId,
                      overrides,
                    )!,
                  )
                }
              >
                Aide documents
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <FicheTechniqueSheet
        fiche={active}
        open={open}
        onOpenChange={setOpen}
        onNavigate={onNavigate}
      />
    </div>
  );
}

function FicheCard({
  fiche,
  index,
  onOpen,
}: {
  fiche: FicheTechnique;
  index?: number;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="rounded-2xl border bg-card p-4 text-start transition-colors hover:border-primary/40 hover:bg-muted/20"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {index != null && (
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
              {index}
            </span>
          )}
          <Badge variant="outline" className="font-mono text-xs">
            {fiche.code}
          </Badge>
          <Badge variant="secondary" className="text-xs">
            {ficheStageLabel(fiche)}
          </Badge>
        </div>
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Clock3 className="h-3 w-3" /> {fiche.durationMin} min
        </span>
      </div>
      <p className="mt-2 text-sm font-semibold">{fiche.title}</p>
      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{fiche.purpose}</p>
      <p className="mt-2 text-xs font-medium text-primary">Ouvrir la fiche →</p>
    </button>
  );
}
