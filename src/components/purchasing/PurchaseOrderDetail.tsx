import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  PurchaseOrder,
  purchaseOrderInvoiceStatusColors,
  purchaseOrderInvoiceStatusLabels,
  purchaseOrderReceiptStatusColors,
  purchaseOrderReceiptStatusLabels,
  purchaseOrderStatusLabels,
  purchaseOrderStatusColors,
} from "@/types/purchasing";
import { AlertTriangle, CheckCircle2, Clock, Download, Printer, RotateCcw, ShieldAlert, Truck, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PurchaseOrderPrint } from "./PurchaseOrderPrint";
import { Textarea } from "@/components/ui/textarea";
import { useEffect, useMemo, useState } from "react";
import { purchasingApi } from "@/lib/api/purchasing";
import { useToast } from "@/hooks/use-toast";

interface PurchaseOrderDetailProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: PurchaseOrder | null;
  onReceiveLine?: (payload: {
    orderId: string;
    lineId: string;
    receivedNow: number;
    supplierLot: string;
    qcStatus: 'accepted' | 'conditional' | 'rejected';
    grnNumber?: string;
    quarantineReason?: string;
    rejectionReason?: string;
  }) => void;
  onSaveThreeWayMatch?: (payload: {
    orderId: string;
    invoiceNumber: string;
    invoiceAmount: number;
    invoiceDate: string;
    tolerancePct: number;
  }) => void;
  isReceiving?: boolean;
  isSavingThreeWayMatch?: boolean;
}

