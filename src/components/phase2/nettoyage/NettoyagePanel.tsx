import { useState } from 'react';
import { useCleaningCycles, useCleaningKpis, useCreateCleaningCycle, useCloseCleaningCycle } from '@/hooks/useNettoyage';
import { CleaningCycle, CleaningProgram, WasteCategory, CLEANING_PROGRAM_CONFIG } from '@/types/phase2';
import { LotSelector } from '../LotSelector';
import { AvailableLot } from '@/hooks/useAvailableLotsForPhase2';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle2, Plus, Droplets, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const STATUS_STYLE = {
  EN_COURS: 'bg-blue-100 text-blue-700',
  TERMINE: 'bg-green-100 text-green-700',
  INCIDENT: 'bg-red-100 text-red-700',
};

export function NettoyagePanel({ currentUser = 'Utilisateur' }: { currentUser?: string }) {
  const { data: cycles = [], isLoading } = useCleaningCycles();
  const { data: kpis } = useCleaningKpis();
  const createCycle = useCreateCleaningCycle();
  const closeCycle = useCloseCleaningCycle();

  const [showCreate, setShowCreate] = useState(false);
  const [closingId, setClosingId] = useState<string | null>(null);

  const active = cycles.filter((c) => c.status === 'EN_COURS');
  const recent = cycles.filter((c) => c.status !== 'EN_COURS').slice(0, 10);

  // Create form state
  const [selectedLot, setSelectedLot] = useState<AvailableLot | null>(null);
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
    const lotId = selectedLot?.id ?? createForm.reception_id;
    const lotNum = selectedLot?.reception_number ?? createForm.lot_number;
    const variety = (selectedLot?.variety ?? createForm.variety) || null;
    await createCycle.mutateAsync({
      reception_id: lotId,
      lot_number: lotNum,
      variety,
      program: createForm.program,
      operator_name: createForm.operator_name,
      created_by: currentUser,
    });
    setShowCreate(false);
    setSelectedLot(null);
    setCreateForm({ reception_id: '', lot_number: '', variety: '', program: 'B', operator_name: currentUser });
  };

  const handleClose = async () => {
    if (!closingId) return;
    await closeCycle.mutateAsync({
      id: closingId,
      weight_in_kg: Number(closeForm.weight_in_kg),
      weight_out_kg: Number(closeForm.weight_out_kg),
      waste_weight_kg: Number(closeForm.waste_weight_kg),
      waste_category: closeForm.waste_category,
      turbidity_ntu: closeForm.turbidity_ntu ? Number(closeForm.turbidity_ntu) : undefined,
      ph_water: closeForm.ph_water ? Number(closeForm.ph_water) : undefined,
    });
    setClosingId(null);
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
          <div className="text-2xl font-bold">{kpis?.completed_count ?? recent.filter(c => c.status === 'TERMINE').length}</div>
          <div className="text-xs text-muted-foreground">Cycles terminés</div>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3">
          <div className="text-2xl font-bold">{kpis?.avg_yield_pct != null ? `${kpis.avg_yield_pct}%` : '—'}</div>
          <div className="text-xs text-muted-foreground">Rendement moy.</div>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-2">
            <Droplets className="h-4 w-4 text-blue-400" />
            <div>
              <div className="text-sm font-semibold">Seuils</div>
              <div className="text-xs text-muted-foreground">Rend. min. 92%</div>
            </div>
          </div>
        </CardContent></Card>
      </div>

      {/* Active cycles */}
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
            <div className="text-sm text-muted-foreground py-4 text-center">Aucun cycle de nettoyage en cours.</div>
          ) : (
            <div className="divide-y">
              {active.map((c) => (
                <div key={c.id} className="py-3 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm font-semibold">{c.cycle_number}</span>
                      <Badge className={`text-xs ${STATUS_STYLE[c.status]}`}>{c.status === 'EN_COURS' ? 'En cours' : c.status}</Badge>
                      <Badge variant="outline" className="text-xs">Prog. {c.program} — {CLEANING_PROGRAM_CONFIG[c.program].label.split(' — ')[1]}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5 flex gap-3 flex-wrap">
                      <span>Lot: {c.lot_number}</span>
                      {c.variety && <span>Variété: {c.variety}</span>}
                      <span>Opérateur: {c.operator_name}</span>
                      <span>Démarré: {format(new Date(c.started_at), 'HH:mm', { locale: fr })}</span>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" className="h-7 px-3 text-xs shrink-0" onClick={() => setClosingId(c.id)}>
                    Clôturer
                  </Button>
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
                  <Badge className={`text-xs ${STATUS_STYLE[c.status]}`}>{c.status === 'TERMINE' ? 'Terminé' : c.status}</Badge>
                  <span className="text-muted-foreground text-xs">Lot {c.lot_number}</span>
                  {c.yield_percent != null && (
                    <span className={`text-xs ml-auto ${c.yield_percent < 92 ? 'text-red-600 font-semibold' : 'text-green-600'}`}>
                      {c.yield_percent < 92 ? <><CheckCircle2 className="h-3 w-3 inline mr-0.5" /></> : null}
                      Rendement {c.yield_percent}%
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
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Nouveau cycle de nettoyage</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Lot à nettoyer</Label>
              <LotSelector
                value={selectedLot?.id ?? null}
                onChange={(lot) => setSelectedLot(lot)}
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
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Variété</Label>
                <Input value={createForm.variety} onChange={(e) => setCreateForm(p => ({ ...p, variety: e.target.value }))} placeholder="ex: Deglet Nour" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Programme lavage</Label>
                <Select value={createForm.program} onValueChange={(v) => setCreateForm(p => ({ ...p, program: v as CleaningProgram }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.entries(CLEANING_PROGRAM_CONFIG) as [CleaningProgram, typeof CLEANING_PROGRAM_CONFIG['A']][]).map(([k, cfg]) => (
                      <SelectItem key={k} value={k}>{cfg.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Opérateur</Label>
                <Input value={createForm.operator_name} onChange={(e) => setCreateForm(p => ({ ...p, operator_name: e.target.value }))} />
              </div>
            </div>
            <div className="bg-muted/40 rounded p-2 text-xs text-muted-foreground">
              {CLEANING_PROGRAM_CONFIG[createForm.program].label} — {CLEANING_PROGRAM_CONFIG[createForm.program].effect}
            </div>
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

      {/* Close dialog */}
      <Dialog open={!!closingId} onOpenChange={(v) => { if (!v) setClosingId(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Clôturer cycle — Saisie mesures</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Poids entrée (kg)</Label>
                <Input type="number" value={closeForm.weight_in_kg} onChange={(e) => setCloseForm(p => ({ ...p, weight_in_kg: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Poids sortie (kg)</Label>
                <Input type="number" value={closeForm.weight_out_kg} onChange={(e) => setCloseForm(p => ({ ...p, weight_out_kg: e.target.value }))} />
              </div>
            </div>
            {closeForm.weight_in_kg && closeForm.weight_out_kg && (
              <div className={`text-sm font-semibold ${Number(closeForm.weight_out_kg) / Number(closeForm.weight_in_kg) * 100 < 92 ? 'text-red-600' : 'text-green-600'}`}>
                Rendement estimé: {(Number(closeForm.weight_out_kg) / Number(closeForm.weight_in_kg) * 100).toFixed(1)}% {Number(closeForm.weight_out_kg) / Number(closeForm.weight_in_kg) * 100 < 92 ? '⚠ < 92% seuil' : '✓'}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Poids déchets (kg)</Label>
                <Input type="number" value={closeForm.waste_weight_kg} onChange={(e) => setCloseForm(p => ({ ...p, waste_weight_kg: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Catégorie déchets</Label>
                <Select value={closeForm.waste_category} onValueChange={(v) => setCloseForm(p => ({ ...p, waste_category: v as WasteCategory }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ORGANIQUE">Organique</SelectItem>
                    <SelectItem value="INERTE">Inerte</SelectItem>
                    <SelectItem value="MAUVAISES_DATTES">Mauvaises dattes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Turbidité eau (NTU)</Label>
                <Input type="number" value={closeForm.turbidity_ntu} onChange={(e) => setCloseForm(p => ({ ...p, turbidity_ntu: e.target.value }))} placeholder="ex: 80" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">pH eau (6.5–8.5)</Label>
                <Input type="number" step="0.1" value={closeForm.ph_water} onChange={(e) => setCloseForm(p => ({ ...p, ph_water: e.target.value }))} placeholder="ex: 7.2" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setClosingId(null)}>Annuler</Button>
            <Button onClick={handleClose} disabled={closeCycle.isPending || !closeForm.weight_in_kg || !closeForm.weight_out_kg || !closeForm.waste_weight_kg}>
              {closeCycle.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Clôturer cycle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
