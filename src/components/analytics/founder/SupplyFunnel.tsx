import { useSupplyFunnel } from '@/hooks/useFounderAnalytics';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, AlertTriangle, MinusCircle } from 'lucide-react';

type Period = 'today' | 'week' | 'month' | 'quarter';

const STAGE_COLORS = ['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#107754'];

const BENCHMARKS = [
  { label: 'Taux Phase 2', key: 'phase2' as const, target: 90, unit: '%' },
  { label: 'Triage → Cond.', key: 'triage' as const, target: 80, unit: '%' },
  { label: 'OEE Cond.', key: 'packaging' as const, target: 85, unit: '%' },
];

function fmtKg(v: number) {
  return v >= 1000 ? `${(v / 1000).toFixed(1)} t` : `${v.toFixed(0)} kg`;
}

function KpiBenchmarkCard({
  label,
  value,
  target,
  unit,
}: {
  label: string;
  value: number;
  target: number;
  unit: string;
}) {
  const hasData = value > 0;
  const onTarget = hasData && value >= target;
  const offTarget = hasData && value < target;

  return (
    <Card
      className={
        onTarget
          ? 'border-green-300 bg-green-50'
          : offTarget
          ? 'border-amber-300 bg-amber-50'
          : ''
      }
    >
      <CardContent className="pt-3 pb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-muted-foreground">{label}</span>
          {hasData ? (
            onTarget ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
            ) : (
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
            )
          ) : (
            <MinusCircle className="h-3.5 w-3.5 text-muted-foreground/40" />
          )}
        </div>
        <div
          className={`text-2xl font-black ${
            onTarget ? 'text-green-700' : offTarget ? 'text-amber-700' : 'text-muted-foreground'
          }`}
        >
          {hasData ? `${value.toFixed(1)}${unit}` : '—'}
        </div>
        <div className="mt-1.5">
          {hasData ? (
            <div className="space-y-0.5">
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-1.5 rounded-full transition-all"
                  style={{
                    width: `${Math.min((value / target) * 100, 100)}%`,
                    background: onTarget ? '#22c55e' : '#f59e0b',
                  }}
                />
              </div>
              <div
                className={`text-[10px] font-semibold ${
                  onTarget ? 'text-green-600' : 'text-amber-600'
                }`}
              >
                {onTarget
                  ? `+${(value - target).toFixed(1)}% vs cible`
                  : `${(value - target).toFixed(1)}% vs cible ≥${target}%`}
              </div>
            </div>
          ) : (
            <div className="text-[10px] text-muted-foreground">Cible : ≥ {target}%</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function FunnelStage({
  label,
  value,
  unit,
  color,
  pctOfFirst,
  isLast,
}: {
  label: string;
  value: number;
  unit: string;
  color: string;
  pctOfFirst: number;
  isLast?: boolean;
}) {
  const isEmpty = value === 0;
  const width = Math.max(isEmpty ? 22 : pctOfFirst * 0.7 + 30, 22);

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="text-xs text-muted-foreground font-medium">{label}</div>
      <div
        className="rounded-xl flex items-center justify-center font-black text-base shadow-sm transition-all duration-500"
        style={{
          background: isEmpty ? '#e5e7eb' : color,
          width: `${width}%`,
          minWidth: 88,
          height: 52,
        }}
      >
        {isEmpty ? (
          <span className="text-[11px] text-gray-400 font-normal">non démarré</span>
        ) : (
          <>
            <span className="text-white">
              {value >= 1000 ? `${(value / 1000).toFixed(1)} t` : value.toFixed(0)}
            </span>
            <span className="text-xs font-normal ml-1 text-white/80">{unit}</span>
          </>
        )}
      </div>
      {!isLast && (
        <div className="flex flex-col items-center">
          <div className="w-0.5 h-4 bg-border" />
          <Badge variant="outline" className="text-[10px] px-1.5 h-5">
            {pctOfFirst > 0 ? `${pctOfFirst.toFixed(1)}%` : '—'}
          </Badge>
        </div>
      )}
    </div>
  );
}

export function SupplyFunnel({ period }: { period: Period }) {
  const { data, isLoading } = useSupplyFunnel(period);

  if (isLoading)
    return (
      <div className="py-20 text-center text-sm text-muted-foreground animate-pulse">
        Calcul de la chaîne de valeur…
      </div>
    );

  const stages = data?.stages ?? [];
  const yields = data?.yields;
  const firstVal = stages[0]?.value ?? 0;
  const allEmpty = stages.every((s) => s.value === 0);
  const phase2Empty = stages.slice(1).every((s) => s.value === 0);

  return (
    <div className="space-y-6">
      {/* Benchmark KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {BENCHMARKS.map(({ label, key, target, unit }) => (
          <KpiBenchmarkCard
            key={key}
            label={label}
            value={yields?.[key] ?? 0}
            target={target}
            unit={unit}
          />
        ))}

        {/* PF scellé */}
        <Card>
          <CardContent className="pt-3 pb-3">
            <div className="text-xs text-muted-foreground mb-1">PF scellé</div>
            <div className="text-2xl font-black text-emerald-700">
              {(data?.palettesKg ?? 0) > 0 ? fmtKg(data!.palettesKg) : '—'}
            </div>
            <div className="text-[10px] text-muted-foreground mt-1">poids brut palettes</div>
          </CardContent>
        </Card>
      </div>

      {/* Visual funnel */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Entonnoir — Réception → Produit Fini</CardTitle>
        </CardHeader>
        <CardContent>
          {allEmpty ? (
            <div className="py-12 text-center space-y-2">
              <div className="text-sm font-semibold text-muted-foreground">
                Entonnoir en attente de données
              </div>
              <div className="text-xs text-muted-foreground max-w-sm mx-auto">
                Les flux apparaîtront ici dès que des réceptions et des cycles Phase 2 seront
                enregistrés.
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-0 py-4 w-full">
              {stages.map((s, i) => (
                <FunnelStage
                  key={s.label}
                  label={s.label}
                  value={s.value}
                  unit={s.unit}
                  color={STAGE_COLORS[i]}
                  pctOfFirst={firstVal > 0 ? (s.value / firstVal) * 100 : 0}
                  isLast={i === stages.length - 1}
                />
              ))}
            </div>
          )}

          {/* Context banner when only reception has data */}
          {!allEmpty && phase2Empty && firstVal > 0 && (
            <div className="mt-4 rounded-xl bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-700">
              <span className="font-semibold">{fmtKg(firstVal)}</span> de matière première
              disponible en réception —{' '}
              <span className="text-blue-500">
                les étapes Phase 2 (fumigation, nettoyage, hydratation, triage) alimenteront
                l'entonnoir dès que des cycles seront terminés.
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
