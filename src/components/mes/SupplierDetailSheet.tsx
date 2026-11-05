import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Archive,
  CheckCircle,
  Edit2,
  MapPin,
  ShieldBan,
  ShoppingCart,
  Truck,
  CreditCard,
} from 'lucide-react';
import type { Supplier } from '@/types/mes';
import {
  getSupplierStatusClassName,
  getSupplierStatusLabel,
  normalizeSupplierStatus,
} from '@/lib/royalPalmPhase1';
import { toast } from 'sonner';
import {
  useApproveSupplier,
  useArchiveSupplier,
  useBlockSupplier,
  useUpdateSupplier,
  useSupplierLots,
  useSupplierOrders,
  useSupplierPayments,
} from '@/hooks/useSuppliers';
import { SupplierScorePanel } from './SupplierScorePanel';

type SupplierLotRow = { id: string; reception_number?: string; variety?: string; quantity_total?: number; status?: string };
type PurchaseOrderRow = { id: string; order_number?: string; order_date?: string; total_amount_tnd?: number; status?: string };
type PaymentRow = { id: string; reference?: string; payment_date?: string; amount_tnd?: number };

interface Props {
  supplier: Supplier | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (supplier: Supplier) => void;
}

function Field({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value ?? '—'}</p>
    </div>
  );
}

const RelatedList = ({
  title,
  icon,
  empty,
  rows,
}: {
  title: string;
  icon: React.ReactNode;
  empty: string;
  rows: Array<{ id: string; primary: string; secondary?: string }>;
}) => (
  <section className="space-y-2">
    <div className="flex items-center gap-2 text-sm font-semibold">
      {icon}
      {title}
    </div>
    {rows.length === 0 ? (
      <p className="text-xs text-muted-foreground">{empty}</p>
    ) : (
      <ul className="space-y-1.5">
        {rows.slice(0, 5).map((row) => (
          <li key={row.id} className="rounded-md border px-2.5 py-1.5 text-sm">
            <span className="font-medium">{row.primary}</span>
            {row.secondary && <span className="ml-2 text-xs text-muted-foreground">{row.secondary}</span>}
          </li>
        ))}
      </ul>
    )}
  </section>
);

export const SupplierDetailSheet = ({ supplier, open, onOpenChange, onEdit }: Props) => {
  const approveMutation = useApproveSupplier();
  const blockMutation = useBlockSupplier();
  const archiveMutation = useArchiveSupplier();
  const updateSupplier = useUpdateSupplier();
  const { data: lots = [] } = useSupplierLots(supplier?.id || '');
  const { data: orders = [] } = useSupplierOrders(supplier?.id || '');
  const { data: payments = [] } = useSupplierPayments(supplier?.id || '');

  if (!supplier) return null;

  const status = normalizeSupplierStatus(supplier);

  const undoStatusChange = () =>
    updateSupplier.mutateAsync({
      id: supplier.id,
      supplier_status: status,
      is_active: supplier.is_active,
    } as Partial<Supplier> & { id: string });

  const handleApprove = async () => {
    await approveMutation.mutateAsync(supplier.id);
    onOpenChange(false);
  };

  const handleBlock = async () => {
    await blockMutation.mutateAsync(supplier.id);
    onOpenChange(false);
    toast(`${supplier.name} bloqué`, { action: { label: 'Annuler', onClick: undoStatusChange } });
  };

  const handleArchive = async () => {
    await archiveMutation.mutateAsync(supplier.id);
    onOpenChange(false);
    toast(`${supplier.name} archivé`, { action: { label: 'Annuler', onClick: undoStatusChange } });
  };

  const lotRows = (lots as SupplierLotRow[]).map((lot) => ({
    id: lot.id,
    primary: lot.reception_number || lot.id,
    secondary: [lot.variety, lot.status, lot.quantity_total != null ? `${lot.quantity_total} kg` : null]
      .filter(Boolean)
      .join(' · '),
  }));

  const orderRows = (orders as PurchaseOrderRow[]).map((order) => ({
    id: order.id,
    primary: order.order_number || order.id,
    secondary: [order.order_date, order.status, order.total_amount_tnd != null ? `${order.total_amount_tnd} TND` : null]
      .filter(Boolean)
      .join(' · '),
  }));

  const paymentRows = (payments as PaymentRow[]).map((payment) => ({
    id: payment.id,
    primary: payment.reference || payment.id,
    secondary: [payment.payment_date, payment.amount_tnd != null ? `${payment.amount_tnd} TND` : null]
      .filter(Boolean)
      .join(' · '),
  }));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader className="space-y-3 text-start">
          <div className="flex items-start justify-between gap-3">
            <div>
              <SheetTitle className="text-xl">{supplier.name}</SheetTitle>
              <p className="font-mono text-xs text-muted-foreground">{supplier.code}</p>
            </div>
            <Badge variant="outline" className={getSupplierStatusClassName(status)}>
              {getSupplierStatusLabel(status)}
            </Badge>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => onEdit(supplier)}>
              <Edit2 className="mr-1.5 h-3.5 w-3.5" />
              Modifier
            </Button>
            {status !== 'active' && (
              <Button size="sm" onClick={handleApprove} disabled={approveMutation.isPending}>
                <CheckCircle className="mr-1.5 h-3.5 w-3.5" />
                Approuver
              </Button>
            )}
            {status !== 'blocked' && (
              <Button size="sm" variant="destructive" onClick={handleBlock} disabled={blockMutation.isPending}>
                <ShieldBan className="mr-1.5 h-3.5 w-3.5" />
                Bloquer
              </Button>
            )}
            {status !== 'archived' && (
              <Button size="sm" variant="secondary" onClick={handleArchive} disabled={archiveMutation.isPending}>
                <Archive className="mr-1.5 h-3.5 w-3.5" />
                Archiver
              </Button>
            )}
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <section className="grid grid-cols-2 gap-3">
            <Field label="Type" value={supplier.actor_type} />
            <Field label="Région" value={supplier.region} />
            <Field label="Contact" value={supplier.contact_name || supplier.phone} />
            <Field label="Email" value={supplier.email} />
            <Field label="CIN / Matricule" value={supplier.fiscal_identifier || supplier.id_document_number} />
            <Field label="Oasis" value={supplier.oasis_name || supplier.locality} />
          </section>

          {(supplier.oasis_name || supplier.locality || supplier.region) && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" />
              {[supplier.oasis_name, supplier.locality, supplier.region].filter(Boolean).join(' · ')}
            </p>
          )}

          <Separator />

          <SupplierScorePanel supplier={supplier} />

          <Separator />

          <RelatedList
            title="Réceptions / lots"
            icon={<Truck className="h-4 w-4" />}
            empty="Aucune réception liée."
            rows={lotRows}
          />
          <RelatedList
            title="Commandes"
            icon={<ShoppingCart className="h-4 w-4" />}
            empty="Aucune commande."
            rows={orderRows}
          />
          <RelatedList
            title="Paiements"
            icon={<CreditCard className="h-4 w-4" />}
            empty="Aucun paiement."
            rows={paymentRows}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
};
