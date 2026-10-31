import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { costingApi, type CostSummaryView } from '@/lib/api/costing';
import { Loader2, Scale, TrendingDown, TrendingUp, Printer } from 'lucide-react';
import { useState } from 'react';
import { printCfoCostPack } from '@/lib/printCfoCostPack';
import { useSiteSettings } from '@/hooks/useSettings';

type Period = CostSummaryView['period'];

const fmt = (n: number, digits = 2) =>
  n.toLocaleString('fr-TN', { minimumFractionDigits: digits, maximumFractionDigits: digits });

/** Wave B — live TND/kg roll-up from closed triage + packaging (standard absorption). */
export function MarginCockpitPanel() {
  const [period, setPeriod] = useState<Period>('month');
  const { data: settings } = useSiteSettings();
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['costing-summary', period],
    queryFn: () => costingApi.getSummary(period),
    staleTime: 30_000,
  });

  const overTarget =
    data != null && data.totals.cost_tnd_per_kg > data.totals.target_cost_tnd_per_kg;

  return (
    <Card className="rounded-lg border-primary/20">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Scale className="h-4 w-4 text-primary" />
            Marge usine — TND/kg
          </CardTitle>
          <div className="flex gap-1">
            {(['week', 'month', 'quarter'] as const).map((p) => (
              <Button
                key={p}
                size="sm"
                variant={period === p ? 'default' : 'outline'}
                className="h-7 px-2 text-xs"
                onClick={() => setPeriod(p)}
              >
                {p === 'week' ? 'Sem.' : p === 'month' ? 'Mois' : 'Trim.'}
              </Button>
            ))}
            {data && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 text-xs"
                onClick={() =>
                  printCfoCostPack(data, {
                    companyName: settings?.company_name,
                    plantName: settings?.plant_name || undefined,
                  })
                }
              >
                <Printer className="h-3.5 w-3.5 mr-1" />
                Pack CFO
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {isLoading && (
          <p className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
          </p>
        )}
        {isError && (
          <div className="space-y-2">
            <p className="text-red-600">{error instanceof Error ? error.message : 'Erreur'}</p>
            <Button size="sm" variant="outline" onClick={() => refetch()}>
              Réessayer
            </Button>
          </div>
        )}
        {data && (
          <>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-xl border px-3 py-2.5">
                <p className="text-[11px] text-muted-foreground">Coût / kg</p>
                <p className="text-lg font-semibold">{fmt(data.totals.cost_tnd_per_kg, 3)}</p>
              </div>
              <div className="rounded-xl border px-3 py-2.5">
                <p className="text-[11px] text-muted-foreground">Cible</p>
                <p className="text-lg font-semibold">{fmt(data.totals.target_cost_tnd_per_kg, 3)}</p>
              </div>
              <div className="rounded-xl border px-3 py-2.5">
                <p className="text-[11px] text-muted-foreground">Écart vs cible</p>
                <p
                  className={`flex items-center gap-1 text-lg font-semibold ${
                    overTarget ? 'text-amber-700' : 'text-emerald-700'
                  }`}
                >
                  {overTarget ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                  {fmt(data.totals.cost_variance_pct, 1)}%
                </p>
              </div>
              <div className="rounded-xl border px-3 py-2.5">
                <p className="text-[11px] text-muted-foreground">Déchets</p>
                <p className="text-lg font-semibold">{fmt(data.totals.waste_kg, 1)} kg</p>
              </div>
            </div>

            <div className="rounded-xl border px-3 py-2.5">
              <div className="mb-2 flex flex-wrap gap-2">
                <Badge variant="outline">Total {fmt(data.totals.total_cost_tnd)} TND</Badge>
                <Badge variant="outline">Produit {fmt(data.totals.produced_kg, 1)} kg</Badge>
                <Badge variant="secondary">base standard</Badge>
              </div>
              <div className="space-y-1.5">
                {data.breakdown
                  .filter((row) => row.amount > 0)
                  .map((row) => (
                    <div key={row.category} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{row.label}</span>
                      <span className="font-medium">
                        {fmt(row.amount)} TND · {row.percentage}%
                      </span>
                    </div>
                  ))}
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground">
              Sources: {data.sources.triage_sessions} triage · {data.sources.packaging_orders} OF ·{' '}
              {data.sources.reception_lots_with_purchase_cost} lots avec achat
              {data.sources.mass_balance_unbalanced != null && data.sources.mass_balance_unbalanced > 0
                ? ` · ${data.sources.mass_balance_unbalanced} bilan hors tolérance`
                : ''}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
