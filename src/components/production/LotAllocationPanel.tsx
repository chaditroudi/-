import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, Leaf, PackageCheck, Plus, ShieldAlert, Trash2 } from 'lucide-react';
import {
  useAllocateLotToOrder,
  useLiberedLots,
  useOrderLotAllocations,
  useRemoveLotAllocation,
} from '@/hooks/useProduction';
import { LiberedLot } from '@/types/production';

interface LotAllocationPanelProps {
  orderId: string;
  targetQuantity: number;
  targetUnit: string;
  orderStatus: string;
}

export const LotAllocationPanel = ({
  orderId,
  targetQuantity,
  targetUnit,
  orderStatus,
}: LotAllocationPanelProps) => {
  const { data: allocations = [], isLoading: allocLoading } = useOrderLotAllocations(orderId);
  const { data: liberedLots = [] } = useLiberedLots();

  const allocate = useAllocateLotToOrder();
  const removeAlloc = useRemoveLotAllocation();

  const [addOpen, setAddOpen] = useState(false);
  const [selectedLotId, setSelectedLotId] = useState('');
  const [qty, setQty] = useState('');

  const isReadOnly = orderStatus === 'completed' || orderStatus === 'cancelled';

  // Already-allocated lot IDs — exclude from dropdown
  const allocatedIds = new Set(allocations.map((a) => a.reception_lot_id));

  // Available lots not yet allocated
  const available = liberedLots.filter((l) => !allocatedIds.has(l.id));

  const selectedLot: LiberedLot | undefined = liberedLots.find((l) => l.id === selectedLotId);

  const totalAllocated = allocations.reduce((sum, a) => sum + a.allocated_quantity, 0);
  const allocPct = targetQuantity > 0 ? Math.min(100, Math.round((totalAllocated / targetQuantity) * 100)) : 0;

  // Warn if allocations mix bio and conventional lots
  const bioFlags = allocations.map((a) => a.lot?.bio_declared ?? null).filter((v) => v !== null);
  const mixedBio = bioFlags.length > 1 && new Set(bioFlags).size > 1;

  const handleAdd = () => {
    if (!selectedLot || !qty || parseFloat(qty) <= 0) return;
    allocate.mutate(
      {
        production_order_id: orderId,
        reception_lot_id: selectedLot.id,
        allocated_quantity: parseFloat(qty),
        unit: selectedLot.unit,
        lot_snapshot: {
          lot_internal: selectedLot.lot_internal,
          lot_supplier: selectedLot.lot_supplier,
          quantity: selectedLot.quantity,
          bio_declared: selectedLot.bio_declared,
          variety: selectedLot.variety,
          reception_number: selectedLot.reception_number,
          supplier_name: selectedLot.supplier_name,
        },
      },
      {
        onSuccess: () => {
          setSelectedLotId('');
          setQty('');
          setAddOpen(false);
        },
      },
    );
  };

  return (
    <div className="space-y-3">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <PackageCheck className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">Lots MP alloués</span>
          <Badge variant="outline" className="rounded-full px-2 py-0.5 text-xs">
            {allocations.length}
          </Badge>
        </div>
        {!isReadOnly && (
          <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={() => setAddOpen((v) => !v)}>
            <Plus className="h-3.5 w-3.5" />
            Ajouter un lot
          </Button>
        )}
      </div>

      {/* RG-M5 gate banner — shown when order is planned but has no allocations */}
      {orderStatus === 'planned' && allocations.length === 0 && !allocLoading && (
        <div className="flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
          <span>
            <strong>RG-M5</strong> — Aucun lot libéré alloué. Allouez au moins un lot MP avant de lancer la production.
          </span>
        </div>
      )}

      {/* Mixed bio warning */}
      {mixedBio && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <span>Mélange de lots BIO et conventionnels détecté — vérifiez la conformité de l'ordre.</span>
        </div>
      )}

      {/* Add-lot inline form */}
      {addOpen && !isReadOnly && (
        <Card className="border-dashed">
          <CardContent className="p-4 space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Lot libéré *</Label>
              <Select value={selectedLotId} onValueChange={setSelectedLotId}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Sélectionner un lot" />
                </SelectTrigger>
                <SelectContent>
                  {available.length === 0 && (
                    <SelectItem value="__none__" disabled>Aucun lot libéré disponible</SelectItem>
                  )}
                  {available.map((lot) => (
                    <SelectItem key={lot.id} value={lot.id}>
                      <span className="flex items-center gap-2">
                        {lot.bio_declared && <Leaf className="h-3 w-3 text-emerald-600" />}
                        <span className="font-mono">{lot.lot_internal ?? lot.lot_supplier}</span>
                        {lot.reception_number && (
                          <span className="text-muted-foreground text-xs">· {lot.reception_number}</span>
                        )}
                        <span className="text-muted-foreground text-xs">· {lot.quantity} {lot.unit}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedLot && (
              <div className="rounded bg-muted/40 px-2.5 py-1.5 text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
                {selectedLot.supplier_name && <span>Fournisseur: <strong>{selectedLot.supplier_name}</strong></span>}
                {selectedLot.variety && <span>Variété: <strong>{selectedLot.variety}</strong></span>}
                <span>Stock disponible: <strong>{selectedLot.quantity} {selectedLot.unit}</strong></span>
                {selectedLot.bio_declared && (
                  <Badge className="gap-1 bg-emerald-600 text-white text-xs py-0"><Leaf className="h-2.5 w-2.5" />BIO</Badge>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs">Quantité allouée *</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  max={selectedLot?.quantity}
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  className="h-8 text-sm"
                  placeholder="0.00"
                />
                <span className="flex items-center text-sm text-muted-foreground pr-1">
                  {selectedLot?.unit ?? targetUnit}
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setAddOpen(false); setSelectedLotId(''); setQty(''); }}>
                Annuler
              </Button>
              <Button
                size="sm"
                className="h-7 text-xs"
                onClick={handleAdd}
                disabled={!selectedLotId || !qty || parseFloat(qty) <= 0 || allocate.isPending}
              >
                {allocate.isPending ? 'Allocation...' : 'Allouer'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Allocated lots list */}
      {allocations.length > 0 ? (
        <div className="space-y-2">
          {allocations.map((alloc) => (
            <div
              key={alloc.id}
              className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2.5"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {alloc.lot?.bio_declared && <Leaf className="h-3.5 w-3.5 shrink-0 text-emerald-600" />}
                <div className="min-w-0">
                  <p className="font-mono text-sm font-medium truncate">
                    {alloc.lot?.lot_internal ?? alloc.lot?.lot_supplier ?? alloc.reception_lot_id}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {alloc.lot?.reception_number && `${alloc.lot.reception_number} · `}
                    {alloc.lot?.supplier_name && `${alloc.lot.supplier_name} · `}
                    {alloc.lot?.variety && `${alloc.lot.variety}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-sm font-semibold">{alloc.allocated_quantity} {alloc.unit}</span>
                {!isReadOnly && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 text-muted-foreground hover:text-destructive"
                    onClick={() => removeAlloc.mutate({ allocationId: alloc.id, production_order_id: orderId })}
                    disabled={removeAlloc.isPending}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        !allocLoading && (
          <p className="text-sm text-muted-foreground py-2">Aucun lot alloué.</p>
        )
      )}

      {/* Allocated vs target progress */}
      {allocations.length > 0 && (
        <div className="rounded-lg border border-border bg-muted/20 px-3 py-2.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
            <span>Alloué vs cible</span>
            <span className="font-semibold text-foreground">
              {totalAllocated} / {targetQuantity} {targetUnit} ({allocPct}%)
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${allocPct >= 100 ? 'bg-emerald-500' : 'bg-blue-500'}`}
              style={{ width: `${allocPct}%` }}
            />
          </div>
          {allocPct < 100 && (
            <p className="mt-1 text-xs text-muted-foreground">
              Manque: {(targetQuantity - totalAllocated).toFixed(2)} {targetUnit}
            </p>
          )}
        </div>
      )}
    </div>
  );
};
