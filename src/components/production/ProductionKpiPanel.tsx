import { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { KPI_DEFINITIONS, type KpiDefinition } from '@/types/production-lines';
import { useFluxRuns, type FluxRun } from '@/hooks/useFluxRuns';
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Leaf,
  Loader2,
  Minus,
  RefreshCw,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Truck,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

// ─── KPI computation from real flux runs ─────────────────────────────────────

interface ComputedKpi {
  code: string;
  value: number | null;
  isOnTarget: boolean | null;
  source: 'live' | 'unavailable';
}

function computeKpis(runs: FluxRun[]): Record<string, ComputedKpi> {
  const completed = runs.filter((r) => r.status === 'completed');

  const totalInput  = completed.reduce((s, r) => s + r.input_weight_kg, 0);
  const totalOutput = completed.reduce((s, r) => s + r.output_weight_kg, 0);
  const totalWaste  = completed.reduce((s, r) => s + r.waste_kg, 0);

  const valorisation = totalInput > 0 ? (totalOutput / totalInput) * 100 : null;
  const pertes       = totalInput > 0 ? (totalWaste  / totalInput) * 100 : null;

  const runsWithCcp2 = completed.filter((r) => r.ccp2_passed !== null);
  const ccp2Pass = runsWithCcp2.length > 0
    ? (runsWithCcp2.filter((r) => r.ccp2_passed === true).length / runsWithCcp2.length) * 100
    : null;
  const nonConformitesCcp = runsWithCcp2.filter((r) => r.ccp2_passed === false).length;

  const lineRuns = (code: string) => completed.filter((r) => r.flux_code === code);
  const lineYield = (code: string) => {
    const lr = lineRuns(code);
    const inp = lr.reduce((s, r) => s + r.input_weight_kg, 0);
    const out = lr.reduce((s, r) => s + r.output_weight_kg, 0);
    return inp > 0 ? (out / inp) * 100 : null;
  };

  // déchets valorisés approximation: waste that went through a dedicated valorisation run
  const f8Runs = lineRuns('F8');
  const f8Input = f8Runs.reduce((s, r) => s + r.input_weight_kg, 0);
  const wastePctVal = totalWaste > 0 && f8Input > 0
    ? Math.min(100, (f8Input / totalWaste) * 100)
    : null;

  const make = (
    code: string,
    value: number | null,
    target_num: number,
    direction: 'up_good' | 'down_good',
  ): ComputedKpi => {
    const isOnTarget =
      value === null
        ? null
        : direction === 'up_good'
          ? value >= target_num
          : value <= target_num;
    return { code, value, isOnTarget, source: value !== null ? 'live' : 'unavailable' };
  };

  return {
    'KPI-P1':  make('KPI-P1',  pertes,         15,  'down_good'),
    'KPI-P2':  make('KPI-P2',  lineYield('F3'), 55,  'up_good'),
    'KPI-P3':  make('KPI-P3',  valorisation,   95,  'up_good'),
    'KPI-P4':  make('KPI-P4',  ccp2Pass,       98,  'up_good'),
    'KPI-P5':  make('KPI-P5',  lineYield('F2'), 85,  'up_good'),
    'KPI-FS1': make('KPI-FS1', null,            1,   'down_good'),
    'KPI-FS2': make('KPI-FS2', nonConformitesCcp, 0, 'down_good'),
    'KPI-FS3': make('KPI-FS3', null,            99,  'up_good'),
    'KPI-FS4': make('KPI-FS4', null,            3,   'down_good'),
    'KPI-R1':  make('KPI-R1',  null,            5,   'down_good'),
    'KPI-R2':  make('KPI-R2',  null,            200, 'down_good'),
    'KPI-R3':  make('KPI-R3',  null,            85,  'up_good'),
    'KPI-R4':  make('KPI-R4',  wastePctVal,     3,   'down_good'),
    'KPI-L1':  make('KPI-L1',  null,            95,  'up_good'),
    'KPI-L2':  make('KPI-L2',  null,            5,   'down_good'),
    'KPI-L3':  make('KPI-L3',  null,            99,  'up_good'),
  };
}

// ─── Category meta ────────────────────────────────────────────────────────────

const CATEGORY_META: Record<KpiDefinition['category'], { label: string; icon: typeof BarChart3; color: string }> = {
  process:     { label: 'Procédé',                     icon: BarChart3,   color: 'text-blue-600'    },
  food_safety: { label: 'Sécurité des aliments',       icon: ShieldCheck, color: 'text-red-500'     },
  resources:   { label: 'Ressources & environnement',  icon: Leaf,        color: 'text-emerald-600' },
  logistics:   { label: 'Logistique',                  icon: Truck,       color: 'text-purple-600'  },
};

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({ kpi, computed }: { kpi: KpiDefinition; computed: ComputedKpi | undefined }) {
  const val        = computed?.value ?? null;
  const isOnTarget = computed?.isOnTarget ?? null;
  const source     = computed?.source ?? 'unavailable';
  const isPercent  = kpi.unit === '%';
  const progressValue = isPercent && val !== null ? Math.min(100, val) : null;

  const toneClass =
    isOnTarget === true  ? 'border-emerald-200 bg-emerald-50/40' :
    isOnTarget === false ? 'border-amber-200 bg-amber-50/40'     :
                           'border-border';

  return (
    <div className={cn('rounded-xl border p-4', toneClass)}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold text-foreground leading-snug">{kpi.label}</p>
        {source === 'unavailable' ? (
          <Badge variant="outline" className="rounded-full px-1.5 py-0 text-[11px] text-muted-foreground">
            Capteur requis
          </Badge>
        ) : isOnTarget !== null ? (
          isOnTarget
            ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
            : <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
        ) : null}
      </div>

      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="text-2xl font-bold text-foreground">
          {val !== null ? val.toLocaleString('fr-FR', { maximumFractionDigits: 1 }) : '—'}
        </span>
        <span className="text-xs text-muted-foreground">{kpi.unit}</span>
      </div>

      {progressValue !== null && (
        <Progress
          value={progressValue}
          className={cn(
            'mt-2 h-1.5',
            isOnTarget === true  && '[&>div]:bg-emerald-500',
            isOnTarget === false && '[&>div]:bg-amber-400',
          )}
        />
      )}

      <div className="mt-2">
        <p className="text-[11px] text-muted-foreground truncate">{kpi.definition}</p>
      </div>

      <p className="mt-1.5 text-[11px]">
        <span className="text-muted-foreground">Cible : </span>
        <span className="font-medium text-foreground">{kpi.target}</span>
      </p>
    </div>
  );
}

// ─── Category Section ─────────────────────────────────────────────────────────

function KpiCategorySection({
  category,
  kpis,
  kpiMap,
}: {
  category: KpiDefinition['category'];
  kpis: KpiDefinition[];
  kpiMap: Record<string, ComputedKpi>;
}) {
  const meta = CATEGORY_META[category];
  const Icon = meta.icon;
  const onTargetCount  = kpis.filter((k) => kpiMap[k.code]?.isOnTarget === true).length;
  const offTargetCount = kpis.filter((k) => kpiMap[k.code]?.isOnTarget === false).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Icon className={cn('h-4 w-4', meta.color)} />
        <h3 className="text-sm font-semibold text-foreground">{meta.label}</h3>
        {onTargetCount > 0 && (
          <span className="flex items-center gap-0.5 rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700">
            <CheckCircle2 className="h-2.5 w-2.5" /> {onTargetCount}
          </span>
        )}
        {offTargetCount > 0 && (
          <span className="flex items-center gap-0.5 rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-700">
            <AlertTriangle className="h-2.5 w-2.5" /> {offTargetCount}
          </span>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.code} kpi={kpi} computed={kpiMap[kpi.code]} />
        ))}
      </div>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function ProductionKpiPanel() {
  const [periodDays, setPeriodDays] = useState(30);
  const qc = useQueryClient();

  const since = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - periodDays);
    return d.toISOString();
  }, [periodDays]);

  const { data: runs = [], isLoading, isFetching } = useFluxRuns({ since });

  const kpiMap = useMemo(() => computeKpis(runs), [runs]);
  const categories: KpiDefinition['category'][] = ['process', 'food_safety', 'resources', 'logistics'];

  const totalKpis     = KPI_DEFINITIONS.length;
  const onTargetCount = Object.values(kpiMap).filter((v) => v.isOnTarget === true).length;
  const liveCount     = Object.values(kpiMap).filter((v) => v.source === 'live' && v.value !== null).length;

  // Production summary stats
  const completed = runs.filter((r) => r.status === 'completed');
  const totalInput  = completed.reduce((s, r) => s + r.input_weight_kg, 0);
  const totalOutput = completed.reduce((s, r) => s + r.output_weight_kg, 0);
  const valorisation = totalInput > 0 ? ((totalOutput / totalInput) * 100).toFixed(1) : null;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            <h2 className="text-base font-semibold text-foreground">KPI globaux & tableau de bord</h2>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {totalKpis} indicateurs · {liveCount} calculés depuis les données réelles · MAJ 30 s
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-0.5">
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                onClick={() => setPeriodDays(d)}
                className={cn(
                  'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                  periodDays === d ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted',
                )}
              >
                {d}j
              </button>
            ))}
          </div>
          <button
            onClick={() => qc.invalidateQueries({ queryKey: ['flux-runs'] })}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted"
          >
            <RefreshCw className={cn('h-3 w-3', isFetching && 'animate-spin')} />
            Actualiser
          </button>
        </div>
      </div>

      {/* Summary card */}
      <Card className="surface-card border-border">
        <CardContent className="flex flex-wrap items-center gap-6 p-4">
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Chargement des données…
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <BarChart3 className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{onTargetCount}/{totalKpis}</p>
                  <p className="text-xs text-muted-foreground">KPIs sur cible</p>
                </div>
              </div>
              <div className="h-10 w-px bg-border" />
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700">
                  <CheckCircle2 className="h-3 w-3" />
                  {onTargetCount} conformes
                </span>
                {valorisation && (
                  <span className="flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 font-semibold text-blue-700">
                    <TrendingUp className="h-3 w-3" />
                    Valorisation {valorisation} %
                  </span>
                )}
                <span className="flex items-center gap-1 rounded-full border border-border bg-muted/60 px-2.5 py-1 font-medium text-muted-foreground">
                  {completed.length} prod. · {totalInput.toLocaleString('fr-FR')} kg entrée
                </span>
                <span className="flex items-center gap-1 rounded-full border border-border bg-muted/60 px-2.5 py-1 font-medium text-muted-foreground">
                  Période : {periodDays} jours
                </span>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {!isLoading && runs.length === 0 && (
        <div className="rounded-xl border border-border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
          Aucune production enregistrée sur les {periodDays} derniers jours.
          Démarrez des productions dans l'onglet "Flux F1–F8" pour voir les KPIs réels.
        </div>
      )}

      {/* Category sections */}
      {categories.map((cat) => (
        <Card key={cat} className="surface-card border-border">
          <CardContent className="p-5">
            <KpiCategorySection
              category={cat}
              kpis={KPI_DEFINITIONS.filter((k) => k.category === cat)}
              kpiMap={kpiMap}
            />
          </CardContent>
        </Card>
      ))}

      <p className="text-[11px] text-muted-foreground">
        KPIs marqués "Capteur requis" (mesure d'eau, énergie, conformité micro) nécessitent une
        intégration avec les compteurs terrain ou le laboratoire. Les KPIs de procédé (P1–P5) et
        la conformité CCP2 (FS2) sont calculés en temps réel depuis les productions enregistrées.
      </p>
    </div>
  );
}
