import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { trustApi, type GoldenThreadLotState } from '@/lib/api/trust';
import { costingApi } from '@/lib/api/costing';
import { settlementsApi } from '@/lib/api/settlements';
import type { AppNavigateFn } from '@/lib/appNavigate';
import {
  LOT_JOURNEY_STAGES,
  LOT_JOURNEY_STAGE_LABELS,
  journeyStageStatus,
  resolveLotJourneyNextAction,
  type LotJourneyStage,
} from '@/lib/lotJourney';
import type { AppTab } from '@/lib/roleAccess';
import { toast } from 'sonner';
import { printRecallReport } from '@/lib/printRecallReport';
import { printPfLotLabel } from '@/lib/printPfLotLabel';
import { useBranding } from '@/hooks/useBranding';
import {
  ArrowRight,
  BadgeCheck,
  BookOpen,
  ChevronDown,
  ExternalLink,
  FileDown,
  Link2,
  Loader2,
  Printer,
  Search,
  ShieldAlert,
  Tag,
  Truck,
} from 'lucide-react';
import { getFicheForStage, resolveFicheById, resolveFicheForStage, type FicheTechnique } from '@/lib/fichesTechniques';
import { FicheTechniqueSheet } from '@/components/fiches/FicheTechniqueSheet';
import { useSiteSettings } from '@/hooks/useSettings';

interface LotJourneyHubProps {
  onNavigate: AppNavigateFn;
  accessibleTabs: AppTab[];
  /** Hide 8-step grid + finance until asked (default true for clarity). */
  compact?: boolean;
}

