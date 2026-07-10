import { useState } from 'react';
import {
  useTriageSessions,
  useTriageKpis,
  useCreateTriageSession,
  useUpdateTriageWeights,
  useCloseTriageSession,
  usePauseResumeTriageSession,
  useAddTriageQualityCheck,
  useTriageSubLots,
} from '@/hooks/useTriage';
import { SubLotLabelPrintDialog } from './SubLotLabelPrintDialog';
import { FichePaletteDialog } from './FichePaletteDialog';
import { LotSelector } from '../LotSelector';
import { AvailableLot } from '@/hooks/useAvailableLotsForPhase2';
import {
  TriageSession,
  TriageLine,
  TapeSpeed,
  SUBLOT_SUFFIX,
} from '@/types/phase2';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Scissors, Plus, Loader2, Pause, Play, CheckSquare, Package, Printer, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const STATUS_STYLE = {
  EN_COURS: 'bg-amber-100 text-amber-700',
  PAUSE: 'bg-gray-100 text-gray-700',
  TERMINE: 'bg-green-100 text-green-700',
  INCIDENT: 'bg-red-100 text-red-700',
};

const GRADE_COLORS = {
  EXTRA: 'bg-emerald-100 text-emerald-800',
  CATEGORIE_I: 'bg-blue-100 text-blue-800',
  CATEGORIE_II: 'bg-amber-100 text-amber-800',
  REJETE: 'bg-red-100 text-red-800',
};

