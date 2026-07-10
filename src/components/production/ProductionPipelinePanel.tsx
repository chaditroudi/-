import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { usePhase2Pipeline, type Phase2Stage } from '@/hooks/usePhase2Pipeline';
import { useFumigationCycles } from '@/hooks/useFumigation';
import { useCleaningCycles } from '@/hooks/useNettoyage';
import { useHydrationCycles } from '@/hooks/useHydratation';
import { useTriageSessions } from '@/hooks/useTriage';
import {
  Flame, Droplets, Wind, Scissors, Clock, CheckCircle2, ChevronRight,
  Leaf, Package, ArrowRight,
} from 'lucide-react';
import type { AvailableLot } from '@/hooks/useAvailableLotsForPhase2';

interface Props {
  onLaunchFumigation?: (lot: AvailableLot) => void;
}

// ── Stage config ──────────────────────────────────────────────────────────────
const STAGE_CFG: Record<Phase2Stage, { label: string; color: string; bg: string; Icon: any }> = {
  waiting:     { label: 'En attente',   color: 'text-amber-600',   bg: 'bg-amber-100',   Icon: Clock },
  fumigation:  { label: 'Fumigation',   color: 'text-orange-600',  bg: 'bg-orange-100',  Icon: Flame },
  nettoyage:   { label: 'Nettoyage',    color: 'text-blue-600',    bg: 'bg-blue-100',    Icon: Droplets },
  hydratation: { label: 'Hydratation',  color: 'text-cyan-600',    bg: 'bg-cyan-100',    Icon: Wind },
  triage:      { label: 'Triage',       color: 'text-violet-600',  bg: 'bg-violet-100',  Icon: Scissors },
  completed:   { label: 'Complété',     color: 'text-green-600',   bg: 'bg-green-100',   Icon: CheckCircle2 },
};

function StagePill({ stage, count }: { stage: Phase2Stage; count: number }) {
  const cfg = STAGE_CFG[stage];
  const Icon = cfg.Icon;
  return (
    <div className="flex flex-col items-center gap-1">
      <div className={`flex items-center gap-1.5 px-3 py-2 rounded-xl ${cfg.bg} border border-white/80 shadow-sm min-w-[96px] justify-center`}>
        <Icon className={`h-4 w-4 ${cfg.color}`} />
        <span className={`text-sm font-bold ${cfg.color}`}>{count}</span>
      </div>
      <span className="text-[11px] text-muted-foreground font-medium">{cfg.label}</span>
    </div>
  );
}

function LotCard({ lot, stage, onLaunch }: { lot: AvailableLot; stage: Phase2Stage; onLaunch?: () => void }) {
  const cfg = STAGE_CFG[stage];
  const Icon = cfg.Icon;
  return (
    <div className="flex items-center gap-2 py-2 px-3 border rounded-lg bg-card hover:bg-muted/30 transition-colors group">
      <div className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${cfg.bg}`}>
        <Icon className={`h-3.5 w-3.5 ${cfg.color}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-mono font-semibold">{lot.reception_number}</span>
          {lot.variety && <span className="text-[11px] text-muted-foreground">{lot.variety}</span>}
          {lot.is_bio && <Badge variant="outline" className="text-[11px] h-4 px-1 text-green-600 border-green-300"><Leaf className="h-2.5 w-2.5 mr-0.5" />BIO</Badge>}
          {lot.qc_grade && <Badge variant="outline" className="text-[11px] h-4 px-1">{lot.qc_grade}</Badge>}
        </div>
        <div className="text-[11px] text-muted-foreground">
          {lot.quantity_total ? `${lot.quantity_total.toLocaleString('fr')} ${lot.unit ?? 'kg'}` : '—'}
          {lot.storage_zone_code && ` · Zone ${lot.storage_zone_code}`}
        </div>
      </div>
      {stage === 'waiting' && onLaunch && (
        <Button
          size="sm"
          variant="outline"
          className="h-9 text-xs shrink-0 gap-1 opacity-0 group-hover:opacity-100 transition-opacity border-orange-300 text-orange-700 hover:bg-orange-50"
          onClick={onLaunch}
        >
          <Flame className="h-3 w-3" />
          Fumigation
        </Button>
      )}
    </div>
  );
}

