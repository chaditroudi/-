import { useState } from 'react';
import {
  useLabelTemplates,
  useCreateLabelTemplate,
  useUpdateLabelTemplate,
  useApproveLabelTemplate,
  useArchiveLabelTemplate,
  usePrivateLabelClients,
  useCreatePrivateLabelClient,
  useToggleClientActive,
} from '@/hooks/usePackaging';
import {
  LabelTemplate,
  LabelStatus,
  LabelBrand,
  LabelLanguage,
  PrivateLabelClient,
  LABEL_LANGUAGE_LABELS,
} from '@/types/packaging';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Plus, Loader2, CheckCircle2, Archive, Pencil, Tag, Users, ToggleLeft, ToggleRight,
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const STATUS_STYLE: Record<LabelStatus, string> = {
  BROUILLON: 'bg-slate-100 text-slate-600',
  VALIDE:    'bg-green-100 text-green-700',
  ARCHIVE:   'bg-amber-100 text-amber-600',
};

const EMPTY_FORM = {
  name: '',
  version: 'v1.0',
  brand: 'ROYAL_PALM' as LabelBrand,
  client_name: '',
  language: 'FR' as LabelLanguage,
  market: 'TN',
  product_name: 'Dattes',
  variety: '',
  origin: 'Tunisie – Région de Tozeur',
  net_weight_g: 500,
  ingredients: 'Dattes (100%)',
  allergens: '',
  storage_temp: 'Conserver dans un endroit frais et sec',
  use_by_days: 365,
  gtin: '',
};

