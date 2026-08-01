import { useMemo, useState } from 'react';
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
import {
  ArrowRight,
  BadgeCheck,
  ExternalLink,
  Link2,
  Loader2,
  Search,
  ShieldAlert,
} from 'lucide-react';

interface LotJourneyHubProps {
  onNavigate: AppNavigateFn;
  accessibleTabs: AppTab[];
}

export function LotJourneyHub({ onNavigate, accessibleTabs }: LotJourneyHubProps) {
  const [query, setQuery] = useState('');
  const [selectedLotId, setSelectedLotId] = useState<string | null>(null);

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
    enabled: Boolean(activeLotId),
    retry: false,
  });

  const settlements = useQuery({
    queryKey: ['lot-journey-settlements'],
    queryFn: () => settlementsApi.list(),
    staleTime: 60_000,
    retry: false,
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

  return (
    <Card className="surface-card overflow-hidden rounded-[28px] border-primary/20">
      <CardHeader className="space-y-3 border-b bg-muted/20 pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/70">
              Parcours lot A→Z
            </p>
            <CardTitle className="mt-1 flex items-center gap-2 text-xl">
              <Link2 className="h-5 w-5 text-primary" />
              Un lot, une chaîne, une prochaine action
            </CardTitle>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Réception → pesée → QC → froid → fumigation → triage → conditionnement → expédition.
              Les onglets métier restent disponibles, mais le fil d&apos;or guide d&apos;abord.
            </p>
          </div>
          {golden.data && (
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant="secondary">{golden.data.inProgress} en cours</Badge>
              <Badge variant="outline">{golden.data.complete} complets</Badge>
              {golden.data.broken > 0 && (
                <Badge className="bg-red-600 text-white">{golden.data.broken} chaîne cassée</Badge>
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
              placeholder="N° lot / id (ex. LOT-…)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <Button type="submit" className="gap-2">
            Suivre ce lot
          </Button>
          <Button type="button" variant="outline" onClick={() => onNavigate('scan')}>
            Scanner
          </Button>
        </form>
      </CardHeader>

      <CardContent className="space-y-5 pt-5">
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

            {/* Stepper */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
              {LOT_JOURNEY_STAGES.map((stage, index) => {
                const status = journeyStageStatus(stage, progress);
                return (
                  <div
                    key={stage}
                    className={cn(
                      'rounded-xl border px-2 py-2.5 text-center',
                      status === 'done' && 'border-emerald-200 bg-emerald-50',
                      status === 'current' && 'border-primary bg-primary/5 ring-1 ring-primary/30',
                      status === 'todo' && 'border-border/60 bg-background',
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
                            : 'à venir'}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Next action */}
            <div className="rounded-2xl border border-primary/25 bg-primary/5 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                Prochaine action
              </p>
              <h3 className="mt-1 text-lg font-semibold">{next.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{next.description}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {canGo(next.tab) && (
                  <Button
                    className="gap-2"
                    onClick={() =>
                      onNavigate(next.tab, {
                        view: next.view,
                        module: next.module,
                        focus: next.focus,
                        lot: passport.data?.lotNumber || activeLotId || undefined,
                      })
                    }
                  >
                    {next.ctaLabel}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                )}
                {next.secondary && canGo(next.secondary.tab) && (
                  <Button
                    variant="outline"
                    onClick={() =>
                      onNavigate(next.secondary!.tab, {
                        view: next.secondary!.view,
                        focus: next.secondary!.focus,
                        lot: passport.data?.lotNumber || activeLotId || undefined,
                      })
                    }
                  >
                    {next.secondary.ctaLabel}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  className="gap-1"
                  onClick={() =>
                    window.open(
                      `#/passport/${encodeURIComponent(passport.data?.lotNumber || activeLotId)}`,
                      '_blank',
                    )
                  }
                >
                  Passport client <ExternalLink className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Money strip — soft when role cannot read finance APIs */}
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border p-3">
                <p className="text-xs text-muted-foreground">Coût lot (TND/kg)</p>
                {lotCost.isError ? (
                  <>
                    <p className="text-sm font-medium text-muted-foreground">Réservé Achats / Direction</p>
                    <p className="text-[11px] text-muted-foreground">
                      Votre rôle suit le parcours ; les chiffres coût s&apos;affichent pour les profils finance.
                    </p>
                  </>
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
                  <>
                    <p className="text-sm font-medium text-muted-foreground">Voir avec Achats</p>
                    <p className="text-[11px] text-muted-foreground">
                      Après triage, le règlement est géré dans Achats → Règlements grades.
                    </p>
                  </>
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
                      {relatedSettlement
                        ? relatedSettlement.status
                        : progress.completed.includes('TRIAGE')
                          ? 'Disponible après clôture triage'
                          : 'Après triage'}
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
                    Voir règlements
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
                <p className="text-[11px] text-muted-foreground">CA × FX − coût lot (TND)</p>
                {canGo('export') && (
                  <Button
                    size="sm"
                    variant="link"
                    className="h-auto px-0 text-xs"
                    onClick={() => onNavigate('export')}
                  >
                    Ouvrir export → Marge
                  </Button>
                )}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
