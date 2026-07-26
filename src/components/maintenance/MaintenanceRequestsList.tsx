import { useMemo, useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  CheckCircle2,
  XCircle,
  Undo2,
  Send,
  Ban,
  Flag,
  Pencil,
  Trash2,
  Wrench,
} from 'lucide-react';
import {
  MAINTENANCE_APPROVAL_LEVEL_LABELS,
  MAINTENANCE_PRIORITY_LABELS,
  MAINTENANCE_STATUS_LABELS,
  isMaintenanceRequestPending,
  normalizeMaintenanceRequestStatus,
  type MaintenancePriority,
  type MaintenanceRequest,
  type MaintenanceRequestStatus,
} from '@/types/maintenance';
import { DEPARTMENT_LABELS } from '@/types/org';

const STATUS_VARIANTS: Record<MaintenanceRequestStatus, string> = {
  DRAFT: 'bg-slate-100 text-slate-700',
  SUBMITTED: 'bg-blue-100 text-blue-700',
  MAINTENANCE_REVIEW: 'bg-indigo-100 text-indigo-700',
  FINANCE_APPROVAL: 'bg-purple-100 text-purple-700',
  APPROVED: 'bg-green-100 text-green-700',
  COMPLETED: 'bg-emerald-100 text-emerald-700',
  REJECTED: 'bg-red-100 text-red-700',
  RETURNED_FOR_CHANGES: 'bg-amber-100 text-amber-700',
  CANCELLED: 'bg-gray-100 text-gray-500',
};

const PRIORITY_VARIANTS: Record<MaintenancePriority, string> = {
  low: 'bg-slate-100 text-slate-600',
  normal: 'bg-sky-100 text-sky-700',
  high: 'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700',
};

interface MaintenanceRequestsListProps {
  requests: MaintenanceRequest[];
  currentUserId: string | null;
  canApprove: boolean;
  canComplete: boolean;
  onNew: () => void;
  onEdit: (request: MaintenanceRequest) => void;
  onDelete: (id: string) => void;
  onSubmit: (id: string) => void;
  onApprove: (id: string) => void;
  onReject: (id: string, reason: string) => void;
  onReturn: (id: string, reason: string) => void;
  onCancel: (id: string, reason: string) => void;
  onComplete: (id: string) => void;
}

type ReasonAction = 'reject' | 'return' | 'cancel';

const REASON_TITLES: Record<ReasonAction, string> = {
  reject: 'Rejeter la demande',
  return: 'Renvoyer pour correction',
  cancel: 'Annuler la demande',
};

