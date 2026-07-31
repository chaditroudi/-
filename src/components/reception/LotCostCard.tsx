import { useQuery } from '@tanstack/react-query';
import { costingApi } from '@/lib/api/costing';
import { Badge } from '@/components/ui/badge';

const fmt = (value: number | null | undefined, digits = 3) => {
  if (value == null || !Number.isFinite(Number(value))) return '—';
  return `${Number(value).toFixed(digits)} TND`;
};

type Props = {
  lotId: string;
};

export function LotCostCard({ lotId }: Props) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['lot-cost', lotId],
    queryFn: () => costingApi.getLotCost(lotId),
    enabled: Boolean(lotId),
    retry: 1,
  });

  if (isLoading) {
    return <p className="text-xs text-muted-foreground">Chargement du coût lot…</p>;
  }

  if (isError || !data) {
    return null;
  }

  const purchase = data.lot.purchase_cost_tnd_per_kg;
  const grades = data.triage?.grades?.filter((g) => g.destination !== 'DESTRUCTION') ?? [];

  return (
    <div className="rounded-2xl border bg-muted/30 p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">Coût lot (Wave B)</p>
        <Badge variant="outline" className="text-[10px]">
          base {data.rates.basis}
        </Badge>
      </div>
      <div className="grid gap-3 sm:grid-cols-3 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Achat / kg</p>
          <p className="font-semibold">{fmt(purchase)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Achat total</p>
          <p className="font-semibold">{fmt(data.lot.purchase_cost_tnd, 2)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Cible / kg</p>
          <p className="font-semibold">{fmt(data.rates.target_cost_tnd_per_kg)}</p>
        </div>
      </div>

      {data.triage ? (
        <div className="space-y-2 border-t pt-3">
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span>Input triage {fmt(data.triage.input_cost_tnd as number, 2)}</span>
            <span>Matière {fmt(data.triage.material_cost_tnd as number, 2)}</span>
            <span>MO {fmt(data.triage.labour_cost_tnd as number, 2)}</span>
            <span>Overhead {fmt(data.triage.overhead_cost_tnd as number, 2)}</span>
            {data.triage.mass_balance_variance_pct != null && (
              <span>Δ matière {data.triage.mass_balance_variance_pct}%</span>
            )}
          </div>
          {grades.length > 0 && (
            <div className="grid gap-2 sm:grid-cols-3">
              {grades.map((grade) => (
                <div key={String(grade.lot_number || grade.grade)} className="rounded-lg border bg-background px-3 py-2">
                  <p className="text-[11px] text-muted-foreground">{grade.grade}</p>
                  <p className="text-sm font-semibold">{fmt(grade.cost_tnd_per_kg)} / kg</p>
                  <p className="text-[11px] text-muted-foreground">{grade.weight_kg} kg</p>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Coût d&apos;achat figé à la réception. Le coût par grade apparaîtra après clôture triage.
        </p>
      )}
    </div>
  );
}