export function LotJourneyHub({ onNavigate, accessibleTabs, compact = true }: LotJourneyHubProps) {
  const [query, setQuery] = useState('');
  const [selectedLotId, setSelectedLotId] = useState<string | null>(null);
  const [showStages, setShowStages] = useState(!compact);
  const [ficheOpen, setFicheOpen] = useState(false);
  const [activeFiche, setActiveFiche] = useState<FicheTechnique | null>(null);
  const [recallBusy, setRecallBusy] = useState(false);
  const { data: siteSettings } = useSiteSettings();
  const { companyName } = useBranding();
  const ficheOverrides = siteSettings?.fiche_overrides;

  const openFiche = (fiche: FicheTechnique | null) => {
    if (!fiche) return;
    setActiveFiche(resolveFicheById(fiche.id, ficheOverrides) || fiche);
    setFicheOpen(true);
  };

  const runRecallReport = async () => {
    const lot = passport.data?.lotNumber || activeLotId;
    if (!lot) return;
    setRecallBusy(true);
    try {
      const data = await trustApi.runRecall({ lotId: lot, lotNumber: lot });
      printRecallReport(data, {
        companyName,
        plantName: siteSettings?.plant_name,
        coordinator: siteSettings?.quality?.recall_coordinator,
      });
      toast.success(
        data.under60s
          ? `Rapport recall prêt (${data.elapsedMs} ms)`
          : `Rapport généré en ${data.elapsedMs} ms (cible < 60s)`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Recall impossible');
    } finally {
      setRecallBusy(false);
    }
  };

  // Keep disclosure in sync when parent toggles compact
  useEffect(() => {
    if (!compact) {
      setShowStages(true);
    } else {
      setShowStages(false);
    }
  }, [compact]);

  const golden = useQuery({
    queryKey: ['golden-thread'],
    queryFn: () => trustApi.getGoldenThread(),
    refetchInterval: 30_000,
  });

  const activeLotId = selectedLotId || golden.data?.lots.find((l) => !l.goldenThreadComplete)?.lotId || null;

  const lotState = useQuery({
    queryKey: ['lot-journey-state', activeLotId],
    queryFn: () => trustApi.getLotState(activeLotId!),
    enabled: Boolean(activeLotId),
  });

  const passport = useQuery({
    queryKey: ['lot-journey-passport', activeLotId],
    queryFn: () => trustApi.getPassport(activeLotId!),
    enabled: Boolean(activeLotId),
  });

  const lotCost = useQuery({
    queryKey: ['lot-journey-cost', activeLotId],
    queryFn: () => costingApi.getLotCost(activeLotId!),
    enabled: Boolean(activeLotId) && !compact,
    retry: false,
  });

  const settlements = useQuery({
    queryKey: ['lot-journey-settlements'],
    queryFn: () => settlementsApi.list(),
    staleTime: 60_000,
    retry: false,
    enabled: !compact,
  });

  const state = lotState.data;
  const progress = state?.progress || {
    current: null,
    completed: [] as string[],
    missing: [] as string[],
    percent: 0,
    rejected: false,
  };

  const next = resolveLotJourneyNextAction({
    stage: state?.stage,
    completed: progress.completed,
    missing: progress.missing,
    rejected: progress.rejected,
    complete: state?.goldenThreadComplete,
  });

  const relatedSettlement = useMemo(() => {
    const lotNumber = passport.data?.lotNumber;
    if (!lotNumber || !settlements.data) return null;
    return (
      settlements.data.find(
        (s) => s.parent_lot_number === lotNumber || s.triage_session_number?.includes(lotNumber),
      ) || null
    );
  }, [passport.data?.lotNumber, settlements.data]);

  const inProgressLots = (golden.data?.lots || []).filter((l) => !l.goldenThreadComplete).slice(0, 8);

  const handleSearch = async (raw?: string) => {
    const q = String(raw ?? query).trim();
    if (!q) return;
    setSelectedLotId(q);
    try {
      await trustApi.getLotState(q);
    } catch {
      // keep selection; error UI via lotState
    }
  };

  const pickLot = (lot: GoldenThreadLotState) => {
    setSelectedLotId(lot.lotId);
    setQuery(lot.lotId);
  };

  const canGo = (tab: AppTab) => accessibleTabs.includes(tab);

  const nextFiche = resolveFicheForStage(next.nextStage, ficheOverrides);

  const claimValue = (key: string) => {
    const hit = passport.data?.claims?.find(
      (c) => c.key === key || c.label.toLowerCase().includes(key.toLowerCase()),
    );
    return hit?.value != null ? String(hit.value) : null;
  };

  const printCurrentPfLabel = () => {
    const lotNumber = passport.data?.lotNumber || activeLotId;
    if (!lotNumber) {
      toast.error('Sélectionnez un lot avant d’imprimer l’étiquette PF');
      return;
    }
    const weightRaw = claimValue('weight') || claimValue('net') || claimValue('poids');
    printPfLotLabel({
      lotNumber,
      productName: claimValue('product') || claimValue('produit') || 'Dattes — Produit fini',
      variety: claimValue('variety') || claimValue('variété'),
      grade: claimValue('grade') || 'PF',
      netWeightKg: weightRaw ? Number(String(weightRaw).replace(',', '.')) : null,
      companyName,
      plantName: siteSettings?.plant_name,
    });
    toast.success('Étiquette PF prête à imprimer');
  };

  return (
    <Card className="surface-card overflow-hidden rounded-[28px] border-primary/20">
      <CardHeader className="space-y-3 border-b bg-muted/15 pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Link2 className="h-4 w-4 text-primary" />
            Suivre un lot
          </CardTitle>
          {golden.data && (
            <div className="flex flex-wrap gap-1.5 text-xs">
              <Badge variant="secondary">{golden.data.inProgress} en cours</Badge>
              {golden.data.broken > 0 && (
                <Badge className="bg-red-600 text-white">{golden.data.broken} cassé</Badge>
              )}
            </div>
          )}
        </div>

        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            void handleSearch();
          }}
        >
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="N° lot"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <Button type="submit">Suivre</Button>
          <Button type="button" variant="outline" onClick={() => onNavigate('scan')}>
            Scan
          </Button>
        </form>
      </CardHeader>

      <CardContent className="space-y-4 pt-4">
        {/* Docs only when a lot is active — avoid empty chrome */}
        {activeLotId && (
          <div className="flex flex-wrap gap-1.5">
            {canGo('receptions') && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1"
                onClick={() => onNavigate('receptions', { view: 'bra', action: 'new' })}
              >
                <Printer className="h-3.5 w-3.5" />
                BRA
              </Button>
            )}
            {canGo('logistics') && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1"
                onClick={() => onNavigate('logistics', { view: 'bde', action: 'new' })}
              >
                <Truck className="h-3.5 w-3.5" />
                BDE
              </Button>
            )}
            <Button size="sm" variant="outline" className="h-8 gap-1" onClick={printCurrentPfLabel}>
              <Tag className="h-3.5 w-3.5" />
              Étiquette PF
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 gap-1"
              onClick={() => onNavigate('home', { view: 'fiches' })}
            >
              <BookOpen className="h-3.5 w-3.5" />
              Fiche
            </Button>
          </div>
        )}

        {/* In-progress picker */}
        {inProgressLots.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Lots en cours — cliquer pour suivre
            </p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {inProgressLots.map((lot) => (
                <button
                  key={lot.lotId}
                  type="button"
                  onClick={() => pickLot(lot)}
                  className={cn(
                    'min-w-[140px] shrink-0 rounded-xl border px-3 py-2 text-left transition-colors',
                    activeLotId === lot.lotId
                      ? 'border-primary bg-primary/5'
                      : 'hover:bg-muted/40',
                  )}
                >
                  <p className="truncate font-mono text-[11px]">{lot.lotId.slice(0, 14)}…</p>
                  <p className="text-xs text-muted-foreground">
                    {LOT_JOURNEY_STAGE_LABELS[(lot.stage as LotJourneyStage) || 'SUPPLIER_INTAKE'] ||
                      lot.stage ||
                      '—'}{' '}
                    · {lot.progress.percent}%
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}

        {!activeLotId && (
          <p className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
            Aucun lot sélectionné. Recherchez un n° lot, scannez un QR, ou créez une réception Deglet
            Nour pour démarrer le parcours.
          </p>
        )}

        {activeLotId && lotState.isLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Chargement du parcours…
          </div>
        )}

        {activeLotId && lotState.isError && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            Lot introuvable ou non suivi sur le fil d&apos;or : <span className="font-mono">{activeLotId}</span>
          </div>
        )}

        {activeLotId && state && (
          <>
            {/* Identity + integrity */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-mono text-sm font-semibold">
                  {passport.data?.lotNumber || activeLotId}
                </p>
                <p className="text-xs text-muted-foreground">
                  Étape actuelle :{' '}
                  {LOT_JOURNEY_STAGE_LABELS[(state.stage as LotJourneyStage) || 'SUPPLIER_INTAKE'] ||
                    state.stage ||
                    '—'}{' '}
                  · {progress.percent}%
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {state.valid ? (
                  <Badge className="gap-1 bg-emerald-600">
                    <BadgeCheck className="h-3 w-3" /> Hash OK
                  </Badge>
                ) : (
                  <Badge className="gap-1 bg-red-600">
                    <ShieldAlert className="h-3 w-3" /> Chaîne cassée
                  </Badge>
                )}
                {state.goldenThreadComplete && (
                  <Badge className="bg-emerald-700">Fil d&apos;or complet</Badge>
                )}
              </div>
            </div>

            <Progress value={progress.percent} className="h-2" />

            {/* Stepper — collapsed in compact mode */}
            {compact && !showStages ? (
              <button
                type="button"
                onClick={() => setShowStages(true)}
                className="flex w-full items-center justify-between rounded-xl border border-dashed px-3 py-2 text-left text-sm text-muted-foreground hover:bg-muted/30"
              >
                <span>
                  {(() => {
                    const idx = LOT_JOURNEY_STAGES.indexOf(
                      (state.stage as LotJourneyStage) || 'SUPPLIER_INTAKE',
                    );
                    const label =
                      LOT_JOURNEY_STAGE_LABELS[(state.stage as LotJourneyStage) || 'SUPPLIER_INTAKE'] ||
                      state.stage ||
                      '—';
                    return `Étape ${idx >= 0 ? idx + 1 : '—'}/8 · ${label}`;
                  })()}
                </span>
                <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                  Voir les 8 étapes <ChevronDown className="h-3.5 w-3.5" />
                </span>
              </button>
            ) : (
              <div className="space-y-2">
                {compact && (
                  <button
                    type="button"
                    onClick={() => setShowStages(false)}
                    className="text-xs font-medium text-muted-foreground hover:text-foreground"
                  >
                    Masquer les étapes
                  </button>
                )}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
                  {LOT_JOURNEY_STAGES.map((stage, index) => {
                    const status = journeyStageStatus(stage, progress);
                    const fiche = getFicheForStage(stage);
                    return (
                      <button
                        key={stage}
                        type="button"
                        onClick={() => openFiche(fiche)}
                        title={fiche ? `Fiche ${fiche.code}` : undefined}
                        className={cn(
                          'rounded-xl border px-2 py-2.5 text-center transition-colors',
                          status === 'done' && 'border-emerald-200 bg-emerald-50',
                          status === 'current' && 'border-primary bg-primary/5 ring-1 ring-primary/30',
                          status === 'todo' && 'border-border/60 bg-background hover:bg-muted/40',
                          status === 'rejected' && 'border-red-200 bg-red-50',
                        )}
                      >
                        <p className="text-[10px] font-medium text-muted-foreground">{index + 1}</p>
                        <p className="text-xs font-semibold leading-tight">
                          {LOT_JOURNEY_STAGE_LABELS[stage]}
                        </p>
                        <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                          {status === 'done'
                            ? 'fait'
                            : status === 'current'
                              ? 'en cours'
                              : status === 'rejected'
                                ? 'rejet'
                                : 'fiche'}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Next action — one job, few buttons */}
            <div className="rounded-xl border border-primary/25 bg-primary/5 p-3.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">
                Prochaine action
              </p>
              <h3 className="mt-0.5 text-base font-semibold">{next.title}</h3>
              {!compact && (
                <p className="mt-1 text-sm text-muted-foreground">{next.description}</p>
              )}
              <div className="mt-2.5 flex flex-wrap gap-2">
                {canGo(next.tab) && (
                  <Button
                    className="gap-2"
                    onClick={() =>
                      onNavigate(next.tab, {
                        view: next.view,
                        module: next.module,
                        focus: next.focus,
                        action: next.action,
                        lot: passport.data?.lotNumber || activeLotId || undefined,
                      })
                    }
                  >
                    {next.ctaLabel}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                )}
                {nextFiche && (
                  <Button type="button" variant="outline" size="sm" onClick={() => openFiche(nextFiche)}>
                    Fiche
                  </Button>
                )}
                {next.secondary && canGo(next.secondary.tab) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      onNavigate(next.secondary!.tab, {
                        view: next.secondary!.view,
                        focus: next.secondary!.focus,
                        action: next.secondary!.action,
                        lot: passport.data?.lotNumber || activeLotId || undefined,
                      })
                    }
                  >
                    {next.secondary.ctaLabel}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1"
                  onClick={() =>
                    window.open(
                      `#/passport/${encodeURIComponent(passport.data?.lotNumber || activeLotId)}`,
                      '_blank',
                    )
                  }
                >
                  Passport <ExternalLink className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="gap-1"
                  disabled={recallBusy}
                  onClick={() => void runRecallReport()}
                >
                  {recallBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />}
                  Recall
                </Button>
              </div>
            </div>

            {/* Money — direction only, never on shop-floor compact home */}
            {!compact && (
              <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border p-3">
                <p className="text-xs text-muted-foreground">Coût lot (TND/kg)</p>
                {lotCost.isError ? (
                  <p className="text-sm font-medium text-muted-foreground">Réservé finance</p>
                ) : (
                  <>
                    <p className="text-lg font-semibold">
                      {lotCost.data?.lot.purchase_cost_tnd_per_kg != null
                        ? Number(lotCost.data.lot.purchase_cost_tnd_per_kg).toFixed(2)
                        : lotCost.data?.triage?.grades?.find((g) => g.cost_tnd_per_kg != null)
                            ?.cost_tnd_per_kg != null
                          ? Number(
                              lotCost.data.triage.grades.find((g) => g.cost_tnd_per_kg != null)!
                                .cost_tnd_per_kg,
                            ).toFixed(2)
                          : lotCost.isLoading
                            ? '…'
                            : '—'}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {lotCost.data?.lot.cost_source || 'snapshot / triage'}
                    </p>
                  </>
                )}
              </div>
              <div className="rounded-xl border p-3">
                <p className="text-xs text-muted-foreground">Règlement grades</p>
                {settlements.isError ? (
                  <p className="text-sm font-medium text-muted-foreground">Voir Achats</p>
                ) : (
                  <>
                    <p className="text-lg font-semibold">
                      {relatedSettlement
                        ? `${relatedSettlement.total_amount_tnd.toLocaleString('fr-FR', {
                            minimumFractionDigits: 0,
                          })} TND`
                        : '—'}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {relatedSettlement?.status || 'Après triage'}
                    </p>
                  </>
                )}
                {canGo('purchasing') && (
                  <Button
                    size="sm"
                    variant="link"
                    className="h-auto px-0 text-xs"
                    onClick={() => onNavigate('purchasing', { focus: 'settlements' })}
                  >
                    Règlements
                  </Button>
                )}
              </div>
              <div className="rounded-xl border p-3">
                <p className="text-xs text-muted-foreground">Marge export</p>
                <p className="text-lg font-semibold">
                  {progress.completed.includes('PACKED') || state.goldenThreadComplete
                    ? 'Disponible'
                    : '—'}
                </p>
                {canGo('export') && (
                  <Button
                    size="sm"
                    variant="link"
                    className="h-auto px-0 text-xs"
                    onClick={() => onNavigate('export')}
                  >
                    Export
                  </Button>
                )}
              </div>
            </div>
            )}
          </>
        )}
      </CardContent>

      <FicheTechniqueSheet
        fiche={activeFiche}
        open={ficheOpen}
        onOpenChange={setFicheOpen}
        onNavigate={onNavigate}
      />
    </Card>
  );
}
