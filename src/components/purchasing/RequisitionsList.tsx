import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Plus, Search, Edit2, Trash2, Check, X, ShoppingCart, Eye,
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  PurchaseRequisition,
  RequisitionStatus,
  UrgencyLevel,
  requisitionStatusLabels,
  requisitionStatusColors,
  urgencyLabels,
  urgencyColors,
} from '@/types/purchasing';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { parseRequisitionMeta } from './requisitionMeta';

interface RequisitionsListProps {
  requisitions: PurchaseRequisition[];
  onNew: () => void;
  onEdit: (req: PurchaseRequisition) => void;
  onDelete: (id: string) => void;
  onApprove: (id: string, approverName: string) => void;
  onReject: (id: string, reason: string, rejectorName: string) => void;
  onCreateOrder: (req: PurchaseRequisition) => void;
  onView: (req: PurchaseRequisition) => void;
  canCreate?: boolean;
  canApprove?: boolean;
  canReject?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  canCreateOrder?: boolean;
  workflowMessage?: string;
  /** Utilisateur connecté — signataire des approbations/rejets (SoD RG-VAL-02). */
  currentUser?: string;
}

export const RequisitionsList = ({
  requisitions,
  onNew,
  onEdit,
  onDelete,
  onApprove,
  onReject,
  onCreateOrder,
  onView,
  canCreate = true,
  canApprove = true,
  canReject = true,
  canEdit = true,
  canDelete = true,
  canCreateOrder = true,
  workflowMessage,
  currentUser = '',
}: RequisitionsListProps) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<RequisitionStatus | 'all'>('all');
  const [urgencyFilter, setUrgencyFilter] = useState<UrgencyLevel | 'all'>('all');

  // ── Reject dialog state ──────────────────────────────
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedReq, setSelectedReq] = useState<PurchaseRequisition | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectorName, setRejectorName] = useState('');

  // ── Approve dialog state ─────────────────────────────
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [reqToApprove, setReqToApprove] = useState<PurchaseRequisition | null>(null);
  const [approverName, setApproverName] = useState('');

  // ── Delete confirm state ─────────────────────────────
  const [deleteTarget, setDeleteTarget] = useState<PurchaseRequisition | null>(null);

  const filtered = requisitions.filter((r) => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    if (urgencyFilter !== 'all' && r.urgency !== urgencyFilter) return false;

    const { meta } = parseRequisitionMeta(r.notes);
    const q = search.toLowerCase();
    return (
      r.requisition_number.toLowerCase().includes(q) ||
      r.material_name.toLowerCase().includes(q) ||
      r.requester_name.toLowerCase().includes(q) ||
      (meta.site || '').toLowerCase().includes(q) ||
      (r.department || '').toLowerCase().includes(q)
    );
  });

  // ── Handlers ────────────────────────────────────────
  const handleApproveClick = (req: PurchaseRequisition) => {
    setReqToApprove(req);
    setApproverName('');
    setApproveDialogOpen(true);
  };

  const handleApproveConfirm = () => {
    if (reqToApprove && approverName.trim()) {
      onApprove(reqToApprove.id, approverName.trim());
      setApproveDialogOpen(false);
      setReqToApprove(null);
    }
  };

  const handleRejectClick = (req: PurchaseRequisition) => {
    setSelectedReq(req);
    setRejectReason('');
    setRejectorName('');
    setRejectDialogOpen(true);
  };

  const handleRejectConfirm = () => {
    if (selectedReq && rejectReason.trim() && rejectorName.trim()) {
      onReject(selectedReq.id, rejectReason.trim(), rejectorName.trim());
      setRejectDialogOpen(false);
      setSelectedReq(null);
    }
  };

  // Status counts for summary chips
  const counts = {
    pending: requisitions.filter((r) => r.status === 'pending_approval').length,
    approved: requisitions.filter((r) => r.status === 'approved').length,
    rejected: requisitions.filter((r) => r.status === 'rejected').length,
    ordered: requisitions.filter((r) => r.status === 'ordered').length,
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle className="text-lg font-semibold">Demandes d'Achat (DA)</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              {requisitions.length} demande{requisitions.length !== 1 ? 's' : ''} au total
            </p>
          </div>
          {canCreate && (
            <Button size="sm" onClick={onNew}>
              <Plus className="h-4 w-4 mr-2" />
              Préparer une DA
            </Button>
          )}
        </CardHeader>

        <CardContent className="space-y-4">
          {workflowMessage && (
            <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
              {workflowMessage}
            </div>
          )}

          {/* Summary chips */}
          {(counts.pending > 0 || counts.approved > 0) && (
            <div className="flex flex-wrap gap-2">
              {counts.pending > 0 && (
                <button
                  type="button"
                  onClick={() => setStatusFilter('pending_approval')}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors',
                    statusFilter === 'pending_approval'
                      ? 'border-yellow-400 bg-yellow-100 text-yellow-800'
                      : 'border-yellow-200 bg-yellow-50 text-yellow-700 hover:bg-yellow-100',
                  )}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-yellow-500 animate-pulse" />
                  {counts.pending} en attente
                </button>
              )}
              {counts.approved > 0 && (
                <button
                  type="button"
                  onClick={() => setStatusFilter('approved')}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors',
                    statusFilter === 'approved'
                      ? 'border-emerald-400 bg-emerald-100 text-emerald-800'
                      : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
                  )}
                >
                  {counts.approved} validée{counts.approved > 1 ? 's' : ''} — prête{counts.approved > 1 ? 's' : ''} pour achats
                </button>
              )}
              {counts.rejected > 0 && (
                <button
                  type="button"
                  onClick={() => setStatusFilter('rejected')}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors',
                    statusFilter === 'rejected'
                      ? 'border-red-400 bg-red-100 text-red-800'
                      : 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100',
                  )}
                >
                  {counts.rejected} refusée{counts.rejected > 1 ? 's' : ''}
                </button>
              )}
              {statusFilter !== 'all' && (
                <button
                  type="button"
                  onClick={() => setStatusFilter('all')}
                  className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted transition-colors"
                >
                  Tout afficher
                </button>
              )}
            </div>
          )}

          {/* Filters row */}
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="N° DA, article, demandeur, site..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as RequisitionStatus | 'all')}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="draft">Brouillon</SelectItem>
                <SelectItem value="pending_approval">En attente</SelectItem>
                <SelectItem value="approved">Validée</SelectItem>
                <SelectItem value="rejected">Refusée</SelectItem>
                <SelectItem value="ordered">Commandée</SelectItem>
                <SelectItem value="cancelled">Annulée</SelectItem>
              </SelectContent>
            </Select>
            <Select value={urgencyFilter} onValueChange={(v) => setUrgencyFilter(v as UrgencyLevel | 'all')}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Urgence" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toute urgence</SelectItem>
                <SelectItem value="critical">Critique</SelectItem>
                <SelectItem value="high">Haute</SelectItem>
                <SelectItem value="normal">Normale</SelectItem>
                <SelectItem value="low">Basse</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>N° DA</TableHead>
                  <TableHead>Date souhaitée</TableHead>
                  <TableHead>Site</TableHead>
                  <TableHead>Préparée par</TableHead>
                  <TableHead>Article</TableHead>
                  <TableHead>Qté</TableHead>
                  <TableHead>Urgence</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground py-10">
                      Aucune demande trouvée
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((req) => {
                    const { meta } = parseRequisitionMeta(req.notes);
                    const isUrgent = req.urgency === 'critical' || req.urgency === 'high';

                    return (
                      <TableRow
                        key={req.id}
                        className={cn(isUrgent && req.status === 'pending_approval' && 'bg-red-50/40')}
                      >
                        <TableCell>
                          <button
                            type="button"
                            onClick={() => onView(req)}
                            className="font-mono text-sm font-semibold text-primary hover:underline underline-offset-2"
                          >
                            {req.requisition_number}
                          </button>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(req.created_at), 'dd/MM/yyyy', { locale: fr })}
                          </p>
                        </TableCell>
                        <TableCell className="text-sm">
                          {meta.desiredDate
                            ? format(new Date(meta.desiredDate), 'dd/MM/yyyy', { locale: fr })
                            : '-'}
                        </TableCell>
                        <TableCell className="text-sm">{meta.site || '-'}</TableCell>
                        <TableCell>
                          <p className="text-sm font-medium">{req.requester_name}</p>
                          {req.department && (
                            <p className="text-xs text-muted-foreground">{req.department}</p>
                          )}
                        </TableCell>
                        <TableCell className="max-w-[160px] truncate text-sm">
                          {req.material_name}
                        </TableCell>
                        <TableCell className="text-sm font-medium">
                          {req.quantity} {req.unit}
                        </TableCell>
                        <TableCell>
                          <Badge className={cn(urgencyColors[req.urgency], 'text-white text-xs')}>
                            {urgencyLabels[req.urgency]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={cn(requisitionStatusColors[req.status], 'text-white text-xs')}>
                            {requisitionStatusLabels[req.status]}
                          </Badge>
                          {req.approved_by && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              par {req.approved_by}
                            </p>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            {/* View */}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => onView(req)}
                              title="Voir détail"
                              className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>

                            {/* Approve / Reject */}
                            {req.status === 'pending_approval' && canApprove && canReject && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-9 w-9 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                  onClick={() => handleApproveClick(req)}
                                  title="Valider"
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-9 w-9 text-red-500 hover:text-red-600 hover:bg-red-50"
                                  onClick={() => handleRejectClick(req)}
                                  title="Refuser"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </>
                            )}

                            {/* Create BC */}
                            {req.status === 'approved' && canCreateOrder && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                onClick={() => onCreateOrder(req)}
                                title="Créer Bon de Commande"
                              >
                                <ShoppingCart className="h-4 w-4" />
                              </Button>
                            )}

                            {/* Edit — only draft or pending */}
                            {canEdit && (req.status === 'draft' || req.status === 'pending_approval') && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9"
                                onClick={() => onEdit(req)}
                                title="Modifier"
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                            )}

                            {/* Delete — only draft */}
                            {canDelete && req.status === 'draft' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9"
                                onClick={() => setDeleteTarget(req)}
                                title="Supprimer"
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
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

          {filtered.length > 0 && filtered.length !== requisitions.length && (
            <p className="text-xs text-muted-foreground text-right">
              {filtered.length} résultat{filtered.length > 1 ? 's' : ''} sur {requisitions.length}
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── Approve Dialog ─────────────────────────────── */}
      <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Valider la demande</DialogTitle>
          </DialogHeader>
          {reqToApprove && (
            <div className="space-y-4">
              <div className="rounded-xl border bg-muted/30 p-3 text-sm space-y-1">
                <p><span className="text-muted-foreground">DA :</span> <strong>{reqToApprove.requisition_number}</strong></p>
                <p><span className="text-muted-foreground">Article :</span> {reqToApprove.material_name}</p>
                <p><span className="text-muted-foreground">Préparée par :</span> {reqToApprove.requester_name}</p>
                {reqToApprove.estimated_cost != null && (
                  <p><span className="text-muted-foreground">Budget estimé :</span> <strong>{reqToApprove.estimated_cost.toLocaleString('fr-FR')} TND</strong></p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Votre nom (valideur) *</Label>
                <Input
                  value={approverName}
                  onChange={(e) => setApproverName(e.target.value)}
                  placeholder="Nom complet du valideur"
                  autoFocus
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveDialogOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleApproveConfirm}
              disabled={!approverName.trim()}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              <Check className="h-4 w-4 mr-2" />
              Confirmer la validation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Reject Dialog ──────────────────────────────── */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Refuser la demande</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Votre nom (valideur) *</Label>
              <Input
                value={rejectorName}
                onChange={(e) => setRejectorName(e.target.value)}
                placeholder="Nom du valideur"
              />
            </div>
            <div className="space-y-2">
              <Label>Motif du refus *</Label>
              <Textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Ex : Stock suffisant, hors budget, fournisseur non agréé..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={handleRejectConfirm}
              disabled={!rejectReason.trim() || !rejectorName.trim()}
            >
              Confirmer le refus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirm Dialog ──────────────────────── */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer la demande ?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            La demande <strong className="font-mono">{deleteTarget?.requisition_number}</strong> sera définitivement supprimée.
            Cette action est irréversible.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleteTarget) { onDelete(deleteTarget.id); setDeleteTarget(null); }
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