export const MaintenanceRequestsList = ({
  requests,
  currentUserId,
  canApprove,
  canComplete,
  onNew,
  onEdit,
  onDelete,
  onSubmit,
  onApprove,
  onReject,
  onReturn,
  onCancel,
  onComplete,
}: MaintenanceRequestsListProps) => {
  const [reasonAction, setReasonAction] = useState<ReasonAction | null>(null);
  const [reasonTargetId, setReasonTargetId] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  const sorted = useMemo(
    () =>
      [...requests].sort((left, right) => {
        const leftTs = Date.parse(right.created_at || '') || 0;
        const rightTs = Date.parse(left.created_at || '') || 0;
        return leftTs - rightTs;
      }),
    [requests],
  );

  const openReason = (action: ReasonAction, id: string) => {
    setReasonAction(action);
    setReasonTargetId(id);
    setReason('');
  };

  const confirmReason = () => {
    if (!reasonAction || !reasonTargetId || !reason.trim()) return;
    if (reasonAction === 'reject') onReject(reasonTargetId, reason.trim());
    if (reasonAction === 'return') onReturn(reasonTargetId, reason.trim());
    if (reasonAction === 'cancel') onCancel(reasonTargetId, reason.trim());
    setReasonAction(null);
    setReasonTargetId(null);
    setReason('');
  };

  const isOwner = (request: MaintenanceRequest) =>
    !!currentUserId && String(request.requester_id ?? '') === currentUserId;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wrench className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Demandes de maintenance</h2>
          <Badge variant="secondary">{requests.length}</Badge>
        </div>
        <Button onClick={onNew} size="sm">
          Nouvelle demande
        </Button>
      </div>

      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>N°</TableHead>
              <TableHead>Objet</TableHead>
              <TableHead>Département</TableHead>
              <TableHead>Priorité</TableHead>
              <TableHead>Coût est.</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Étape</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                  Aucune demande de maintenance.
                </TableCell>
              </TableRow>
            )}
            {sorted.map((request) => {
              const status = normalizeMaintenanceRequestStatus(request.status);
              const priority = (request.priority as MaintenancePriority) ?? 'normal';
              const owner = isOwner(request);
              const pending = isMaintenanceRequestPending(status);
              const canSubmit = (status === 'DRAFT' || status === 'RETURNED_FOR_CHANGES') && (owner || canApprove);
              const canActOnApproval = pending && canApprove && !owner;
              const canCancel =
                status !== 'COMPLETED' &&
                status !== 'CANCELLED' &&
                status !== 'REJECTED' &&
                (owner || canApprove);
              const canEdit = (status === 'DRAFT' || status === 'RETURNED_FOR_CHANGES') && (owner || canApprove);
              const canCloseOut = status === 'APPROVED' && canComplete;
              const departmentLabel = request.department
                ? DEPARTMENT_LABELS[request.department as keyof typeof DEPARTMENT_LABELS] ??
                  String(request.department)
                : '—';
              const stepLabel = request.current_approval_level
                ? MAINTENANCE_APPROVAL_LEVEL_LABELS[request.current_approval_level] ??
                  request.current_approval_level
                : status === 'APPROVED'
                  ? 'Planification'
                  : '—';

              return (
                <TableRow key={request.id}>
                  <TableCell className="font-mono text-xs">
                    {request.request_number || request.id.slice(0, 8)}
                  </TableCell>
                  <TableCell className="max-w-[220px]">
                    <p className="truncate font-medium">{request.title || '—'}</p>
                    {request.equipment_name && (
                      <p className="truncate text-xs text-muted-foreground">
                        {request.equipment_name}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{departmentLabel}</TableCell>
                  <TableCell>
                    <Badge className={PRIORITY_VARIANTS[priority]} variant="secondary">
                      {MAINTENANCE_PRIORITY_LABELS[priority]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {request.estimated_cost != null ? `${request.estimated_cost} TND` : '—'}
                  </TableCell>
                  <TableCell>
                    <Badge className={STATUS_VARIANTS[status]} variant="secondary">
                      {MAINTENANCE_STATUS_LABELS[status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{stepLabel}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      {canSubmit && (
                        <Button
                          size="icon"
                          variant="ghost"
                          title="Soumettre"
                          onClick={() => onSubmit(request.id)}
                        >
                          <Send className="h-4 w-4 text-blue-600" />
                        </Button>
                      )}
                      {canActOnApproval && (
                        <>
                          <Button
                            size="icon"
                            variant="ghost"
                            title="Approuver"
                            onClick={() => onApprove(request.id)}
                          >
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            title="Renvoyer pour correction"
                            onClick={() => openReason('return', request.id)}
                          >
                            <Undo2 className="h-4 w-4 text-amber-600" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            title="Rejeter"
                            onClick={() => openReason('reject', request.id)}
                          >
                            <XCircle className="h-4 w-4 text-red-600" />
                          </Button>
                        </>
                      )}
                      {canCloseOut && (
                        <Button
                          size="icon"
                          variant="ghost"
                          title="Clôturer l'intervention"
                          onClick={() => onComplete(request.id)}
                        >
                          <Flag className="h-4 w-4 text-emerald-600" />
                        </Button>
                      )}
                      {canEdit && (
                        <Button
                          size="icon"
                          variant="ghost"
                          title="Modifier"
                          onClick={() => onEdit(request)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      {canCancel && (
                        <Button
                          size="icon"
                          variant="ghost"
                          title="Annuler"
                          onClick={() => openReason('cancel', request.id)}
                        >
                          <Ban className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      )}
                      {canEdit && (
                        <Button
                          size="icon"
                          variant="ghost"
                          title="Supprimer"
                          onClick={() => onDelete(request.id)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={reasonAction !== null} onOpenChange={(open) => !open && setReasonAction(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{reasonAction ? REASON_TITLES[reasonAction] : ''}</DialogTitle>
          </DialogHeader>
          <Textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Motif (obligatoire)..."
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setReasonAction(null)}>
              Annuler
            </Button>
            <Button onClick={confirmReason} disabled={!reason.trim()}>
              Confirmer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
