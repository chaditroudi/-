import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  PurchaseRequisition,
  PurchaseOrder,
  requisitionStatusLabels,
  requisitionStatusColors,
  urgencyLabels,
  urgencyColors,
} from '@/types/purchasing';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { parseRequisitionMeta } from './requisitionMeta';
import {
  Building2,
  Calendar,
  CheckCircle,
  Clock,
  FileText,
  Package,
  ShoppingCart,
  User,
  XCircle,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface RequisitionDetailSheetProps {
  requisition: PurchaseRequisition | null;
  linkedOrder?: PurchaseOrder | null;
  onClose: () => void;
  onCreateOrder?: (req: PurchaseRequisition) => void;
  canCreateOrder?: boolean;
}

export const RequisitionDetailSheet = ({
  requisition,
  linkedOrder,
  onClose,
  onCreateOrder,
  canCreateOrder = false,
}: RequisitionDetailSheetProps) => {
  if (!requisition) return null;

  const { meta, plainNotes } = parseRequisitionMeta(requisition.notes);

  type TimelineEvent = {
    label: string;
    date: string;
    by?: string | null;
    icon: typeof FileText;
    color: string;
  };

  const timeline: TimelineEvent[] = [
    {
      label: 'Demande créée',
      date: requisition.created_at,
      icon: FileText,
      color: 'text-slate-500',
    },
    ...(requisition.status !== 'draft'
      ? [
          {
            label: 'Soumise pour validation',
            date: requisition.created_at,
            icon: Clock,
            color: 'text-amber-500',
          } as TimelineEvent,
        ]
      : []),
    ...(requisition.approved_at
      ? [
          {
            label: requisition.status === 'rejected' ? 'Refusée' : 'Validée',
            date: requisition.approved_at,
            by: requisition.approved_by,
            icon: requisition.status === 'rejected' ? XCircle : CheckCircle,
            color: requisition.status === 'rejected' ? 'text-red-500' : 'text-emerald-500',
          } as TimelineEvent,
        ]
      : []),
    ...(linkedOrder
      ? [
          {
            label: `Bon de commande émis — ${linkedOrder.order_number}`,
            date: linkedOrder.created_at,
            icon: ShoppingCart,
            color: 'text-blue-500',
          } as TimelineEvent,
        ]
      : []),
  ];

  const isUrgent = requisition.urgency === 'critical' || requisition.urgency === 'high';

  return (
    <Sheet open={!!requisition} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader className="pb-4">
          <SheetTitle className="flex flex-wrap items-center gap-2">
            <FileText className="h-5 w-5 text-primary shrink-0" />
            <span className="font-mono">{requisition.requisition_number}</span>
            <Badge className={cn(requisitionStatusColors[requisition.status], 'text-white text-xs')}>
              {requisitionStatusLabels[requisition.status]}
            </Badge>
            {isUrgent && (
              <Badge className={cn(urgencyColors[requisition.urgency], 'text-white text-xs')}>
                <AlertTriangle className="h-3 w-3 mr-1" />
                {urgencyLabels[requisition.urgency]}
              </Badge>
            )}
          </SheetTitle>
          <p className="text-xs text-muted-foreground">
            Créée le {format(new Date(requisition.created_at), 'dd MMMM yyyy à HH:mm', { locale: fr })}
          </p>
        </SheetHeader>

        <div className="space-y-5 pb-6">
          {/* Identity grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border bg-muted/30 p-3 space-y-1">
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Préparée par</p>
              <p className="font-semibold text-sm text-foreground flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                {requisition.requester_name}
              </p>
              {requisition.department && (
                <p className="text-xs text-muted-foreground pl-5">{requisition.department}</p>
              )}
            </div>
            <div className="rounded-xl border bg-muted/30 p-3 space-y-1">
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Site / Échéance</p>
              <p className="font-semibold text-sm text-foreground flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                {meta.site || 'Non précisé'}
              </p>
              {meta.desiredDate && (
                <p className="text-xs text-muted-foreground flex items-center gap-1 pl-5">
                  <Calendar className="h-3 w-3" />
                  {format(new Date(meta.desiredDate), 'dd MMM yyyy', { locale: fr })}
                </p>
              )}
            </div>
          </div>

          {/* Article */}
          <div className="rounded-xl border p-4 space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Article demandé</p>
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
                <Package className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-foreground">{requisition.material_name}</p>
                <p className="text-sm text-muted-foreground">
                  {requisition.quantity} {requisition.unit}
                  {requisition.estimated_cost != null && (
                    <> · Budget : <strong className="text-foreground">{requisition.estimated_cost.toLocaleString('fr-FR')} TND</strong></>
                  )}
                </p>
              </div>
              {!isUrgent && (
                <Badge className={cn(urgencyColors[requisition.urgency], 'text-white text-xs shrink-0')}>
                  {urgencyLabels[requisition.urgency]}
                </Badge>
              )}
            </div>

            {requisition.preferred_supplier && (
              <div className="flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2 text-sm">
                <span className="text-muted-foreground">Fournisseur suggéré :</span>
                <span className="font-medium">{(requisition.preferred_supplier as any).name}</span>
              </div>
            )}
          </div>

          {/* Justification */}
          {requisition.justification && (
            <div className="space-y-1.5">
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Justification</p>
              <div className="rounded-xl border bg-amber-50/60 p-3 text-sm text-foreground leading-relaxed">
                {requisition.justification}
              </div>
            </div>
          )}

          {/* Rejection */}
          {requisition.status === 'rejected' && requisition.rejection_reason && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 space-y-1">
              <p className="text-[11px] font-bold uppercase tracking-widest text-red-600 flex items-center gap-1.5">
                <XCircle className="h-3.5 w-3.5" />
                Motif du refus
              </p>
              <p className="text-sm text-red-700">{requisition.rejection_reason}</p>
              {requisition.approved_by && (
                <p className="text-xs text-red-500">Par {requisition.approved_by}</p>
              )}
            </div>
          )}

          {/* Approval */}
          {requisition.status === 'approved' && requisition.approved_by && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-emerald-700">
                  Validée par {requisition.approved_by}
                </p>
                {requisition.approved_at && (
                  <p className="text-xs text-emerald-600">
                    {format(new Date(requisition.approved_at), 'dd MMM yyyy à HH:mm', { locale: fr })}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Linked BC */}
          {linkedOrder && (
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 flex items-center gap-3">
              <ShoppingCart className="h-5 w-5 text-blue-500 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-blue-700">
                  BC généré : {linkedOrder.order_number}
                </p>
                <p className="text-xs text-blue-600">
                  {linkedOrder.total_amount.toLocaleString('fr-FR')} TND
                  {(linkedOrder.supplier as any)?.name && ` · ${(linkedOrder.supplier as any).name}`}
                </p>
              </div>
            </div>
          )}

          <Separator />

          {/* Timeline */}
          <div className="space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Historique</p>
            <div className="relative space-y-3 pl-5">
              <div className="absolute left-[7px] top-1 bottom-1 w-px bg-border/60" />
              {timeline.map((event, i) => (
                <div key={i} className="relative flex items-start gap-3">
                  <div className={cn('absolute -left-[13px] flex h-5 w-5 items-center justify-center rounded-full border bg-background', event.color)}>
                    <event.icon className="h-3 w-3" />
                  </div>
                  <div className="pl-2">
                    <p className="text-sm font-medium text-foreground">{event.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(event.date), 'dd MMM yyyy à HH:mm', { locale: fr })}
                      {event.by && ` · par ${event.by}`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Notes */}
          {plainNotes && (
            <div className="space-y-1.5">
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Notes</p>
              <p className="text-sm text-muted-foreground leading-relaxed">{plainNotes}</p>
            </div>
          )}

          {/* CTA */}
          {requisition.status === 'approved' && !linkedOrder && onCreateOrder && canCreateOrder && (
            <Button
              className="w-full"
              onClick={() => { onCreateOrder(requisition); onClose(); }}
            >
              <ShoppingCart className="h-4 w-4 mr-2" />
              Créer un Bon de Commande
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
