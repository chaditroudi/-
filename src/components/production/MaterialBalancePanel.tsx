/**
 * MaterialBalancePanel
 *
 * Displays the indicative material balance table from PDF page 4:
 * "Bilan matière & nomenclature des flux — base 1 000 kg réceptionnés"
 *
 * Also renders the S1–S10 support flow nomenclature.
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  MATERIAL_BALANCE_TABLE,
  PRODUCTION_LINE_DEFINITIONS,
  SUPPORT_FLOW_DEFINITIONS,
  type SupportFlowCode,
} from '@/types/production-lines';
import { useFluxRuns } from '@/hooks/useFluxRuns';
import type { ProductionFluxCode } from '@/types/production';
import {
  ArrowRight,
  BarChart3,
  Droplets,
  Flame,
  Info,
  Package,
  Recycle,
  Snowflake,
  Users,
  Wind,
  Zap,
} from 'lucide-react';

// Support flow icon mapping
const SUPPORT_FLOW_ICONS: Record<SupportFlowCode, typeof Droplets> = {
  S1: Droplets,
  S2: Flame,
  S3: Snowflake,
  S4: Wind,
  S5: Zap,
  S6: Package,
  S7: Recycle,
  S8: Recycle,
  S9: Users,
  S10: Info,
};

// ─── Material balance bar ─────────────────────────────────────────────────────

function BalanceRow({
  code,
  label,
  color,
  yieldRangePercent,
  destination,
  index,
}: {
  code: string;
  label: string;
  color: string;
  yieldRangePercent: [number, number];
  destination: string;
  index: number;
}) {
  const midpoint = (yieldRangePercent[0] + yieldRangePercent[1]) / 2;

  return (
    <div className="flex items-center gap-3 py-2">
      {/* Rank */}
      <span className="w-4 text-right text-[11px] font-semibold text-muted-foreground">{index + 1}</span>

      {/* Code badge */}
      <Badge
        className="w-8 shrink-0 justify-center rounded-md px-1.5 py-0.5 text-[11px] font-bold text-white"
        style={{ backgroundColor: color }}
      >
        {code}
      </Badge>

      {/* Label + destination */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{label}</p>
        <p className="truncate text-[11px] text-muted-foreground">{destination}</p>
      </div>

      {/* Bar */}
      <div className="hidden w-32 flex-col gap-1 sm:flex">
        <div className="relative h-2 overflow-hidden rounded-full bg-muted">
          {/* Range bar */}
          <div
            className="absolute top-0 h-full rounded-full opacity-30"
            style={{
              left: `${yieldRangePercent[0]}%`,
              width: `${yieldRangePercent[1] - yieldRangePercent[0]}%`,
              backgroundColor: color,
            }}
          />
          {/* Midpoint marker */}
          <div
            className="absolute top-0 h-full w-1 rounded-full"
            style={{ left: `${midpoint}%`, backgroundColor: color }}
          />
        </div>
      </div>

      {/* % range */}
      <span
        className="w-16 shrink-0 text-right text-xs font-semibold"
        style={{ color }}
      >
        {yieldRangePercent[0]}–{yieldRangePercent[1]} %
      </span>
    </div>
  );
}

// ─── Support flow card ────────────────────────────────────────────────────────

