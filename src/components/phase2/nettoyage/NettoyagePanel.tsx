import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { apiRequest } from '@/integrations/mongodb/client';
import { useCleaningCycles, useCleaningKpis, useCreateCleaningCycle, useCloseCleaningCycle } from '@/hooks/useNettoyage';
import { CleaningProgram, WasteCategory, CLEANING_PROGRAM_CONFIG } from '@/types/phase2';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { AlertTriangle, CheckCircle2, Droplets, Plus, Loader2 } from 'lucide-react';
import { SummaryStrip } from '@/components/shared/SummaryStrip';
import { formatNumber, formatTime } from '@/lib/format';
import { cn } from '@/lib/utils';

const STATUS_STYLE = {
  EN_COURS: 'border-info/40 bg-card text-info',
  TERMINE: 'border-success/40 bg-card text-success',
  INCIDENT: 'border-destructive/40 bg-card text-destructive',
};

const MIN_YIELD = 92;
const WASTE_CATEGORIES: Array<{ value: WasteCategory; key: string }> = [
  { value: 'ORGANIQUE', key: 'organic' },
  { value: 'INERTE', key: 'inert' },
  { value: 'MAUVAISES_DATTES', key: 'badDates' },
];

/** A large tappable choice: one of a few options, shown all at once instead of a drop-down. */
function Choice({ selected, onSelect, title, hint }: { selected: boolean; onSelect: () => void; title: string; hint?: string }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        'flex min-h-14 w-full flex-col justify-center rounded-xl border-2 bg-card px-4 py-2.5 text-start transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        selected ? 'border-primary bg-accent' : 'border-border hover:border-primary/40',
      )}
    >
      <span className="font-semibold">{title}</span>
      {hint && <span className="text-sm text-muted-foreground">{hint}</span>}
    </button>
  );
}

