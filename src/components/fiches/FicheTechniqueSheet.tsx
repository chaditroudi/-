import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Circle,
  Clock3,
  Printer,
  Wrench,
  ArrowRight,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import type { AppNavigateFn } from '@/lib/appNavigate';
import { useAuthContext } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  clearFicheAck,
  ficheStageLabel,
  isFicheAckCurrentShift,
  loadFicheAcks,
  loadFicheChecklist,
  printFicheTechnique,
  saveFicheAck,
  saveFicheChecklist,
  type FicheShiftAck,
  type FicheTechnique,
} from '@/lib/fichesTechniques';

interface FicheTechniqueSheetProps {
  fiche: FicheTechnique | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate: AppNavigateFn;
}

export function FicheTechniqueSheet({
  fiche,
  open,
  onOpenChange,
  onNavigate,
}: FicheTechniqueSheetProps) {
  const { profile, user } = useAuthContext();
  const [checked, setChecked] = useState<boolean[]>([]);
  const [ack, setAck] = useState<FicheShiftAck | null>(null);
  const [operator, setOperator] = useState('');
  const [shift, setShift] = useState<FicheShiftAck['shift']>('matin');

  useEffect(() => {
    if (!fiche) return;
    const all = loadFicheChecklist();
    const saved = all[fiche.id];
    setChecked(
      saved && saved.length === fiche.steps.length
        ? saved
        : fiche.steps.map(() => false),
    );
    const existing = loadFicheAcks()[fiche.id] || null;
    setAck(existing);
    setOperator(existing?.operator || profile?.full_name || user?.email || '');
    setShift(existing?.shift || 'matin');
  }, [fiche, profile?.full_name, user?.email]);

  const doneCount = useMemo(() => checked.filter(Boolean).length, [checked]);
  const pct = fiche && fiche.steps.length ? Math.round((doneCount / fiche.steps.length) * 100) : 0;
  const ackToday = isFicheAckCurrentShift(ack);

  const toggleStep = (index: number) => {
    if (!fiche) return;
    setChecked((prev) => {
      const next = [...prev];
      next[index] = !next[index];
      const all = loadFicheChecklist();
      all[fiche.id] = next;
      saveFicheChecklist(all);
      return next;
    });
  };

  const resetChecklist = () => {
    if (!fiche) return;
    const next = fiche.steps.map(() => false);
    setChecked(next);
    const all = loadFicheChecklist();
    all[fiche.id] = next;
    saveFicheChecklist(all);
  };

  const confirmAck = () => {
    if (!fiche) return;
    if (!operator.trim()) {
      toast.error('Indiquez votre nom');
      return;
    }
    const next: FicheShiftAck = {
      operator: operator.trim(),
      shift,
      at: new Date().toISOString(),
      applied: true,
    };
    saveFicheAck(fiche.id, next);
    setAck(next);
    toast.success('Fiche lue et appliquée — enregistré pour ce shift');
  };

  const revokeAck = () => {
    if (!fiche) return;
    clearFicheAck(fiche.id);
    setAck(null);
    toast.message('Accusé retiré');
  };

  if (!fiche) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-lg">
        <SheetHeader className="space-y-2 border-b px-5 py-4 text-start">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="font-mono">
              {fiche.code}
            </Badge>
            <Badge variant="secondary">{ficheStageLabel(fiche)}</Badge>
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Clock3 className="h-3.5 w-3.5" /> ~{fiche.durationMin} min
            </span>
            {ackToday && <Badge className="bg-emerald-600 text-white">Lu · shift</Badge>}
          </div>
          <SheetTitle className="text-xl leading-tight">{fiche.title}</SheetTitle>
          <SheetDescription className="text-sm text-foreground/80">{fiche.purpose}</SheetDescription>
          <p className="text-xs text-muted-foreground">Poste : {fiche.poste}</p>
        </SheetHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-muted-foreground">Checklist atelier</span>
              <span className="tabular-nums text-muted-foreground">
                {doneCount}/{fiche.steps.length} · {pct}%
              </span>
            </div>
            <Progress value={pct} className="h-2" />
          </div>

          <section className="space-y-2">
            <h3 className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              <CheckCircle2 className="h-3.5 w-3.5" /> Étapes
            </h3>
            <ul className="space-y-2">
              {fiche.steps.map((step, i) => {
                const on = Boolean(checked[i]);
                return (
                  <li key={`${fiche.id}-step-${i}`}>
                    <button
                      type="button"
                      onClick={() => toggleStep(i)}
                      className={cn(
                        'flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-start text-sm transition-colors',
                        on
                          ? 'border-emerald-200 bg-emerald-50/80 text-emerald-950'
                          : 'hover:bg-muted/40',
                      )}
                    >
                      {on ? (
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                      ) : (
                        <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      )}
                      <span className={cn(on && 'line-through opacity-80')}>
                        <span className="me-1 font-semibold text-muted-foreground">{i + 1}.</span>
                        {step}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {doneCount > 0 && (
              <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={resetChecklist}>
                Réinitialiser la checklist
              </Button>
            )}
          </section>

          <section className="space-y-3 rounded-xl border border-primary/20 bg-primary/5 p-3">
            <h3 className="text-xs font-semibold text-primary">
              Accusé shift — lu / appliqué
            </h3>
            {ackToday ? (
              <div className="space-y-2 text-sm">
                <p>
                  <span className="font-medium">{ack!.operator}</span>
                  {' · '}
                  {ack!.shift}
                  {' · '}
                  {new Date(ack!.at).toLocaleString('fr-FR')}
                </p>
                <Button type="button" variant="ghost" size="sm" className="h-8 px-2" onClick={revokeAck}>
                  Retirer l&apos;accusé
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">Opérateur</Label>
                  <Input
                    value={operator}
                    onChange={(e) => setOperator(e.target.value)}
                    placeholder="Votre nom"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Shift</Label>
                  <Select value={shift} onValueChange={(v) => setShift(v as FicheShiftAck['shift'])}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="matin">Matin</SelectItem>
                      <SelectItem value="apres-midi">Après-midi</SelectItem>
                      <SelectItem value="nuit">Nuit</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button type="button" className="w-full" onClick={confirmAck}>
                  Je confirme : lu et appliqué
                </Button>
              </div>
            )}
          </section>

          <section className="space-y-2">
            <h3 className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              <AlertTriangle className="h-3.5 w-3.5" /> Limites critiques
            </h3>
            <div className="space-y-2">
              {fiche.criticalLimits.map((lim) => (
                <div
                  key={lim.label}
                  className="rounded-xl border border-amber-200/80 bg-amber-50/70 px-3 py-2"
                >
                  <p className="text-xs font-semibold text-amber-900">{lim.label}</p>
                  <p className="text-sm text-amber-950/90">{lim.value}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-2">
            <h3 className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              <Wrench className="h-3.5 w-3.5" /> Outils & documents
            </h3>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-xl border p-3">
                <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Outils</p>
                <ul className="space-y-1 text-sm">
                  {fiche.tools.map((t) => (
                    <li key={t}>· {t}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-xl border p-3">
                <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Documents</p>
                <ul className="space-y-1 text-sm">
                  {fiche.documents.map((d) => (
                    <li key={d}>· {d}</li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          <div className="rounded-xl border border-red-200 bg-red-50/80 px-3 py-3 text-sm text-red-900">
            <p className="text-xs font-semibold text-red-800">Si bloqué</p>
            <p className="mt-1">{fiche.ifBlocked}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 border-t bg-background px-5 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <Button
            className="gap-2"
            onClick={() => {
              onNavigate(fiche.navigate.tab, {
                view: fiche.navigate.view,
                module: fiche.navigate.module,
                focus: fiche.navigate.focus,
                action: fiche.navigate.action,
              });
              onOpenChange(false);
            }}
          >
            Aller au poste
            <ArrowRight className="h-4 w-4" />
          </Button>
          <Button type="button" variant="outline" className="gap-2" onClick={() => printFicheTechnique(fiche)}>
            <Printer className="h-4 w-4" />
            Imprimer
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

interface FicheAideButtonProps {
  onClick: () => void;
  label?: string;
  className?: string;
}

export function FicheAideButton({ onClick, label = 'Fiche technique', className }: FicheAideButtonProps) {
  return (
    <Button type="button" variant="outline" className={cn('gap-2', className)} onClick={onClick}>
      <BookOpen className="h-4 w-4" />
      {label}
    </Button>
  );
}
