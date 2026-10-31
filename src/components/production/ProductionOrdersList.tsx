import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ProductionOrderDialog } from './ProductionOrderDialog';
import { ProductionOrder, type ProductionOrderStatus } from '@/types/production';
import { useProductionConfig } from '@/hooks/useProduction';
import { MaterialReception } from '@/types/mes';
import { Plus, Search } from 'lucide-react';
import { format } from 'date-fns';
import { enUS, fr, ar } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { byUrgency, ORDER_STATUS_BADGE } from './orderStatus';

interface ProductionOrdersListProps {
  orders: ProductionOrder[];
  receptions: MaterialReception[];
  onOpenOrder: (orderId: string) => void;
}

const FILTERS: Array<{ value: 'open' | ProductionOrderStatus | 'all'; label: string }> = [
  { value: 'open', label: 'À traiter' },
  { value: 'in_progress', label: 'En cours' },
  { value: 'planned', label: 'Planifiés' },
  { value: 'draft', label: 'Brouillons' },
  { value: 'completed', label: 'Terminés' },
  { value: 'all', label: 'Tous' },
];

export const ProductionOrdersList = ({ orders, receptions, onOpenOrder }: ProductionOrdersListProps) => {
  const { t, i18n } = useTranslation();
  const { fluxCodeLabels, orderStatusLabels } = useProductionConfig();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['value']>('open');
  const [search, setSearch] = useState('');

  const locale = i18n.language === 'ar' ? ar : i18n.language === 'en' ? enUS : fr;

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return orders
      .filter((order) => filter === 'all'
        || (filter === 'open' ? ['draft', 'planned', 'in_progress'].includes(order.status) : order.status === filter))
      .filter((order) => !term || [order.order_number, order.product_name, order.reception_number_snapshot]
        .some((value) => value?.toLowerCase().includes(term)))
      .sort(byUrgency);
  }, [orders, filter, search]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[12rem] flex-1 lg:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input aria-label="Rechercher un ordre" className="pl-9" placeholder="N° d'ordre, produit, réception" value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>
        <div className="flex flex-wrap gap-1">
          {FILTERS.map((item) => (
            <Button key={item.value} type="button" size="sm" variant={filter === item.value ? 'secondary' : 'ghost'} aria-pressed={filter === item.value} onClick={() => setFilter(item.value)}>
              {item.label}
            </Button>
          ))}
        </div>
        <Button type="button" className="ml-auto gap-2" onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4" />
          {t('production.new')}
        </Button>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-lg border bg-card py-10 text-center text-muted-foreground">
          {orders.length === 0 ? 'Aucun ordre de fabrication. Créez le premier pour commencer.' : 'Aucun ordre ne correspond à ce filtre.'}
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('production.orderNumber')}</TableHead>
              <TableHead>{t('production.product')}</TableHead>
              <TableHead className="hidden lg:table-cell">Réception</TableHead>
              <TableHead className="text-right">{t('common.quantity')}</TableHead>
              <TableHead className="hidden sm:table-cell">{t('production.priority')}</TableHead>
              <TableHead>{t('common.status')}</TableHead>
              <TableHead className="hidden md:table-cell">{t('production.creationDate')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((order) => (
              <TableRow key={order.id}>
                <TableCell>
                  <button type="button" className="font-mono text-sm hover:underline" onClick={() => onOpenOrder(order.id)}>{order.order_number}</button>
                </TableCell>
                <TableCell>
                  {order.product_name}
                  {order.flux_code && <span className="block text-xs text-muted-foreground">{order.flux_code} : {fluxCodeLabels[order.flux_code]}</span>}
                </TableCell>
                <TableCell className="hidden lg:table-cell">{order.reception?.reception_number ?? order.reception_number_snapshot ?? '—'}</TableCell>
                <TableCell className="text-right">
                  {order.target_quantity == null ? '—' : `${order.target_quantity} ${order.unit ?? ''}`}
                  {order.actual_quantity > 0 && <span className="block text-xs text-muted-foreground">{order.actual_quantity} produits</span>}
                </TableCell>
                <TableCell className={cn('hidden sm:table-cell', order.priority >= 3 && 'font-semibold text-red-700', order.priority === 2 && 'font-semibold text-amber-800')}>
                  {order.priority >= 3 ? t('production.priorities.urgent') : order.priority === 2 ? t('production.priorities.high') : t('production.priorities.normal')}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={ORDER_STATUS_BADGE[order.status]}>{orderStatusLabels[order.status]}</Badge>
                </TableCell>
                <TableCell className="hidden md:table-cell">{format(new Date(order.created_at), 'dd/MM/yyyy', { locale })}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <ProductionOrderDialog open={showCreateDialog} onOpenChange={setShowCreateDialog} receptions={receptions} />
    </div>
  );
};
