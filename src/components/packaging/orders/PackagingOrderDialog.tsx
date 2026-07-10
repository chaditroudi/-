import { useState } from 'react';
import {
  usePackagingBOMs,
  useLabelTemplates,
  useAvailableSublotsForPackaging,
  useCreatePackagingOrder,
  useStartPackagingOrder,
  usePauseResumePackagingOrder,
  useUpdatePackagingProgress,
  useClosePackagingOrder,
  usePackagingPalettes,
  useCreatePackagingPalette,
  useSealPalette,
} from '@/hooks/usePackaging';
import {
  PackagingOrder,
  PackagingLine,
  ORDER_STATUS_STYLE,
  PACKAGING_FORMAT_CONFIG,
  computeTargetUnits,
  PACKAGING_LINE_LABELS,
} from '@/types/packaging';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Loader2, Play, Pause, Square, Plus, Printer, ShieldCheck, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { printPaletteLabel } from '../printPaletteLabel';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  order?: PackagingOrder;
  currentUser?: string;
}

export function PackagingOrderDialog({ open, onOpenChange, order, currentUser = 'Utilisateur' }: Props) {
  const { data: boms = [] } = usePackagingBOMs();
  const { data: allLabels = [] } = useLabelTemplates();
  const { data: sublots = [] } = useAvailableSublotsForPackaging();
  const createOrder = useCreatePackagingOrder();
  const startOrder = useStartPackagingOrder();
  const pauseResume = usePauseResumePackagingOrder();
  const updateProgress = useUpdatePackagingProgress();
  const closeOrder = useClosePackagingOrder();

  // Create form
  const [createForm, setCreateForm] = useState({
    source_sublot_id: '',
    bom_id: '',
    label_template_id: '',
    line: 'L-PKG-1' as PackagingLine,
    planned_at: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    operator_name: currentUser,
    chef_ligne: '',
    worker_count: 4,
    notes: '',
  });

  // Progress form
  const [progressForm, setProgressForm] = useState({
    produced_units: order?.produced_units ?? 0,
    rejected_units: order?.rejected_units ?? 0,
    checkweigher_count: order?.checkweigher_count ?? 0,
    checkweigher_failures: order?.checkweigher_failures ?? 0,
    metal_detector_failures: order?.metal_detector_failures ?? 0,
  });

  // Palette creation
  const [showPaletteCreate, setShowPaletteCreate] = useState(false);
  const [paletteBoxCount, setPaletteBoxCount] = useState('');
  const [sealingId, setSealingId] = useState<string | null>(null);
  const [sealForm, setSealForm] = useState({ seal_number: '', sealed_by: currentUser });

  const { data: palettes = [] } = usePackagingPalettes(order?.id ?? '');
  const createPalette = useCreatePackagingPalette();
  const sealPalette = useSealPalette();

  const selectedBOM = boms.find((b) => b.id === createForm.bom_id);
  const selectedSublot = sublots.find((s) => s.id === createForm.source_sublot_id);
  const labelForBOM = selectedBOM?.label_template_id
    ? allLabels.find((l) => l.id === selectedBOM.label_template_id)
    : null;

  const previewTargetUnits = selectedBOM && selectedSublot
    ? computeTargetUnits(selectedSublot.weight_kg, selectedBOM.net_weight_g)
    : null;

  const handleBOMSelect = (bomId: string) => {
    const bom = boms.find((b) => b.id === bomId);
    setCreateForm((p) => ({
      ...p,
      bom_id: bomId,
      label_template_id: bom?.label_template_id ?? '',
    }));
  };

  const handleCreate = async () => {
    if (!selectedSublot || !selectedBOM) return;
    const labelTemplate = allLabels.find((l) => l.id === createForm.label_template_id);
    await createOrder.mutateAsync({
      source_sublot_id: selectedSublot.id,
      source_lot_number: selectedSublot.lot_number,
      source_weight_kg: selectedSublot.weight_kg,
      grade: selectedSublot.grade,
      bom_id: selectedBOM.id,
      bom_name: selectedBOM.name,
      bom_format: selectedBOM.format,
      bom_net_weight_g: selectedBOM.net_weight_g,
      label_template_id: createForm.label_template_id,
      label_template_name: labelTemplate?.name ?? '',
      label_status: labelTemplate?.status ?? 'BROUILLON',
      line: createForm.line,
      planned_at: new Date(createForm.planned_at).toISOString(),
      operator_name: createForm.operator_name,
      chef_ligne: createForm.chef_ligne || null,
      worker_count: createForm.worker_count,
      notes: createForm.notes || null,
      created_by: currentUser,
    });
    onOpenChange(false);
  };

  const handleSealPalette = async (paletteId: string, paletteNumber: string) => {
    const sealSerial = palettes.filter((p) => p.status === 'SCELLE').length + 1;
    await sealPalette.mutateAsync({
      id: paletteId,
      order_id: order!.id,
      palette_number: paletteNumber,
      seal_number: sealForm.seal_number,
      sealed_by: sealForm.sealed_by,
      serial_counter: Date.now() % 100_000_000,
    });
    setSealingId(null);
    setSealForm({ seal_number: '', sealed_by: currentUser });
  };

  const progressPct = order && order.target_units > 0
    ? Math.min(100, Math.round((order.produced_units / order.target_units) * 100))
    : 0;

  const checkweigherRate = order && order.checkweigher_count > 0
    ? ((order.checkweigher_failures / order.checkweigher_count) * 100).toFixed(1)
    : null;

  const activeBOM = order ? boms.find((b) => b.id === order.bom_id) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {order ? `OF ${order.order_number}` : 'Nouvel ordre de conditionnement'}
          </DialogTitle>
        </DialogHeader>

        {/* ── VIEW mode ─────────────────────────────────────────── */}
        {order && (
          <div className="space-y-5">
            {/* Status + meta */}
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={ORDER_STATUS_STYLE[order.status]}>{order.status.replace('_', ' ')}</Badge>
              <span className="text-xs text-muted-foreground">{order.line} · {order.operator_name}</span>
              {order.started_at && (
                <span className="text-xs text-muted-foreground">
                  Démarré {format(new Date(order.started_at), 'HH:mm', { locale: fr })}
                </span>
              )}
            </div>

            {/* Progress */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="font-semibold">{order.produced_units} / {order.target_units} unités</span>
                <span className="text-muted-foreground">{progressPct}%</span>
              </div>
              <Progress value={progressPct} className="h-3" />
              <div className="flex gap-4 text-xs text-muted-foreground flex-wrap">
                <span>Rejetées: {order.rejected_units}</span>
                {checkweigherRate && (
                  <span className={parseFloat(checkweigherRate) > 2 ? 'text-red-600 font-semibold' : ''}>
                    Pond.: {order.checkweigher_failures}/{order.checkweigher_count} ({checkweigherRate}%)
                  </span>
                )}
                {order.metal_detector_failures > 0 && (
                  <span className="text-red-600 font-semibold flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Métal: {order.metal_detector_failures} détection(s)
                  </span>
                )}
              </div>
            </div>

            {/* Update progress */}
            {(order.status === 'EN_COURS' || order.status === 'PAUSE') && (
              <div className="border rounded-lg p-3 space-y-3">
                <div className="text-xs font-semibold text-muted-foreground uppercase">Mise à jour avancement</div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Unités produites</Label>
                    <Input
                      type="number"
                      value={progressForm.produced_units}
                      onChange={(e) => setProgressForm((p) => ({ ...p, produced_units: Number(e.target.value) }))}
                      min={0}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Unités rejetées</Label>
                    <Input
                      type="number"
                      value={progressForm.rejected_units}
                      onChange={(e) => setProgressForm((p) => ({ ...p, rejected_units: Number(e.target.value) }))}
                      min={0}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Contrôle pondéral total</Label>
                    <Input
                      type="number"
                      value={progressForm.checkweigher_count}
                      onChange={(e) => setProgressForm((p) => ({ ...p, checkweigher_count: Number(e.target.value) }))}
                      min={0}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Échecs pondéral</Label>
                    <Input
                      type="number"
                      value={progressForm.checkweigher_failures}
                      onChange={(e) => setProgressForm((p) => ({ ...p, checkweigher_failures: Number(e.target.value) }))}
                      min={0}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Détections métal</Label>
                    <Input
                      type="number"
                      value={progressForm.metal_detector_failures}
                      onChange={(e) => setProgressForm((p) => ({ ...p, metal_detector_failures: Number(e.target.value) }))}
                      min={0}
                      className={progressForm.metal_detector_failures > 0 ? 'border-red-400' : ''}
                    />
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => updateProgress.mutate({ id: order.id, order_number: order.order_number, target_units: order.target_units, ...progressForm })}
                  disabled={updateProgress.isPending}
                >
                  {updateProgress.isPending && <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />}
                  Enregistrer avancement
                </Button>
              </div>
            )}

            {/* Palettes */}
            <div className="border rounded-lg p-3 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold text-muted-foreground uppercase">Palettes ({palettes.length})</div>
                {order.status === 'EN_COURS' && (
                  <Button size="sm" variant="outline" className="h-9 text-xs" onClick={() => setShowPaletteCreate(true)}>
                    <Plus className="h-3 w-3 mr-1" />
                    Palette
                  </Button>
                )}
              </div>
              {showPaletteCreate && (
                <div className="flex gap-2 items-end">
                  <div className="space-y-1 flex-1">
                    <Label className="text-xs">Nb boîtes sur cette palette</Label>
                    <Input
                      type="number"
                      value={paletteBoxCount}
                      onChange={(e) => setPaletteBoxCount(e.target.value)}
                      placeholder={activeBOM ? String(activeBOM.boxes_per_layer * activeBOM.layers_per_palette) : ''}
                    />
                  </div>
                  <Button
                    size="sm"
                    onClick={async () => {
                      if (!activeBOM) return;
                      await createPalette.mutateAsync({
                        order_id: order.id,
                        order_number: order.order_number,
                        bom_id: activeBOM.id,
                        box_count: Number(paletteBoxCount) || (activeBOM.boxes_per_layer * activeBOM.layers_per_palette),
                        gross_weight_per_box_g: activeBOM.gross_weight_g,
                      });
                      setShowPaletteCreate(false);
                      setPaletteBoxCount('');
                    }}
                    disabled={createPalette.isPending}
                  >
                    {createPalette.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                    Créer
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowPaletteCreate(false)}>✕</Button>
                </div>
              )}
              {palettes.length === 0 ? (
                <div className="text-xs text-muted-foreground text-center py-2">Aucune palette créée</div>
              ) : (
                <div className="space-y-2">
                  {palettes.map((pal) => (
                    <div key={pal.id} className="flex items-center gap-2 text-xs">
                      <span className="font-mono font-semibold">{pal.palette_number}</span>
                      <Badge className={`text-[10px] px-1 ${pal.status === 'SCELLE' ? 'bg-green-100 text-green-700' : pal.status === 'EXPEDIE' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
                        {pal.status}
                      </Badge>
                      <span className="text-muted-foreground">{pal.box_count} boîtes · {pal.gross_weight_kg} kg</span>
                      {pal.sscc && <span className="font-mono text-[10px] text-muted-foreground">SSCC: {pal.sscc}</span>}
                      <div className="ml-auto flex gap-1">
                        {pal.status === 'EN_COURS' && sealingId !== pal.id && (
                          <Button size="sm" variant="outline" className="h-6 px-2 text-[10px]" onClick={() => setSealingId(pal.id)}>
                            <ShieldCheck className="h-3 w-3 mr-1" />
                            Sceller
                          </Button>
                        )}
                        {pal.status === 'SCELLE' && activeBOM && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2 text-[10px]"
                            onClick={() => printPaletteLabel(pal, order, activeBOM)}
                          >
                            <Printer className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {sealingId && (
                <div className="flex gap-2 items-end border-t pt-2">
                  <div className="space-y-1 flex-1">
                    <Label className="text-xs">N° sceau / film étirable</Label>
                    <Input
                      value={sealForm.seal_number}
                      onChange={(e) => setSealForm((p) => ({ ...p, seal_number: e.target.value }))}
                      placeholder="SC-20260608-001"
                    />
                  </div>
                  <Button
                    size="sm"
                    className="bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => {
                      const pal = palettes.find((p) => p.id === sealingId);
                      if (pal) handleSealPalette(pal.id, pal.palette_number);
                    }}
                    disabled={sealPalette.isPending || !sealForm.seal_number}
                  >
                    {sealPalette.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                    Confirmer scellage
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setSealingId(null)}>✕</Button>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2 flex-wrap pt-2 border-t">
              {order.status === 'PLANIFIE' && (
                <Button
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => {
                    const lbl = allLabels.find((l) => l.id === order.label_template_id);
                    startOrder.mutate({ id: order.id, label_status: lbl?.status ?? 'BROUILLON' });
                  }}
                  disabled={startOrder.isPending}
                >
                  {startOrder.isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Play className="h-4 w-4 mr-1.5" />}
                  Démarrer
                </Button>
              )}
              {(order.status === 'EN_COURS' || order.status === 'PAUSE') && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => pauseResume.mutate({ id: order.id, currentStatus: order.status })}
                  disabled={pauseResume.isPending}
                >
                  {order.status === 'EN_COURS'
                    ? <><Pause className="h-4 w-4 mr-1.5" />Pause</>
                    : <><Play className="h-4 w-4 mr-1.5" />Reprendre</>}
                </Button>
              )}
              {order.status === 'EN_COURS' && order.started_at && (
                <Button
                  size="sm"
                  className="bg-slate-700 hover:bg-slate-800 text-white"
                  onClick={() => closeOrder.mutate({
                    id: order.id,
                    started_at: order.started_at!,
                    produced_units: order.produced_units,
                    target_units: order.target_units,
                    order_number: order.order_number,
                  })}
                  disabled={closeOrder.isPending}
                >
                  {closeOrder.isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Square className="h-4 w-4 mr-1.5" />}
                  Clôturer
                </Button>
              )}
            </div>
          </div>
        )}

        {/* ── CREATE mode ───────────────────────────────────────── */}
        {!order && (
          <div className="space-y-4">
            <div className="space-y-1">
              <Label className="text-xs">Sous-lot source (triage)</Label>
              <Select value={createForm.source_sublot_id} onValueChange={(v) => setCreateForm((p) => ({ ...p, source_sublot_id: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un sous-lot disponible…" />
                </SelectTrigger>
                <SelectContent>
                  {sublots.length === 0 && (
                    <SelectItem value="__none" disabled>Aucun sous-lot disponible</SelectItem>
                  )}
                  {sublots.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.lot_number} — {s.grade.replace('_', ' ')} — {s.weight_kg} kg
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Nomenclature (BOM)</Label>
              <Select value={createForm.bom_id} onValueChange={handleBOMSelect}>
                <SelectTrigger><SelectValue placeholder="Choisir une BOM active…" /></SelectTrigger>
                <SelectContent>
                  {boms.filter((b) => b.is_active).map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name} — {PACKAGING_FORMAT_CONFIG[b.format].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedBOM && (
              <div className="bg-muted/40 rounded-lg p-3 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Étiquette liée</span>
                  <span>{labelForBOM ? `${labelForBOM.name} (${labelForBOM.status})` : '—'}</span>
                </div>
                {previewTargetUnits && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Unités cibles</span>
                    <span className="font-semibold">{previewTargetUnits.toLocaleString('fr-TN')}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Boîtes/palette</span>
                  <span>{selectedBOM.boxes_per_layer * selectedBOM.layers_per_palette}</span>
                </div>
              </div>
            )}

            <div className="space-y-1">
              <Label className="text-xs">Étiquette (auto depuis BOM, modifiable)</Label>
              <Select value={createForm.label_template_id} onValueChange={(v) => setCreateForm((p) => ({ ...p, label_template_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Choisir une étiquette…" /></SelectTrigger>
                <SelectContent>
                  {allLabels.filter((l) => l.is_active || l.status === 'BROUILLON').map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name} v{l.version} — {l.status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Ligne</Label>
                <Select value={createForm.line} onValueChange={(v) => setCreateForm((p) => ({ ...p, line: v as PackagingLine }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.entries(PACKAGING_LINE_LABELS) as [PackagingLine, string][]).map(([k, lbl]) => (
                      <SelectItem key={k} value={k}>{lbl}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Date planifiée</Label>
                <Input
                  type="datetime-local"
                  value={createForm.planned_at}
                  onChange={(e) => setCreateForm((p) => ({ ...p, planned_at: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1 col-span-2">
                <Label className="text-xs">Opérateur</Label>
                <Input value={createForm.operator_name} onChange={(e) => setCreateForm((p) => ({ ...p, operator_name: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Nb opérateurs</Label>
                <Input type="number" min={1} max={20} value={createForm.worker_count} onChange={(e) => setCreateForm((p) => ({ ...p, worker_count: Number(e.target.value) }))} />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Chef de ligne</Label>
              <Input value={createForm.chef_ligne} onChange={(e) => setCreateForm((p) => ({ ...p, chef_ligne: e.target.value }))} placeholder="(optionnel)" />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Notes</Label>
              <Textarea value={createForm.notes} onChange={(e) => setCreateForm((p) => ({ ...p, notes: e.target.value }))} rows={2} />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => onOpenChange(false)}>Annuler</Button>
              <Button
                onClick={handleCreate}
                disabled={createOrder.isPending || !createForm.source_sublot_id || !createForm.bom_id || !createForm.label_template_id}
              >
                {createOrder.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Créer l'OF
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