function SupportFlowCard({ code }: { code: SupportFlowCode }) {
  const def = SUPPORT_FLOW_DEFINITIONS[code];
  const Icon = SUPPORT_FLOW_ICONS[code];

  return (
    <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/30 p-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <Badge variant="outline" className="rounded-full px-1.5 py-0 text-[11px] font-bold">
            {def.code}
          </Badge>
          <span className="text-xs font-semibold text-foreground">{def.label}</span>
        </div>
        <p className="mt-0.5 text-[11px] text-muted-foreground">{def.description}</p>
        {def.controlPoints && def.controlPoints.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {def.controlPoints.map((cp) => (
              <span
                key={cp}
                className="inline-flex items-center gap-0.5 rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0 text-[11px] text-amber-700"
              >
                {cp}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Real balance row (from live runs) ───────────────────────────────────────

function RealBalanceRow({
  code,
  inputKg,
  outputKg,
  runs,
  color,
}: {
  code: string;
  inputKg: number;
  outputKg: number;
  runs: number;
  color: string;
}) {
  const yieldPct = inputKg > 0 ? ((outputKg / inputKg) * 100).toFixed(1) : null;
  return (
    <div className="flex items-center gap-3 py-1.5">
      <Badge
        className="w-8 shrink-0 justify-center rounded-md px-1.5 py-0.5 text-[11px] font-bold text-white"
        style={{ backgroundColor: color }}
      >
        {code}
      </Badge>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">{inputKg.toLocaleString('fr-FR')} kg →</span>
          <span className="font-semibold text-foreground">{outputKg.toLocaleString('fr-FR')} kg</span>
        </div>
        <p className="text-[11px] text-muted-foreground">{runs} prod. enregistrée{runs > 1 ? 's' : ''}</p>
      </div>
      {yieldPct && (
        <span className="text-xs font-bold" style={{ color }}>
          {yieldPct} %
        </span>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function MaterialBalancePanel() {
  // Theoretical stats
  const totalMin = MATERIAL_BALANCE_TABLE.reduce((s, r) => s + r.yieldRangePercent[0], 0);
  const totalMax = MATERIAL_BALANCE_TABLE.reduce((s, r) => s + r.yieldRangePercent[1], 0);
  const lossMax = 3;

  const supportFlowCodes = Object.keys(SUPPORT_FLOW_DEFINITIONS) as SupportFlowCode[];

  // Real data from completed runs
  const { data: allRuns = [] } = useFluxRuns();
  const completedRuns = allRuns.filter((r) => r.status === 'completed');
  const fluxCodes: NonNullable<ProductionFluxCode>[] = ['F1','F2','F3','F4','F5','F6','F7','F8'];
  const realByFlux = fluxCodes.map((code) => {
    const lineRuns = completedRuns.filter((r) => r.flux_code === code);
    return {
      code,
      color: PRODUCTION_LINE_DEFINITIONS[code].color,
      inputKg: lineRuns.reduce((s, r) => s + r.input_weight_kg, 0),
      outputKg: lineRuns.reduce((s, r) => s + r.output_weight_kg, 0),
      runs: lineRuns.length,
    };
  }).filter((r) => r.runs > 0);

  const realTotalInput  = realByFlux.reduce((s, r) => s + r.inputKg, 0);
  const realTotalOutput = realByFlux.reduce((s, r) => s + r.outputKg, 0);
  const realValorisation = realTotalInput > 0
    ? ((realTotalOutput / realTotalInput) * 100).toFixed(1)
    : null;

  return (
    <div className="space-y-5">
      {/* ── Bilan matière ─────────────────────────────────────────────────── */}
      <Card className="surface-card border-border">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Badge variant="outline" className="rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-widest">
                Bilan matière indicatif
              </Badge>
              <CardTitle className="mt-2 text-base font-semibold">
                Répartition des flux — base 1 000 kg réceptionnés
              </CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                Source : Cartographie complète des flux de production, v3.0 · Usine Royal Palm Tozeur
              </p>
            </div>
            <div className="shrink-0 text-right">
              <div className="text-2xl font-bold text-foreground">&gt; 95 %</div>
              <div className="text-[11px] text-muted-foreground">Taux de valorisation matière</div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {/* Global progress bar */}
          <div className="mb-4 rounded-xl border border-border bg-muted/20 p-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-foreground">
                Valorisation totale estimée : {totalMin}–{totalMax} %
              </span>
              <span className="text-muted-foreground">Pertes &lt; {lossMax} %</span>
            </div>
            <Progress value={Math.min(100, (totalMin + totalMax) / 2)} className="mt-2 h-2" />
          </div>

          {/* Balance rows */}
          <div className="divide-y divide-border">
            {MATERIAL_BALANCE_TABLE.map((row, i) => (
              <BalanceRow key={row.code} {...row} index={i} />
            ))}

            {/* Losses row */}
            <div className="flex items-center gap-3 py-2 opacity-60">
              <span className="w-4 text-right text-[11px] font-semibold text-muted-foreground">—</span>
              <Badge variant="outline" className="w-8 justify-center rounded-md px-1.5 py-0.5 text-[11px]">
                ⊘
              </Badge>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">Pertes & corps étrangers</p>
                <p className="text-[11px] text-muted-foreground">Élimination / compostage</p>
              </div>
              <span className="w-16 text-right text-xs font-semibold text-muted-foreground">&lt; 3 %</span>
            </div>
          </div>

          {/* Flow diagram hint */}
          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
            <BarChart3 className="h-3.5 w-3.5 text-primary" />
            <span>
              F1–F4 : lignes principales (dattes entières) ·
              F5–F7 : valorisation des écarts ·
              F8 : noyaux (co-produit F3)
            </span>
            <ArrowRight className="h-3 w-3" />
            <span className="font-medium text-foreground">Taux global &gt; 95 %</span>
          </div>
        </CardContent>
      </Card>

      {/* ── Bilan réel (depuis les productions enregistrées) ─────────────── */}
      {realByFlux.length > 0 && (
        <Card className="surface-card border-border">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <Badge variant="outline" className="rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-widest">
                  Bilan réel
                </Badge>
                <CardTitle className="mt-2 text-base font-semibold">
                  Productions enregistrées — données MongoDB
                </CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  Calculé depuis {completedRuns.length} production{completedRuns.length > 1 ? 's' : ''} complétée{completedRuns.length > 1 ? 's' : ''} · MAJ 30 s
                </p>
              </div>
              {realValorisation && (
                <div className="shrink-0 text-right">
                  <div className="text-2xl font-bold text-foreground">{realValorisation} %</div>
                  <div className="text-[11px] text-muted-foreground">Valorisation réelle</div>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="mb-3 rounded-xl border border-border bg-muted/20 px-3 py-2 text-xs">
              <span className="text-muted-foreground">Entrée totale : </span>
              <span className="font-bold text-foreground">{realTotalInput.toLocaleString('fr-FR')} kg</span>
              <span className="mx-2 text-muted-foreground">→</span>
              <span className="text-muted-foreground">Sortie totale : </span>
              <span className="font-bold text-foreground">{realTotalOutput.toLocaleString('fr-FR')} kg</span>
            </div>
            <div className="divide-y divide-border">
              {realByFlux.map((r) => (
                <RealBalanceRow key={r.code} {...r} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Nomenclature des flux supports S1–S10 ─────────────────────────── */}
      <Card className="surface-card border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-widest">
              Flux supports
            </Badge>
            <CardTitle className="text-base font-semibold">
              Nomenclature S1–S10
            </CardTitle>
          </div>
          <p className="text-xs text-muted-foreground">
            10 flux supports transversaux à l'ensemble des lignes produits.
          </p>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
            {supportFlowCodes.map((code) => (
              <SupportFlowCard key={code} code={code} />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Ligne F3 → F8 liaison note ────────────────────────────────────── */}
      <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <div>
          <p className="font-semibold text-amber-800">Liaison F3 → F8</p>
          <p className="mt-1 text-xs text-amber-700">
            Les noyaux extraits en F3 (dénoyautage) représentent 10–14 % du tonnage dénoyauté.
            Ils alimentent directement la ligne F8 (noyaux valorisés) et contribuent au taux global
            de valorisation matière {'>'}95 %, transformant ce sous-produit en revenu complémentaire.
          </p>
        </div>
      </div>
    </div>
  );
}
