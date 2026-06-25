import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, Eye, Send, Trophy, FileSearch } from 'lucide-react';
import {
  useRFQs,
  useCreateRFQ,
  useUpdateRFQ,
  useRFQResponses,
  useAddRFQResponse,
  useSelectRFQWinner,
} from '@/hooks/useP2P';
import {
  rfqStatusLabels,
  rfqStatusColors,
  SITE_LABELS,
  type RFQRequest,
  type RFQResponse,
  type SiteCode,
} from '@/types/p2p';
import type { Supplier } from '@/types/mes';
import { useSettingsContext } from '@/contexts/SettingsContext';

interface Props {
  suppliers: Supplier[];
  currentUser: string;
}

const EMPTY_RFQ: Partial<RFQRequest> = {
  title: '',
  description: null,
  site: null,
  supplier_ids: [],
  deadline_response: null,
  status: 'BROUILLON',
};

export const RFQPanel = ({ suppliers, currentUser }: Props) => {
  const { settings } = useSettingsContext();
  const { data: rfqs = [], isLoading } = useRFQs();
  const createRFQ = useCreateRFQ();
  const updateRFQ = useUpdateRFQ();
  const addResponse = useAddRFQResponse();
  const selectWinner = useSelectRFQWinner();

  const [createOpen, setCreateOpen] = useState(false);
  const [detailRFQ, setDetailRFQ] = useState<RFQRequest | null>(null);
  const [responseOpen, setResponseOpen] = useState(false);
  const [selectedRFQForResponse, setSelectedRFQForResponse] = useState<RFQRequest | null>(null);

  const [form, setForm] = useState<Partial<RFQRequest>>(EMPTY_RFQ);
  const [supplierIdsStr, setSupplierIdsStr] = useState('');

  const [responseForm, setResponseForm] = useState({
    supplier_id: '',
    unit_price: '',
    total_amount: '',
    currency: 'TND',
    delivery_days: '',
    validity_days: '',
    notes: '',
  });

  const handleOpenCreate = () => {
    setForm({ ...EMPTY_RFQ, created_by: currentUser });
    setSupplierIdsStr('');
    setCreateOpen(true);
  };

  const handleCreate = () => {
    const now = new Date().toISOString();
    const d = now.slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    const ids = supplierIdsStr.split(',').map((s) => s.trim()).filter(Boolean);
    createRFQ.mutate(
      { ...form, rfq_number: `AO-${d}-${rand}`, supplier_ids: ids },
      { onSuccess: () => setCreateOpen(false) },
    );
  };

  const handleSend = (rfq: RFQRequest) => {
    updateRFQ.mutate({ id: rfq.id, status: 'ENVOYEE' });
  };

  const handleOpenResponse = (rfq: RFQRequest) => {
    setSelectedRFQForResponse(rfq);
    setResponseForm({ supplier_id: '', unit_price: '', total_amount: '', currency: 'TND', delivery_days: '', validity_days: '', notes: '' });
    setResponseOpen(true);
  };

  const handleSaveResponse = () => {
    if (!selectedRFQForResponse) return;
    const sup = suppliers.find((s) => s.id === responseForm.supplier_id);
    addResponse.mutate(
      {
        rfqId: selectedRFQForResponse.id,
        supplier_id: responseForm.supplier_id,
        supplier_name: sup?.name ?? responseForm.supplier_id,
        unit_price: parseFloat(responseForm.unit_price) || 0,
        total_amount: parseFloat(responseForm.total_amount) || 0,
        currency: responseForm.currency,
        delivery_days: responseForm.delivery_days ? parseInt(responseForm.delivery_days) : null,
        validity_days: responseForm.validity_days ? parseInt(responseForm.validity_days) : null,
        notes: responseForm.notes || null,
        received_at: new Date().toISOString(),
      },
      {
        onSuccess: () => {
          setResponseOpen(false);
          updateRFQ.mutate({ id: selectedRFQForResponse.id, status: 'REPONSE_RECUE' });
        },
      },
    );
  };

  const pendingCount = rfqs.filter((r) => r.status === 'ENVOYEE').length;
  const receivedCount = rfqs.filter((r) => r.status === 'REPONSE_RECUE').length;
  const closedCount = rfqs.filter((r) => r.status === 'CLOTUREE').length;

  return (
    <div className="space-y-4">
      {settings.p2p.enable_minimum_quotes_rule && (
        <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
          Règle active: minimum {settings.p2p.rfq_minimum_quote_count} devis au-delà de{' '}
          {settings.p2p.rfq_quote_threshold_tnd.toLocaleString('fr-FR')} TND.
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-3 md:grid-cols-3 gap-3">
        {[
          { label: 'AO envoyés', value: pendingCount, color: 'text-blue-600' },
          { label: 'Réponses reçues', value: receivedCount, color: 'text-amber-600' },
          { label: 'AO clôturés', value: closedCount, color: 'text-emerald-600' },
        ].map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="p-3 flex items-center gap-3">
              <FileSearch className={`h-5 w-5 ${kpi.color}`} />
              <div>
                <p className={`text-xl font-bold ${kpi.color}`}>{kpi.value}</p>
                <p className="text-xs text-muted-foreground">{kpi.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-base">Appels d'offres</h3>
        <Button size="sm" onClick={handleOpenCreate}>
          <Plus className="h-4 w-4 mr-1" /> Nouvel AO
        </Button>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Numéro</TableHead>
                <TableHead>Titre</TableHead>
                <TableHead>Site</TableHead>
                <TableHead>Fournisseurs</TableHead>
                <TableHead>Échéance</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Chargement…
                  </TableCell>
                </TableRow>
              ) : rfqs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Aucun appel d'offres
                  </TableCell>
                </TableRow>
              ) : (
                rfqs.map((rfq) => (
                  <TableRow key={rfq.id}>
                    <TableCell className="font-mono text-xs">{rfq.rfq_number}</TableCell>
                    <TableCell className="max-w-[180px] truncate">{rfq.title}</TableCell>
                    <TableCell>{rfq.site ? SITE_LABELS[rfq.site] : '—'}</TableCell>
                    <TableCell>{rfq.supplier_ids?.length ?? 0}</TableCell>
                    <TableCell>
                      {rfq.deadline_response
                        ? new Date(rfq.deadline_response).toLocaleDateString('fr-FR')
                        : '—'}
                    </TableCell>
                    <TableCell>
                      <Badge className={rfqStatusColors[rfq.status]}>
                        {rfqStatusLabels[rfq.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setDetailRFQ(rfq)}>
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        {rfq.status === 'BROUILLON' && (
                          <Button variant="ghost" size="sm" onClick={() => handleSend(rfq)}>
                            <Send className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {rfq.status === 'ENVOYEE' && (
                          <Button variant="ghost" size="sm" onClick={() => handleOpenResponse(rfq)}>
                            <Plus className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nouvel appel d'offres</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Titre *</Label>
              <Input value={form.title ?? ''} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <Label>Site</Label>
              <Select value={form.site ?? ''} onValueChange={(v) => setForm({ ...form, site: v as SiteCode || null })}>
                <SelectTrigger><SelectValue placeholder="Sélectionner…" /></SelectTrigger>
                <SelectContent>
                  {Object.entries(SITE_LABELS).map(([code, label]) => (
                    <SelectItem key={code} value={code}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={form.description ?? ''}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
              />
            </div>
            <div>
              <Label>Fournisseurs consultés</Label>
              <Select
                value=""
                onValueChange={(v) => {
                  if (!form.supplier_ids?.includes(v)) {
                    setForm({ ...form, supplier_ids: [...(form.supplier_ids ?? []), v] });
                  }
                }}
              >
                <SelectTrigger><SelectValue placeholder="Ajouter un fournisseur…" /></SelectTrigger>
                <SelectContent>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(form.supplier_ids?.length ?? 0) > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {form.supplier_ids?.map((id) => {
                    const s = suppliers.find((x) => x.id === id);
                    return (
                      <Badge
                        key={id}
                        className="cursor-pointer bg-blue-100 text-blue-700 hover:bg-red-100 hover:text-red-700"
                        onClick={() =>
                          setForm({ ...form, supplier_ids: form.supplier_ids?.filter((x) => x !== id) })
                        }
                      >
                        {s?.name ?? id} ×
                      </Badge>
                    );
                  })}
                </div>
              )}
            </div>
            <div>
              <Label>Date limite de réponse</Label>
              <Input
                type="date"
                value={form.deadline_response?.slice(0, 10) ?? ''}
                onChange={(e) => setForm({ ...form, deadline_response: e.target.value || null })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Annuler</Button>
            <Button onClick={handleCreate} disabled={!form.title || createRFQ.isPending}>
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Response dialog */}
      <Dialog open={responseOpen} onOpenChange={setResponseOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Enregistrer une réponse fournisseur</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Fournisseur *</Label>
              <Select
                value={responseForm.supplier_id}
                onValueChange={(v) => setResponseForm({ ...responseForm, supplier_id: v })}
              >
                <SelectTrigger><SelectValue placeholder="Sélectionner…" /></SelectTrigger>
                <SelectContent>
                  {(selectedRFQForResponse?.supplier_ids ?? []).map((id) => {
                    const s = suppliers.find((x) => x.id === id);
                    return <SelectItem key={id} value={id}>{s?.name ?? id}</SelectItem>;
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Prix unitaire</Label>
                <Input
                  type="number"
                  value={responseForm.unit_price}
                  onChange={(e) => setResponseForm({ ...responseForm, unit_price: e.target.value })}
                />
              </div>
              <div>
                <Label>Montant total</Label>
                <Input
                  type="number"
                  value={responseForm.total_amount}
                  onChange={(e) => setResponseForm({ ...responseForm, total_amount: e.target.value })}
                />
              </div>
              <div>
                <Label>Délai livraison (j)</Label>
                <Input
                  type="number"
                  value={responseForm.delivery_days}
                  onChange={(e) => setResponseForm({ ...responseForm, delivery_days: e.target.value })}
                />
              </div>
              <div>
                <Label>Validité offre (j)</Label>
                <Input
                  type="number"
                  value={responseForm.validity_days}
                  onChange={(e) => setResponseForm({ ...responseForm, validity_days: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                value={responseForm.notes}
                onChange={(e) => setResponseForm({ ...responseForm, notes: e.target.value })}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResponseOpen(false)}>Annuler</Button>
            <Button
              onClick={handleSaveResponse}
              disabled={!responseForm.supplier_id || addResponse.isPending}
            >
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail dialog */}
      {detailRFQ && (
        <RFQDetailDialog
          rfq={detailRFQ}
          suppliers={suppliers}
          onClose={() => setDetailRFQ(null)}
          onSelectWinner={(supplierId, reason) => {
            selectWinner.mutate({ rfqId: detailRFQ.id, supplierId, reason }, {
              onSuccess: () => setDetailRFQ(null),
            });
          }}
        />
      )}
    </div>
  );
};

// ── Detail sub-component ───────────────────────────────────────────────────────
const RFQDetailDialog = ({
  rfq,
  suppliers,
  onClose,
  onSelectWinner,
}: {
  rfq: RFQRequest;
  suppliers: Supplier[];
  onClose: () => void;
  onSelectWinner: (supplierId: string, reason: string) => void;
}) => {
  const { data: responses = [] } = useRFQResponses(rfq.id);
  const [winnerSupplierId, setWinnerSupplierId] = useState('');
  const [winnerReason, setWinnerReason] = useState('');

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSearch className="h-5 w-5" />
            {rfq.rfq_number} — {rfq.title}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <Badge className={rfqStatusColors[rfq.status]}>{rfqStatusLabels[rfq.status]}</Badge>
            {rfq.site && <span>{SITE_LABELS[rfq.site]}</span>}
            {rfq.deadline_response && (
              <span>Échéance: {new Date(rfq.deadline_response).toLocaleDateString('fr-FR')}</span>
            )}
          </div>

          {rfq.description && (
            <p className="text-sm text-muted-foreground bg-muted/40 rounded-lg p-3">{rfq.description}</p>
          )}

          <div>
            <h4 className="font-semibold text-sm mb-2">Réponses reçues ({responses.length})</h4>
            {responses.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune réponse enregistrée</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fournisseur</TableHead>
                    <TableHead>P.U.</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Délai</TableHead>
                    <TableHead>Validité</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {responses.map((r: RFQResponse) => (
                    <TableRow key={r.id} className={rfq.selected_supplier_id === r.supplier_id ? 'bg-emerald-50' : ''}>
                      <TableCell>
                        {suppliers.find((s) => s.id === r.supplier_id)?.name ?? r.supplier_name}
                        {rfq.selected_supplier_id === r.supplier_id && (
                          <Trophy className="h-3.5 w-3.5 text-amber-500 inline ml-1" />
                        )}
                      </TableCell>
                      <TableCell>{r.unit_price.toLocaleString('fr-FR')} {r.currency}</TableCell>
                      <TableCell>{r.total_amount.toLocaleString('fr-FR')} {r.currency}</TableCell>
                      <TableCell>{r.delivery_days ?? '—'} j</TableCell>
                      <TableCell>{r.validity_days ?? '—'} j</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          {rfq.status === 'REPONSE_RECUE' && !rfq.selected_supplier_id && responses.length > 0 && (
            <div className="border-t pt-3 space-y-2">
              <h4 className="font-semibold text-sm">Sélectionner le fournisseur attributaire</h4>
              <div className="grid grid-cols-2 gap-3">
                <Select value={winnerSupplierId} onValueChange={setWinnerSupplierId}>
                  <SelectTrigger><SelectValue placeholder="Fournisseur…" /></SelectTrigger>
                  <SelectContent>
                    {responses.map((r: RFQResponse) => (
                      <SelectItem key={r.supplier_id} value={r.supplier_id}>
                        {suppliers.find((s) => s.id === r.supplier_id)?.name ?? r.supplier_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Raison / critère de sélection"
                  value={winnerReason}
                  onChange={(e) => setWinnerReason(e.target.value)}
                />
              </div>
              <Button
                size="sm"
                disabled={!winnerSupplierId || !winnerReason}
                onClick={() => onSelectWinner(winnerSupplierId, winnerReason)}
              >
                <Trophy className="h-4 w-4 mr-1" /> Attribuer
              </Button>
            </div>
          )}

          {rfq.selected_supplier_id && rfq.selected_reason && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm">
              <p className="font-semibold text-emerald-700">Attributaire sélectionné</p>
              <p className="text-emerald-600">
                {suppliers.find((s) => s.id === rfq.selected_supplier_id)?.name ?? rfq.selected_supplier_id}
                {' '}— {rfq.selected_reason}
              </p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fermer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
