import { useState } from 'react';
import {
  usePackagingBOMs,
  useCreatePackagingBOM,
  useUpdatePackagingBOM,
  useToggleBOMActive,
  useLabelTemplates,
  usePrivateLabelClients,
} from '@/hooks/usePackaging';
import {
  PackagingBOMItem,
  PackagingFormat,
  BoxMaterial,
  PACKAGING_FORMAT_CONFIG,
  BOX_MATERIAL_LABELS,
  computeBoxesPerPalette,
  computePaletteGrossWeightKg,
} from '@/types/packaging';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Loader2, Package, Pencil, ToggleLeft, ToggleRight } from 'lucide-react';

const EMPTY_FORM = {
  name: '',
  sku: '',
  format: 'BOITE_500G' as PackagingFormat,
  net_weight_g: 500,
  gross_weight_g: 650,
  box_material: 'CARTON' as BoxMaterial,
  boxes_per_layer: 12,
  layers_per_palette: 8,
  label_template_id: null as string | null,
  label_template_name: null as string | null,
  is_private_label: false,
  private_label_client_id: null as string | null,
  private_label_client_name: null as string | null,
  notes: '',
};

export function BOMPanel({ currentUser = 'Utilisateur' }: { currentUser?: string }) {
  const { data: boms = [], isLoading } = usePackagingBOMs();
  const { data: labels = [] } = useLabelTemplates('VALIDE');
  const { data: clients = [] } = usePrivateLabelClients();
  const createBOM = useCreatePackagingBOM();
  const updateBOM = useUpdatePackagingBOM();
  const toggleActive = useToggleBOMActive();

  const [showDialog, setShowDialog] = useState(false);
  const [editingBOM, setEditingBOM] = useState<PackagingBOMItem | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [showInactive, setShowInactive] = useState(false);

  const visibleBOMs = showInactive ? boms : boms.filter((b) => b.is_active);

  const openCreate = () => {
    setEditingBOM(null);
    setForm({ ...EMPTY_FORM });
    setShowDialog(true);
  };

  const openEdit = (bom: PackagingBOMItem) => {
    setEditingBOM(bom);
    setForm({
      name: bom.name,
      sku: bom.sku,
      format: bom.format,
      net_weight_g: bom.net_weight_g,
      gross_weight_g: bom.gross_weight_g,
      box_material: bom.box_material,
      boxes_per_layer: bom.boxes_per_layer,
      layers_per_palette: bom.layers_per_palette,
      label_template_id: bom.label_template_id,
      label_template_name: bom.label_template_name,
      is_private_label: bom.is_private_label,
      private_label_client_id: bom.private_label_client_id,
      private_label_client_name: bom.private_label_client_name,
      notes: bom.notes ?? '',
    });
    setShowDialog(true);
  };

  const handleFormatChange = (f: PackagingFormat) => {
    const cfg = PACKAGING_FORMAT_CONFIG[f];
    setForm((p) => ({
      ...p,
      format: f,
      net_weight_g: cfg.net_weight_g,
      gross_weight_g: cfg.net_weight_g + cfg.overhead_g,
    }));
  };

  const handleLabelSelect = (id: string) => {
    const tpl = labels.find((l) => l.id === id);
    setForm((p) => ({
      ...p,
      label_template_id: id,
      label_template_name: tpl?.name ?? null,
    }));
  };

  const handleClientSelect = (id: string) => {
    const client = clients.find((c) => c.id === id);
    setForm((p) => ({
      ...p,
      private_label_client_id: id,
      private_label_client_name: client?.name ?? null,
    }));
  };

  const handleSubmit = async () => {
    const payload = {
      ...form,
      notes: form.notes || null,
      created_by: currentUser,
    };
    if (editingBOM) {
      await updateBOM.mutateAsync({ id: editingBOM.id, ...payload });
    } else {
      await createBOM.mutateAsync(payload);
    }
    setShowDialog(false);
  };

  const boxesPerPalette = computeBoxesPerPalette(form.boxes_per_layer, form.layers_per_palette);
  const palGross = computePaletteGrossWeightKg(boxesPerPalette, form.gross_weight_g);

  const isPending = createBOM.isPending || updateBOM.isPending;
  const canSubmit = form.name && form.sku && form.net_weight_g > 0 && form.gross_weight_g > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{boms.length} nomenclatures</span>
          <div className="flex items-center gap-2">
            <Switch checked={showInactive} onCheckedChange={setShowInactive} id="show-inactive" />
            <label htmlFor="show-inactive" className="text-xs text-muted-foreground">Afficher inactives</label>
          </div>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1.5" />
          Nouvelle nomenclature
        </Button>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground py-8 text-center">Chargement…</div>
      ) : visibleBOMs.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            <Package className="h-8 w-8 mx-auto mb-2 opacity-30" />
            Aucune nomenclature. Créez votre première BOM.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {visibleBOMs.map((bom) => {
            const bpp = computeBoxesPerPalette(bom.boxes_per_layer, bom.layers_per_palette);
            const palGrossKg = computePaletteGrossWeightKg(bpp, bom.gross_weight_g);
            return (
              <Card key={bom.id} className={bom.is_active ? '' : 'opacity-50'}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-sm">{bom.name}</CardTitle>
                      <div className="text-xs text-muted-foreground font-mono mt-0.5">{bom.sku}</div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      {bom.is_private_label && (
                        <Badge variant="outline" className="text-[10px] h-4 px-1 text-purple-700">PL</Badge>
                      )}
                      <Badge className={`text-[10px] h-4 px-1 ${bom.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                        {bom.is_active ? 'Actif' : 'Inactif'}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex gap-2 flex-wrap">
                    <Badge variant="outline" className="text-xs">{PACKAGING_FORMAT_CONFIG[bom.format].label}</Badge>
                    <Badge variant="outline" className="text-xs">{BOX_MATERIAL_LABELS[bom.box_material]}</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <div className="text-muted-foreground">Poids net</div>
                    <div className="font-semibold">{bom.net_weight_g} g</div>
                    <div className="text-muted-foreground">Poids brut</div>
                    <div className="font-semibold">{bom.gross_weight_g} g</div>
                    <div className="text-muted-foreground">Boîtes/palette</div>
                    <div className="font-semibold">{bpp} ({bom.boxes_per_layer}×{bom.layers_per_palette})</div>
                    <div className="text-muted-foreground">Poids pal.</div>
                    <div className="font-semibold">{palGrossKg} kg</div>
                  </div>
                  {bom.label_template_name && (
                    <div className="text-xs text-blue-600 truncate">
                      Étiquette: {bom.label_template_name}
                    </div>
                  )}
                  <div className="flex gap-2 pt-1">
                    <Button size="sm" variant="outline" className="h-9 px-2 text-xs" onClick={() => openEdit(bom)}>
                      <Pencil className="h-3 w-3 mr-1" />
                      Modifier
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-9 px-2 text-xs"
                      onClick={() => toggleActive.mutate({ id: bom.id, is_active: bom.is_active })}
                    >
                      {bom.is_active
                        ? <><ToggleRight className="h-3 w-3 mr-1" />Désactiver</>
                        : <><ToggleLeft className="h-3 w-3 mr-1" />Activer</>}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingBOM ? 'Modifier nomenclature' : 'Nouvelle nomenclature'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1 col-span-2 sm:col-span-1">
                <Label className="text-xs">Désignation *</Label>
                <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="Boîte 500g Deglet Nour Premium" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">SKU *</Label>
                <Input value={form.sku} onChange={(e) => setForm((p) => ({ ...p, sku: e.target.value }))} placeholder="PKG-BOX-500-DN-RP" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Format</Label>
                <Select value={form.format} onValueChange={(v) => handleFormatChange(v as PackagingFormat)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.entries(PACKAGING_FORMAT_CONFIG) as [PackagingFormat, typeof PACKAGING_FORMAT_CONFIG['BOITE_500G']][]).map(([k, cfg]) => (
                      <SelectItem key={k} value={k}>{cfg.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Matériau boîte</Label>
                <Select value={form.box_material} onValueChange={(v) => setForm((p) => ({ ...p, box_material: v as BoxMaterial }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.entries(BOX_MATERIAL_LABELS) as [BoxMaterial, string][]).map(([k, lbl]) => (
                      <SelectItem key={k} value={k}>{lbl}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Poids net (g) *</Label>
                <Input type="number" value={form.net_weight_g} onChange={(e) => setForm((p) => ({ ...p, net_weight_g: Number(e.target.value) }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Poids brut (g) *</Label>
                <Input type="number" value={form.gross_weight_g} onChange={(e) => setForm((p) => ({ ...p, gross_weight_g: Number(e.target.value) }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">
                  Palette preview
                </Label>
                <div className="h-9 flex items-center text-xs text-muted-foreground">
                  {boxesPerPalette} boîtes · {palGross} kg brut
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Boîtes/couche</Label>
                <Input type="number" value={form.boxes_per_layer} onChange={(e) => setForm((p) => ({ ...p, boxes_per_layer: Number(e.target.value) }))} min={1} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Couches/palette</Label>
                <Input type="number" value={form.layers_per_palette} onChange={(e) => setForm((p) => ({ ...p, layers_per_palette: Number(e.target.value) }))} min={1} />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Étiquette associée (VALIDE uniquement)</Label>
              <Select value={form.label_template_id ?? ''} onValueChange={handleLabelSelect}>
                <SelectTrigger><SelectValue placeholder="Choisir un modèle d'étiquette…" /></SelectTrigger>
                <SelectContent>
                  {labels.map((l) => (
                    <SelectItem key={l.id} value={l.id}>{l.name} v{l.version} — {l.market}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-3">
              <Switch
                checked={form.is_private_label}
                onCheckedChange={(v) => setForm((p) => ({ ...p, is_private_label: v, private_label_client_id: null, private_label_client_name: null }))}
                id="pl-switch"
              />
              <label htmlFor="pl-switch" className="text-sm">Marque blanche (private label)</label>
            </div>

            {form.is_private_label && (
              <div className="space-y-1">
                <Label className="text-xs">Client marque blanche</Label>
                <Select value={form.private_label_client_id ?? ''} onValueChange={handleClientSelect}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner un client…" /></SelectTrigger>
                  <SelectContent>
                    {clients.filter((c) => c.active).map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name} ({c.code}) — {c.country}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1">
              <Label className="text-xs">Notes</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                placeholder="Instructions particulières…"
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowDialog(false)}>Annuler</Button>
            <Button onClick={handleSubmit} disabled={isPending || !canSubmit}>
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingBOM ? 'Enregistrer' : 'Créer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
