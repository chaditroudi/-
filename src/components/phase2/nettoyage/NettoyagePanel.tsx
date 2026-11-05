import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { apiRequest } from '@/integrations/mongodb/client';
import { useCleaningCycles, useCleaningKpis, useCreateCleaningCycle, useCloseCleaningCycle } from '@/hooks/useNettoyage';
import { CleaningProgram, WasteCategory, CLEANING_PROGRAM_CONFIG } from '@/types/phase2';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle2, Plus, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { SummaryStrip } from '@/components/shared/SummaryStrip';

const STATUS_STYLE = {
  EN_COURS: 'bg-blue-100 text-blue-700',
  TERMINE: 'bg-green-100 text-green-700',
  INCIDENT: 'bg-red-100 text-red-700',
};

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

  return (
    <div className="space-y-4">
      <SummaryStrip items={[
        { label: label('active'), value: kpis?.active_count ?? active.length },
        { label: label('completed'), value: kpis?.completed_count ?? recent.filter(c => c.status === 'TERMINE').length },
        { label: label('averageYield'), value: kpis?.avg_yield_pct != null ? `${kpis.avg_yield_pct} %` : '—' },
        { label: label('minimumYield'), value: '92 %' },
      ]} />

      {/* Active cycles */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="text-sm">{label('active')} ({active.length})</CardTitle>
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4 mr-1.5" />
              {label('newCycle')}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-sm text-muted-foreground py-4 text-center">{label('loading')}</div>
          ) : active.length === 0 ? (
            <div className="text-sm text-muted-foreground py-4 text-center">{label('empty')}</div>
          ) : (
            <div className="divide-y">
              {active.map((c) => (
                <div key={c.id} className="py-3 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm font-semibold">{c.cycle_number}</span>
                      <Badge className={`text-xs ${STATUS_STYLE[c.status]}`}>{c.status === 'EN_COURS' ? label('inProgress') : label('incident')}</Badge>
                      <Badge variant="outline" className="text-xs">{label('program')} {c.program} — {label('program' + c.program)}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5 flex gap-3 flex-wrap">
                      <span>{label('lot')}: {c.lot_number}</span>
                      {c.variety && <span>{label('variety')}: {c.variety}</span>}
                      <span>{label('operator')}: {c.operator_name}</span>
                      <span>{label('started')}: {format(new Date(c.started_at), 'HH:mm', { locale: fr })}</span>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" className="h-9 px-3 text-xs shrink-0" onClick={() => setClosingId(c.id)}>
                    {label('close')}
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
          <CardHeader className="pb-2"><CardTitle className="text-sm">{label('history')}</CardTitle></CardHeader>
          <CardContent>
            <div className="divide-y">
              {recent.map((c) => (
                <div key={c.id} className="py-2.5 flex items-center gap-3 flex-wrap text-sm">
                  <span className="font-mono text-xs text-muted-foreground">{c.cycle_number}</span>
                  <Badge className={`text-xs ${STATUS_STYLE[c.status]}`}>{c.status === 'TERMINE' ? label('complete') : label('incident')}</Badge>
                  <span className="text-muted-foreground text-xs">{label('lot')} {c.lot_number}</span>
                  {c.yield_percent != null && (
                    <span className={`text-xs ml-auto ${c.yield_percent < 92 ? 'text-red-600 font-semibold' : 'text-green-600'}`}>
                      {c.yield_percent < 92 ? <><CheckCircle2 className="h-3 w-3 inline mr-0.5" /></> : null}
                      {label('yield')} {c.yield_percent}%
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
        <DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto">
          <DialogHeader><DialogTitle>{label('createTitle')}</DialogTitle><DialogDescription>{label('sourceHelp')}</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="cleaning-source" className="text-xs">{label('sourceLot')}</Label>
              <select id="cleaning-source" value={sourceId} onChange={(e) => setSourceId(e.target.value)} disabled={sources.isLoading} className="flex h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm">
                <option value="">{label('selectLot')}</option>
                {sources.data?.map((lot) => <option key={lot.id} value={lot.id}>{lot.lot_number} · {lot.current_quantity} {lot.unit}</option>)}
              </select>
              {sources.isError && <p role="alert" className="text-sm text-destructive">{label('sourceError')}</p>}
              {!sources.isLoading && !sources.isError && sources.data?.length === 0 && <p className="text-sm text-muted-foreground">{label('noSources')}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="cleaning-variety" className="text-xs">{label('variety')}</Label>
                <Input id="cleaning-variety" value={createForm.variety} onChange={(e) => setCreateForm(p => ({ ...p, variety: e.target.value }))} placeholder="ex: Deglet Nour" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">{label('washProgram')}</Label>
                <Select value={createForm.program} onValueChange={(v) => setCreateForm(p => ({ ...p, program: v as CleaningProgram }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.entries(CLEANING_PROGRAM_CONFIG) as [CleaningProgram, typeof CLEANING_PROGRAM_CONFIG['A']][]).map(([k]) => (
                      <SelectItem key={k} value={k}>{label(`program${k}`)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="cleaning-operator" className="text-xs">{label('operator')}</Label>
                <Input id="cleaning-operator" value={createForm.operator_name} onChange={(e) => setCreateForm(p => ({ ...p, operator_name: e.target.value }))} />
              </div>
            </div>
            <div className="bg-muted/40 rounded p-2 text-xs text-muted-foreground">
              {label('program' + createForm.program)} — {label('effect' + createForm.program)}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowCreate(false)}>{label('cancel')}</Button>
            <Button onClick={handleCreate} disabled={createCycle.isPending || !selectedLot}>
              {createCycle.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {label('start')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Close dialog */}
      <Dialog open={!!closingId} onOpenChange={(v) => { if (!v) setClosingId(null); }}>
        <DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto">
          <DialogHeader><DialogTitle>{label('closeTitle')}</DialogTitle><DialogDescription>{label('balanceHelp')}</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="cleaning-input" className="text-xs">{label('input')}</Label>
                <Input id="cleaning-input" type="number" value={closeForm.weight_in_kg} onChange={(e) => setCloseForm(p => ({ ...p, weight_in_kg: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="cleaning-output" className="text-xs">{label('output')}</Label>
                <Input id="cleaning-output" type="number" value={closeForm.weight_out_kg} onChange={(e) => setCloseForm(p => ({ ...p, weight_out_kg: e.target.value }))} />
              </div>
            </div>
            {closeForm.weight_in_kg && closeForm.weight_out_kg && (
              <div className={`text-sm font-semibold ${Number(closeForm.weight_out_kg) / Number(closeForm.weight_in_kg) * 100 < 92 ? 'text-red-600' : 'text-green-600'}`}>
                {label('estimatedYield')}: {(Number(closeForm.weight_out_kg) / Number(closeForm.weight_in_kg) * 100).toFixed(1)}% {Number(closeForm.weight_out_kg) / Number(closeForm.weight_in_kg) * 100 < 92 ? label('lowYield') : '✓'}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="cleaning-waste" className="text-xs">{label('waste')}</Label>
                <Input id="cleaning-waste" type="number" value={closeForm.waste_weight_kg} onChange={(e) => setCloseForm(p => ({ ...p, waste_weight_kg: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{label('wasteCategory')}</Label>
                <Select value={closeForm.waste_category} onValueChange={(v) => setCloseForm(p => ({ ...p, waste_category: v as WasteCategory }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ORGANIQUE">{label('organic')}</SelectItem>
                    <SelectItem value="INERTE">{label('inert')}</SelectItem>
                    <SelectItem value="MAUVAISES_DATTES">{label('badDates')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">{label('turbidity')}</Label>
                <Input type="number" value={closeForm.turbidity_ntu} onChange={(e) => setCloseForm(p => ({ ...p, turbidity_ntu: e.target.value }))} placeholder="ex: 80" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{label('ph')}</Label>
                <Input type="number" step="0.1" value={closeForm.ph_water} onChange={(e) => setCloseForm(p => ({ ...p, ph_water: e.target.value }))} placeholder="ex: 7.2" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setClosingId(null)}>{label('cancel')}</Button>
            <Button onClick={handleClose} disabled={closeCycle.isPending || !closeForm.weight_in_kg || !closeForm.weight_out_kg || !closeForm.waste_weight_kg}>
              {closeCycle.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {label('submitClose')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
