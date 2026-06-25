import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
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
import { AlertTriangle, CheckCircle, Package, Plus, XCircle } from 'lucide-react';
import {
  useGoodsReceipts,
  useCreateGoodsReceipt,
  useUpdateGoodsReceipt,
  useReleaseQuarantine,
} from '@/hooks/useP2P';
import {
  goodsReceiptStatusColors,
  goodsReceiptStatusLabels,
  SITE_LABELS,
  type GoodsReceipt,
  type SiteCode,
} from '@/types/p2p';
import type { Supplier } from '@/types/mes';
import type { PurchaseOrder } from '@/types/purchasing';
import { useSettingsContext } from '@/contexts/SettingsContext';

interface Props {
  suppliers: Supplier[];
  orders: PurchaseOrder[];
  currentUser: string;
}

export const GoodsReceiptsPanel = ({ suppliers, orders, currentUser }: Props) => {
  const { settings } = useSettingsContext();
  const { data: receipts = [], isLoading } = useGoodsReceipts();
  const createReceipt = useCreateGoodsReceipt();
  const updateReceipt = useUpdateGoodsReceipt();
  const releaseQ = useReleaseQuarantine();

  const [createOpen, setCreateOpen] = useState(false);
  const [releaseOpen, setReleaseOpen] = useState(false);
  const [selectedBR, setSelectedBR] = useState<GoodsReceipt | null>(null);
  const [releaseDecision, setReleaseDecision] = useState<'ACCEPTE' | 'REFUSE'>('ACCEPTE');
  const [releaseNotes, setReleaseNotes] = useState('');

  const [form, setForm] = useState({
    purchase_order_id: '',
    supplier_id: '',
    site: '' as SiteCode | '',
    expected_date: '',
    received_date: new Date().toISOString().slice(0, 10),
    total_received_qty: '',
    total_accepted_qty: '',
    total_rejected_qty: '',
    quarantine_reason: '',
    dluo_date: '',
    fds_document: '',
    bio_cert_ref: '',
    phyto_doc_ref: '',
    notes: '',
  });

  const quarantineCount = receipts.filter((r) => r.status === 'EN_QUARANTAINE').length;
  const awaitingCount = receipts.filter((r) => r.status === 'ATTENDUE').length;
  const acceptedCount = receipts.filter((r) => r.status === 'ACCEPTEE').length;

  const selectedSiteConfig = form.site ? settings.p2p.sites[form.site] : null;
  const purchaseOrderRequired =
    settings.operations.require_purchase_order_for_reception ||
    settings.p2p.require_purchase_order_for_goods_receipt;

  const handleCreate = () => {
    const now = new Date().toISOString();
    const d = now.slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    const po = orders.find((o) => o.id === form.purchase_order_id);
    const sup = suppliers.find((s) => s.id === form.supplier_id);

    const status: GoodsReceipt['status'] = form.quarantine_reason
      ? 'EN_QUARANTAINE'
      : 'ACCEPTEE';

    createReceipt.mutate(
      {
        receipt_number: `BR-${d}-${rand}`,
        purchase_order_id: form.purchase_order_id || null,
        purchase_order_number: po?.order_number ?? null,
        supplier_id: form.supplier_id,
        supplier_name: sup?.name ?? null,
        site: form.site || null,
        expected_date: form.expected_date || null,
        received_date: form.received_date || null,
        status,
        quarantine_reason: form.quarantine_reason || null,
        release_decision: null,
        release_by: null,
        release_at: null,
        total_received_qty: parseFloat(form.total_received_qty) || 0,
        total_accepted_qty: parseFloat(form.total_accepted_qty) || 0,
        total_rejected_qty: parseFloat(form.total_rejected_qty) || 0,
        dluo_date: form.dluo_date || null,
        fds_document: form.fds_document || null,
        bio_cert_ref: form.bio_cert_ref || null,
        phyto_doc_ref: form.phyto_doc_ref || null,
        notes: form.notes || null,
      },
      { onSuccess: () => setCreateOpen(false) },
    );
  };

  const handleRelease = () => {
    if (!selectedBR) return;
    releaseQ.mutate(
      { id: selectedBR.id, decision: releaseDecision, by: currentUser, notes: releaseNotes || undefined },
      { onSuccess: () => { setReleaseOpen(false); setSelectedBR(null); } },
    );
  };

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'En attente', value: awaitingCount, icon: Package, color: 'text-slate-600' },
          { label: 'En quarantaine', value: quarantineCount, icon: AlertTriangle, color: 'text-amber-600' },
          { label: 'Acceptées', value: acceptedCount, icon: CheckCircle, color: 'text-emerald-600' },
        ].map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="p-3 flex items-center gap-3">
              <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
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
        <h3 className="font-semibold text-base">Bons de réception</h3>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Nouveau BR
        </Button>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>N° BR</TableHead>
                <TableHead>Fournisseur</TableHead>
                <TableHead>Site</TableHead>
                <TableHead>Reçu le</TableHead>
                <TableHead>Qté reçue</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">Chargement…</TableCell>
                </TableRow>
              ) : receipts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">Aucun bon de réception</TableCell>
                </TableRow>
              ) : (
                receipts.map((br) => (
                  <TableRow key={br.id} className={br.status === 'EN_QUARANTAINE' ? 'bg-amber-50/50' : ''}>
                    <TableCell className="font-mono text-xs">{br.receipt_number}</TableCell>
                    <TableCell>{br.supplier_name ?? '—'}</TableCell>
                    <TableCell>{br.site ? SITE_LABELS[br.site] : '—'}</TableCell>
                    <TableCell>
                      {br.received_date
                        ? new Date(br.received_date).toLocaleDateString('fr-FR')
                        : '—'}
                    </TableCell>
                    <TableCell>{br.total_received_qty}</TableCell>
                    <TableCell>
                      <Badge className={goodsReceiptStatusColors[br.status]}>
                        {goodsReceiptStatusLabels[br.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {br.status === 'EN_QUARANTAINE' && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-amber-700 border-amber-300 hover:bg-amber-50"
                          onClick={() => { setSelectedBR(br); setReleaseOpen(true); setReleaseNotes(''); }}
                        >
                          Lever quarantaine
                        </Button>
                      )}
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
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nouveau bon de réception</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {purchaseOrderRequired && (
              <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800">
                Le bon de commande est actuellement obligatoire pour enregistrer un BR.
              </div>
            )}
            <div>
              <Label>Bon de commande lié</Label>
              <Select value={form.purchase_order_id} onValueChange={(v) => {
                const po = orders.find((o) => o.id === v);
                setForm({ ...form, purchase_order_id: v, supplier_id: po?.supplier_id ?? form.supplier_id });
              }}>
                <SelectTrigger><SelectValue placeholder="Sélectionner un BC…" /></SelectTrigger>
                <SelectContent>
                  {orders.filter((o) => ['confirmed', 'partially_delivered'].includes(o.status)).map((o) => (
                    <SelectItem key={o.id} value={o.id}>{o.order_number}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Fournisseur *</Label>
              <Select value={form.supplier_id} onValueChange={(v) => setForm({ ...form, supplier_id: v })}>
                <SelectTrigger><SelectValue placeholder="Sélectionner…" /></SelectTrigger>
                <SelectContent>
                  {suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Site</Label>
              <Select value={form.site} onValueChange={(v) => setForm({ ...form, site: v as SiteCode })}>
                <SelectTrigger><SelectValue placeholder="Site…" /></SelectTrigger>
                <SelectContent>
                  {Object.entries(SITE_LABELS).map(([code, label]) => (
                    <SelectItem key={code} value={code}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Date attendue</Label>
                <Input type="date" value={form.expected_date} onChange={(e) => setForm({ ...form, expected_date: e.target.value })} />
              </div>
              <div>
                <Label>Date réception</Label>
                <Input type="date" value={form.received_date} onChange={(e) => setForm({ ...form, received_date: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Qté reçue</Label>
                <Input type="number" value={form.total_received_qty} onChange={(e) => setForm({ ...form, total_received_qty: e.target.value })} />
              </div>
              <div>
                <Label>Qté acceptée</Label>
                <Input type="number" value={form.total_accepted_qty} onChange={(e) => setForm({ ...form, total_accepted_qty: e.target.value })} />
              </div>
              <div>
                <Label>Qté refusée</Label>
                <Input type="number" value={form.total_rejected_qty} onChange={(e) => setForm({ ...form, total_rejected_qty: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Motif quarantaine (laisser vide si acceptation directe)</Label>
              <Input
                value={form.quarantine_reason}
                onChange={(e) => setForm({ ...form, quarantine_reason: e.target.value })}
                placeholder="Ex: Contrôle bio requis, document manquant…"
              />
              {selectedSiteConfig?.systematic_quarantine && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Ce site force la quarantaine systématique à la création du BR.
                </p>
              )}
            </div>
            {/* EcoDatte-specific */}
            {selectedSiteConfig?.bio_certification_required && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 space-y-2">
                <p className="text-xs font-semibold text-green-700">EcoDatte — Documents obligatoires</p>
                <div>
                  <Label>Référence certificat bio</Label>
                  <Input value={form.bio_cert_ref} onChange={(e) => setForm({ ...form, bio_cert_ref: e.target.value })} />
                </div>
                <div>
                  <Label>Référence document phytosanitaire</Label>
                  <Input value={form.phyto_doc_ref} onChange={(e) => setForm({ ...form, phyto_doc_ref: e.target.value })} />
                </div>
              </div>
            )}
            {/* Bioscha-specific */}
            {selectedSiteConfig?.dluo_required && (
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 space-y-2">
                <p className="text-xs font-semibold text-purple-700">Bioscha — Traçabilité lot</p>
                <div>
                  <Label>Date DLUO/DDM</Label>
                  <Input type="date" value={form.dluo_date} onChange={(e) => setForm({ ...form, dluo_date: e.target.value })} />
                </div>
                <div>
                  <Label>Référence FDS</Label>
                  <Input value={form.fds_document} onChange={(e) => setForm({ ...form, fds_document: e.target.value })} />
                </div>
              </div>
            )}
            <div>
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Annuler</Button>
            <Button onClick={handleCreate} disabled={!form.supplier_id || createReceipt.isPending}>
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Release quarantine dialog */}
      <Dialog open={releaseOpen} onOpenChange={setReleaseOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Lever la quarantaine</DialogTitle>
          </DialogHeader>
          {selectedBR && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                BR <span className="font-mono font-semibold">{selectedBR.receipt_number}</span> — {selectedBR.supplier_name}
              </p>
              {selectedBR.quarantine_reason && (
                <div className="bg-amber-50 border border-amber-200 rounded p-2 text-xs text-amber-700">
                  Motif: {selectedBR.quarantine_reason}
                </div>
              )}
              <div>
                <Label>Décision *</Label>
                <div className="flex gap-2 mt-1">
                  <Button
                    variant={releaseDecision === 'ACCEPTE' ? 'default' : 'outline'}
                    size="sm"
                    className={releaseDecision === 'ACCEPTE' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
                    onClick={() => setReleaseDecision('ACCEPTE')}
                  >
                    <CheckCircle className="h-4 w-4 mr-1" /> Accepter
                  </Button>
                  <Button
                    variant={releaseDecision === 'REFUSE' ? 'default' : 'outline'}
                    size="sm"
                    className={releaseDecision === 'REFUSE' ? 'bg-red-600 hover:bg-red-700' : ''}
                    onClick={() => setReleaseDecision('REFUSE')}
                  >
                    <XCircle className="h-4 w-4 mr-1" /> Refuser
                  </Button>
                </div>
              </div>
              <div>
                <Label>Notes de décision</Label>
                <Textarea
                  value={releaseNotes}
                  onChange={(e) => setReleaseNotes(e.target.value)}
                  rows={2}
                  placeholder="Résultats d'analyse, justification…"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReleaseOpen(false)}>Annuler</Button>
            <Button
              onClick={handleRelease}
              disabled={releaseQ.isPending}
              className={releaseDecision === 'REFUSE' ? 'bg-red-600 hover:bg-red-700' : ''}
            >
              Confirmer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