export function TriagePanel({ currentUser = 'Utilisateur' }: { currentUser?: string }) {
  const { data: sessions = [], isLoading } = useTriageSessions();
  const { data: kpis } = useTriageKpis();
  const createSession = useCreateTriageSession();
  const updateWeights = useUpdateTriageWeights();
  const closeSession = useCloseTriageSession();
  const pauseResume = usePauseResumeTriageSession();
  const addQCCheck = useAddTriageQualityCheck();

  const [showCreate, setShowCreate] = useState(false);
  const [selectedLot, setSelectedLot] = useState<AvailableLot | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [qcSessionId, setQcSessionId] = useState<string | null>(null);
  const [labelSession, setLabelSession] = useState<TriageSession | null>(null);
  const { data: labelSubLots = [] } = useTriageSubLots(labelSession?.id ?? null);
  const [ficheSession, setFicheSession] = useState<TriageSession | null>(null);
  const { data: ficheSubLots = [] } = useTriageSubLots(ficheSession?.id ?? null);

  const active = sessions.filter((s) => ['EN_COURS', 'PAUSE'].includes(s.status));
  const recent = sessions.filter((s) => s.status === 'TERMINE').slice(0, 8);

  // Create form
  const [createForm, setCreateForm] = useState({
    line: 'L1' as TriageLine,
    lot_number: '',
    parent_weight_kg: '',
    worker_count: '6',
    chef_ligne: currentUser,
    tape_speed: 'STANDARD' as TapeSpeed,
  });

  // Weights form (for active session)
  const [weightsForm, setWeightsForm] = useState({
    extra: '', cat1: '', cat2: '', reject: '',
  });

  // QC form
  const [qcForm, setQcForm] = useState({
    sample_weight_kg: '1',
    extra_err: '0', cat1_err: '0', cat2_err: '0', reject_err: '0',
    inspector: currentUser, notes: '',
  });

  const activeSession = sessions.find((s) => s.id === activeSessionId) ?? null;

  const handleCreate = async () => {
    await createSession.mutateAsync({
      line: createForm.line,
      parent_reception_id: selectedLot?.id ?? '',
      parent_lot_number: selectedLot?.reception_number ?? createForm.lot_number,
      variety: selectedLot?.variety ?? null,
      parent_weight_kg: selectedLot?.quantity_total ?? Number(createForm.parent_weight_kg),
      worker_count: Number(createForm.worker_count),
      worker_ids: [],
      chef_ligne: createForm.chef_ligne,
      tape_speed: createForm.tape_speed,
      created_by: currentUser,
    });
    setShowCreate(false);
    setCreateForm({ line: 'L1', lot_number: '', parent_weight_kg: '', worker_count: '6', chef_ligne: currentUser, tape_speed: 'STANDARD' });
  };

  const handleUpdateWeights = async () => {
    if (!activeSession) return;
    await updateWeights.mutateAsync({
      id: activeSession.id,
      weight_extra_kg: Number(weightsForm.extra) || 0,
      weight_cat1_kg: Number(weightsForm.cat1) || 0,
      weight_cat2_kg: Number(weightsForm.cat2) || 0,
      weight_reject_kg: Number(weightsForm.reject) || 0,
      started_at: activeSession.started_at,
    });
    setActiveSessionId(null); // auto-close after save
  };

  const handleQCCheck = async () => {
    if (!qcSessionId) return;
    await addQCCheck.mutateAsync({
      session_id: qcSessionId,
      inspector_name: qcForm.inspector,
      sample_weight_kg: Number(qcForm.sample_weight_kg),
      extra_error_count: Number(qcForm.extra_err),
      cat1_error_count: Number(qcForm.cat1_err),
      cat2_error_count: Number(qcForm.cat2_err),
      reject_error_count: Number(qcForm.reject_err),
      notes: qcForm.notes || undefined,
    });
    setQcSessionId(null);
  };

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Card><CardContent className="pt-4 pb-3">
          <div className="text-2xl font-bold">{kpis?.active_count ?? active.length}</div>
          <div className="text-xs text-muted-foreground">Lignes actives</div>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3">
          <div className="text-2xl font-bold text-emerald-700">{kpis?.avg_extra_pct != null ? `${kpis.avg_extra_pct}%` : '—'}</div>
          <div className="text-xs text-muted-foreground">Extra moy.</div>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3">
          <div className={`text-2xl font-bold ${(kpis?.avg_reject_pct ?? 0) > 10 ? 'text-red-600' : ''}`}>
            {kpis?.avg_reject_pct != null ? `${kpis.avg_reject_pct}%` : '—'}
          </div>
          <div className="text-xs text-muted-foreground">Rejet moy.</div>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3">
          <div className="text-2xl font-bold">{kpis?.total_sorted_kg != null ? `${kpis.total_sorted_kg.toLocaleString('fr-TN')} kg` : '—'}</div>
          <div className="text-xs text-muted-foreground">Volume trié total</div>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-2">
            <Scissors className="h-4 w-4 text-muted-foreground" />
            <div>
              <div className="text-sm font-semibold">L1–L4</div>
              <div className="text-xs text-muted-foreground">Lignes triage</div>
            </div>
          </div>
        </CardContent></Card>
      </div>

      {/* Active sessions */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Sessions actives ({active.length})</CardTitle>
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4 mr-1.5" />
              Démarrer session
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-sm text-muted-foreground py-4 text-center">Chargement…</div>
          ) : active.length === 0 ? (
            <div className="text-sm text-muted-foreground py-4 text-center">Aucune session de triage en cours.</div>
          ) : (
            <div className="divide-y">
              {active.map((s) => (
                <SessionRow
                  key={s.id}
                  session={s}
                  onOpen={() => {
                    setActiveSessionId(s.id);
                    setWeightsForm({
                      extra: String(s.weight_extra_kg),
                      cat1: String(s.weight_cat1_kg),
                      cat2: String(s.weight_cat2_kg),
                      reject: String(s.weight_reject_kg),
                    });
                  }}
                  onPauseResume={() => pauseResume.mutate({ id: s.id, action: s.status === 'EN_COURS' ? 'PAUSE' : 'RESUME' })}
                  onQC={() => { setQcSessionId(s.id); setQcForm(p => ({ ...p, inspector: currentUser })); }}
                  onClose={() => closeSession.mutate({ id: s.id })}
                  onLabels={() => setLabelSession(s)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* History */}
      {recent.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Sessions récentes</CardTitle></CardHeader>
          <CardContent>
            <div className="divide-y">
              {recent.map((s) => (
                <div key={s.id} className="py-2.5 flex items-center gap-3 text-sm">
                  <span className="font-mono text-xs">{s.session_number}</span>
                  <Badge className="text-xs bg-green-100 text-green-700">Terminé</Badge>
                  <span className="text-xs text-muted-foreground">Lot {s.parent_lot_number}</span>
                  <span className="text-xs text-emerald-600">{s.extra_percent}% Extra</span>
                  <span className={`text-xs ${s.reject_percent > 10 ? 'text-red-600' : 'text-muted-foreground'}`}>
                    {s.reject_percent}% rejet
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="ml-auto h-6 gap-1 text-xs border-green-300 text-green-700 hover:bg-green-50"
                    onClick={() => setFicheSession(s)}
                  >
                    <Printer className="h-3 w-3" />
                    Fiche Palette
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nouvelle session de triage</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {/* Line — chip buttons instead of dropdown */}
            <div className="space-y-1">
              <Label className="text-xs">Ligne</Label>
              <div className="grid grid-cols-4 gap-1.5">
                {(['L1', 'L2', 'L3', 'L4'] as TriageLine[]).map((line) => (
                  <button
                    key={line}
                    type="button"
                    onClick={() => setCreateForm(p => ({ ...p, line }))}
                    className={`rounded-xl border-2 py-2 text-sm font-bold transition-all ${
                      createForm.line === line
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border text-muted-foreground hover:border-primary/50'
                    }`}
                  >
                    {line}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Lot parent</Label>
              <LotSelector
                value={selectedLot?.id ?? null}
                onChange={(lot) => setSelectedLot(lot)}
                placeholder="Sélectionner un lot disponible…"
              />
              {!selectedLot && (
                <Input
                  className="mt-1 text-sm h-10"
                  value={createForm.lot_number}
                  onChange={(e) => setCreateForm(p => ({ ...p, lot_number: e.target.value }))}
                  placeholder="Ou saisir N° lot manuellement"
                />
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Poids lot (kg)</Label>
                <Input type="number" value={createForm.parent_weight_kg} onFocus={(e) => e.target.select()} onChange={(e) => setCreateForm(p => ({ ...p, parent_weight_kg: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Opérateurs</Label>
                <Input type="number" min="1" max="12" value={createForm.worker_count} onFocus={(e) => e.target.select()} onChange={(e) => setCreateForm(p => ({ ...p, worker_count: e.target.value }))} />
              </div>
            </div>

            {/* Tape speed — chip buttons instead of dropdown */}
            <div className="space-y-1">
              <Label className="text-xs">Vitesse tapis</Label>
              <div className="flex gap-1.5">
                {([
                  { value: 'LENT', label: 'Lent' },
                  { value: 'STANDARD', label: 'Standard' },
                  { value: 'RAPIDE', label: 'Rapide' },
                ] as const).map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setCreateForm(p => ({ ...p, tape_speed: value }))}
                    className={`flex-1 rounded-xl border-2 py-2 text-xs font-semibold transition-all ${
                      createForm.tape_speed === value
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border text-muted-foreground hover:border-primary/50'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Chef de ligne</Label>
              <Input value={createForm.chef_ligne} onChange={(e) => setCreateForm(p => ({ ...p, chef_ligne: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowCreate(false)}>Annuler</Button>
            <Button onClick={handleCreate} disabled={createSession.isPending || (!selectedLot && !createForm.lot_number)}>
              {createSession.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Démarrer session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Weight update dialog */}
      <Dialog open={!!activeSession} onOpenChange={(v) => { if (!v) setActiveSessionId(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Mise à jour poids — {activeSession?.session_number}</DialogTitle>
          </DialogHeader>
          {activeSession && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {([['extra', 'Extra (-EX)', 'emerald'], ['cat1', 'Catégorie I (-C1)', 'blue'], ['cat2', 'Catégorie II (-C2)', 'amber'], ['reject', 'Rejet (-RJ)', 'red']] as const).map(([key, label, color]) => (
                  <div key={key} className="space-y-1">
                    <Label className={`text-xs text-${color}-700`}>{label}</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={weightsForm[key as keyof typeof weightsForm]}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => setWeightsForm(p => ({ ...p, [key]: e.target.value }))}
                      placeholder="0 kg"
                    />
                  </div>
                ))}
              </div>
              {['extra', 'cat1', 'cat2', 'reject'].some(k => weightsForm[k as keyof typeof weightsForm]) && (
                <div className="bg-muted/40 rounded p-2 text-xs">
                  Total trié: <strong>{(['extra', 'cat1', 'cat2', 'reject'] as const).reduce((s, k) => s + (Number(weightsForm[k]) || 0), 0).toFixed(1)} kg</strong>
                  {activeSession.parent_weight_kg > 0 && ` / ${activeSession.parent_weight_kg} kg lot`}
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setActiveSessionId(null)}>Fermer</Button>
            <Button onClick={handleUpdateWeights} disabled={updateWeights.isPending}>
              {updateWeights.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Enregistrer poids
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QC check dialog */}
      <Dialog open={!!qcSessionId} onOpenChange={(v) => { if (!v) setQcSessionId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Contrôle qualité triage</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="text-xs text-muted-foreground">Prélever 1 kg par bac, compter les erreurs de tri (dattes dans le mauvais bac)</div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Inspecteur</Label>
                <Input value={qcForm.inspector} onChange={(e) => setQcForm(p => ({ ...p, inspector: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Poids échantillon (kg)</Label>
                <Input type="number" step="0.1" value={qcForm.sample_weight_kg} onChange={(e) => setQcForm(p => ({ ...p, sample_weight_kg: e.target.value }))} />
              </div>
            </div>
            <Separator />
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Erreurs de tri (nb dattes mal classées)</div>
            {([['extra_err', 'Extra', 'emerald'], ['cat1_err', 'Cat. I', 'blue'], ['cat2_err', 'Cat. II', 'amber'], ['reject_err', 'Rejet', 'red']] as const).map(([key, label]) => (
              <div key={key} className="flex items-center gap-3">
                <Label className="text-xs w-16">{label}</Label>
                <Input type="number" min="0" value={qcForm[key as keyof typeof qcForm]} onFocus={(e) => e.target.select()} onChange={(e) => setQcForm(p => ({ ...p, [key]: e.target.value }))} className="w-24" />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setQcSessionId(null)}>Annuler</Button>
            <Button onClick={handleQCCheck} disabled={addQCCheck.isPending}>
              {addQCCheck.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Enregistrer contrôle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sub-lot label print dialog */}
      <SubLotLabelPrintDialog
        open={!!labelSession}
        onOpenChange={(v) => { if (!v) setLabelSession(null); }}
        subLots={labelSubLots}
        sessionNumber={labelSession?.session_number ?? ''}
      />

      {/* Fiche Palette PSF dialog */}
      {ficheSession && (
        <FichePaletteDialog
          open={!!ficheSession}
          onOpenChange={(v) => { if (!v) setFicheSession(null); }}
          session={ficheSession}
          subLots={ficheSubLots.map((sl: any) => ({
            sublot_number: sl.sublot_number,
            grade: sl.grade,
            weight_kg: sl.weight_kg,
            unit_count: sl.unit_count,
          }))}
        />
      )}
    </div>
  );
}

function SessionRow({
  session,
  onOpen,
  onPauseResume,
  onQC,
  onClose,
  onLabels,
}: {
  session: TriageSession;
  onOpen: () => void;
  onPauseResume: () => void;
  onQC: () => void;
  onClose: () => void;
  onLabels: () => void;
}) {
  const { data: subLots = [] } = useTriageSubLots(session.status === 'TERMINE' ? session.id : null);
  const total = session.weight_extra_kg + session.weight_cat1_kg + session.weight_cat2_kg + session.weight_reject_kg;

  return (
    <div className="py-3 space-y-2">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-sm font-semibold">{session.session_number}</span>
            <Badge className={`text-xs ${STATUS_STYLE[session.status]}`}>
              {session.status === 'EN_COURS' ? 'En cours' : session.status === 'PAUSE' ? 'Pause' : session.status}
            </Badge>
            {session.status === 'EN_COURS' && <span className="text-xs text-amber-600 animate-pulse font-semibold">● LIVE</span>}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5 flex gap-3 flex-wrap">
            <span>Ligne {session.line} · {session.worker_count} ops · Tapis {session.tape_speed.toLowerCase()}</span>
            <span>Lot {session.parent_lot_number}</span>
            {session.yield_kg_per_hour != null && <span>Cadence: {session.yield_kg_per_hour} kg/h</span>}
            {session.quality_score_percent != null && (
              <span className={session.quality_score_percent < 90 ? 'text-red-600 font-semibold' : 'text-green-600'}>
                Qualité: {session.quality_score_percent}%
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-1.5 shrink-0 flex-wrap justify-end">
          <Button size="sm" variant="ghost" className="h-7 px-2" onClick={onPauseResume}>
            {session.status === 'EN_COURS' ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          </Button>
          <Button size="sm" variant="ghost" className="h-7 px-2" onClick={onQC} title="Contrôle qualité">
            <CheckSquare className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={onOpen}>Poids</Button>
          <Button size="sm" className="h-7 px-2 text-xs" onClick={onClose}>Clôturer</Button>
        </div>
      </div>

      {/* Grade weight bar */}
      {total > 0 && (
        <div className="space-y-1">
          <div className="h-2 flex rounded overflow-hidden gap-px">
            {session.extra_percent > 0 && <div className="bg-emerald-400" style={{ width: `${session.extra_percent}%` }} title={`Extra: ${session.extra_percent}%`} />}
            {session.cat1_percent > 0 && <div className="bg-blue-400" style={{ width: `${session.cat1_percent}%` }} title={`Cat I: ${session.cat1_percent}%`} />}
            {session.cat2_percent > 0 && <div className="bg-amber-400" style={{ width: `${session.cat2_percent}%` }} title={`Cat II: ${session.cat2_percent}%`} />}
            {session.reject_percent > 0 && <div className="bg-red-400" style={{ width: `${session.reject_percent}%` }} title={`Rejet: ${session.reject_percent}%`} />}
          </div>
          <div className="flex gap-3 text-xs">
            <span className="text-emerald-700">Ex {session.extra_percent}%</span>
            <span className="text-blue-700">C1 {session.cat1_percent}%</span>
            <span className="text-amber-700">C2 {session.cat2_percent}%</span>
            <span className={`${session.reject_percent > 10 ? 'text-red-700 font-semibold' : 'text-red-600'}`}>RJ {session.reject_percent}%{session.reject_percent > 10 ? ' ⚠' : ''}</span>
            <span className="text-muted-foreground ml-auto">{total.toFixed(1)} kg trié</span>
          </div>
        </div>
      )}

      {/* Sub-lots (shown after close) */}
      {subLots.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {subLots.map((sl) => (
            <div key={sl.id} className={`rounded px-2 py-1 text-xs ${GRADE_COLORS[sl.grade]}`}>
              <Package className="h-3 w-3 inline mr-1" />
              {sl.lot_number} — {sl.weight_kg} kg
            </div>
          ))}
          <Button size="sm" variant="ghost" className="h-6 px-2 text-xs ml-auto" onClick={onLabels}>
            <Printer className="h-3 w-3 mr-1" />
            Étiquettes QR
          </Button>
        </div>
      )}
    </div>
  );
}
