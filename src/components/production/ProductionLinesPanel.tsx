import { useState, useEffect, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

import { cn } from '@/lib/utils';
import {
  PRODUCTION_LINE_CODES,
  PRODUCTION_LINE_DEFINITIONS,
  type ProductionLineCode,
} from '@/types/production-lines';
import {
  useFluxRuns,
  useStartFluxRun,
  useCompleteFluxRun,
  useCancelFluxRun,
  type FluxRun,
} from '@/hooks/useFluxRuns';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Droplets,
  FlaskConical,
  Loader2,
  Play,
  Thermometer,
  TrendingUp,
  X,
  Zap,
} from 'lucide-react';

// ─── Elapsed timer ────────────────────────────────────────────────────────────

function useElapsed(startedAt: string | null): string {
  const [elapsed, setElapsed] = useState('');

  useEffect(() => {
    if (!startedAt) { setElapsed(''); return; }
    const tick = () => {
      const secs = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
      const h = Math.floor(secs / 3600);
      const m = Math.floor((secs % 3600) / 60);
      const s = secs % 60;
      setElapsed(h > 0
        ? `${h}h ${String(m).padStart(2, '0')}min`
        : `${m}min ${String(s).padStart(2, '0')}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  return elapsed;
}

// ─── Start Run Dialog ─────────────────────────────────────────────────────────

interface StartRunDialogProps {
  code: ProductionLineCode;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

function StartRunDialog({ code, open, onOpenChange }: StartRunDialogProps) {
  const def = PRODUCTION_LINE_DEFINITIONS[code];
  const [operator, setOperator] = useState('');
  const [inputKg, setInputKg] = useState('');
  const [notes, setNotes] = useState('');
  const start = useStartFluxRun();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!operator.trim() || !inputKg) return;
    start.mutate(
      { flux_code: code, operator_name: operator.trim(), input_weight_kg: parseFloat(inputKg), notes: notes || undefined },
      {
        onSuccess: () => {
          setOperator(''); setInputKg(''); setNotes('');
          onOpenChange(false);
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Badge className="rounded-md text-white text-xs font-bold" style={{ backgroundColor: def.color }}>
              {code}
            </Badge>
            Démarrer une production
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          <div>
            <Label>Opérateur *</Label>
            <Input
              value={operator}
              onChange={(e) => setOperator(e.target.value)}
              placeholder="Nom de l'opérateur"
              required
            />
          </div>
          <div>
            <Label>Poids entrant (kg) *</Label>
            <Input
              type="number"
              step="0.1"
              min="0"
              value={inputKg}
              onChange={(e) => setInputKg(e.target.value)}
              placeholder="ex. 1000"
              required
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Rendement attendu : {def.balance.yieldRangePercent[0]}–{def.balance.yieldRangePercent[1]} %
            </p>
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Variété, lot MP, remarques…"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={start.isPending}>
              {start.isPending ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />Démarrage…</> : <><Play className="h-3.5 w-3.5 mr-1" />Démarrer</>}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Complete Run Dialog ──────────────────────────────────────────────────────

interface CompleteRunDialogProps {
  run: FluxRun;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

function CompleteRunDialog({ run, open, onOpenChange }: CompleteRunDialogProps) {
  const def = PRODUCTION_LINE_DEFINITIONS[run.flux_code as ProductionLineCode];
  const [outputKg, setOutputKg] = useState('');
  const [wasteKg, setWasteKg] = useState('');
  const [ccp2Passed, setCcp2Passed] = useState<'true' | 'false'>('true');
  const [notes, setNotes] = useState(run.notes ?? '');
  const complete = useCompleteFluxRun();

  const computedYield =
    outputKg && run.input_weight_kg > 0
      ? ((parseFloat(outputKg) / run.input_weight_kg) * 100).toFixed(1)
      : null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    complete.mutate(
      {
        id: run.id,
        output_weight_kg: parseFloat(outputKg),
        waste_kg: parseFloat(wasteKg || '0'),
        ccp2_passed: ccp2Passed === 'true',
        notes: notes || undefined,
      },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Badge className="rounded-md text-white text-xs font-bold" style={{ backgroundColor: def.color }}>
              {run.flux_code}
            </Badge>
            Terminer la production
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          <div className="rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            Entrée : <span className="font-bold text-foreground">{run.input_weight_kg.toLocaleString('fr-FR')} kg</span>
            {' · '}Opérateur : {run.operator_name}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Poids sortant (kg) *</Label>
              <Input
                type="number"
                step="0.1"
                min="0"
                value={outputKg}
                onChange={(e) => setOutputKg(e.target.value)}
                placeholder="ex. 850"
                required
              />
            </div>
            <div>
              <Label>Pertes / déchets (kg)</Label>
              <Input
                type="number"
                step="0.1"
                min="0"
                value={wasteKg}
                onChange={(e) => setWasteKg(e.target.value)}
                placeholder="ex. 30"
              />
            </div>
          </div>
          {computedYield && (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs">
              <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
              <span className="text-emerald-700">
                Rendement calculé : <span className="font-bold">{computedYield} %</span>
                {' '}(cible : {def.balance.yieldRangePercent[0]}–{def.balance.yieldRangePercent[1]} %)
              </span>
            </div>
          )}
          <div>
            <Label>CCP2 — Détecteur métaux *</Label>
            <Select value={ccp2Passed} onValueChange={(v) => setCcp2Passed(v as 'true' | 'false')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="true">✓ Conforme — Aucun corps étranger détecté</SelectItem>
                <SelectItem value="false">✗ Non conforme — Lot isolé</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Notes finales</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Observations de fin de production…"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={complete.isPending}>
              {complete.isPending ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />Enregistrement…</> : <><CheckCircle2 className="h-3.5 w-3.5 mr-1" />Terminer</>}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Active Run Badge ─────────────────────────────────────────────────────────

function ActiveRunBadge({ run }: { run: FluxRun }) {
  const elapsed = useElapsed(run.started_at);
  const cancel = useCancelFluxRun();
  const [completeOpen, setCompleteOpen] = useState(false);

  return (
    <>
      <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full hidden rounded-full bg-emerald-500 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-600" />
            </span>
            <span className="text-xs font-semibold text-emerald-800">En production</span>
            <Clock className="h-3 w-3 text-emerald-600" />
            <span className="text-xs text-emerald-700 font-mono">{elapsed}</span>
          </div>
          <div className="flex gap-1.5">
            <Button
              size="sm"
              className="h-9 rounded-lg px-2 text-xs bg-emerald-600 hover:bg-emerald-700"
              onClick={() => setCompleteOpen(true)}
            >
              <CheckCircle2 className="mr-1 h-3 w-3" />
              Terminer
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-9 rounded-lg px-2 text-xs text-red-500 hover:bg-red-50 hover:text-red-700"
              onClick={() => cancel.mutate(run.id)}
              disabled={cancel.isPending}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-muted-foreground">Opérateur : </span>
            <span className="font-medium text-foreground">{run.operator_name}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Entrée : </span>
            <span className="font-medium text-foreground">{run.input_weight_kg.toLocaleString('fr-FR')} kg</span>
          </div>
        </div>
      </div>
      <CompleteRunDialog run={run} open={completeOpen} onOpenChange={setCompleteOpen} />
    </>
  );
}

// ─── Recent Runs List ─────────────────────────────────────────────────────────

function RecentRunsList({ runs }: { runs: FluxRun[] }) {
  if (runs.length === 0) return null;

  return (
    <div className="mt-2">
      <p className="mb-1.5 text-[11px] font-semibold text-muted-foreground">
        Historique récent
      </p>
      <div className="space-y-1.5">
        {runs.slice(0, 3).map((run) => {
          const yieldPct =
            run.input_weight_kg > 0 && run.output_weight_kg > 0
              ? ((run.output_weight_kg / run.input_weight_kg) * 100).toFixed(1)
              : null;
          const isCancel = run.status === 'cancelled';
          return (
            <div
              key={run.id}
              className={cn(
                'flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs',
                isCancel
                  ? 'border-border bg-muted/30 opacity-60'
                  : 'border-border bg-card',
              )}
            >
              <span className={cn('font-medium', isCancel ? 'text-muted-foreground' : 'text-foreground')}>
                {run.input_weight_kg.toLocaleString('fr-FR')} kg
              </span>
              {yieldPct && (
                <>
                  <span className="text-muted-foreground">→</span>
                  <span className="font-semibold text-emerald-700">{yieldPct} %</span>
                </>
              )}
              {run.ccp2_passed === false && (
                <Badge className="ml-auto rounded-full bg-red-100 px-1.5 py-0 text-[11px] font-semibold text-red-700">
                  CCP2 NC
                </Badge>
              )}
              {isCancel && (
                <Badge className="ml-auto rounded-full bg-muted px-1.5 py-0 text-[11px] text-muted-foreground">
                  Annulé
                </Badge>
              )}
              <span className="ml-auto text-[11px] text-muted-foreground">
                {new Date(run.started_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LineParamPill({ icon: Icon, label }: { icon: typeof Thermometer; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/60 px-2 py-0.5 text-[11px] text-muted-foreground">
      <Icon className="h-2.5 w-2.5" />
      {label}
    </span>
  );
}

// ─── Production Line Card (dynamic) ───────────────────────────────────────────

interface ProductionLineCardProps {
  code: ProductionLineCode;
  isExpanded: boolean;
  onToggle: () => void;
  activeRun: FluxRun | null;
  recentRuns: FluxRun[];
  isLoading: boolean;
}

function ProductionLineRow({
  code,
  isExpanded,
  onToggle,
  activeRun,
  recentRuns,
  isLoading,
}: ProductionLineCardProps) {
  const def = PRODUCTION_LINE_DEFINITIONS[code];
  const [startOpen, setStartOpen] = useState(false);
  const ccps = def.steps.filter((step) => step.ccp).map((step) => step.ccp);

  return (
    <li className="border-t first:border-t-0">
      <div className="grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-3 px-3 py-2 md:grid-cols-[2.5rem_minmax(0,1fr)_6rem_9rem_auto]">
        <span className="rounded-sm px-1.5 py-0.5 text-center text-xs font-bold text-white" style={{ backgroundColor: def.color }}>
          {def.code}
        </span>
        <button type="button" aria-expanded={isExpanded} className="min-h-9 min-w-0 text-left pointer-coarse:min-h-11" onClick={onToggle}>
          <span className="flex items-center gap-1 text-sm font-medium text-foreground">
            {isExpanded ? <ChevronUp className="h-3.5 w-3.5 shrink-0" /> : <ChevronDown className="h-3.5 w-3.5 shrink-0" />}
            <span className="truncate">{def.labelFr}</span>
          </span>
          <span className="block truncate pl-[1.125rem] text-xs text-muted-foreground">
            {def.steps.length} étapes{ccps.length > 0 ? `, ${ccps.join(', ')}` : ''}{def.isDerived ? ', ligne dérivée' : ''}
          </span>
        </button>
        <span className="hidden text-sm text-muted-foreground md:block">
          {def.balance.yieldRangePercent[0]} à {def.balance.yieldRangePercent[1]} %
        </span>
        <span className={cn('hidden text-sm md:block', activeRun ? 'font-medium text-emerald-800' : 'text-muted-foreground')}>
          {activeRun ? 'En production' : 'Inactive'}
        </span>
        {activeRun ? (
          <span className="text-sm font-medium text-emerald-800 md:hidden">En production</span>
        ) : (
          <Button size="sm" variant="outline" onClick={() => setStartOpen(true)} disabled={isLoading} aria-label={`Démarrer la ligne ${def.code}`}>
            <Play className="mr-1 h-3 w-3" />
            Démarrer
          </Button>
        )}
      </div>

      {activeRun && (
        <div className="px-3 pb-3">
          <ActiveRunBadge run={activeRun} />
        </div>
      )}

      {isExpanded && (
        <div className="space-y-3 border-t bg-muted/20 px-3 py-3">
          <p className="text-sm text-muted-foreground">{def.description}</p>
          <p className="text-sm"><span className="font-medium">Entrée :</span> {def.inputQuality}</p>
          <div className="flex flex-wrap gap-1.5">
            {def.params.humidity && (
              <LineParamPill icon={Droplets} label={`Humidité ${def.params.humidity[0]} à ${def.params.humidity[1]} %`} />
            )}
            {def.params.temperatureRange && (
              <LineParamPill icon={Thermometer} label={`Température ${def.params.temperatureRange[0]} à ${def.params.temperatureRange[1]} °C`} />
            )}
            {def.params.throughput && (
              <LineParamPill icon={Zap} label={def.params.throughput} />
            )}
            {def.params.conservationConditions && (
              <LineParamPill icon={FlaskConical} label={def.params.conservationConditions} />
            )}
          </div>

          {recentRuns.length > 0 && <RecentRunsList runs={recentRuns} />}

          <ol className="divide-y rounded-lg border bg-card text-sm">
            {def.steps.map((step) => (
              <li key={step.code} className="flex items-start gap-3 px-3 py-2">
                <span className="w-5 shrink-0 text-center font-medium text-muted-foreground">{step.sequence}</span>
                <div className="min-w-0 flex-1">
                  <span className="font-medium text-foreground">{step.label}</span>
                  {step.ccp && <Badge className="ml-1.5 rounded-sm bg-red-700 px-1.5 py-0 text-xs font-semibold text-white">{step.ccp}</Badge>}
                  {step.requiresQC && !step.ccp && <Badge variant="outline" className="ml-1.5 rounded-sm border-amber-300 px-1.5 py-0 text-xs text-amber-800">QC</Badge>}
                  <p className="text-xs text-muted-foreground">{step.description}</p>
                </div>
                {step.parameters && step.parameters.length > 0 && (
                  <div className="shrink-0 text-right text-xs text-muted-foreground">
                    {step.parameters.map((p) => (
                      <div key={p.key}>
                        {p.label}
                        {p.range && (p.range[0] !== null || p.range[1] !== null) && (
                          <span className="ml-1 font-medium text-foreground">
                            {p.range[0] ?? '–'} à {p.range[1] ?? '–'} {p.unit}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ol>

          {def.params.packagingFormats && (
            <p className="text-sm"><span className="font-medium">Formats :</span> {def.params.packagingFormats.join(', ')}</p>
          )}
          {def.params.notes && <p className="text-sm text-muted-foreground">{def.params.notes}</p>}
          <p className="text-sm"><span className="font-medium">Destination :</span> {def.balance.destination}</p>
          {def.fedBy && def.fedBy.length > 0 && (
            <p className="text-sm"><span className="font-medium">Alimentée par :</span> {def.fedBy.join(', ')}</p>
          )}
        </div>
      )}

      <StartRunDialog code={code} open={startOpen} onOpenChange={setStartOpen} />
    </li>
  );
}

// ─── Common trunk ─────────────────────────────────────────────────────────────

function CommonTrunk() {
  const steps = ['Palmeraie', 'Réception (CCP1)', 'Stockage froid', 'Tri et aiguillage'];
  return (
    <p className="text-sm text-muted-foreground">
      <span className="font-medium text-foreground">Avant toute ligne :</span> {steps.join(', puis ')}.
    </p>
  );
}

// ─── Filter bar ───────────────────────────────────────────────────────────────

type FilterMode = 'all' | 'main' | 'derived';

function FilterBar({ mode, onChange }: { mode: FilterMode; onChange: (m: FilterMode) => void }) {
  return (
    <div className="flex flex-wrap gap-1">
      {(['all', 'main', 'derived'] as FilterMode[]).map((m) => (
        <Button key={m} type="button" size="sm" variant={mode === m ? 'secondary' : 'ghost'} aria-pressed={mode === m} onClick={() => onChange(m)}>
          {m === 'all' ? 'Toutes' : m === 'main' ? 'Principales (F1 à F4)' : 'Dérivées (F5 à F8)'}
        </Button>
      ))}
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function ProductionLinesPanel() {
  const [expandedCode, setExpandedCode] = useState<ProductionLineCode | null>(null);
  const [filterMode, setFilterMode] = useState<FilterMode>('all');

  // Fetch ALL runs (active + recent history) — refreshes every 30 s
  const { data: allRuns = [], isLoading } = useFluxRuns();

  const activeRunsByLine = useCallback(
    (code: ProductionLineCode) => allRuns.find((r) => r.flux_code === code && r.status === 'running') ?? null,
    [allRuns],
  );

  const recentRunsByLine = useCallback(
    (code: ProductionLineCode) =>
      allRuns
        .filter((r) => r.flux_code === code && r.status !== 'running')
        .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime()),
    [allRuns],
  );

  const activeCount = allRuns.filter((r) => r.status === 'running').length;
  const todayRuns = allRuns.filter(
    (r) =>
      r.status === 'completed' &&
      new Date(r.started_at).toDateString() === new Date().toDateString(),
  );
  const todayOutput = todayRuns.reduce((s, r) => s + r.output_weight_kg, 0);

  const visibleCodes = PRODUCTION_LINE_CODES.filter((code) => {
    const def = PRODUCTION_LINE_DEFINITIONS[code];
    if (filterMode === 'main') return !def.isDerived;
    if (filterMode === 'derived') return def.isDerived;
    return true;
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <FilterBar mode={filterMode} onChange={setFilterMode} />
        <p className="text-sm text-muted-foreground" role="status">
          {isLoading ? 'Chargement…' : activeCount > 0 ? `${activeCount} ligne${activeCount > 1 ? 's' : ''} en production` : 'Aucune ligne en production'}
          {todayRuns.length > 0 && `, ${todayRuns.length} production${todayRuns.length > 1 ? 's' : ''} aujourd'hui pour ${todayOutput.toLocaleString('fr-FR')} kg`}
        </p>
      </div>
      <CommonTrunk />
      <div className="overflow-hidden rounded-lg border bg-card">
        <div className="hidden grid-cols-[2.5rem_minmax(0,1fr)_6rem_9rem_auto] gap-3 border-b bg-muted/50 px-3 py-1.5 text-xs font-medium text-muted-foreground md:grid">
          <span>Ligne</span>
          <span>Produit</span>
          <span>Du tonnage</span>
          <span>État</span>
          <span className="w-[6.5rem]" />
        </div>
        <ul>
          {visibleCodes.map((code) => (
            <ProductionLineRow
              key={code}
              code={code}
              isExpanded={expandedCode === code}
              onToggle={() => setExpandedCode((p) => (p === code ? null : code))}
              activeRun={activeRunsByLine(code)}
              recentRuns={recentRunsByLine(code)}
              isLoading={isLoading}
            />
          ))}
        </ul>
      </div>
    </div>
  );
}
