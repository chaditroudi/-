import { useState, useEffect, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import {
  PRODUCTION_LINE_CODES,
  PRODUCTION_LINE_DEFINITIONS,
  type ProductionLineCode,
  type ProductionLineStep,
} from '@/types/production-lines';
import {
  useFluxRuns,
  useStartFluxRun,
  useCompleteFluxRun,
  useCancelFluxRun,
  type FluxRun,
} from '@/hooks/useFluxRuns';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Circle,
  Clock,
  Droplets,
  FlaskConical,
  History,
  Leaf,
  Loader2,
  Package,
  Play,
  ShieldAlert,
  Square,
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
            <Badge className="rounded-md text-white text-[11px] font-bold" style={{ backgroundColor: def.color }}>
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
            <p className="mt-1 text-[10px] text-muted-foreground">
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
            <Badge className="rounded-md text-white text-[11px] font-bold" style={{ backgroundColor: def.color }}>
              {run.flux_code}
            </Badge>
            Terminer la production
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          <div className="rounded-lg bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground">
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
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-600" />
            </span>
            <span className="text-xs font-semibold text-emerald-800">En production</span>
            <Clock className="h-3 w-3 text-emerald-600" />
            <span className="text-xs text-emerald-700 font-mono">{elapsed}</span>
          </div>
          <div className="flex gap-1.5">
            <Button
              size="sm"
              className="h-7 rounded-lg px-2 text-[11px] bg-emerald-600 hover:bg-emerald-700"
              onClick={() => setCompleteOpen(true)}
            >
              <CheckCircle2 className="mr-1 h-3 w-3" />
              Terminer
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 rounded-lg px-2 text-[11px] text-red-500 hover:bg-red-50 hover:text-red-700"
              onClick={() => cancel.mutate(run.id)}
              disabled={cancel.isPending}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
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
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
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
                'flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[11px]',
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
                <Badge className="ml-auto rounded-full bg-red-100 px-1.5 py-0 text-[9px] font-semibold text-red-700">
                  CCP2 NC
                </Badge>
              )}
              {isCancel && (
                <Badge className="ml-auto rounded-full bg-muted px-1.5 py-0 text-[9px] text-muted-foreground">
                  Annulé
                </Badge>
              )}
              <span className="ml-auto text-[10px] text-muted-foreground">
                {new Date(run.started_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── StepChip ─────────────────────────────────────────────────────────────────

function StepChip({ step }: { step: ProductionLineStep }) {
  const hasCcp = Boolean(step.ccp);
  return (
    <div className="group relative flex flex-col items-center gap-0.5">
      <div className="flex items-center gap-0">
        {step.sequence > 1 && <span className="hidden h-px w-4 bg-border sm:block" />}
        <div
          className={cn(
            'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-[10px] font-bold transition-colors',
            hasCcp
              ? 'border-red-400 bg-red-50 text-red-700'
              : step.requiresQC
                ? 'border-amber-300 bg-amber-50 text-amber-700'
                : 'border-border bg-muted text-muted-foreground',
          )}
          title={hasCcp ? `${step.ccp} — ${step.description}` : step.description}
        >
          {step.sequence}
        </div>
      </div>
      <span className="max-w-[60px] text-center text-[9px] leading-tight text-muted-foreground">
        {step.label}
      </span>
      {hasCcp && (
        <Badge className="rounded-full bg-red-600 px-1 py-0 text-[8px] font-bold text-white">
          {step.ccp}
        </Badge>
      )}
    </div>
  );
}

function LineParamPill({ icon: Icon, label }: { icon: typeof Thermometer; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/60 px-2 py-0.5 text-[10px] text-muted-foreground">
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

function ProductionLineCard({
  code,
  isExpanded,
  onToggle,
  activeRun,
  recentRuns,
  isLoading,
}: ProductionLineCardProps) {
  const def = PRODUCTION_LINE_DEFINITIONS[code];
  const [startOpen, setStartOpen] = useState(false);

  return (
    <>
      <Card
        className="surface-card overflow-hidden border-l-4 border-t border-r border-b border-border transition-shadow hover:shadow-md"
        style={{ borderLeftColor: def.color }}
      >
        <CardHeader className="pb-0 pt-4 px-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  className="rounded-md px-2 py-0.5 text-[11px] font-bold text-white"
                  style={{ backgroundColor: def.color }}
                >
                  {def.code}
                </Badge>
                <span className="text-sm font-semibold text-foreground">{def.labelFr}</span>
                {def.isDerived && (
                  <Badge variant="outline" className="rounded-full px-1.5 py-0 text-[9px]">
                    Dérivé
                  </Badge>
                )}
                {activeRun && (
                  <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                    Live
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{def.description}</p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div
                className="shrink-0 rounded-xl border px-3 py-1.5 text-center text-xs"
                style={{ borderColor: def.color + '60', backgroundColor: def.color + '10' }}
              >
                <span className="font-bold" style={{ color: def.color }}>
                  {def.balance.yieldRangePercent[0]}–{def.balance.yieldRangePercent[1]} %
                </span>
                <p className="mt-0.5 text-[9px] text-muted-foreground">du tonnage</p>
              </div>
              {!activeRun && (
                <Button
                  size="sm"
                  className="h-7 rounded-lg px-2.5 text-[11px]"
                  style={{ backgroundColor: def.color }}
                  onClick={() => setStartOpen(true)}
                  disabled={isLoading}
                >
                  <Play className="mr-1 h-3 w-3" />
                  Démarrer
                </Button>
              )}
            </div>
          </div>

          <p className="mt-2 text-[10px] text-muted-foreground">
            <span className="font-medium text-foreground">Entrée :</span> {def.inputQuality}
          </p>

          <div className="mt-3 flex flex-wrap items-start gap-1">
            {def.steps.map((step) => (
              <StepChip key={step.code} step={step} />
            ))}
          </div>
        </CardHeader>

        <CardContent className="px-4 pb-4 pt-3">
          <div className="flex flex-wrap gap-1.5">
            {def.params.humidity && (
              <LineParamPill icon={Droplets} label={`Humidité ${def.params.humidity[0]}–${def.params.humidity[1]} %`} />
            )}
            {def.params.temperatureRange && (
              <LineParamPill icon={Thermometer} label={`T° ${def.params.temperatureRange[0]}–${def.params.temperatureRange[1]} °C`} />
            )}
            {def.params.throughput && (
              <LineParamPill icon={Zap} label={def.params.throughput} />
            )}
            {def.params.conservationConditions && (
              <LineParamPill icon={FlaskConical} label={def.params.conservationConditions} />
            )}
          </div>

          {/* Live run section */}
          {activeRun ? (
            <ActiveRunBadge run={activeRun} />
          ) : (
            <div className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Square className="h-3 w-3" />
              <span>Ligne inactive</span>
            </div>
          )}

          {/* Recent runs history */}
          {recentRuns.length > 0 && (
            <div className="mt-3 border-t border-border pt-3">
              <RecentRunsList runs={recentRuns} />
            </div>
          )}

          {/* Expand / collapse */}
          <button
            className="mt-3 flex items-center gap-1 text-[11px] text-primary/70 hover:text-primary"
            onClick={onToggle}
          >
            {isExpanded
              ? <><ChevronUp className="h-3 w-3" /> Masquer le détail</>
              : <><ChevronDown className="h-3 w-3" /> Voir le détail</>}
          </button>

          {isExpanded && (
            <div className="mt-3 space-y-2 border-t border-border pt-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Étapes</p>
              <div className="divide-y divide-border rounded-xl border border-border text-[11px]">
                {def.steps.map((step) => (
                  <div key={step.code} className="flex items-center gap-3 px-3 py-2">
                    <span className="w-5 text-center font-semibold text-muted-foreground">{step.sequence}</span>
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-foreground">{step.label}</span>
                      {step.ccp && (
                        <Badge className="ml-1.5 rounded-full bg-red-600 px-1.5 py-0 text-[8px] font-bold text-white">
                          {step.ccp}
                        </Badge>
                      )}
                      {step.requiresQC && !step.ccp && (
                        <Badge variant="outline" className="ml-1.5 rounded-full border-amber-300 px-1.5 py-0 text-[8px] text-amber-700">
                          QC
                        </Badge>
                      )}
                      <p className="text-muted-foreground">{step.description}</p>
                    </div>
                    {step.parameters && step.parameters.length > 0 && (
                      <div className="shrink-0 text-right text-[9px] text-muted-foreground">
                        {step.parameters.map((p) => (
                          <div key={p.key}>
                            {p.label}
                            {p.range && (p.range[0] !== null || p.range[1] !== null) && (
                              <span className="ml-1 text-foreground font-medium">
                                [{p.range[0] ?? '–'}, {p.range[1] ?? '–'}] {p.unit}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {def.params.packagingFormats && (
                <div className="mt-2">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Formats emballage</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {def.params.packagingFormats.map((fmt) => (
                      <Badge key={fmt} variant="outline" className="rounded-full text-[10px]">
                        <Package className="mr-1 h-2.5 w-2.5" />{fmt}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {def.params.notes && (
                <p className="rounded-lg bg-muted/40 px-3 py-2 text-[10px] text-muted-foreground">
                  {def.params.notes}
                </p>
              )}
              <div className="flex items-center gap-1.5 rounded-lg bg-muted/30 px-3 py-1.5">
                <Leaf className="h-3 w-3 text-emerald-600" />
                <p className="text-[10px] text-foreground">
                  <span className="font-medium">Destination :</span> {def.balance.destination}
                </p>
              </div>
              {def.fedBy && def.fedBy.length > 0 && (
                <p className="text-[10px] text-muted-foreground">
                  Alimenté par :{' '}
                  {def.fedBy.map((f) => (
                    <Badge
                      key={f}
                      className="ml-1 rounded-md px-1.5 py-0 text-[9px] font-bold text-white"
                      style={{ backgroundColor: PRODUCTION_LINE_DEFINITIONS[f].color }}
                    >
                      {f}
                    </Badge>
                  ))}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <StartRunDialog code={code} open={startOpen} onOpenChange={setStartOpen} />
    </>
  );
}

// ─── Common trunk ─────────────────────────────────────────────────────────────

function CommonTrunk() {
  const steps = [
    { label: 'Palmeraie', icon: Leaf, desc: 'Récolte régimes Deglet Nour', ccp: false },
    { label: 'Réception', icon: ShieldAlert, desc: 'Pesée · QC humidité · Désinsectisation (CCP1)', ccp: true },
    { label: 'Stockage froid', icon: Thermometer, desc: '0–4 °C · FIFO par lot', ccp: false },
    { label: 'Tri / aiguillage', icon: CheckCircle2, desc: 'Table vibrante · Trieuse optique', ccp: false },
  ];

  return (
    <Card className="surface-card border-border">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="rounded-full text-xs font-semibold uppercase tracking-widest">
            Tronc commun
          </Badge>
          <span className="text-xs text-muted-foreground">— toutes lignes F1–F8</span>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex flex-wrap items-start gap-0">
          {steps.map((step, i) => (
            <div key={step.label} className="flex items-center">
              <div className="flex flex-col items-center gap-1">
                <div
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-full border-2',
                    step.ccp
                      ? 'border-red-400 bg-red-50 text-red-700'
                      : 'border-border bg-muted/60 text-muted-foreground',
                  )}
                >
                  <step.icon className="h-4 w-4" />
                </div>
                <p className="text-[10px] font-semibold text-foreground">{step.label}</p>
                <p className="max-w-[80px] text-center text-[9px] text-muted-foreground">{step.desc}</p>
                {step.ccp && (
                  <Badge className="rounded-full bg-red-600 px-1.5 py-0 text-[8px] font-bold text-white">CCP1</Badge>
                )}
              </div>
              {i < steps.length - 1 && <div className="mx-2 mb-6 h-px w-8 bg-border" />}
            </div>
          ))}
          <div className="mx-2 mb-6 flex items-center">
            <div className="h-px w-8 bg-border" />
            <div className="text-xs font-bold text-muted-foreground">→ F1–F8</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Filter bar ───────────────────────────────────────────────────────────────

type FilterMode = 'all' | 'main' | 'derived';

function FilterBar({ mode, onChange }: { mode: FilterMode; onChange: (m: FilterMode) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {(['all', 'main', 'derived'] as FilterMode[]).map((m) => (
        <button
          key={m}
          onClick={() => onChange(m)}
          className={cn(
            'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
            mode === m
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-border bg-card text-muted-foreground hover:bg-muted',
          )}
        >
          {m === 'all' ? 'Toutes les lignes' : m === 'main' ? 'Lignes principales (F1–F4)' : 'Lignes dérivées (F5–F8)'}
        </button>
      ))}
    </div>
  );
}

function StepLegend() {
  return (
    <div className="flex flex-wrap items-center gap-4 text-[11px] text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <div className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-red-400 bg-red-50 text-[9px] font-bold text-red-700">n</div>
        CCP (point critique)
      </span>
      <span className="flex items-center gap-1.5">
        <div className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-amber-300 bg-amber-50 text-[9px] font-bold text-amber-700">n</div>
        Contrôle qualité requis
      </span>
      <span className="flex items-center gap-1.5">
        <div className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-border bg-muted text-[9px] font-bold text-muted-foreground">n</div>
        Étape opérationnelle
      </span>
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
    <div className="space-y-5">
      {/* Header + live summary */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">Flux matière — 8 lignes produits</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Cartographie des opérations · Données en temps réel (MAJ 30 s)
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className={cn(
            'inline-flex items-center gap-1 rounded-full border px-3 py-1 font-medium',
            activeCount > 0 ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-border bg-muted/60 text-muted-foreground',
          )}>
            {isLoading
              ? <Loader2 className="h-3 w-3 animate-spin" />
              : <span className={cn('h-1.5 w-1.5 rounded-full', activeCount > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground')} />}
            {activeCount > 0 ? `${activeCount} ligne${activeCount > 1 ? 's' : ''} en production` : 'Aucune ligne active'}
          </span>
          {todayRuns.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/60 px-3 py-1 font-medium text-muted-foreground">
              <History className="h-3 w-3" />
              {todayRuns.length} prod. aujourd'hui · {todayOutput.toLocaleString('fr-FR')} kg
            </span>
          )}
          <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/60 px-3 py-1 font-medium text-muted-foreground">
            <AlertTriangle className="h-3 w-3 text-red-500" />
            2 CCP
          </span>
        </div>
      </div>

      {/* Common trunk */}
      <CommonTrunk />

      {/* Filter + legend */}
      <FilterBar mode={filterMode} onChange={setFilterMode} />
      <StepLegend />

      {/* Line cards */}
      <div className="grid gap-4 lg:grid-cols-2">
        {visibleCodes.map((code) => (
          <ProductionLineCard
            key={code}
            code={code}
            isExpanded={expandedCode === code}
            onToggle={() => setExpandedCode((p) => (p === code ? null : code))}
            activeRun={activeRunsByLine(code)}
            recentRuns={recentRunsByLine(code)}
            isLoading={isLoading}
          />
        ))}
      </div>
    </div>
  );
}
