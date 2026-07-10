import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ProductionOrderDialog } from './ProductionOrderDialog';
import { ProductionOrderDetail } from './ProductionOrderDetail';
import { ProductionOrder } from '@/types/production';
import { useProductionConfig } from '@/hooks/useProduction';
import { MaterialReception } from '@/types/mes';
import { Plus, Eye, Calendar, Package } from 'lucide-react';
import { format } from 'date-fns';
import { enUS, fr, ar } from 'date-fns/locale';

interface ProductionOrdersListProps {
  orders: ProductionOrder[];
  receptions: MaterialReception[];
}

export const ProductionOrdersList = ({ orders, receptions }: ProductionOrdersListProps) => {
  const { t, i18n } = useTranslation();
  const { fluxCodeLabels, fluxCodeColors, orderStatusLabels, orderStatusColors } = useProductionConfig();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const getLocale = () => {
    switch (i18n.language) {
      case 'ar': return ar;
      case 'en': return enUS;
      default: return fr;
    }
  };

  const priorityLabels: Record<number, string> = {
    1: t('production.priorities.normal'),
    2: t('production.priorities.high'),
    3: t('production.priorities.urgent')
  };

  const priorityColors: Record<number, string> = {
    1: 'bg-gray-100 text-gray-800',
    2: 'bg-orange-100 text-orange-800',
    3: 'bg-red-100 text-red-800'
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            {t('production.manufacturingOrders')}
          </CardTitle>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 me-2" />
            {t('production.new')}
          </Button>
        </CardHeader>
        <CardContent>
          {orders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>{t('production.noOrders')}</p>
              <p className="text-sm">{t('production.createFirst')}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('production.orderNumber')}</TableHead>
                  <TableHead className="hidden sm:table-cell">Flux</TableHead>
                  <TableHead>{t('production.product')}</TableHead>
                  <TableHead>{t('common.quantity')}</TableHead>
                  <TableHead>{t('production.priority')}</TableHead>
                  <TableHead>{t('common.status')}</TableHead>
                  <TableHead>{t('production.creationDate')}</TableHead>
                  <TableHead>{t('common.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <TableRow key={order.id} className="cursor-pointer hover:bg-muted/50">
                    <TableCell className="font-mono font-medium">{order.order_number}</TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {order.flux_code ? (
                        <Badge
                          className="rounded-md px-2 py-0.5 text-xs font-bold text-white"
                          style={{ backgroundColor: fluxCodeColors[order.flux_code!] }}
                        >
                          {order.flux_code}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{order.product_name}</p>
                        {order.flux_code && (
                          <p className="text-xs text-muted-foreground">
                            {fluxCodeLabels[order.flux_code!]}
                          </p>
                        )}
                        {(order.reception || order.reception_number_snapshot) && (
                          <p className="text-xs text-muted-foreground">
                            {t('nav.receptions')}:{' '}
                            {order.reception?.reception_number ?? order.reception_number_snapshot}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <span className="font-medium">{order.target_quantity}</span>
                        <span className="text-muted-foreground">{order.unit}</span>
                        {order.actual_quantity > 0 && (
                          <span className="text-xs text-green-600 ms-2">
                            ({order.actual_quantity} {t('production.actual')})
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={priorityColors[order.priority]}>
                        {priorityLabels[order.priority]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={`${orderStatusColors[order.status]} text-white`}>
                        {orderStatusLabels[order.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(order.created_at), 'dd MMM yyyy', { locale: getLocale() })}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => setSelectedOrderId(order.id)}>
                        <Eye className="h-4 w-4 me-1" />
                        {t('common.details')}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <ProductionOrderDialog open={showCreateDialog} onOpenChange={setShowCreateDialog} receptions={receptions} />
      {selectedOrderId && (
        <ProductionOrderDetail open={!!selectedOrderId} onOpenChange={(open) => !open && setSelectedOrderId(null)} orderId={selectedOrderId} />
      )}
    </>
  );
};