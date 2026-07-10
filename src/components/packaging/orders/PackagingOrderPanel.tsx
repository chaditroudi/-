import { useState } from 'react';
import { usePackagingOrders, usePackagingKpis, useLabelTemplates } from '@/hooks/usePackaging';
import {
  PackagingOrder,
  PackagingOrderStatus,
  ORDER_STATUS_STYLE,
  PACKAGING_FORMAT_CONFIG,
} from '@/types/packaging';
import { PackagingOrderDialog } from './PackagingOrderDialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Plus, ClipboardList, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export function PackagingOrderPanel({ currentUser = 'Utilisateur' }: { currentUser?: string }) {
  const { data: orders = [], isLoading } = usePackagingOrders();
  const { data: kpis } = usePackagingKpis();
  const { data: labels = [] } = useLabelTemplates();

  const [showCreate, setShowCreate] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<PackagingOrder | null>(null);

  const active = orders.filter((o) => ['EN_COURS', 'PAUSE'].includes(o.status));
  const planned = orders.filter((o) => o.status === 'PLANIFIE');
  const recent = orders.filter((o) => ['TERMINE', 'ANNULE'].includes(o.status)).slice(0, 10);

  return (
    <div className="space-y-4">
      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'En cours',        value: kpis?.active_orders   ?? active.length  },
          { label: 'Planifiés',        value: kpis?.planned_orders  ?? planned.length },
          { label: 'Terminés auj.',   value: kpis?.completed_today ?? 0              },
          { label: 'Produits auj.',   value: (kpis?.total_produced_today ?? 0).toLocaleString('fr-TN') },
          { label: 'Palettes scellées', value: kpis?.palettes_sealed_today ?? 0       },
          { label: 'Rendement moy.',  value: kpis?.avg_yield_pct != null ? `${kpis.avg_yield_pct}%` : '—' },
        ].map(({ label, value }) => (
          <Card key={label}>
            <CardContent className="pt-4 pb-3">
              <div className="text-2xl font-bold">{value}</div>
              <div className="text-xs text-muted-foreground">{label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Active + Planned orders */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">
              Ordres actifs + planifiés ({active.length + planned.length})
            </CardTitle>
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4 mr-1.5" />
              Nouvel OF
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-6 gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Chargement…
            </div>
          ) : active.length + planned.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-6">
              <ClipboardList className="h-6 w-6 mx-auto mb-2 opacity-30" />
              Aucun ordre actif ou planifié.
            </div>
          ) : (
            <div className="divide-y">
              {[...active, ...planned].map((order) => {
                const pct = order.target_units > 0
                  ? Math.min(100, Math.round((order.produced_units / order.target_units) * 100))
                  : 0;
                const lbl = labels.find((l) => l.id === order.label_template_id);
                return (
                  <div key={order.id} className="py-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-sm font-semibold">{order.order_number}</span>
                          <Badge className={`text-xs ${ORDER_STATUS_STYLE[order.status]}`}>
                            {order.status.replace('_', ' ')}
                          </Badge>
                          <Badge variant="outline" className="text-xs">{order.line}</Badge>
                          {lbl && lbl.status !== 'VALIDE' && (
                            <Badge className="text-[10px] bg-amber-100 text-amber-700">Étiq. non validée</Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5 flex gap-3 flex-wrap">
                          <span>{order.bom_name}</span>
                          <span>Lot: {order.source_lot_number}</span>
                          <span>{PACKAGING_FORMAT_CONFIG[order.bom_format].label}</span>
                          <span>{order.operator_name}</span>
                          {order.planned_at && (
                            <span>Prévu: {format(new Date(order.planned_at), 'dd/MM HH:mm', { locale: fr })}</span>
                          )}
                        </div>
                      </div>
                      <Button size="sm" variant="outline" className="h-9 px-3 text-xs shrink-0" onClick={() => setSelectedOrder(order)}>
                        Gérer
                      </Button>
                    </div>
                    {order.status !== 'PLANIFIE' && (
                      <div className="space-y-1">
                        <Progress value={pct} className="h-2" />
                        <div className="text-xs text-muted-foreground">
                          {order.produced_units} / {order.target_units} unités · {pct}%
                          {order.metal_detector_failures > 0 && (
                            <span className="text-red-600 font-semibold ml-2">
                              ⚠ Métal x{order.metal_detector_failures}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* History */}
      {recent.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Historique récent</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {recent.map((order) => {
                const yieldPct = order.target_units > 0
                  ? Math.round((order.produced_units / order.target_units) * 100)
                  : null;
                return (
                  <div key={order.id} className="py-2.5 flex items-center gap-3 text-sm">
                    <span className="font-mono text-xs text-muted-foreground">{order.order_number}</span>
                    <Badge className={`text-xs ${ORDER_STATUS_STYLE[order.status]}`}>
                      {order.status === 'TERMINE' ? 'Terminé' : order.status}
                    </Badge>
                    <span className="text-muted-foreground text-xs truncate max-w-36">{order.bom_name}</span>
                    {yieldPct != null && (
                      <span className={`text-xs ml-auto ${yieldPct < 95 ? 'text-amber-600 font-semibold' : 'text-green-600'}`}>
                        {order.produced_units.toLocaleString('fr-TN')} un. · {yieldPct}%
                      </span>
                    )}
                    {order.duration_minutes != null && (
                      <span className="text-xs text-muted-foreground">{order.duration_minutes} min</span>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dialogs */}
      <PackagingOrderDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        currentUser={currentUser}
      />
      {selectedOrder && (
        <PackagingOrderDialog
          open={!!selectedOrder}
          onOpenChange={(v) => { if (!v) setSelectedOrder(null); }}
          order={selectedOrder}
          currentUser={currentUser}
        />
      )}
    </div>
  );
}
