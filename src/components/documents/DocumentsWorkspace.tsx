import { useState } from 'react';
import { ArrowLeft, BookOpen, FileInput, FileOutput, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { BonReceptionAchatDashboard } from '@/components/bon-reception-achat/BonReceptionAchatDashboard';
import { BonExpeditionDashboard } from '@/components/bon-expedition/BonExpeditionDashboard';
import { FicheTechniqueSheet } from '@/components/fiches/FicheTechniqueSheet';
import { getFicheById, type FicheTechnique } from '@/lib/fichesTechniques';
import type { AppNavigateFn } from '@/lib/appNavigate';

export type DocumentKind = 'bra' | 'bde';

const DOC_META: Record<
  DocumentKind,
  {
    code: string;
    title: string;
    subtitle: string;
    howTo: string;
    createLabel: string;
    accent: string;
    Icon: typeof FileInput;
  }
> = {
  bra: {
    code: 'BRA',
    title: 'Bon de Réception Achat',
    subtitle: 'Document d’entrée — quand un camion fournisseur arrive.',
    howTo: '1) Créer le bon · 2) Remplir poids / lots · 3) Valider · 4) Imprimer pour le fournisseur',
    createLabel: 'Créer un BRA',
    accent: 'border-amber-200 bg-amber-50/80',
    Icon: FileInput,
  },
  bde: {
    code: 'BDE',
    title: 'Bon d’Expédition',
    subtitle: 'Document de sortie — quand la marchandise quitte l’usine.',
    howTo: '1) Créer le bon · 2) Lier commande / lots · 3) Valider · 4) Imprimer pour le transporteur',
    createLabel: 'Créer un BDE',
    accent: 'border-sky-200 bg-sky-50/80',
    Icon: FileOutput,
  },
};

interface DocumentsWorkspaceProps {
  kind: DocumentKind;
  canBra?: boolean;
  canBde?: boolean;
  autoOpenCreate?: boolean;
  onNavigate: AppNavigateFn;
}

export function DocumentsWorkspace({
  kind,
  canBra = true,
  canBde = true,
  autoOpenCreate = false,
  onNavigate,
}: DocumentsWorkspaceProps) {
  const meta = DOC_META[kind];
  const Icon = meta.Icon;
  const [createNonce, setCreateNonce] = useState(() => (autoOpenCreate ? 1 : 0));
  const [ficheOpen, setFicheOpen] = useState(false);
  const fiche = getFicheById(kind === 'bra' ? 'FT-BRA' : 'FT-BDE') as FicheTechnique;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="gap-1.5"
          onClick={() => onNavigate('home')}
        >
          <ArrowLeft className="h-4 w-4" />
          Parcours lot
        </Button>
        {(canBra || canBde) && (
          <div className="ml-auto flex rounded-xl border bg-muted/40 p-1">
            {canBra && (
              <button
                type="button"
                onClick={() => onNavigate('receptions', { view: 'bra' })}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                  kind === 'bra' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                BRA · Entrée
              </button>
            )}
            {canBde && (
              <button
                type="button"
                onClick={() => onNavigate('logistics', { view: 'bde' })}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                  kind === 'bde' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                BDE · Sortie
              </button>
            )}
          </div>
        )}
      </div>

      <header className={cn('rounded-lg border px-5 py-5 sm:px-6', meta.accent)}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-background/80">
                <Icon className="h-5 w-5" />
              </span>
              <p className="text-xs font-semibold text-muted-foreground">
                Document {meta.code}
              </p>
            </div>
            <h1 className="text-2xl font-bold sm:text-2xl">{meta.title}</h1>
            <p className="max-w-xl text-sm text-muted-foreground">{meta.subtitle}</p>
            <p className="max-w-2xl text-xs text-muted-foreground/90">{meta.howTo}</p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <Button type="button" size="lg" className="gap-2" onClick={() => setCreateNonce((n) => n + 1)}>
              <Plus className="h-4 w-4" />
              {meta.createLabel}
            </Button>
            <Button type="button" size="lg" variant="outline" className="gap-2" onClick={() => setFicheOpen(true)}>
              <BookOpen className="h-4 w-4" />
              Fiche technique
            </Button>
          </div>
        </div>
      </header>

      {kind === 'bra' ? (
        <BonReceptionAchatDashboard createNonce={createNonce} autoOpenCreate={autoOpenCreate} />
      ) : (
        <BonExpeditionDashboard createNonce={createNonce} autoOpenCreate={autoOpenCreate} />
      )}

      <FicheTechniqueSheet
        fiche={fiche}
        open={ficheOpen}
        onOpenChange={setFicheOpen}
        onNavigate={onNavigate}
      />
    </div>
  );
}
