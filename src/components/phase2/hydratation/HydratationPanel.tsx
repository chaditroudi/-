import { useState } from 'react';
import {
  useHydrationCycles,
  useHydrationKpis,
  useCreateHydrationCycle,
  useRecordExitHumidity,
  useCloseHydrationCycle,
  suggestHydrationProgram,
  HYDRATION_PROGRAM_CONFIG,
} from '@/hooks/useHydratation';
import { LotSelector } from '../LotSelector';
import { AvailableLot } from '@/hooks/useAvailableLotsForPhase2';
import {
  HydrationCycle,
  HydrationChamber,
  HydrationProgram,
  HydrationNonConformityAction,
  Phase2LotRef,
} from '@/types/phase2';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Droplets, Thermometer, Plus, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const STATUS_STYLE = {
  EN_COURS: 'bg-blue-100 text-blue-700',
  TERMINE: 'bg-green-100 text-green-700',
  NON_CONFORME: 'bg-red-100 text-red-700',
};

const CONFORMITY_STYLE = {
  VERT: 'text-green-600',
  JAUNE: 'text-amber-600',
  ROUGE: 'text-red-600 font-semibold',
};

export function HydratationPanel({ currentUser = 'Utilisateur' }: { currentUser?: string }) {
  const { data: cycles = [], isLoading } = useHydrationCycles();
  const { data: kpis } = useHydrationKpis();
  const createCycle = useCreateHydrationCycle();
  const recordExit = useRecordExitHumidity();
  const closeCycle = useCloseHydrationCycle();

  const [showCreate, setShowCreate] = useState(false);
  const [selectedLot, setSelectedLot] = useState<AvailableLot | null>(null);
  const [exitCycleId, setExitCycleId] = useState<string | null>(null);
  const [closingCycle, setClosingCycle] = useState<HydrationCycle | null>(null);

  const active = cycles.filter((c) => c.status === 'EN_COURS');
  const recent = cycles.filter((c) => c.status !== 'EN_COURS').slice(0, 10);

  // Create form
  const [createForm, setCreateForm] = useState({
    chamber: 'HY-01' as HydrationChamber,
    lot_number: '',
    humidity_in: '',
    program_override: '' as HydrationProgram | '',
    operator_name: currentUser,
  });
  const suggestedProg = createForm.humidity_in ? suggestHydrationProgram(Number(createForm.humidity_in)) : null;

  // Exit humidity form
  const [exitForm, setExitForm] = useState({ h1: '', h2: '', h3: '', inspector: currentUser });

  // Close form
  const [closeAction, setCloseAction] = useState<HydrationNonConformityAction>('ACCEPTER');

  const handleCreate = async () => {
    const lotRef: Phase2LotRef = {
      reception_id: selectedLot?.id ?? '',
      lot_number: selectedLot?.reception_number ?? createForm.lot_number,
      variety: selectedLot?.variety ?? null,
      weight_kg: selectedLot?.quantity_total ?? 0,
      is_bio: false,
    };
    await createCycle.mutateAsync({
      chamber: createForm.chamber,
      lot_refs: [lotRef],
      humidity_in_percent: createForm.humidity_in ? Number(createForm.humidity_in) : null,
      program_override: (createForm.program_override as HydrationProgram) || undefined,
      operator_name: createForm.operator_name,
      created_by: currentUser,
    });
    setShowCreate(false);
    setSelectedLot(null);
    setCreateForm({ chamber: 'HY-01', lot_number: '', humidity_in: '', program_override: '', operator_name: currentUser });
  };

  const handleRecordExit = async () => {
    if (!exitCycleId) return;
    await recordExit.mutateAsync({
      id: exitCycleId,
      humidity_out_1: Number(exitForm.h1),
      humidity_out_2: Number(exitForm.h2),
      humidity_out_3: Number(exitForm.h3),
      inspector_name: exitForm.inspector,
    });
    setExitCycleId(null);
  };

  const handleClose = async () => {
    if (!closingCycle) return;
    await closeCycle.mutateAsync({
      id: closingCycle.id,
      non_conformity_action:
        closingCycle.conformity !== 'VERT' ? closeAction : undefined,
    });
    setClosingCycle(null);
  };

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card><CardContent className="pt-4 pb-3">
          <div className="text-2xl font-bold">{kpis?.active_count ?? active.length}</div>
          <div className="text-xs text-muted-foreground">Cycles actifs</div>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3">
          <div className="text-2xl font-bold">{kpis?.conform_pct != null ? `${kpis.conform_pct}%` : '—'}</div>
          <div className="text-xs text-muted-foreground">Conformité (20–26%)</div>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3">
          <div className="text-2xl font-bold">{kpis?.override_count ?? '—'}</div>
          <div className="text-xs text-muted-foreground">Dérogations programme</div>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-2">
            <Droplets className="h-4 w-4 text-blue-400" />
            <div>
              <div className="text-sm font-semibold">20 – 26%</div>
              <div className="text-xs text-muted-foreground">Cible humidité</div>
            </div>
          </div>
        </CardContent></Card>
      </div>

      {/* Active */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Cycles actifs ({active.length})</CardTitle>
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4 mr-1.5" />
              Nouveau cycle
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-sm text-muted-foreground py-4 text-center">Chargement…</div>
          ) : active.length === 0 ? (
            <div className="text-sm text-muted-foreground py-4 text-center">Aucun cycle d'hydratation/séchage en cours.</div>
          ) : (
            <div className="divide-y">
              {active.map((c) => (
                <div key={c.id} className="py-3 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm font-semibold">{c.cycle_number}</span>
                      <Badge className="text-xs bg-blue-100 text-blue-700">En cours</Badge>
                      <Badge variant="outline" className="text-xs">{HYDRATION_PROGRAM_CONFIG[c.program_applied].label.split(' — ')[0]}</Badge>
                      {c.program_applied !== c.program_suggested && (
                        <Badge variant="outline" className="text-xs text-amber-700">Dérogation</Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5 flex gap-3 flex-wrap">
                      <span>Chambre: {c.chamber}</span>
                      {c.humidity_in_percent != null && <span>Humidité entrée: {c.humidity_in_percent}%</span>}
                      <span>Démarré: {format(new Date(c.started_at), 'dd/MM HH:mm', { locale: fr })}</span>
                    </div>
                    {c.humidity_out_avg != null && (
                      <div className={`text-xs mt-1 ${CONFORMITY_STYLE[c.conformity ?? 'VERT']}`}>
                        Humidité sortie: {c.humidity_out_avg}% — {c.conformity === 'VERT' ? 'Conforme' : c.conformity === 'JAUNE' ? 'Attention' : 'Non conforme'}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {c.humidity_out_avg == null && (
                      <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => { setExitCycleId(c.id); setExitForm({ h1: '', h2: '', h3: '', inspector: currentUser }); }}>
                        <Thermometer className="h-3.5 w-3.5 mr-1" />
                        Mesures
                      </Button>
                    )}
                    {c.humidity_out_avg != null && (
                      <Button size="sm" className="h-7 px-2 text-xs" onClick={() => setClosingCycle(c)}>
                        Clôturer
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* History */}
      {recent.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Historique récent</CardTitle></CardHeader>
          <CardContent>
            <div className="divide-y">
              {recent.map((c) => (
                <div key={c.id} className="py-2.5 flex items-center gap-3 text-sm">
                  <span className="font-mono text-xs text-muted-foreground">{c.cycle_number}</span>
                  <Badge className={`text-xs ${STATUS_STYLE[c.status]}`}>{c.status === 'TERMINE' ? 'Terminé' : c.status === 'NON_CONFORME' ? 'Non conforme' : c.status}</Badge>
                  <span className="text-muted-foreground text-xs">{HYDRATION_PROGRAM_CONFIG[c.program_applied].label.split(' — ')[0]}</span>
                  {c.humidity_out_avg != null && (
                    <span className={`text-xs ml-auto ${c.conformity ? CONFORMITY_STYLE[c.conformity] : ''}`}>
                      Sortie: {c.humidity_out_avg}%
                    </span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nouveau cycle hydratation/séchage</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Chambre</Label>
                <Select value={createForm.chamber} onValueChange={(v) => setCreateForm(p => ({ ...p, chamber: v as HydrationChamber }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="HY-01">HY-01</SelectItem>
                    <SelectItem value="HY-02">HY-02</SelectItem>
                    <SelectItem value="HY-03">HY-03</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Lot à traiter</Label>
                <LotSelector
                  value={selectedLot?.id ?? null}
                  onChange={(lot) => {
                    setSelectedLot(lot);
                    if (lot?.qc_grade) {
                      // Could auto-fill humidity from QC data — left for future
                    }
                  }}
                  placeholder="Sélectionner un lot disponible…"
                />
                {!selectedLot && (
                  <Input
                    className="mt-1 text-xs h-8"
                    value={createForm.lot_number}
                    onChange={(e) => setCreateForm(p => ({ ...p, lot_number: e.target.value }))}
                    placeholder="Ou saisir N° lot manuellement"
                  />
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Humidité entrée (%)</Label>
                <Input type="number" step="0.1" value={createForm.humidity_in} onChange={(e) => setCreateForm(p => ({ ...p, humidity_in: e.target.value }))} placeholder="ex: 17.5" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Programme suggéré</Label>
                <div className="h-10 flex items-center px-3 border rounded-md bg-muted/40 text-sm">
                  {suggestedProg ? HYDRATION_PROGRAM_CONFIG[suggestedProg].label.split(' — ')[0] : '—'}
                </div>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Dérogation programme (optionnel)</Label>
              <Select value={createForm.program_override} onValueChange={(v) => setCreateForm(p => ({ ...p, program_override: v as HydrationProgram }))}>
                <SelectTrigger><SelectValue placeholder="Utiliser le programme suggéré" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Utiliser le programme suggéré</SelectItem>
                  {(Object.entries(HYDRATION_PROGRAM_CONFIG) as [HydrationProgram, typeof HYDRATION_PROGRAM_CONFIG['SKIP']][]).map(([k, cfg]) => (
                    <SelectItem key={k} value={k}>{cfg.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {suggestedProg && (
              <div className="bg-muted/40 rounded p-2 text-xs text-muted-foreground">
                {HYDRATION_PROGRAM_CONFIG[createForm.program_override as HydrationProgram || suggestedProg].params}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowCreate(false)}>Annuler</Button>
            <Button onClick={handleCreate} disabled={createCycle.isPending || (!selectedLot && !createForm.lot_number)}>
              {createCycle.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Démarrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Exit humidity dialog */}
      <Dialog open={!!exitCycleId} onOpenChange={(v) => { if (!v) setExitCycleId(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Mesures humidité sortie (3 prélèvements)</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              {(['h1', 'h2', 'h3'] as const).map((k, i) => (
                <div key={k} className="space-y-1">
                  <Label className="text-xs">Lecture {i + 1} (%)</Label>
                  <Input type="number" step="0.1" value={exitForm[k]} onChange={(e) => setExitForm(p => ({ ...p, [k]: e.target.value }))} placeholder="ex: 22.4" />
                </div>
              ))}
            </div>
            {exitForm.h1 && exitForm.h2 && exitForm.h3 && (
              <div className="bg-muted/40 rounded p-2 text-sm">
                Moyenne: <strong>{((Number(exitForm.h1) + Number(exitForm.h2) + Number(exitForm.h3)) / 3).toFixed(1)}%</strong>
                {' '}
                {(Number(exitForm.h1) + Number(exitForm.h2) + Number(exitForm.h3)) / 3 >= 20 && (Number(exitForm.h1) + Number(exitForm.h2) + Number(exitForm.h3)) / 3 <= 26
                  ? <span className="text-green-600">✓ Conforme (20–26%)</span>
                  : <span className="text-red-600">✗ Hors plage</span>}
              </div>
            )}
            <div className="space-y-1">
              <Label className="text-xs">Inspecteur</Label>
              <Input value={exitForm.inspector} onChange={(e) => setExitForm(p => ({ ...p, inspector: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setExitCycleId(null)}>Annuler</Button>
            <Button onClick={handleRecordExit} disabled={recordExit.isPending || !exitForm.h1 || !exitForm.h2 || !exitForm.h3}>
              {recordExit.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Close dialog */}
      <Dialog open={!!closingCycle} onOpenChange={(v) => { if (!v) setClosingCycle(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Clôturer cycle</DialogTitle></DialogHeader>
          {closingCycle && (
            <div className="space-y-3">
              <div className="bg-muted/40 rounded p-3 text-sm">
                <div>Humidité sortie: <strong>{closingCycle.humidity_out_avg}%</strong></div>
                <div className={CONFORMITY_STYLE[closingCycle.conformity ?? 'VERT']}>
                  Conformité: {closingCycle.conformity === 'VERT' ? 'Conforme ✓' : closingCycle.conformity === 'JAUNE' ? 'Attention' : 'Non conforme ✗'}
                </div>
              </div>
              {closingCycle.conformity !== 'VERT' && (
                <div className="space-y-1">
                  <Label className="text-xs">Action non-conformité</Label>
                  <Select value={closeAction} onValueChange={(v) => setCloseAction(v as HydrationNonConformityAction)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {closingCycle.additional_cycle_count === 0 && <SelectItem value="REFAIRE">Refaire un cycle (1× max)</SelectItem>}
                      <SelectItem value="ACCEPTER">Accepter en dérogation</SelectItem>
                      <SelectItem value="REJETER">Rejeter le lot</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setClosingCycle(null)}>Annuler</Button>
            <Button onClick={handleClose} disabled={closeCycle.isPending}>
              {closeCycle.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Clôturer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