function ActiveCycleSummary() {
  const { data: fum = [] } = useFumigationCycles();
  const { data: net = [] } = useCleaningCycles();
  const { data: hyd = [] } = useHydrationCycles();
  const { data: tri = [] } = useTriageSessions();

  const ACTIVE = new Set(['PREPARATION', 'CHARGEMENT', 'EN_COURS', 'VENTILATION', 'VALIDATION', 'PAUSE']);

  const activeFum = (fum as any[]).filter(c => ACTIVE.has(c.status));
  const activeNet = (net as any[]).filter(c => c.status === 'EN_COURS');
  const activeHyd = (hyd as any[]).filter(c => c.status === 'EN_COURS');
  const activeTri = (tri as any[]).filter(c => c.status === 'EN_COURS' || c.status === 'PAUSE');

  if (activeFum.length + activeNet.length + activeHyd.length + activeTri.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Cycles actifs maintenant</p>
      {activeFum.map((c: any) => (
        <div key={c.id} className="flex items-center gap-2 text-xs px-2 py-1.5 bg-orange-50 border border-orange-200 rounded-lg">
          <Flame className="h-3.5 w-3.5 text-orange-600 shrink-0" />
          <span className="font-medium text-orange-700">{c.chamber ?? 'Chambre'}</span>
          <span className="text-muted-foreground flex-1">{c.lot_refs?.map((r: any) => r.lot_number).join(', ') || '—'}</span>
          <Badge className="text-[11px] h-4 bg-orange-100 text-orange-700 border-orange-300 shrink-0">{c.status}</Badge>
        </div>
      ))}
      {activeNet.map((c: any) => (
        <div key={c.id} className="flex items-center gap-2 text-xs px-2 py-1.5 bg-blue-50 border border-blue-200 rounded-lg">
          <Droplets className="h-3.5 w-3.5 text-blue-600 shrink-0" />
          <span className="font-medium text-blue-700">Prog. {c.program}</span>
          <span className="text-muted-foreground flex-1">{c.lot_number || '—'}</span>
          <Badge className="text-[11px] h-4 bg-blue-100 text-blue-700 border-blue-300 shrink-0">EN_COURS</Badge>
        </div>
      ))}
      {activeHyd.map((c: any) => (
        <div key={c.id} className="flex items-center gap-2 text-xs px-2 py-1.5 bg-cyan-50 border border-cyan-200 rounded-lg">
          <Wind className="h-3.5 w-3.5 text-cyan-600 shrink-0" />
          <span className="font-medium text-cyan-700">{c.chamber ?? 'Chambre'}</span>
          <span className="text-muted-foreground flex-1">{c.lot_refs?.map((r: any) => r.lot_number).join(', ') || '—'}</span>
          <Badge className="text-[11px] h-4 bg-cyan-100 text-cyan-700 border-cyan-300 shrink-0">EN_COURS</Badge>
        </div>
      ))}
      {activeTri.map((s: any) => (
        <div key={s.id} className="flex items-center gap-2 text-xs px-2 py-1.5 bg-violet-50 border border-violet-200 rounded-lg">
          <Scissors className="h-3.5 w-3.5 text-violet-600 shrink-0" />
          <span className="font-medium text-violet-700">{s.line ?? 'Ligne'}</span>
          <span className="text-muted-foreground flex-1">{s.parent_lot_number || '—'}</span>
          <Badge className="text-[11px] h-4 bg-violet-100 text-violet-700 border-violet-300 shrink-0">{s.status}</Badge>
        </div>
      ))}
    </div>
  );
}

export function ProductionPipelinePanel({ onLaunchFumigation }: Props) {
  const pipeline = usePhase2Pipeline();

  const { waiting, inFumigation, inCleaning, inHydration, inTriage, completedToday, totalKgWaiting } = pipeline;

  const stages: { stage: Phase2Stage; count: number }[] = [
    { stage: 'waiting',     count: waiting.length },
    { stage: 'fumigation',  count: inFumigation },
    { stage: 'nettoyage',   count: inCleaning },
    { stage: 'hydratation', count: inHydration },
    { stage: 'triage',      count: inTriage },
    { stage: 'completed',   count: completedToday },
  ];

  return (
    <div className="space-y-4">
      {/* Pipeline flow bar */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-start justify-center gap-1 flex-wrap">
            {stages.map((s, i) => (
              <div key={s.stage} className="flex items-center gap-1">
                <StagePill stage={s.stage} count={s.count} />
                {i < stages.length - 1 && (
                  <ChevronRight className="h-4 w-4 text-muted-foreground/40 mt-[-10px]" />
                )}
              </div>
            ))}
          </div>
          {waiting.length > 0 && (
            <p className="text-center text-xs text-muted-foreground mt-3">
              <span className="font-semibold text-amber-600">{waiting.length} lot(s)</span> en attente · {totalKgWaiting.toLocaleString('fr')} kg prêts pour traitement
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Waiting lots */}
        {waiting.length > 0 && (
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="h-4 w-4 text-amber-500" />
                <span className="font-semibold text-sm">Lots en attente de traitement</span>
                <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50 text-[11px]">
                  {waiting.length}
                </Badge>
              </div>
              <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                {waiting.map((lot) => (
                  <LotCard
                    key={lot.id}
                    lot={lot}
                    stage="waiting"
                    onLaunch={onLaunchFumigation ? () => onLaunchFumigation(lot) : undefined}
                  />
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground mt-2">
                Survoler un lot pour lancer la fumigation directement.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Active cycles */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-3">
              <ArrowRight className="h-4 w-4 text-primary" />
              <span className="font-semibold text-sm">En cours de traitement</span>
            </div>
            <ActiveCycleSummary />
            {inFumigation + inCleaning + inHydration + inTriage === 0 && (
              <p className="text-sm text-muted-foreground py-4 text-center">Aucun cycle actif en ce moment.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
