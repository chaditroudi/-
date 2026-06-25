import { useEffect, useState } from 'react';
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
import {
  AlertCircle,
  ArrowLeftRight,
  CheckCircle2,
  CircleDollarSign,
  Plus,
  XCircle,
} from 'lucide-react';
import {
  useSupplierInvoices,
  useCreateInvoice,
  useRunThreeWayMatch,
  useApproveInvoicePayment,
  useMarkInvoicePaid,
} from '@/hooks/useP2P';
import {
  computeMatchResult,
  invoiceStatusColors,
  invoiceStatusLabels,
  matchResultColors,
  matchResultLabels,
  SITE_LABELS,
  type InvoiceStatus,
  type SupplierInvoice,
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

export const InvoicesPanel = ({ suppliers, orders, currentUser }: Props) => {
  const { settings } = useSettingsContext();
  const defaultTolerance = settings.p2p.default_invoice_tolerance_pct || 3;
  const { data: invoices = [], isLoading } = useSupplierInvoices();
  const createInvoice = useCreateInvoice();
  const runMatch = useRunThreeWayMatch();
  const approvePayment = useApproveInvoicePayment();
  const markPaid = useMarkInvoicePaid();

  const [createOpen, setCreateOpen] = useState(false);
  const [detailInvoice, setDetailInvoice] = useState<SupplierInvoice | null>(null);
  const [paymentRef, setPaymentRef] = useState('');
  const [paymentOpen, setPaymentOpen] = useState(false);

  const [form, setForm] = useState({
    invoice_number: '',
    supplier_id: '',
    purchase_order_id: '',
    site: '' as SiteCode | '',
    invoice_date: new Date().toISOString().slice(0, 10),
    due_date: '',
    currency: 'TND',
    subtotal: '',
    tax_amount: '',
    total_amount: '',
    tolerance_pct: String(defaultTolerance),
    notes: '',
  });

  useEffect(() => {
    setForm((prev) => {
      if (prev.tolerance_pct && Number(prev.tolerance_pct) > 0) return prev;
      return { ...prev, tolerance_pct: String(defaultTolerance) };
    });
  }, [defaultTolerance]);

  const pendingMatch = invoices.filter((i) => i.status === 'EN_RAPPROCHEMENT').length;
  const toPayCount = invoices.filter((i) => i.status === 'BON_A_PAYER').length;
  const litigeCount = invoices.filter((i) => i.status === 'EN_LITIGE').length;
  const paidAmount = invoices
    .filter((i) => i.status === 'PAYEE' || i.status === 'CLOTUREE')
    .reduce((sum, i) => sum + i.total_amount, 0);

  const handleCreate = () => {
    const po = orders.find((o) => o.id === form.purchase_order_id);
    const sup = suppliers.find((s) => s.id === form.supplier_id);
    createInvoice.mutate(
      {
        invoice_number: form.invoice_number,
        supplier_id: form.supplier_id,
        supplier_name: sup?.name ?? null,
        purchase_order_id: form.purchase_order_id || null,
        purchase_order_number: po?.order_number ?? null,
        site: (form.site as SiteCode) || null,
        invoice_date: form.invoice_date,
        due_date: form.due_date || null,
        currency: form.currency,
        subtotal: parseFloat(form.subtotal) || 0,
        tax_amount: parseFloat(form.tax_amount) || 0,
        total_amount: parseFloat(form.total_amount) || parseFloat(form.subtotal) || 0,
        status: 'RECUE' as InvoiceStatus,
        bc_amount: po?.total_amount ?? null,
        br_amount: null,
        match_result: 'NON_VERIFIE',
        tolerance_pct: parseFloat(form.tolerance_pct) || defaultTolerance,
        notes: form.notes || null,
      },
      { onSuccess: () => setCreateOpen(false) },
    );
  };

  const handleRunMatch = (inv: SupplierInvoice) => {
    runMatch.mutate({ invoiceId: inv.id, tolerancePct: inv.tolerance_pct });
  };

  const handleApprovePayment = (inv: SupplierInvoice) => {
    if (inv.match_result === 'ECART_BLOQUANT') return;
    approvePayment.mutate({ invoiceId: inv.id, by: currentUser });
  };

  const handleMarkPaid = () => {
    if (!detailInvoice || !paymentRef) return;
    markPaid.mutate(
      { invoiceId: detailInvoice.id, paymentRef, by: currentUser },
      { onSuccess: () => { setPaymentOpen(false); setDetailInvoice(null); } },
    );
  };

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'En rapprochement', value: pendingMatch, icon: ArrowLeftRight, color: 'text-blue-600' },
          { label: 'Bon à payer', value: toPayCount, icon: CheckCircle2, color: 'text-emerald-600' },
          { label: 'En litige', value: litigeCount, icon: AlertCircle, color: 'text-red-600' },
          {
            label: 'Payé (TND)',
            value: paidAmount.toLocaleString('fr-FR', { maximumFractionDigits: 0 }),
            icon: CircleDollarSign,
            color: 'text-violet-600',
          },
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
        <h3 className="font-semibold text-base">Factures fournisseurs</h3>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Nouvelle facture
        </Button>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>N° facture</TableHead>
                <TableHead>Fournisseur</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Montant</TableHead>
                <TableHead>Rapprochement</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">Chargement…</TableCell>
                </TableRow>
              ) : invoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">Aucune facture</TableCell>
                </TableRow>
              ) : (
                invoices.map((inv) => (
                  <TableRow
                    key={inv.id}
                    className={inv.status === 'EN_LITIGE' ? 'bg-red-50/50' : inv.status === 'BON_A_PAYER' ? 'bg-emerald-50/30' : ''}
                  >
                    <TableCell className="font-mono text-xs">{inv.invoice_number}</TableCell>
                    <TableCell>{inv.supplier_name ?? '—'}</TableCell>
                    <TableCell>{new Date(inv.invoice_date).toLocaleDateString('fr-FR')}</TableCell>
                    <TableCell className="font-semibold">
                      {inv.total_amount.toLocaleString('fr-FR')} {inv.currency}
                    </TableCell>
                    <TableCell>
                      <Badge className={matchResultColors[inv.match_result]}>
                        {matchResultLabels[inv.match_result]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={invoiceStatusColors[inv.status]}>
                        {invoiceStatusLabels[inv.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setDetailInvoice(inv)}>
                          Détail
                        </Button>
                        {inv.status === 'RECUE' && (
                          <Button variant="ghost" size="sm" onClick={() => handleRunMatch(inv)}>
                            <ArrowLeftRight className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {inv.status === 'EN_RAPPROCHEMENT' && inv.match_result !== 'ECART_BLOQUANT' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-emerald-600"
                            onClick={() => handleApprovePayment(inv)}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {inv.status === 'BON_A_PAYER' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-violet-600"
                            onClick={() => { setDetailInvoice(inv); setPaymentOpen(true); setPaymentRef(''); }}
                          >
                            <CircleDollarSign className="h-3.5 w-3.5" />
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
            <DialogTitle>Saisir une facture fournisseur</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>N° facture *</Label>
                <Input value={form.invoice_number} onChange={(e) => setForm({ ...form, invoice_number: e.target.value })} />
              </div>
              <div>
                <Label>Devise</Label>
                <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['TND', 'EUR', 'USD'].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
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
              <Label>BC associé</Label>
              <Select value={form.purchase_order_id} onValueChange={(v) => setForm({ ...form, purchase_order_id: v })}>
                <SelectTrigger><SelectValue placeholder="Sélectionner un BC…" /></SelectTrigger>
                <SelectContent>
                  {orders.map((o) => <SelectItem key={o.id} value={o.id}>{o.order_number} — {o.total_amount.toLocaleString('fr-FR')}</SelectItem>)}
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
                <Label>Date facture *</Label>
                <Input type="date" value={form.invoice_date} onChange={(e) => setForm({ ...form, invoice_date: e.target.value })} />
              </div>
              <div>
                <Label>Date échéance</Label>
                <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>HT</Label>
                <Input type="number" value={form.subtotal} onChange={(e) => setForm({ ...form, subtotal: e.target.value })} />
              </div>
              <div>
                <Label>TVA</Label>
                <Input type="number" value={form.tax_amount} onChange={(e) => setForm({ ...form, tax_amount: e.target.value })} />
              </div>
              <div>
                <Label>TTC *</Label>
                <Input type="number" value={form.total_amount} onChange={(e) => setForm({ ...form, total_amount: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Tolérance écart (%) — défaut {defaultTolerance}%</Label>
              <Input type="number" value={form.tolerance_pct} onChange={(e) => setForm({ ...form, tolerance_pct: e.target.value })} />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Annuler</Button>
            <Button
              onClick={handleCreate}
              disabled={!form.invoice_number || !form.supplier_id || createInvoice.isPending}
            >
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail dialog */}
      {detailInvoice && !paymentOpen && (
        <InvoiceDetailDialog
          invoice={detailInvoice}
          suppliers={suppliers}
          orders={orders}
          onClose={() => setDetailInvoice(null)}
          onRunMatch={() => handleRunMatch(detailInvoice)}
          onApprovePayment={() => handleApprovePayment(detailInvoice)}
          onMarkPaid={() => { setPaymentOpen(true); setPaymentRef(''); }}
          currentUser={currentUser}
        />
      )}

      {/* Mark paid dialog */}
      <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Enregistrer le paiement</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {detailInvoice && (
              <p className="text-sm text-muted-foreground">
                Facture <span className="font-semibold">{detailInvoice.invoice_number}</span> —{' '}
                {detailInvoice.total_amount.toLocaleString('fr-FR')} {detailInvoice.currency}
              </p>
            )}
            <div>
              <Label>Référence de paiement *</Label>
              <Input
                value={paymentRef}
                onChange={(e) => setPaymentRef(e.target.value)}
                placeholder="N° virement, chèque…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentOpen(false)}>Annuler</Button>
            <Button onClick={handleMarkPaid} disabled={!paymentRef || markPaid.isPending}>
              Confirmer paiement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ── Detail sub-component ───────────────────────────────────────────────────────
const InvoiceDetailDialog = ({
  invoice,
  suppliers,
  orders,
  onClose,
  onRunMatch,
  onApprovePayment,
  onMarkPaid,
  currentUser,
}: {
  invoice: SupplierInvoice;
  suppliers: Supplier[];
  orders: PurchaseOrder[];
  onClose: () => void;
  onRunMatch: () => void;
  onApprovePayment: () => void;
  onMarkPaid: () => void;
  currentUser: string;
}) => {
  const po = orders.find((o) => o.id === invoice.purchase_order_id);

  const matchPreview = invoice.bc_amount
    ? computeMatchResult(
        invoice.bc_amount,
        invoice.br_amount ?? 0,
        invoice.total_amount,
        invoice.tolerance_pct,
      )
    : null;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CircleDollarSign className="h-5 w-5" />
            Facture {invoice.invoice_number}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={invoiceStatusColors[invoice.status]}>{invoiceStatusLabels[invoice.status]}</Badge>
            <Badge className={matchResultColors[invoice.match_result]}>{matchResultLabels[invoice.match_result]}</Badge>
          </div>

          <div className="grid grid-cols-2 gap-2 text-muted-foreground">
            <div>
              <span className="font-medium text-foreground">Fournisseur: </span>
              {invoice.supplier_name ?? '—'}
            </div>
            <div>
              <span className="font-medium text-foreground">Date: </span>
              {new Date(invoice.invoice_date).toLocaleDateString('fr-FR')}
            </div>
            {po && (
              <div>
                <span className="font-medium text-foreground">BC lié: </span>
                {po.order_number}
              </div>
            )}
            {invoice.due_date && (
              <div>
                <span className="font-medium text-foreground">Échéance: </span>
                {new Date(invoice.due_date).toLocaleDateString('fr-FR')}
              </div>
            )}
          </div>

          {/* 3-way match */}
          <Card>
            <CardHeader className="py-2 px-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <ArrowLeftRight className="h-4 w-4" />
                Rapprochement 3 documents
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3 space-y-2">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-blue-50 rounded p-2">
                  <p className="text-xs text-blue-600 font-semibold">BC</p>
                  <p className="font-bold">{invoice.bc_amount?.toLocaleString('fr-FR') ?? '—'}</p>
                </div>
                <div className="bg-amber-50 rounded p-2">
                  <p className="text-xs text-amber-600 font-semibold">BR</p>
                  <p className="font-bold">{invoice.br_amount?.toLocaleString('fr-FR') ?? '—'}</p>
                </div>
                <div className="bg-violet-50 rounded p-2">
                  <p className="text-xs text-violet-600 font-semibold">Facture</p>
                  <p className="font-bold">{invoice.total_amount.toLocaleString('fr-FR')}</p>
                </div>
              </div>
              {matchPreview && (
                <div className={`rounded p-2 text-xs font-semibold text-center ${matchResultColors[matchPreview.result]}`}>
                  {matchResultLabels[matchPreview.result]}
                  {matchPreview.variancePct > 0 && (
                    <span className="ml-2">
                      Écart: {matchPreview.variancePct.toFixed(1)}% ({matchPreview.varianceAmount > 0 ? '+' : ''}{matchPreview.varianceAmount.toLocaleString('fr-FR')})
                    </span>
                  )}
                </div>
              )}
              <p className="text-xs text-muted-foreground">Tolérance configurée: {invoice.tolerance_pct}%</p>
              {invoice.match_result === 'ECART_BLOQUANT' && (
                <div className="flex items-center gap-2 text-red-700 bg-red-50 rounded p-2 text-xs">
                  <XCircle className="h-4 w-4 shrink-0" />
                  Paiement bloqué — écart supérieur à la tolérance
                </div>
              )}
            </CardContent>
          </Card>

          {invoice.match_notes && (
            <p className="text-xs text-muted-foreground bg-muted/40 rounded p-2">{invoice.match_notes}</p>
          )}
        </div>
        <DialogFooter className="flex-wrap gap-2">
          <Button variant="outline" onClick={onClose}>Fermer</Button>
          {invoice.status === 'RECUE' && (
            <Button variant="outline" size="sm" onClick={onRunMatch}>
              <ArrowLeftRight className="h-4 w-4 mr-1" /> Rapprocher
            </Button>
          )}
          {invoice.status === 'EN_RAPPROCHEMENT' && invoice.match_result !== 'ECART_BLOQUANT' && (
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={onApprovePayment}>
              <CheckCircle2 className="h-4 w-4 mr-1" /> Bon à payer
            </Button>
          )}
          {invoice.status === 'BON_A_PAYER' && (
            <Button size="sm" className="bg-violet-600 hover:bg-violet-700" onClick={onMarkPaid}>
              <CircleDollarSign className="h-4 w-4 mr-1" /> Enregistrer paiement
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
