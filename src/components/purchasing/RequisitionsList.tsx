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
  RequisitionApproval,
  RequisitionStatus,
  UrgencyLevel,
  isRequisitionPending,
  normalizeRequisitionStatus,
  requisitionStatusLabels,
  requisitionStatusColors,
  urgencyLabels,
  urgencyColors,
} from '@/types/purchasing';
import { useSettingsContext } from '@/contexts/SettingsContext';
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
  /** Approver identity comes from the authenticated session on the server. */
  onApprove: (id: string) => void;
  onReject: (id: string, reason: string) => void;
  onReturn?: (id: string, reason: string) => void;
  onSubmit?: (id: string) => void;
  onCreateOrder: (req: PurchaseRequisition) => void;
  onView: (req: PurchaseRequisition) => void;
  canCreate?: boolean;
  canApprove?: boolean;
  canReject?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  canCreateOrder?: boolean;
  workflowMessage?: string;
  /** Utilisateur connecté — affichage + SoD côté UI (id + nom). */
  currentUser?: string;
  currentUserId?: string | null;
}

export const RequisitionsList = ({
  requisitions,
  onNew,
  onEdit,
  onDelete,
  onApprove,
  onReject,
  onReturn,
  onSubmit,
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
  currentUserId = null,
}: RequisitionsListProps) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<RequisitionStatus | 'all'>('all');
  const [urgencyFilter, setUrgencyFilter] = useState<UrgencyLevel | 'all'>('all');

  // ── Reject / return dialog state ─────────────────────
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [returnMode, setReturnMode] = useState(false);
  const [selectedReq, setSelectedReq] = useState<PurchaseRequisition | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // ── Approve dialog state ─────────────────────────────
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [reqToApprove, setReqToApprove] = useState<PurchaseRequisition | null>(null);

  // ── Delete confirm state ─────────────────────────────
  const [deleteTarget, setDeleteTarget] = useState<PurchaseRequisition | null>(null);

  const filtered = requisitions.filter((r) => {
    if (statusFilter !== 'all') {
      const wanted = normalizeRequisitionStatus(statusFilter);
      if (normalizeRequisitionStatus(r.status) !== wanted) return false;
    }
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

  // ── Matrice d'approbation (§5.1) ─────────────────────
  const { settings } = useSettingsContext();
  const approvalMatrix = [...(settings.p2p?.approval_matrix ?? [])].sort(
    (a, b) => a.threshold_gte - b.threshold_gte,
  );

  /** Niveaux exigés par le montant estimé de la DA. */
  const getRequiredSteps = (req: PurchaseRequisition) =>
    approvalMatrix.filter((step) => (req.estimated_cost ?? 0) >= step.threshold_gte);

  const getSignedApprovals = (req: PurchaseRequisition): RequisitionApproval[] => req.approvals ?? [];

  const getNextStep = (req: PurchaseRequisition) => {
    const signed = new Set(getSignedApprovals(req).map((a) => a.level));
    const fromMatrix = getRequiredSteps(req).find((step) => !signed.has(step.level)) ?? null;
    if (fromMatrix) return fromMatrix;
    if (
      normalizeRequisitionStatus(req.status) === 'PURCHASING_REVIEW' &&
      !signed.has('purchasing_officer') &&
      !signed.has('purchasing_manager')
    ) {
      return { level: 'purchasing_officer', threshold_gte: 0, label: 'Acheteur' };
    }
    return null;
  };

  // ── Handlers ────────────────────────────────────────
  // RG-VAL-02 — séparation des tâches : un demandeur ne valide pas sa propre DA.
  const isOwnRequisition = (req: PurchaseRequisition) => {
    if (currentUserId && req.requester_id) return req.requester_id === currentUserId;
    return !!currentUser && req.requester_name.trim().toLowerCase() === currentUser.trim().toLowerCase();
  };

  // Un même utilisateur ne signe pas deux niveaux de la même DA.
  const hasAlreadySigned = (req: PurchaseRequisition) =>
    getSignedApprovals(req).some(
      (a) =>
        (currentUserId && a.approved_by_id === currentUserId) ||
        (!!currentUser && a.approved_by.trim().toLowerCase() === currentUser.trim().toLowerCase()),
    );

  const handleApproveClick = (req: PurchaseRequisition) => {
    setReqToApprove(req);
    setApproveDialogOpen(true);
  };

  const handleApproveConfirm = () => {
    if (!reqToApprove) return;
    onApprove(reqToApprove.id);
    setApproveDialogOpen(false);
    setReqToApprove(null);
  };

  const handleRejectClick = (req: PurchaseRequisition, asReturn = false) => {
    setSelectedReq(req);
    setRejectReason('');
    setReturnMode(asReturn);
    setRejectDialogOpen(true);
  };

  const handleRejectConfirm = () => {
    if (selectedReq && rejectReason.trim()) {
      if (returnMode && onReturn) onReturn(selectedReq.id, rejectReason.trim());
      else onReject(selectedReq.id, rejectReason.trim());
      setRejectDialogOpen(false);
      setSelectedReq(null);
    }
  };

  // Status counts for summary chips
  const counts = {
    pending: requisitions.filter((r) => isRequisitionPending(r.status)).length,
    approved: requisitions.filter((r) => normalizeRequisitionStatus(r.status) === 'APPROVED').length,
    rejected: requisitions.filter((r) => normalizeRequisitionStatus(r.status) === 'REJECTED').length,
    ordered: requisitions.filter((r) => normalizeRequisitionStatus(r.status) === 'ORDERED').length,
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
                  onClick={() => setStatusFilter('SUBMITTED')}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors',
                    normalizeRequisitionStatus(statusFilter === 'all' ? '' : statusFilter) === 'SUBMITTED' ||
                      statusFilter === 'SUBMITTED'
                      ? 'border-yellow-400 bg-yellow-100 text-yellow-800'
                      : 'border-yellow-200 bg-yellow-50 text-yellow-700 hover:bg-yellow-100',
                  )}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-yellow-500 animate-pulse" />
                  {counts.pending} en circuit
                </button>
              )}
              {counts.approved > 0 && (
                <button
                  type="button"
                  onClick={() => setStatusFilter('APPROVED')}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors',
                    statusFilter === 'APPROVED'
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
                  onClick={() => setStatusFilter('REJECTED')}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors',
                    statusFilter === 'REJECTED'
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
              <SelectTrigger className="w-52">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="DRAFT">Brouillon</SelectItem>
                <SelectItem value="SUBMITTED">Soumise</SelectItem>
                <SelectItem value="PURCHASING_REVIEW">Revue Achats</SelectItem>
                <SelectItem value="FINANCE_APPROVAL">Finance</SelectItem>
                <SelectItem value="APPROVED">Approuvée</SelectItem>
                <SelectItem value="ORDERED">Commandée</SelectItem>
                <SelectItem value="RETURNED_FOR_CHANGES">Retour correction</SelectItem>
                <SelectItem value="REJECTED">Rejetée</SelectItem>
                <SelectItem value="CANCELLED">Annulée</SelectItem>
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
                          <Badge className={cn(requisitionStatusColors[req.status] || 'bg-gray-500', 'text-white text-xs')}>
                            {requisitionStatusLabels[req.status] || req.status}
                          </Badge>
                          {isRequisitionPending(req.status) && (
                            <p className="mt-0.5 text-xs text-amber-700">
                              Circuit {getSignedApprovals(req).length}/{Math.max(getRequiredSteps(req).length, 1)}
                              {getNextStep(req) ? ` · ${getNextStep(req)!.label}` : ''}
                            </p>
                          )}
                          {req.approved_by && normalizeRequisitionStatus(req.status) === 'APPROVED' && (
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

                            {/* Submit draft */}
                            {onSubmit &&
                              (normalizeRequisitionStatus(req.status) === 'DRAFT' ||
                                normalizeRequisitionStatus(req.status) === 'RETURNED_FOR_CHANGES') &&
                              canEdit &&
                              isOwnRequisition(req) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-9 text-sky-700 hover:bg-sky-50"
                                onClick={() => onSubmit(req.id)}
                                title="Soumettre"
                              >
                                Soumettre
                              </Button>
                            )}

                            {/* Approve / Reject — RG-VAL-02 : pas de validation de sa propre DA */}
                            {isRequisitionPending(req.status) && canApprove && canReject && !isOwnRequisition(req) && (
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
                                  className="h-9 w-9 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                                  onClick={() => handleRejectClick(req, true)}
                                  title="Renvoyer pour correction"
                                >
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-9 w-9 text-red-500 hover:text-red-600 hover:bg-red-50"
                                  onClick={() => handleRejectClick(req, false)}
                                  title="Refuser"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </>
                            )}

                            {/* Create BC */}
                            {normalizeRequisitionStatus(req.status) === 'APPROVED' && canCreateOrder && (
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

                            {/* Edit — only draft / returned */}
                            {canEdit &&
                              ['DRAFT', 'RETURNED_FOR_CHANGES'].includes(normalizeRequisitionStatus(req.status)) && (
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
                            {canDelete && normalizeRequisitionStatus(req.status) === 'DRAFT' && (
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
          {reqToApprove && (() => {
            const requiredSteps = getRequiredSteps(reqToApprove);
            const signed = getSignedApprovals(reqToApprove);
            const nextStep = getNextStep(reqToApprove);
            const alreadySigned = hasAlreadySigned(reqToApprove);
            const isFinal = requiredSteps.filter(
              (s) => !signed.some((a) => a.level === s.level),
            ).length <= 1;

            return (
              <>
                <div className="space-y-4">
                  <div className="rounded-xl border bg-muted/30 p-3 text-sm space-y-1">
                    <p><span className="text-muted-foreground">DA :</span> <strong>{reqToApprove.requisition_number}</strong></p>
                    <p><span className="text-muted-foreground">Article :</span> {reqToApprove.material_name}</p>
                    <p><span className="text-muted-foreground">Préparée par :</span> {reqToApprove.requester_name}</p>
                    {reqToApprove.estimated_cost != null && (
                      <p><span className="text-muted-foreground">Budget estimé :</span> <strong>{reqToApprove.estimated_cost.toLocaleString('fr-FR')} TND</strong></p>
                    )}
                  </div>

                  {/* Circuit d'approbation par seuils (§5.1) */}
                  {requiredSteps.length > 0 && (
                    <div className="space-y-1.5">
                      <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                        Circuit d'approbation ({signed.length}/{requiredSteps.length})
                      </Label>
                      <div className="rounded-xl border divide-y">
                        {requiredSteps.map((step) => {
                          const sig = signed.find((a) => a.level === step.level);
                          const isNext = !sig && nextStep?.level === step.level;
                          return (
                            <div key={step.level} className="flex items-center gap-2.5 px-3 py-2 text-sm">
                              <span className={cn(
                                'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold',
                                sig ? 'bg-emerald-600 text-white' : isNext ? 'bg-amber-500 text-white' : 'bg-muted text-muted-foreground',
                              )}>
                                {sig ? '✓' : '•'}
                              </span>
                              <span className={cn('flex-1', sig && 'text-muted-foreground')}>{step.label}</span>
                              {sig ? (
                                <span className="text-xs text-muted-foreground">
                                  {sig.approved_by} · {format(new Date(sig.approved_at), 'dd/MM HH:mm', { locale: fr })}
                                </span>
                              ) : isNext ? (
                                <Badge className="bg-amber-500 text-white text-[11px]">À signer</Badge>
                              ) : (
                                <span className="text-xs text-muted-foreground/60">En attente</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {alreadySigned && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                      Vous avez déjà signé un niveau de cette DA — le niveau suivant doit être
                      validé par une autre personne (séparation des tâches).
                    </div>
                  )}

                  <div className="rounded-xl border bg-muted/20 p-3 text-sm">
                    <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Valideur (session)</p>
                    <p className="font-medium">{currentUser || 'Utilisateur connecté'}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      L&apos;identité est prise depuis votre session authentifiée — aucun nom saisi manuellement.
                    </p>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setApproveDialogOpen(false)}>
                    Annuler
                  </Button>
                  <Button
                    onClick={handleApproveConfirm}
                    disabled={alreadySigned}
                    className="bg-emerald-600 hover:bg-emerald-700"
                  >
                    <Check className="h-4 w-4 mr-2" />
                    {isFinal ? 'Confirmer la validation' : `Signer — ${nextStep?.label ?? ''}`}
                  </Button>
                </DialogFooter>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* ── Reject / Return Dialog ─────────────────────── */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{returnMode ? 'Renvoyer pour correction' : 'Refuser la demande'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-xl border bg-muted/20 p-3 text-sm">
              <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Acteur (session)</p>
              <p className="font-medium">{currentUser || 'Utilisateur connecté'}</p>
            </div>
            <div className="space-y-2">
              <Label>{returnMode ? 'Motif du retour *' : 'Motif du refus *'}</Label>
              <Textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder={
                  returnMode
                    ? 'Ex : Quantité à revoir, justification incomplète...'
                    : 'Ex : Stock suffisant, hors budget, fournisseur non agréé...'
                }
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              Annuler
            </Button>
            <Button
              variant={returnMode ? 'default' : 'destructive'}
              onClick={handleRejectConfirm}
              disabled={!rejectReason.trim()}
            >
              {returnMode ? 'Renvoyer' : 'Confirmer le refus'}
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