const PurchaseOrderDetailContent = ({
  open,
  onOpenChange,
  order,
  onReceiveLine,
  onSaveThreeWayMatch,
  isReceiving,
  isSavingThreeWayMatch,
}: Omit<PurchaseOrderDetailProps, 'order'> & { order: PurchaseOrder }) => {
  const { toast } = useToast();

  const [lineInputs, setLineInputs] = useState<Record<string, {
    receivedNow: string;
    supplierLot: string;
    qcStatus: 'accepted' | 'conditional' | 'rejected';
    grnNumber: string;
    quarantineReason: string;
    rejectionReason: string;
  }>>({});

  // 3-way match fields — read from order fields directly (no notes JSON)
  const [invoiceNumber, setInvoiceNumber] = useState(order.invoice_number || '');
  const [invoiceAmount, setInvoiceAmount] = useState(
    order.invoice_amount != null ? String(order.invoice_amount) : order.total_amount.toFixed(2),
  );
  const [invoiceDate, setInvoiceDate] = useState(
    order.invoice_date || new Date().toISOString().split('T')[0],
  );
  const [tolerancePct, setTolerancePct] = useState(
    order.invoice_tolerance_pct != null ? String(order.invoice_tolerance_pct) : '2',
  );

  const [receiptLogs, setReceiptLogs] = useState<Record<string, unknown>[]>([]);
  const [linkedReceptions, setLinkedReceptions] = useState<{ lots: Record<string, unknown>[]; receptions: Record<string, unknown>[] }>({ lots: [], receptions: [] });
  const [logsLoading, setLogsLoading] = useState(false);

  useEffect(() => {
    setLineInputs({});
    setInvoiceNumber(order.invoice_number || '');
    setInvoiceAmount(order.invoice_amount != null ? String(order.invoice_amount) : order.total_amount.toFixed(2));
    setInvoiceDate(order.invoice_date || new Date().toISOString().split('T')[0]);
    setTolerancePct(order.invoice_tolerance_pct != null ? String(order.invoice_tolerance_pct) : '2');
  }, [order.id, order.invoice_number, order.invoice_amount, order.invoice_date, order.invoice_tolerance_pct, order.total_amount]);

  useEffect(() => {
    if (!open) return;
    setLogsLoading(true);
    Promise.all([
      purchasingApi.getOrderReceiptLogs(order.id),
      purchasingApi.getOrderLinkedReceptions(order.id),
    ])
      .then(([logs, linked]) => {
        setReceiptLogs(logs ?? []);
        setLinkedReceptions(linked ?? { lots: [], receptions: [] });
      })
      .catch(() => null)
      .finally(() => setLogsLoading(false));
  }, [open, order.id]);

  // Per-order receipt progress
  const orderedTotalQty = (order.lines || []).reduce((s, l) => s + Number(l.confirmed_quantity ?? (l.quantity || 0)), 0);
  const receivedTotalQty = (order.lines || []).reduce((s, l) => s + Number(l.received_quantity || 0), 0);
  const acceptedTotalQty = (order.lines || []).reduce((s, l) => s + Number(l.accepted_quantity || 0), 0);
  const rejectedTotalQty = (order.lines || []).reduce((s, l) => s + Number((l as any).rejected_quantity || 0), 0);
  const quarantineTotalQty = (order.lines || []).reduce((s, l) => s + Number((l as any).quarantine_quantity || 0), 0);
  const receptionPct = orderedTotalQty > 0 ? Math.min(100, (receivedTotalQty / orderedTotalQty) * 100) : 0;
  const hasDiscrepancy = rejectedTotalQty > 0 || quarantineTotalQty > 0;

  // Live 3-way match calculation
  const currentInvoiceAmount = Number(invoiceAmount || 0);
  const currentTolerancePct = Number(tolerancePct || 0);
  const liveVarianceAmount = currentInvoiceAmount - Number(order.total_amount || 0);
  const liveVariancePct = Number(order.total_amount || 0) > 0
    ? (liveVarianceAmount / Number(order.total_amount || 0)) * 100 : 0;
  const liveMatched = Math.abs(liveVariancePct) <= currentTolerancePct;

  const getLineInput = (lineId: string) =>
    lineInputs[lineId] || { receivedNow: '', supplierLot: '', qcStatus: 'accepted' as const, grnNumber: '', quarantineReason: '', rejectionReason: '' };

  const updateLineInput = (lineId: string, field: string, value: string) => {
    setLineInputs((prev) => ({ ...prev, [lineId]: { ...getLineInput(lineId), [field]: value } }));
  };

  const handleReceiveLine = (lineId: string) => {
    if (!onReceiveLine) return;
    const input = getLineInput(lineId);
    const qty = Number(input.receivedNow || 0);
    if (qty <= 0) { toast({ title: 'Quantité invalide', variant: 'destructive' }); return; }
    if (!input.supplierLot.trim()) { toast({ title: 'Lot fournisseur obligatoire', variant: 'destructive' }); return; }
    if (input.qcStatus === 'conditional' && !input.quarantineReason.trim()) {
      toast({ title: 'Motif quarantaine requis pour QC sous réserve', variant: 'destructive' }); return;
    }
    onReceiveLine({
      orderId: order.id, lineId,
      receivedNow: qty,
      supplierLot: input.supplierLot.trim(),
      qcStatus: input.qcStatus,
      grnNumber: input.grnNumber.trim() || undefined,
      quarantineReason: input.qcStatus === 'conditional' ? input.quarantineReason.trim() : undefined,
      rejectionReason: input.qcStatus === 'rejected' ? input.rejectionReason.trim() : undefined,
    });
  };

  const handleSaveThreeWay = () => {
    if (!onSaveThreeWayMatch) return;
    if (!invoiceNumber.trim()) { toast({ title: 'N° facture requis', variant: 'destructive' }); return; }
    if (!invoiceDate) { toast({ title: 'Date facture requise', variant: 'destructive' }); return; }
    if (Number(invoiceAmount || 0) <= 0) { toast({ title: 'Montant facture invalide', variant: 'destructive' }); return; }
    onSaveThreeWayMatch({
      orderId: order.id,
      invoiceNumber: invoiceNumber.trim(),
      invoiceAmount: Number(invoiceAmount),
      invoiceDate,
      tolerancePct: Number(tolerancePct || 0),
    });
  };

  const handlePrint = () => {
    const printWindow = window.open("", "_blank", "width=900,height=700");
    if (!printWindow) return;
    printWindow.document.write(`<html><head><title>BC ${order.order_number}</title><style>body{font-family:Arial,sans-serif;margin:0}table{width:100%}th,td{padding:6px 0}@media print{@page{margin:12mm}}</style></head><body><div id="root"></div></body></html>`);
    printWindow.document.close();
    const html = document.getElementById("po-print-source")?.innerHTML || "";
    printWindow.document.getElementById("root")!.innerHTML = html;
    printWindow.focus(); printWindow.print(); printWindow.close();
  };

  const handleDownloadPdf = async () => {
    const source = document.getElementById("po-print-source");
    if (!source) return;
    const html2canvasModule = await import("html2canvas");
    const jsPdfModule = await import("jspdf");
    const html2canvas = html2canvasModule.default;
    type JsPdfCtor = new (o?: string, u?: string, f?: string) => { internal: { pageSize: { getWidth: () => number; getHeight: () => number } }; addImage: (d: string, f: string, x: number, y: number, w: number, h: number) => void; addPage: () => void; save: (n: string) => void };
    const JsPDF = ((jsPdfModule as any).jsPDF ?? (jsPdfModule as any).default) as JsPdfCtor;
    if (!JsPDF) return;
    const canvas = await html2canvas(source, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
    const imgData = canvas.toDataURL("image/jpeg", 0.92);
    const pdf = new JsPDF("p", "mm", "a4");
    const pw = pdf.internal.pageSize.getWidth();
    const ph = pdf.internal.pageSize.getHeight();
    const iw = pw;
    const ih = (canvas.height * iw) / canvas.width;
    let left = ih; let pos = 0;
    pdf.addImage(imgData, "JPEG", 0, pos, iw, ih);
    left -= ph;
    while (left > 0) { pos -= ph; pdf.addPage(); pdf.addImage(imgData, "JPEG", 0, pos, iw, ih); left -= ph; }
    pdf.save(`BC-${order.order_number}.pdf`);
  };

  const qcBadge = (status: string) => {
    if (status === 'accepted') return <Badge className="bg-green-600 text-white text-[10px]">Accepté</Badge>;
    if (status === 'conditional') return <Badge className="bg-amber-500 text-white text-[10px]">Quarantaine</Badge>;
    return <Badge className="bg-red-600 text-white text-[10px]">Rejeté</Badge>;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        {/* Hidden print source */}
        <div style={{ position: "fixed", left: "-10000px", top: 0, width: "800px", background: "white" }}>
          <div id="po-print-source"><PurchaseOrderPrint order={order} /></div>
        </div>

        <DialogHeader>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <DialogTitle className="text-base font-bold">Bon de Commande {order.order_number}</DialogTitle>
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge className={purchaseOrderStatusColors[order.status]}>{purchaseOrderStatusLabels[order.status]}</Badge>
              {order.receipt_status && (
                <Badge variant="outline" className={purchaseOrderReceiptStatusColors[order.receipt_status]}>
                  {purchaseOrderReceiptStatusLabels[order.receipt_status]}
                </Badge>
              )}
              {order.invoice_status && (
                <Badge variant="outline" className={purchaseOrderInvoiceStatusColors[order.invoice_status]}>
                  {purchaseOrderInvoiceStatusLabels[order.invoice_status]}
                </Badge>
              )}
              {(order as any).three_way_match_status === 'matched' && (
                <Badge className="bg-green-700 text-white text-[10px]"><CheckCircle2 className="h-3 w-3 mr-1" />3-way OK</Badge>
              )}
              {(order as any).three_way_match_status === 'mismatch' && (
                <Badge className="bg-red-600 text-white text-[10px]"><XCircle className="h-3 w-3 mr-1" />3-way Litige</Badge>
              )}
              <Button variant="outline" size="sm" onClick={handlePrint}><Printer className="h-3.5 w-3.5 mr-1" />Imprimer</Button>
              <Button variant="outline" size="sm" onClick={handleDownloadPdf}><Download className="h-3.5 w-3.5 mr-1" />PDF</Button>
            </div>
          </div>
        </DialogHeader>

        {/* On-hold warning banner */}
        {order.status === 'on_hold' && (
          <div className="flex items-center gap-2 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>Commande en litige — écart QC détecté. Vérifier les lots en quarantaine ou rejetés avant validation.</span>
          </div>
        )}

        <Tabs defaultValue="details">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="details">Détails</TabsTrigger>
            <TabsTrigger value="reception">
              Réception
              {hasDiscrepancy && <span className="ml-1.5 h-1.5 w-1.5 rounded-full bg-red-500 inline-block" />}
            </TabsTrigger>
            <TabsTrigger value="match">
              3-Way Match
              {(order as any).three_way_match_status === 'mismatch' && <span className="ml-1.5 h-1.5 w-1.5 rounded-full bg-red-500 inline-block" />}
            </TabsTrigger>
            <TabsTrigger value="history">
              Historique
              {receiptLogs.length > 0 && <span className="ml-1 text-xs text-muted-foreground">({receiptLogs.length})</span>}
            </TabsTrigger>
          </TabsList>

          {/* ── TAB: Détails ────────────────────────────────────────────── */}
          <TabsContent value="details" className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <div><p className="text-muted-foreground">Fournisseur</p><p className="font-medium">{order.supplier?.name || '—'}</p></div>
              <div><p className="text-muted-foreground">Date commande</p><p className="font-medium">{format(new Date(order.order_date), 'dd MMMM yyyy', { locale: fr })}</p></div>
              {order.expected_delivery_date && (
                <div><p className="text-muted-foreground">Livraison prévue</p><p className="font-medium">{format(new Date(order.expected_delivery_date), 'dd MMMM yyyy', { locale: fr })}</p></div>
              )}
              {order.payment_terms && <div><p className="text-muted-foreground">Conditions paiement</p><p className="font-medium">{order.payment_terms}</p></div>}
              {order.supplier_reference && <div><p className="text-muted-foreground">Réf. fournisseur</p><p className="font-medium">{order.supplier_reference}</p></div>}
              {order.delivery_site && <div><p className="text-muted-foreground">Site de livraison</p><p className="font-medium">{order.delivery_site}</p></div>}
              {order.incoterm && <div><p className="text-muted-foreground">Incoterm</p><p className="font-medium">{order.incoterm}</p></div>}
              {order.buyer_name && <div><p className="text-muted-foreground">Acheteur</p><p className="font-medium">{order.buyer_name}</p></div>}
              {(order as any).variety && <div><p className="text-muted-foreground">Variété</p><p className="font-medium">{(order as any).variety}</p></div>}
              {(order as any).quality_expected && <div><p className="text-muted-foreground">Qualité attendue</p><p className="font-medium">{(order as any).quality_expected}</p></div>}
            </div>

            <Separator />

            {/* Lines summary read-only */}
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Article</TableHead>
                    <TableHead className="text-right">Commandé</TableHead>
                    <TableHead className="text-right">Reçu</TableHead>
                    <TableHead className="text-right">Accepté</TableHead>
                    <TableHead className="text-right">Quarantaine</TableHead>
                    <TableHead className="text-right">Rejeté</TableHead>
                    <TableHead className="text-right">Prix unit.</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.lines?.map((line) => {
                    const target = Number(line.confirmed_quantity ?? (line.quantity || 0));
                    const received = Number(line.received_quantity || 0);
                    const accepted = Number(line.accepted_quantity || 0);
                    const quarantine = Number((line as any).quarantine_quantity || 0);
                    const rejected = Number((line as any).rejected_quantity || 0);
                    const pct = target > 0 ? Math.min(100, (received / target) * 100) : 0;
                    const overTol = Number(line.over_delivery_tolerance_pct || 0);
                    const hasIssue = rejected > 0 || quarantine > 0;
                    return (
                      <TableRow key={line.id} className={hasIssue ? 'bg-red-50/50' : ''}>
                        <TableCell>
                          <div>{line.description}</div>
                          {line.material?.code && <span className="text-xs text-muted-foreground">({line.material.code})</span>}
                          <Progress value={pct} className={`h-1 mt-1 ${hasIssue ? 'bg-red-100' : ''}`} />
                          <span className="text-[10px] text-muted-foreground">{pct.toFixed(0)}% livré · tol +{overTol}%</span>
                        </TableCell>
                        <TableCell className="text-right text-sm">{target.toFixed(2)} {line.unit}</TableCell>
                        <TableCell className="text-right text-sm">{received.toFixed(2)} {line.unit}</TableCell>
                        <TableCell className="text-right text-sm text-green-700 font-medium">{accepted.toFixed(2)}</TableCell>
                        <TableCell className="text-right text-sm text-amber-600 font-medium">{quarantine > 0 ? quarantine.toFixed(2) : '—'}</TableCell>
                        <TableCell className="text-right text-sm text-red-600 font-medium">{rejected > 0 ? rejected.toFixed(2) : '—'}</TableCell>
                        <TableCell className="text-right text-sm">{line.unit_price.toFixed(2)} TND</TableCell>
                        <TableCell className="text-right text-sm font-medium">{line.total_price.toFixed(2)} TND</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-end">
              <div className="w-64 space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Sous-total</span><span>{order.subtotal.toFixed(2)} TND</span></div>
                {order.tax_amount > 0 && <div className="flex justify-between"><span className="text-muted-foreground">TVA</span><span>{order.tax_amount.toFixed(2)} TND</span></div>}
                <Separator />
                <div className="flex justify-between text-base font-bold"><span>Total</span><span>{order.total_amount.toFixed(2)} {order.currency}</span></div>
              </div>
            </div>

            {/* Audit trail */}
            <div className="text-xs text-muted-foreground pt-2 border-t space-y-0.5">
              <p>Créé par: {order.created_by || 'N/A'} · {format(new Date(order.created_at), 'dd/MM/yyyy HH:mm', { locale: fr })}</p>
              {(order.submitted_at || order.sent_at) && <p>Soumis: {format(new Date(order.submitted_at || order.sent_at || order.created_at), 'dd/MM/yyyy HH:mm', { locale: fr })}</p>}
              {order.confirmed_at && <p>Confirmé: {format(new Date(order.confirmed_at), 'dd/MM/yyyy HH:mm', { locale: fr })}</p>}
              {order.delivered_at && <p>Livré: {format(new Date(order.delivered_at), 'dd/MM/yyyy HH:mm', { locale: fr })}</p>}
              {order.invoiced_at && <p>Facturé: {format(new Date(order.invoiced_at), 'dd/MM/yyyy HH:mm', { locale: fr })}</p>}
              {(order as any).three_way_match_at && <p>3-Way match: {format(new Date((order as any).three_way_match_at), 'dd/MM/yyyy HH:mm', { locale: fr })}</p>}
            </div>
          </TabsContent>

          {/* ── TAB: Réception ──────────────────────────────────────────── */}
          <TabsContent value="reception" className="space-y-4 pt-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-3">
                <Truck className="h-4 w-4 text-muted-foreground" />
                <span>Avancement global : <strong>{receptionPct.toFixed(0)}%</strong> ({receivedTotalQty.toFixed(2)} / {orderedTotalQty.toFixed(2)} kg)</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-green-700">✓ {acceptedTotalQty.toFixed(2)} accepté</span>
                {quarantineTotalQty > 0 && <span className="text-amber-600">⚠ {quarantineTotalQty.toFixed(2)} quarantaine</span>}
                {rejectedTotalQty > 0 && <span className="text-red-600">✗ {rejectedTotalQty.toFixed(2)} rejeté</span>}
              </div>
            </div>
            <Progress value={receptionPct} className="h-2" />

            <p className="text-xs text-muted-foreground">
              Traçabilité agro-alimentaire : lot fournisseur + statut QC obligatoires à chaque réception.
            </p>

            {order.lines?.map((line) => {
              const target = Number(line.confirmed_quantity ?? (line.quantity || 0));
              const received = Number(line.received_quantity || 0);
              const remaining = Math.max(0, target - received);
              const overTol = Number(line.over_delivery_tolerance_pct || 0);
              const maxReceivable = target * (1 + overTol / 100);
              const input = getLineInput(line.id);
              const qty = Number(input.receivedNow || 0);
              const wouldExceed = received + qty > maxReceivable + 0.0001;

              return (
                <div key={line.id} className="border rounded-lg p-3 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-sm">{line.description}</p>
                      <p className="text-xs text-muted-foreground">
                        Commandé: {target.toFixed(2)} {line.unit} · Reçu: {received.toFixed(2)} · Reste: {remaining.toFixed(2)} · Tol: +{overTol}%
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      {Number((line as any).quarantine_quantity || 0) > 0 && (
                        <Badge className="bg-amber-100 text-amber-700 border-amber-300 text-[10px]">
                          <ShieldAlert className="h-2.5 w-2.5 mr-0.5" />{Number((line as any).quarantine_quantity).toFixed(2)} quarantaine
                        </Badge>
                      )}
                      {Number((line as any).rejected_quantity || 0) > 0 && (
                        <Badge className="bg-red-100 text-red-700 border-red-300 text-[10px]">
                          <XCircle className="h-2.5 w-2.5 mr-0.5" />{Number((line as any).rejected_quantity).toFixed(2)} rejeté
                        </Badge>
                      )}
                    </div>
                  </div>

                  {remaining > 0 || received < maxReceivable ? (
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Quantité réceptionnée *</Label>
                        <Input
                          type="number" step="0.01" placeholder="0.00"
                          className={`h-8 text-sm ${wouldExceed ? 'border-red-400' : ''}`}
                          value={input.receivedNow}
                          onChange={(e) => updateLineInput(line.id, 'receivedNow', e.target.value)}
                        />
                        {wouldExceed && <p className="text-[10px] text-red-500">Dépasse tolérance +{overTol}%</p>}
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Lot fournisseur *</Label>
                        <Input
                          placeholder="LOT-FOURNISSEUR-123" className="h-8 text-sm"
                          value={input.supplierLot}
                          onChange={(e) => updateLineInput(line.id, 'supplierLot', e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">N° BRF / GRN</Label>
                        <Input
                          placeholder="GRN-20260621-001" className="h-8 text-sm"
                          value={input.grnNumber}
                          onChange={(e) => updateLineInput(line.id, 'grnNumber', e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Statut QC *</Label>
                        <Select
                          value={input.qcStatus}
                          onValueChange={(v) => updateLineInput(line.id, 'qcStatus', v)}
                        >
                          <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="accepted"><span className="text-green-700">✓ Accepté</span></SelectItem>
                            <SelectItem value="conditional"><span className="text-amber-600">⚠ Sous réserve (quarantaine)</span></SelectItem>
                            <SelectItem value="rejected"><span className="text-red-600">✗ Rejeté</span></SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {input.qcStatus === 'conditional' && (
                        <div className="col-span-2 space-y-1">
                          <Label className="text-xs text-amber-700">Motif quarantaine *</Label>
                          <Textarea
                            placeholder="Ex: Humidité hors norme, attente résultat labo..."
                            className="h-16 text-sm resize-none"
                            value={input.quarantineReason}
                            onChange={(e) => updateLineInput(line.id, 'quarantineReason', e.target.value)}
                          />
                        </div>
                      )}
                      {input.qcStatus === 'rejected' && (
                        <div className="col-span-2 space-y-1">
                          <Label className="text-xs text-red-700">Motif rejet</Label>
                          <Textarea
                            placeholder="Ex: Infestation, qualité non conforme..."
                            className="h-16 text-sm resize-none"
                            value={input.rejectionReason}
                            onChange={(e) => updateLineInput(line.id, 'rejectionReason', e.target.value)}
                          />
                        </div>
                      )}
                      <div className="col-span-2 flex justify-end">
                        <Button
                          size="sm"
                          onClick={() => handleReceiveLine(line.id)}
                          disabled={isReceiving || wouldExceed || !input.receivedNow || !input.supplierLot.trim()}
                        >
                          Réceptionner
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-sm text-green-700">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Ligne entièrement réceptionnée</span>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Linked receptions from receptions module */}
            {(linkedReceptions.lots.length > 0 || linkedReceptions.receptions.length > 0) && (
              <div className="space-y-2">
                <Separator />
                <h4 className="text-sm font-semibold">Lots liés (module réception)</h4>
                {linkedReceptions.lots.length > 0 && (
                  <div className="border rounded-md overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Lot interne</TableHead>
                          <TableHead>Lot fournisseur</TableHead>
                          <TableHead>Quantité</TableHead>
                          <TableHead>Statut stock</TableHead>
                          <TableHead>Date</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {linkedReceptions.lots.map((lot: any) => (
                          <TableRow key={String(lot.id)}>
                            <TableCell className="text-sm font-mono">{lot.lot_internal ?? '—'}</TableCell>
                            <TableCell className="text-sm">{lot.lot_supplier ?? '—'}</TableCell>
                            <TableCell className="text-sm">{lot.quantity != null ? `${lot.quantity} ${lot.unit ?? 'kg'}` : '—'}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-[10px]">{lot.stock_status ?? 'N/A'}</Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {lot.created_at ? format(new Date(String(lot.created_at)), 'dd/MM/yy HH:mm', { locale: fr }) : '—'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          {/* ── TAB: 3-Way Match ────────────────────────────────────────── */}
          <TabsContent value="match" className="space-y-4 pt-2">
            {order.receipt_status === 'not_received' && (
              <div className="flex items-center gap-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-700">
                <Clock className="h-4 w-4 shrink-0" />
                Aucune réception enregistrée. Réceptionnez au moins une ligne avant de valider la facture.
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">N° facture fournisseur *</Label>
                <Input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} placeholder="INV-2026-0001" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Date facture *</Label>
                <Input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Montant facture TND *</Label>
                <Input type="number" step="0.01" value={invoiceAmount} onChange={(e) => setInvoiceAmount(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Tolérance (%)</Label>
                <Input type="number" step="0.1" min="0" max="20" value={tolerancePct} onChange={(e) => setTolerancePct(e.target.value)} />
              </div>
            </div>

            <div className={`rounded-lg border p-4 space-y-2 ${liveMatched ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm">Résultat 3-Way Match</span>
                <Badge className={liveMatched ? 'bg-green-600' : 'bg-red-600'}>
                  {liveMatched ? <><CheckCircle2 className="h-3 w-3 mr-1" />Match OK</> : <><XCircle className="h-3 w-3 mr-1" />Écart détecté</>}
                </Badge>
              </div>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">Total PO</p>
                  <p className="font-medium">{order.total_amount.toFixed(2)} TND</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Montant facture</p>
                  <p className="font-medium">{currentInvoiceAmount.toFixed(2)} TND</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Variance</p>
                  <p className={`font-bold ${Math.abs(liveVariancePct) <= currentTolerancePct ? 'text-green-700' : 'text-red-600'}`}>
                    {liveVarianceAmount > 0 ? '+' : ''}{liveVarianceAmount.toFixed(2)} TND ({liveVariancePct.toFixed(2)}%)
                  </p>
                </div>
              </div>
              {!liveMatched && (
                <p className="text-xs text-red-700 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Variance {Math.abs(liveVariancePct).toFixed(2)}% dépasse la tolérance {currentTolerancePct}% — une approbation manuelle sera requise.
                </p>
              )}
              {(order as any).three_way_match_at && (
                <p className="text-xs text-muted-foreground">
                  Dernière validation : {format(new Date((order as any).three_way_match_at), 'dd/MM/yyyy HH:mm', { locale: fr })}
                  {(order as any).three_way_match_status && ` · ${(order as any).three_way_match_status === 'matched' ? 'Validé' : 'Litige'}`}
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setInvoiceAmount(order.total_amount.toFixed(2)); setTolerancePct('2'); }}>
                <RotateCcw className="h-3.5 w-3.5 mr-1" />Réinitialiser
              </Button>
              <Button onClick={handleSaveThreeWay} disabled={isSavingThreeWayMatch || !invoiceNumber.trim() || !invoiceDate || Number(invoiceAmount || 0) <= 0}>
                Valider 3-Way Match
              </Button>
            </div>

            {/* QC breakdown */}
            {(acceptedTotalQty > 0 || quarantineTotalQty > 0 || rejectedTotalQty > 0) && (
              <div className="border rounded-md p-3 space-y-2">
                <p className="text-sm font-medium">Récapitulatif QC</p>
                <div className="grid grid-cols-3 gap-3 text-xs">
                  <div className="rounded bg-green-50 border border-green-100 p-2 text-center">
                    <p className="font-bold text-green-700 text-base">{acceptedTotalQty.toFixed(2)} kg</p>
                    <p className="text-green-600">Accepté</p>
                  </div>
                  <div className="rounded bg-amber-50 border border-amber-100 p-2 text-center">
                    <p className="font-bold text-amber-600 text-base">{quarantineTotalQty.toFixed(2)} kg</p>
                    <p className="text-amber-600">Quarantaine</p>
                  </div>
                  <div className="rounded bg-red-50 border border-red-100 p-2 text-center">
                    <p className="font-bold text-red-600 text-base">{rejectedTotalQty.toFixed(2)} kg</p>
                    <p className="text-red-600">Rejeté</p>
                  </div>
                </div>
                {hasDiscrepancy && (
                  <p className="text-xs text-amber-700 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Des écarts QC existent. Le montant facturé ne devrait couvrir que les {acceptedTotalQty.toFixed(2)} kg acceptés.
                    Montant attendu ≈ {((acceptedTotalQty / (orderedTotalQty || 1)) * order.total_amount).toFixed(2)} TND.
                  </p>
                )}
              </div>
            )}
          </TabsContent>

          {/* ── TAB: Historique ─────────────────────────────────────────── */}
          <TabsContent value="history" className="space-y-3 pt-2">
            {logsLoading ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">Chargement...</div>
            ) : receiptLogs.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">Aucun événement de réception enregistré.</div>
            ) : (
              <div className="space-y-2">
                {receiptLogs.map((log: any) => {
                  const isAccepted = log.qc_status === 'accepted';
                  const isQuarantine = log.qc_status === 'conditional';
                  return (
                    <div key={String(log.id)} className={`flex items-start gap-3 rounded-md border p-2.5 text-sm ${isAccepted ? 'bg-green-50/40' : isQuarantine ? 'bg-amber-50/40' : 'bg-red-50/40'}`}>
                      <div className="mt-0.5 shrink-0">
                        {isAccepted ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : isQuarantine ? <ShieldAlert className="h-4 w-4 text-amber-500" /> : <XCircle className="h-4 w-4 text-red-500" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">{Number(log.received_qty ?? 0).toFixed(2)} kg</span>
                          {qcBadge(String(log.qc_status ?? 'accepted'))}
                          {log.grn_number && <Badge variant="outline" className="text-[10px]">GRN: {String(log.grn_number)}</Badge>}
                          <span className="text-xs text-muted-foreground ml-auto">
                            {log.received_at ? format(new Date(String(log.received_at)), 'dd/MM/yyyy HH:mm', { locale: fr }) : '—'}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5 space-y-0.5">
                          {log.supplier_lot && <span>Lot fournisseur: <strong>{String(log.supplier_lot)}</strong></span>}
                          {log.received_by && <span> · Par: {String(log.received_by)}</span>}
                          {log.quarantine_reason && <p className="text-amber-700">⚠ {String(log.quarantine_reason)}</p>}
                          {log.rejection_reason && <p className="text-red-700">✗ {String(log.rejection_reason)}</p>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export const PurchaseOrderDetail = (props: PurchaseOrderDetailProps) => {
  if (!props.order) return null;
  return <PurchaseOrderDetailContent {...props} order={props.order} />;
};
