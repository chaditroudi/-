import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Search, Edit2, Trash2, Send, Check, Eye, ShieldCheck, PackageCheck, Lock } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  PurchaseOrder,
  purchaseOrderInvoiceStatusColors,
  purchaseOrderInvoiceStatusLabels,
  purchaseOrderReceiptStatusColors,
  purchaseOrderReceiptStatusLabels,
  purchaseOrderStatusLabels,
  purchaseOrderStatusColors,
  orderTypeLabels,
  orderTypeColors,
} from '@/types/purchasing';

interface PurchaseOrdersListProps {
  orders: PurchaseOrder[];
  isLoading?: boolean;
  errorMessage?: string | null;
  onNew: () => void;
  onEdit: (order: PurchaseOrder) => void;
  onDelete: (id: string) => void;
  onSend: (id: string) => void;
  onConfirm: (id: string) => void;
  onApprove: (id: string, approverName: string) => void;
  onReceive: (order: PurchaseOrder) => void;
  onClose?: (id: string) => void;
  onView: (order: PurchaseOrder) => void;
}

export const PurchaseOrdersList = ({
  orders,
  isLoading = false,
  errorMessage = null,
  onNew,
  onEdit,
  onDelete,
  onSend,
  onConfirm,
  onApprove,
  onReceive,
  onClose,
  onView
}: PurchaseOrdersListProps) => {
  const [search, setSearch] = useState('');
  const [approveDialog, setApproveDialog] = useState<{ order: PurchaseOrder; name: string } | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<PurchaseOrder | null>(null);

  const filtered = orders.filter(o =>
    o.order_number.toLowerCase().includes(search.toLowerCase()) ||
    o.supplier?.name?.toLowerCase().includes(search.toLowerCase()) ||
    (o.variety || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle className="text-lg font-semibold">Bons de Commande (BC)</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Workflow: Brouillon → Soumis → Confirmé → Livraison partielle → Livré → Facturé → Clôturé
            </p>
          </div>
          <Button size="sm" onClick={onNew}>
            <Plus className="h-4 w-4 mr-2" />
            Nouveau BC
          </Button>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher N° BC, fournisseur, variété..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>N° BC / Type</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Fournisseur / Variété</TableHead>
                  <TableHead>Lignes</TableHead>
                  <TableHead>Réception</TableHead>
                  <TableHead>Validation</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                      Chargement des bons de commande...
                    </TableCell>
                  </TableRow>
                ) : errorMessage && filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-destructive py-8">
                      Impossible de charger les bons de commande: {errorMessage}
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                      Aucun bon de commande trouvé
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((order) => {
                    const totalOrdered = (order.lines || []).reduce((sum, l) => sum + Number(l.confirmed_quantity ?? (l.quantity || 0)), 0);
                    const totalReceived = (order.lines || []).reduce((sum, l) => sum + Number(l.received_quantity || 0), 0);
                    const receptionPct = totalOrdered > 0 ? Math.min(100, (totalReceived / totalOrdered) * 100) : 0;
                    const needsApproval = Boolean(order.approval_required ?? Number(order.total_amount || 0) >= 50000);
                    const isApproved = Boolean(order.approved_by);

                    return (
                      <TableRow key={order.id}>
                        <TableCell>
                          <div className="space-y-1">
                            <span className="font-mono text-sm">{order.order_number}</span>
                            {order.order_type && (
                              <div>
                                <Badge className={`${orderTypeColors[order.order_type]} text-white text-[10px] py-0`}>
                                  {orderTypeLabels[order.order_type]}
                                </Badge>
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {format(new Date(order.order_date), 'dd/MM/yyyy', { locale: fr })}
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="text-sm font-medium">{order.supplier?.name || '—'}</div>
                            {order.variety && (
                              <div className="text-xs text-muted-foreground">{order.variety}</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{order.lines?.length || 0} articles</TableCell>
                        <TableCell>
                          <div className="space-y-1 min-w-[80px]">
                            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${receptionPct >= 100 ? 'bg-green-500' : receptionPct > 0 ? 'bg-orange-400' : 'bg-muted-foreground/20'}`}
                                style={{ width: `${receptionPct}%` }}
                              />
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {receptionPct.toFixed(0)}% · {totalReceived.toFixed(1)} / {totalOrdered.toFixed(1)} kg
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {needsApproval ? (
                            <Badge variant={isApproved ? 'default' : 'secondary'} className="text-xs">
                              {isApproved ? `✓ ${order.approved_by}` : 'Direction requise'}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs">Standard</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          <div>{order.total_amount?.toFixed(2)} {order.currency}</div>
                          {(order.advance_paid ?? 0) > 0 && (
                            <div className="text-xs text-muted-foreground">
                              Avance: {(order.advance_paid ?? 0).toFixed(2)}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <Badge className={`${purchaseOrderStatusColors[order.status]} text-white text-xs`}>
                              {purchaseOrderStatusLabels[order.status]}
                            </Badge>
                            <div className="flex flex-wrap gap-1">
                              {order.receipt_status && order.receipt_status !== 'not_received' && (
                                <Badge variant="outline" className={`text-[10px] py-0 ${purchaseOrderReceiptStatusColors[order.receipt_status]}`}>
                                  {purchaseOrderReceiptStatusLabels[order.receipt_status]}
                                </Badge>
                              )}
                              {order.invoice_status && order.invoice_status !== 'not_invoiced' && (
                                <Badge variant="outline" className={`text-[10px] py-0 ${purchaseOrderInvoiceStatusColors[order.invoice_status]}`}>
                                  {purchaseOrderInvoiceStatusLabels[order.invoice_status]}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => onView(order)}
                              title="Voir détails"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {order.status === 'draft' && (
                              <>
                                {needsApproval && !isApproved && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-emerald-600"
                                    onClick={() => setApproveDialog({ order, name: '' })}
                                    title="Validation interne Direction"
                                  >
                                    <ShieldCheck className="h-4 w-4" />
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-blue-600"
                                  onClick={() => onSend(order.id)}
                                  disabled={needsApproval && !isApproved}
                                  title="Soumettre au fournisseur"
                                >
                                  <Send className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => onEdit(order)} title="Modifier">
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setDeleteDialog(order)}
                                  title="Supprimer"
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </>
                            )}
                            {order.status === 'submitted' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-green-600"
                                onClick={() => onConfirm(order.id)}
                                title="Marquer confirmé par fournisseur"
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                            )}
                            {(order.status === 'confirmed' || order.status === 'partially_delivered' || order.status === 'on_hold') && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-orange-600"
                                onClick={() => onReceive(order)}
                                title="Réceptionner"
                              >
                                <PackageCheck className="h-4 w-4" />
                              </Button>
                            )}
                            {order.status === 'invoiced' && onClose && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-slate-600"
                                onClick={() => onClose(order.id)}
                                title="Clôturer le BC"
                              >
                                <Lock className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
          <p className="text-xs text-muted-foreground mt-2">{filtered.length} BC affichés</p>
        </CardContent>
      </Card>

      {/* Approve Dialog */}
      <Dialog open={!!approveDialog} onOpenChange={(open) => { if (!open) setApproveDialog(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
              Validation interne Direction
            </DialogTitle>
          </DialogHeader>
          {approveDialog && (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted/40 p-3 text-sm space-y-1">
                <div className="font-mono font-semibold">{approveDialog.order.order_number}</div>
                <div className="text-muted-foreground">
                  Montant : <strong className="text-foreground">{approveDialog.order.total_amount?.toLocaleString('fr-FR')} {approveDialog.order.currency}</strong>
                </div>
                <div className="text-muted-foreground">
                  Fournisseur : {approveDialog.order.supplier?.name || '—'}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Nom du valideur Direction *</Label>
                <Input
                  placeholder="Prénom NOM"
                  value={approveDialog.name}
                  onChange={(e) => setApproveDialog({ ...approveDialog, name: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && approveDialog.name.trim()) {
                      onApprove(approveDialog.order.id, approveDialog.name.trim());
                      setApproveDialog(null);
                    }
                  }}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveDialog(null)}>Annuler</Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              disabled={!approveDialog?.name.trim()}
              onClick={() => {
                if (approveDialog?.name.trim()) {
                  onApprove(approveDialog.order.id, approveDialog.name.trim());
                  setApproveDialog(null);
                }
              }}
            >
              Valider
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={!!deleteDialog} onOpenChange={(open) => { if (!open) setDeleteDialog(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-destructive">Supprimer ce BC ?</DialogTitle>
          </DialogHeader>
          {deleteDialog && (
            <p className="text-sm text-muted-foreground">
              Le bon de commande <strong className="font-mono text-foreground">{deleteDialog.order_number}</strong> sera définitivement supprimé. Cette action est irréversible.
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog(null)}>Annuler</Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleteDialog) {
                  onDelete(deleteDialog.id);
                  setDeleteDialog(null);
                }
              }}
            >
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