export function LabelTemplatePanel({ currentUser = 'Utilisateur' }: { currentUser?: string }) {
  const { data: templates = [], isLoading } = useLabelTemplates();
  const { data: clients = [] } = usePrivateLabelClients();
  const createTemplate = useCreateLabelTemplate();
  const updateTemplate = useUpdateLabelTemplate();
  const approveTemplate = useApproveLabelTemplate();
  const archiveTemplate = useArchiveLabelTemplate();
  const createClient = useCreatePrivateLabelClient();
  const toggleClient = useToggleClientActive();

  const [activeView, setActiveView] = useState<'labels' | 'clients'>('labels');
  const [statusFilter, setStatusFilter] = useState<LabelStatus | 'TOUS'>('TOUS');
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });

  // Client form
  const [showClientDialog, setShowClientDialog] = useState(false);
  const [clientForm, setClientForm] = useState({ name: '', code: '', country: '', contact_name: '', contact_email: '' });

  const visible = templates.filter((t) =>
    statusFilter === 'TOUS' ? true : t.status === statusFilter,
  );

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setShowDialog(true);
  };

  const openEdit = (tpl: LabelTemplate) => {
    setEditingId(tpl.id);
    setForm({
      name: tpl.name,
      version: tpl.version,
      brand: tpl.brand,
      client_name: tpl.client_name ?? '',
      language: tpl.language,
      market: tpl.market,
      product_name: tpl.product_name,
      variety: tpl.variety ?? '',
      origin: tpl.origin,
      net_weight_g: tpl.net_weight_g,
      ingredients: tpl.ingredients,
      allergens: tpl.allergens ?? '',
      storage_temp: tpl.storage_temp,
      use_by_days: tpl.use_by_days,
      gtin: tpl.gtin ?? '',
    });
    setShowDialog(true);
  };

  const handleSubmit = async () => {
    const payload = {
      name: form.name,
      version: form.version,
      brand: form.brand,
      client_name: form.brand === 'PRIVATE_LABEL' ? (form.client_name || null) : null,
      language: form.language,
      market: form.market,
      product_name: form.product_name,
      variety: form.variety || null,
      origin: form.origin,
      net_weight_g: form.net_weight_g,
      ingredients: form.ingredients,
      allergens: form.allergens || null,
      storage_temp: form.storage_temp,
      use_by_days: form.use_by_days,
      gtin: form.gtin || null,
      created_by: currentUser,
    };
    if (editingId) {
      await updateTemplate.mutateAsync({ id: editingId, ...payload });
    } else {
      await createTemplate.mutateAsync(payload);
    }
    setShowDialog(false);
  };

  const isPending = createTemplate.isPending || updateTemplate.isPending;
  const canSubmit = form.name && form.product_name && form.net_weight_g > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Tabs value={activeView} onValueChange={(v) => setActiveView(v as typeof activeView)}>
          <TabsList className="h-8">
            <TabsTrigger value="labels" className="text-xs h-7">
              <Tag className="h-3 w-3 mr-1.5" />
              Modèles d'étiquettes
            </TabsTrigger>
            <TabsTrigger value="clients" className="text-xs h-7">
              <Users className="h-3 w-3 mr-1.5" />
              Clients marque blanche ({clients.length})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {activeView === 'labels' ? (
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1.5" />
            Nouveau modèle
          </Button>
        ) : (
          <Button size="sm" onClick={() => setShowClientDialog(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            Nouveau client
          </Button>
        )}
      </div>

      {activeView === 'labels' && (
        <>
          <div className="flex gap-2 flex-wrap">
            {(['TOUS', 'BROUILLON', 'VALIDE', 'ARCHIVE'] as const).map((s) => (
              <Button
                key={s}
                size="sm"
                variant={statusFilter === s ? 'default' : 'outline'}
                className="h-9 text-xs"
                onClick={() => setStatusFilter(s)}
              >
                {s === 'TOUS' ? `Tous (${templates.length})` : s}
                {s !== 'TOUS' && ` (${templates.filter((t) => t.status === s).length})`}
              </Button>
            ))}
          </div>

          {isLoading ? (
            <div className="text-sm text-muted-foreground py-8 text-center">Chargement…</div>
          ) : visible.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                <Tag className="h-8 w-8 mx-auto mb-2 opacity-30" />
                Aucun modèle d'étiquette. Créez le premier.
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {visible.map((tpl) => (
                <Card key={tpl.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <CardTitle className="text-sm">{tpl.name}</CardTitle>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {tpl.version} · {LABEL_LANGUAGE_LABELS[tpl.language]} · {tpl.market}
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        {tpl.brand === 'PRIVATE_LABEL' && (
                          <Badge variant="outline" className="text-[10px] h-4 px-1 text-purple-700">PL</Badge>
                        )}
                        <Badge className={`text-[10px] px-1.5 ${STATUS_STYLE[tpl.status]}`}>{tpl.status}</Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="grid grid-cols-2 gap-x-4 text-xs">
                      <div className="text-muted-foreground">Produit</div>
                      <div className="font-semibold truncate">{tpl.product_name}{tpl.variety ? ` — ${tpl.variety}` : ''}</div>
                      <div className="text-muted-foreground">Poids net</div>
                      <div className="font-semibold">{tpl.net_weight_g} g</div>
                      {tpl.gtin && <>
                        <div className="text-muted-foreground">GTIN</div>
                        <div className="font-mono text-xs">{tpl.gtin}</div>
                      </>}
                      {tpl.approved_by && <>
                        <div className="text-muted-foreground">Validée par</div>
                        <div className="text-xs">{tpl.approved_by} · {tpl.approved_at ? format(new Date(tpl.approved_at), 'dd/MM/yyyy', { locale: fr }) : ''}</div>
                      </>}
                    </div>
                    <div className="flex gap-2 pt-1 flex-wrap">
                      {tpl.status === 'BROUILLON' && (
                        <>
                          <Button size="sm" variant="outline" className="h-9 px-2 text-xs" onClick={() => openEdit(tpl)}>
                            <Pencil className="h-3 w-3 mr-1" />
                            Modifier
                          </Button>
                          <Button
                            size="sm"
                            className="h-9 px-2 text-xs bg-green-600 hover:bg-green-700 text-white"
                            onClick={() => approveTemplate.mutate({ id: tpl.id, approved_by: currentUser })}
                            disabled={approveTemplate.isPending}
                          >
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Valider
                          </Button>
                        </>
                      )}
                      {tpl.status === 'VALIDE' && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-9 px-2 text-xs"
                          onClick={() => archiveTemplate.mutate(tpl.id)}
                          disabled={archiveTemplate.isPending}
                        >
                          <Archive className="h-3 w-3 mr-1" />
                          Archiver
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {activeView === 'clients' && (
        <div className="space-y-2">
          {clients.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
                Aucun client marque blanche enregistré.
              </CardContent>
            </Card>
          ) : (
            <div className="divide-y rounded-lg border bg-card">
              {clients.map((c) => (
                <div key={c.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{c.name}</span>
                      <span className="font-mono text-xs text-muted-foreground">{c.code}</span>
                      <Badge variant="outline" className="text-[10px] h-4 px-1">{c.country}</Badge>
                      {!c.active && <Badge className="text-[10px] h-4 px-1 bg-slate-100 text-slate-500">Inactif</Badge>}
                    </div>
                    {c.contact_name && (
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {c.contact_name} {c.contact_email ? `— ${c.contact_email}` : ''}
                      </div>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-9 px-2 text-xs"
                    onClick={() => toggleClient.mutate({ id: c.id, active: c.active })}
                  >
                    {c.active ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Label template dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Modifier modèle d\'étiquette' : 'Nouveau modèle d\'étiquette'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1 col-span-2">
                <Label className="text-xs">Nom *</Label>
                <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="Deglet Nour 500g — France" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Version</Label>
                <Input value={form.version} onChange={(e) => setForm((p) => ({ ...p, version: e.target.value }))} placeholder="v1.0" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Marque</Label>
                <Select value={form.brand} onValueChange={(v) => setForm((p) => ({ ...p, brand: v as LabelBrand }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ROYAL_PALM">Royal Palm</SelectItem>
                    <SelectItem value="PRIVATE_LABEL">Marque blanche</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Langue</Label>
                <Select value={form.language} onValueChange={(v) => setForm((p) => ({ ...p, language: v as LabelLanguage }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.entries(LABEL_LANGUAGE_LABELS) as [LabelLanguage, string][]).map(([k, lbl]) => (
                      <SelectItem key={k} value={k}>{lbl}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Marché (pays)</Label>
                <Input value={form.market} onChange={(e) => setForm((p) => ({ ...p, market: e.target.value.toUpperCase() }))} placeholder="TN, FR, DE…" maxLength={5} />
              </div>
            </div>

            {form.brand === 'PRIVATE_LABEL' && (
              <div className="space-y-1">
                <Label className="text-xs">Nom du client (marque)</Label>
                <Input value={form.client_name} onChange={(e) => setForm((p) => ({ ...p, client_name: e.target.value }))} placeholder="Carrefour, Lidl…" />
              </div>
            )}

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1 col-span-2">
                <Label className="text-xs">Nom produit *</Label>
                <Input value={form.product_name} onChange={(e) => setForm((p) => ({ ...p, product_name: e.target.value }))} placeholder="Dattes Deglet Nour" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Variété</Label>
                <Input value={form.variety} onChange={(e) => setForm((p) => ({ ...p, variety: e.target.value }))} placeholder="Deglet Nour" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Origine</Label>
                <Input value={form.origin} onChange={(e) => setForm((p) => ({ ...p, origin: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Poids net (g) *</Label>
                <Input type="number" value={form.net_weight_g} onChange={(e) => setForm((p) => ({ ...p, net_weight_g: Number(e.target.value) }))} />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Ingrédients *</Label>
              <Textarea value={form.ingredients} onChange={(e) => setForm((p) => ({ ...p, ingredients: e.target.value }))} rows={2} placeholder="Dattes (100%)" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Allergènes (si applicable)</Label>
                <Input value={form.allergens} onChange={(e) => setForm((p) => ({ ...p, allergens: e.target.value }))} placeholder="Peut contenir des traces de…" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Conditions de conservation</Label>
                <Input value={form.storage_temp} onChange={(e) => setForm((p) => ({ ...p, storage_temp: e.target.value }))} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">DLC (jours depuis production)</Label>
                <Input type="number" value={form.use_by_days} onChange={(e) => setForm((p) => ({ ...p, use_by_days: Number(e.target.value) }))} min={1} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">GTIN-13 (GS1)</Label>
                <Input
                  value={form.gtin}
                  onChange={(e) => setForm((p) => ({ ...p, gtin: e.target.value.replace(/\D/g, '').slice(0, 13) }))}
                  placeholder="0000000000000"
                  maxLength={13}
                  className="font-mono"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowDialog(false)}>Annuler</Button>
            <Button onClick={handleSubmit} disabled={isPending || !canSubmit}>
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingId ? 'Enregistrer' : 'Créer (Brouillon)'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Private label client dialog */}
      <Dialog open={showClientDialog} onOpenChange={setShowClientDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nouveau client marque blanche</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1 col-span-2">
                <Label className="text-xs">Nom du client *</Label>
                <Input value={clientForm.name} onChange={(e) => setClientForm((p) => ({ ...p, name: e.target.value }))} placeholder="Carrefour France" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Code interne *</Label>
                <Input value={clientForm.code} onChange={(e) => setClientForm((p) => ({ ...p, code: e.target.value.toUpperCase() }))} placeholder="CARREFOUR-FR" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Pays *</Label>
                <Input value={clientForm.country} onChange={(e) => setClientForm((p) => ({ ...p, country: e.target.value.toUpperCase() }))} placeholder="FR" maxLength={3} />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Contact</Label>
              <Input value={clientForm.contact_name} onChange={(e) => setClientForm((p) => ({ ...p, contact_name: e.target.value }))} placeholder="Prénom Nom" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Email contact</Label>
              <Input type="email" value={clientForm.contact_email} onChange={(e) => setClientForm((p) => ({ ...p, contact_email: e.target.value }))} placeholder="contact@example.com" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowClientDialog(false)}>Annuler</Button>
            <Button
              onClick={async () => {
                await createClient.mutateAsync({
                  name: clientForm.name,
                  code: clientForm.code,
                  country: clientForm.country,
                  contact_name: clientForm.contact_name || null,
                  contact_email: clientForm.contact_email || null,
                });
                setShowClientDialog(false);
                setClientForm({ name: '', code: '', country: '', contact_name: '', contact_email: '' });
              }}
              disabled={createClient.isPending || !clientForm.name || !clientForm.code || !clientForm.country}
            >
              {createClient.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
