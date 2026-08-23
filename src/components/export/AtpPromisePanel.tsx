import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { atpApi, type AtpPromise } from '@/lib/api/atp';
import { CalendarClock, Loader2 } from 'lucide-react';

const tone = (c: string) => {
  if (c === 'committed') return 'bg-emerald-600 text-white';
  if (c === 'partial') return 'bg-amber-500 text-white';
  return 'bg-slate-500 text-white';
};

/** Wave D — available-to-promise ship week from FEFO stock. */
export function AtpPromisePanel() {
  const [qty, setQty] = useState('5000');
  const [promise, setPromise] = useState<AtpPromise | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const summary = useQuery({
    queryKey: ['atp-summary'],
    queryFn: () => atpApi.summary(),
    staleTime: 60_000,
  });

  const runPromise = async () => {
    setBusy(true);
    setError(null);
    try {
      const data = await atpApi.promise({ qty_kg: Number(qty || 0) });
      setPromise(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur ATP');
      setPromise(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="rounded-[24px] border-primary/20">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarClock className="h-4 w-4 text-primary" />
          ATP — semaine de livraison
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {summary.data && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-xl border px-3 py-2">
              <p className="text-[11px] text-muted-foreground">Stock validé</p>
              <p className="font-semibold">{summary.data.available_validated_kg.toLocaleString('fr-TN')} kg</p>
            </div>
            <div className="rounded-xl border px-3 py-2">
              <p className="text-[11px] text-muted-foreground">Palettes scellées</p>
              <p className="font-semibold">{summary.data.sealed_ready_kg.toLocaleString('fr-TN')} kg</p>
            </div>
            <div className="rounded-xl border px-3 py-2">
              <p className="text-[11px] text-muted-foreground">Capacité libre</p>
              <p className="font-semibold">{summary.data.free_storage_capacity_kg.toLocaleString('fr-TN')} kg</p>
            </div>
            <div className="rounded-xl border px-3 py-2">
              <p className="text-[11px] text-muted-foreground">Exemple semaine</p>
              <p className="font-semibold">{summary.data.next_ship_week_sample}</p>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Quantité demandée (kg)</Label>
            <Input
              type="number"
              min={1}
              className="h-9 w-36"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
            />
          </div>
          <Button size="sm" onClick={runPromise} disabled={busy}>
            {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
            Promettre
          </Button>
        </div>

        {error && <p className="text-red-600 text-xs">{error}</p>}

        {promise && (
          <div className="rounded-xl border px-3 py-3 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={tone(promise.confidence)}>{promise.confidence}</Badge>
              <span className="font-semibold text-base">{promise.ship_week}</span>
              <span className="text-xs text-muted-foreground">dès {promise.ship_week_start}</span>
            </div>
            <p className="text-xs text-muted-foreground">{promise.notes}</p>
            <p className="text-xs">
              Couvert {promise.covered_kg} kg
              {promise.shortfall_kg > 0 ? ` · manque ${promise.shortfall_kg} kg` : ''}
              {' · '}
              {promise.allocations.length} lot(s) FEFO
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