export function NettoyagePanel({ currentUser = 'Utilisateur' }: { currentUser?: string }) {
  const { t } = useTranslation();
  const label = (key: string, values?: Record<string, unknown>) => t(`cleaning.${key}`, values);
  type SourceLot = { id: string; lot_number: string; current_quantity: number; unit: string; variety?: string | null; source_reception_id?: string | null };
  const sources = useQuery({ queryKey: ['cleaning-source-lots'], queryFn: async () => (await apiRequest<{ data: SourceLot[] }>('/phase2/cleaning/source-lots')).data });
  const { data: cycles = [], isLoading } = useCleaningCycles();
  const { data: kpis } = useCleaningKpis();
  const createCycle = useCreateCleaningCycle();
  const closeCycle = useCloseCleaningCycle();

  const [showCreate, setShowCreate] = useState(false);
  const [closingId, setClosingId] = useState<string | null>(null);

  const active = cycles.filter((c) => c.status === 'EN_COURS');
  const recent = cycles.filter((c) => c.status !== 'EN_COURS').slice(0, 10);
  const closingCycle = cycles.find((c) => c.id === closingId);

  // Create form state
  const [sourceId, setSourceId] = useState('');
  const selectedLot = sources.data?.find((lot) => lot.id === sourceId);
  const [createForm, setCreateForm] = useState({
    reception_id: '',
    lot_number: '',
    variety: '',
    program: 'B' as CleaningProgram,
    operator_name: currentUser,
  });

  // Close form state
  const [closeForm, setCloseForm] = useState({
    weight_in_kg: '',
    weight_out_kg: '',
    waste_weight_kg: '',
    waste_category: 'ORGANIQUE' as WasteCategory,
    turbidity_ntu: '',
    ph_water: '',
  });

  const handleCreate = async () => {
    if (!selectedLot) return;
    const lotId = selectedLot.source_reception_id ?? '';
    const lotNum = selectedLot.lot_number;
    const variety = (selectedLot?.variety ?? createForm.variety) || null;
    try { await createCycle.mutateAsync({
      source_stock_lot_id: selectedLot.id,
      reception_id: lotId,
      lot_number: lotNum,
      variety,
      program: createForm.program,
      operator_name: createForm.operator_name,
      created_by: currentUser,
    }); } catch { return; } // The mutation displays the error; preserve the worker's form.
    setShowCreate(false);
    setSourceId('');
    setCreateForm({ reception_id: '', lot_number: '', variety: '', program: 'B', operator_name: currentUser });
  };

  const handleClose = async () => {
    if (!closingId) return;
    try { await closeCycle.mutateAsync({
      id: closingId,
      weight_in_kg: Number(closeForm.weight_in_kg),
      weight_out_kg: Number(closeForm.weight_out_kg),
      waste_weight_kg: Number(closeForm.waste_weight_kg),
      waste_category: closeForm.waste_category,
      turbidity_ntu: closeForm.turbidity_ntu ? Number(closeForm.turbidity_ntu) : undefined,
      ph_water: closeForm.ph_water ? Number(closeForm.ph_water) : undefined,
    }); } catch { return; } // A rejected command must not close the dialog or lose measurements.
    setClosingId(null);
  };

  // Read-only views of what is typed: the yield and the gap the server's mass balance will check.
  const weightIn = Number(closeForm.weight_in_kg);
  const weightOut = Number(closeForm.weight_out_kg);
  const waste = Number(closeForm.waste_weight_kg);
  const yieldPct = closeForm.weight_in_kg && closeForm.weight_out_kg && weightIn > 0 ? (weightOut / weightIn) * 100 : null;
  const gap = closeForm.weight_in_kg && closeForm.weight_out_kg && closeForm.waste_weight_kg ? weightIn - weightOut - waste : null;
  const readyCount = sources.data?.length;
  const bigNumber = 'h-14 text-2xl font-semibold tabular-nums';

  return (
    <div className="space-y-5">
      {/* Start: how many released lots are waiting, and the one action that starts a cycle. */}
      <section className="flex flex-col gap-4 rounded-2xl border bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
            <Droplets className="h-6 w-6" aria-hidden />
          </span>
          <div>
            <h2 className="font-display text-xl font-semibold">{label('createTitle')}</h2>
            <p className="text-sm text-muted-foreground">
              {sources.isError ? label('sourceError') : readyCount == null ? label('loading') : label('readyLots', { count: readyCount })}
            </p>
          </div>
        </div>
        <Button size="xl" className="w-full sm:w-auto" onClick={() => setShowCreate(true)}>
          <Plus aria-hidden />
          {label('newCycle')}
        </Button>
      </section>

      <SummaryStrip items={[
        { label: label('active'), value: kpis?.active_count ?? active.length },
        { label: label('completed'), value: kpis?.completed_count ?? recent.filter(c => c.status === 'TERMINE').length },
        { label: label('averageYield'), value: kpis?.avg_yield_pct != null ? `${kpis.avg_yield_pct} %` : '—' },
        { label: label('minimumYield'), value: `${MIN_YIELD} %` },
      ]} />

      {/* Active cycles */}
      <section className="space-y-2">
        <h3 className="font-display text-lg font-semibold">{label('active')} ({active.length})</h3>
        {isLoading ? (
          <p role="status" className="rounded-2xl border bg-card px-4 py-6 text-center text-sm text-muted-foreground">{label('loading')}</p>
        ) : active.length === 0 ? (
          <p className="rounded-2xl border border-dashed bg-card px-4 py-6 text-center text-sm text-muted-foreground">{label('empty')}</p>
        ) : (
          <ul className="grid gap-3 lg:grid-cols-2">
            {active.map((c) => (
              <li key={c.id} className="flex flex-col gap-4 rounded-2xl border bg-card p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-mono text-lg font-semibold">{c.cycle_number}</p>
                    <p className="text-sm text-muted-foreground">{label('lot')} <span className="font-mono font-medium text-foreground">{c.lot_number}</span></p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="outline" className={STATUS_STYLE[c.status]}>{c.status === 'EN_COURS' ? label('inProgress') : label('incident')}</Badge>
                    <Badge variant="outline">{label('program' + c.program)}</Badge>
                  </div>
                </div>
                <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
                  {c.variety && (
                    <div className="rounded-xl bg-secondary/60 px-3 py-2"><dt className="text-muted-foreground">{label('variety')}</dt><dd className="font-semibold">{c.variety}</dd></div>
                  )}
                  <div className="rounded-xl bg-secondary/60 px-3 py-2"><dt className="text-muted-foreground">{label('operator')}</dt><dd className="truncate font-semibold">{c.operator_name || '—'}</dd></div>
                  <div className="rounded-xl bg-secondary/60 px-3 py-2"><dt className="text-muted-foreground">{label('started')}</dt><dd className="font-semibold tabular-nums">{formatTime(c.started_at)}</dd></div>
                </dl>
                <Button className="min-h-12 w-full sm:w-auto sm:self-end" onClick={() => setClosingId(c.id)}>
                  <CheckCircle2 aria-hidden />
                  {label('close')}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* History */}
      {recent.length > 0 && (
        <section className="space-y-2">
          <h3 className="font-display text-lg font-semibold">{label('history')}</h3>
          <ul className="space-y-2">
            {recent.map((c) => {
              const low = c.yield_percent != null && c.yield_percent < MIN_YIELD;
              return (
                <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border bg-card px-4 py-3 text-sm">
                  <span className="font-mono font-semibold">{c.cycle_number}</span>
                  <Badge variant="outline" className={STATUS_STYLE[c.status]}>{c.status === 'TERMINE' ? label('complete') : label('incident')}</Badge>
                  <span className="text-muted-foreground">{label('lot')} {c.lot_number}</span>
                  {c.yield_percent != null && (
                    <span className={cn('ms-auto inline-flex items-center gap-1 font-semibold tabular-nums', low ? 'text-destructive' : 'text-success')}>
                      {low ? <AlertTriangle className="h-4 w-4" aria-hidden /> : <CheckCircle2 className="h-4 w-4" aria-hidden />}
                      {label('yield')} {c.yield_percent}%
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-h-[92dvh] max-w-xl overflow-y-auto">
          <DialogHeader className="text-start">
            <DialogTitle className="font-display text-xl">{label('createTitle')}</DialogTitle>
            <DialogDescription>{label('sourceHelp')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="cleaning-source" className="text-sm font-medium">{label('sourceLot')}</Label>
              <select
                id="cleaning-source"
                value={sourceId}
                onChange={(e) => setSourceId(e.target.value)}
                disabled={sources.isLoading}
                className="flex h-12 w-full min-w-0 rounded-md border border-input bg-background px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">{label('selectLot')}</option>
                {sources.data?.map((lot) => <option key={lot.id} value={lot.id}>{lot.lot_number} · {lot.current_quantity} {lot.unit}</option>)}
              </select>
              {sources.isError && <p role="alert" className="text-sm text-destructive">{label('sourceError')}</p>}
              {!sources.isLoading && !sources.isError && sources.data?.length === 0 && <p className="text-sm text-muted-foreground">{label('noSources')}</p>}
              {selectedLot && (
                <dl className="grid grid-cols-2 gap-2 rounded-xl border border-primary/20 bg-accent p-3 text-sm">
                  <div><dt className="text-muted-foreground">{label('lot')}</dt><dd className="font-mono font-semibold">{selectedLot.lot_number}</dd></div>
                  <div><dt className="text-muted-foreground">{label('quantity')}</dt><dd className="font-semibold tabular-nums"><bdi dir="ltr">{formatNumber(selectedLot.current_quantity)} {selectedLot.unit}</bdi></dd></div>
                  {selectedLot.variety && <div className="col-span-2"><dt className="text-muted-foreground">{label('variety')}</dt><dd className="font-semibold">{selectedLot.variety}</dd></div>}
                </dl>
              )}
            </div>
            {!selectedLot?.variety && (
              <div className="space-y-1.5">
                <Label htmlFor="cleaning-variety" className="text-sm font-medium">{label('variety')}</Label>
                <Input id="cleaning-variety" className="h-12 text-base" value={createForm.variety} onChange={(e) => setCreateForm(p => ({ ...p, variety: e.target.value }))} placeholder="ex: Deglet Nour" />
              </div>
            )}
            <div className="space-y-1.5" role="group" aria-labelledby="cleaning-program-label">
              <p id="cleaning-program-label" className="text-sm font-medium">{label('washProgram')}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {(Object.keys(CLEANING_PROGRAM_CONFIG) as CleaningProgram[]).map((k) => (
                  <Choice key={k} selected={createForm.program === k} onSelect={() => setCreateForm(p => ({ ...p, program: k }))} title={label(`program${k}`)} hint={label(`effect${k}`)} />
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cleaning-operator" className="text-sm font-medium">{label('operator')}</Label>
              <Input id="cleaning-operator" className="h-12 text-base" value={createForm.operator_name} onChange={(e) => setCreateForm(p => ({ ...p, operator_name: e.target.value }))} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="min-h-12" onClick={() => setShowCreate(false)}>{label('cancel')}</Button>
            <Button className="min-h-12 font-semibold" onClick={handleCreate} disabled={createCycle.isPending || !selectedLot}>
              {createCycle.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {label('start')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Close dialog */}
      <Dialog open={!!closingId} onOpenChange={(v) => { if (!v) setClosingId(null); }}>
        <DialogContent className="max-h-[92dvh] max-w-xl overflow-y-auto">
          <DialogHeader className="text-start">
            <DialogTitle className="font-display text-xl">{label('closeTitle')}</DialogTitle>
            <DialogDescription>
              {closingCycle && <bdi dir="ltr" className="block font-mono font-semibold text-foreground">{closingCycle.cycle_number} · {closingCycle.lot_number}</bdi>}
              {label('balanceHelp')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cleaning-input" className="text-sm font-medium">{label('input')}</Label>
                <Input id="cleaning-input" type="number" inputMode="decimal" className={bigNumber} value={closeForm.weight_in_kg} onChange={(e) => setCloseForm(p => ({ ...p, weight_in_kg: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cleaning-output" className="text-sm font-medium">{label('output')}</Label>
                <Input id="cleaning-output" type="number" inputMode="decimal" className={bigNumber} value={closeForm.weight_out_kg} onChange={(e) => setCloseForm(p => ({ ...p, weight_out_kg: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cleaning-waste" className="text-sm font-medium">{label('waste')}</Label>
                <Input id="cleaning-waste" type="number" inputMode="decimal" className={bigNumber} value={closeForm.waste_weight_kg} onChange={(e) => setCloseForm(p => ({ ...p, waste_weight_kg: e.target.value }))} />
              </div>
              <div className={cn('flex flex-col justify-end rounded-xl border px-3 py-2',
                yieldPct == null ? 'bg-secondary/60' : yieldPct < MIN_YIELD ? 'border-destructive/30 bg-destructive/5' : 'border-primary/30 bg-accent')}>
                <span className="text-sm text-muted-foreground">{label('estimatedYield')}</span>
                <span className={cn('text-2xl font-semibold tabular-nums', yieldPct != null && yieldPct < MIN_YIELD && 'text-destructive')}>
                  {yieldPct == null ? '—' : `${yieldPct.toFixed(1)}%`}
                </span>
                {yieldPct != null && yieldPct < MIN_YIELD && <span className="text-xs font-semibold text-destructive">{label('lowYield')}</span>}
              </div>
            </div>
            {gap != null && (
              <p role="status" className={cn('rounded-xl border px-3 py-2 text-sm', Math.abs(gap) < 0.05 ? 'border-primary/30 bg-accent' : 'border-warning/30 bg-sand')}>
                {Math.abs(gap) < 0.05 ? label('balanceOk') : label('balanceGap', { gap: formatNumber(gap) })}
              </p>
            )}
            <div className="space-y-1.5" role="group" aria-labelledby="cleaning-waste-category">
              <p id="cleaning-waste-category" className="text-sm font-medium">{label('wasteCategory')}</p>
              <div className="grid grid-cols-3 gap-2">
                {WASTE_CATEGORIES.map((category) => (
                  <Choice key={category.value} selected={closeForm.waste_category === category.value} onSelect={() => setCloseForm(p => ({ ...p, waste_category: category.value }))} title={label(category.key)} />
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cleaning-turbidity" className="text-sm font-medium">{label('turbidity')}</Label>
                <Input id="cleaning-turbidity" type="number" inputMode="decimal" className="h-12 text-lg tabular-nums" value={closeForm.turbidity_ntu} onChange={(e) => setCloseForm(p => ({ ...p, turbidity_ntu: e.target.value }))} placeholder="ex: 80" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cleaning-ph" className="text-sm font-medium">{label('ph')}</Label>
                <Input id="cleaning-ph" type="number" inputMode="decimal" step="0.1" className="h-12 text-lg tabular-nums" value={closeForm.ph_water} onChange={(e) => setCloseForm(p => ({ ...p, ph_water: e.target.value }))} placeholder="ex: 7.2" />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="min-h-12" onClick={() => setClosingId(null)}>{label('cancel')}</Button>
            <Button className="min-h-12 font-semibold" onClick={handleClose} disabled={closeCycle.isPending || !closeForm.weight_in_kg || !closeForm.weight_out_kg || !closeForm.waste_weight_kg}>
              {closeCycle.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {label('submitClose')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
