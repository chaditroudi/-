import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowRight, BoxSelect, Leaf, Package, Plus } from 'lucide-react';
import { useOutputLots, useOrderLotAllocations, useRecordOutputLot } from '@/hooks/useProduction';
import { LotAllocation } from '@/types/production';

interface OutputLotPanelProps {
  orderId: string;
  orderNumber: string;
  targetUnit: string;
  orderStatus: string;
  actorName?: string;
}

export const OutputLotPanel = ({
  orderId,
  orderNumber,
  targetUnit,
  orderStatus,
  actorName,
}: OutputLotPanelProps) => {
  const { data: outputLots = [] } = useOutputLots(orderId);
  const { data: allocations = [] } = useOrderLotAllocations(orderId);
  const recordOutput = useRecordOutputLot();

  const [addOpen, setAddOpen] = useState(false);
  const [qty, setQty] = useState('');
  const [variety, setVariety] = useState('');

  const isReadOnly = orderStatus === 'cancelled';
  const canRecord = orderStatus === 'in_progress' || orderStatus === 'completed';

  // Infer bio from allocations (majority vote; warn if mixed)
  const bioFlags = allocations.map((a) => a.lot?.bio_declared ?? null).filter((v) => v !== null) as boolean[];
  const isBio = bioFlags.length > 0 ? bioFlags.filter(Boolean).length > bioFlags.length / 2 : null;
  const mixedBio = bioFlags.length > 1 && new Set(bioFlags).size > 1;

  const handleRecord = () => {
    if (!qty || parseFloat(qty) <= 0) return;
    recordOutput.mutate(
      {
        production_order_id: orderId,
        order_number: orderNumber,
        quantity: parseFloat(qty),
        unit: targetUnit,
        variety: variety || null,
        bio_declared: isBio,
        recorded_by: actorName ?? null,
        allocations,
      },
      {
        onSuccess: () => {
          setQty('');
          setVariety('');
          setAddOpen(false);
        },
      },
    );
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BoxSelect className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">Lots PF produits</span>
          <Badge variant="outline" className="rounded-full px-2 py-0.5 text-xs">
            {outputLots.length}
          </Badge>
        </div>
        {canRecord && !isReadOnly && (
          <Button size="sm" variant="outline" className="h-9 gap-1.5 text-xs" onClick={() => setAddOpen((v) => !v)}>
            <Plus className="h-3.5 w-3.5" />
            Enregistrer un lot PF
          </Button>
        )}
      </div>

      {/* Record form */}
      {addOpen && canRecord && (
        <Card className="border-dashed">
          <CardContent className="p-4 space-y-3">
            {mixedBio && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
                Attention — les lots MP alloués mélangent BIO et conventionnel. Vérifiez la certification du lot PF.
              </p>
            )}
            {isBio !== null && !mixedBio && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                {isBio
                  ? <><Leaf className="h-3 w-3 text-emerald-600" /><span className="text-emerald-700 font-medium">Lot PF BIO hérité des lots MP</span></>
                  : <span>Lot PF conventionnel hérité des lots MP</span>
                }
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Quantité produite *</Label>
                <div className="flex gap-1.5">
                  <Input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                    className="h-8 text-sm"
                    placeholder="0.00"
                  />
                  <span className="flex items-center text-xs text-muted-foreground">{targetUnit}</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Variété</Label>
                <Input
                  value={variety}
                  onChange={(e) => setVariety(e.target.value)}
                  className="h-8 text-sm"
                  placeholder="ex: Deglet Nour"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" className="h-9 text-xs" onClick={() => { setAddOpen(false); setQty(''); setVariety(''); }}>
                Annuler
              </Button>
              <Button
                size="sm"
                className="h-9 text-xs"
                onClick={handleRecord}
                disabled={!qty || parseFloat(qty) <= 0 || recordOutput.isPending}
              >
                {recordOutput.isPending ? 'Enregistrement...' : 'Enregistrer'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Genealogy tree */}
      {outputLots.length > 0 && allocations.length > 0 && (
        <div className="space-y-4">
          {outputLots.map((out) => (
            <GenealogyRow key={out.id} outputLot={out} allocations={allocations} />
          ))}
        </div>
      )}

      {outputLots.length === 0 && canRecord && (
        <p className="text-sm text-muted-foreground py-1">Aucun lot PF enregistré.</p>
      )}
    </div>
  );
};

function GenealogyRow({
  outputLot,
  allocations,
}: {
  outputLot: import('@/types/production').ProductionOutputLot;
  allocations: LotAllocation[];
}) {
  const parents = outputLot.parent_lots_snapshot ?? [];

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
        Généalogie — {outputLot.lot_pf_number}
      </p>
      <div className="flex items-start gap-3 flex-wrap">
        {/* Input MP lots */}
        <div className="space-y-1.5 min-w-0">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Lots MP (entrée)</p>
          {parents.map((p) => (
            <div key={p.reception_lot_id} className="rounded-lg border border-border bg-muted/30 px-2.5 py-2 text-xs">
              <p className="font-mono font-semibold">{p.lot_internal ?? p.lot_supplier}</p>
              {p.reception_number && <p className="text-muted-foreground">{p.reception_number}</p>}
              <p className="text-muted-foreground">{p.allocated_quantity} {p.unit}</p>
            </div>
          ))}
        </div>

        {/* Arrow */}
        <div className="flex items-center self-center mt-5">
          <ArrowRight className="h-5 w-5 text-muted-foreground" />
        </div>

        {/* Production order (OF) node */}
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">OF</p>
          <div className="rounded-lg border border-primary/30 bg-primary/5 px-2.5 py-2 text-xs">
            <p className="font-mono font-semibold text-primary">
              {outputLot.lot_pf_number.replace(/^PF-/, '').replace(/-\d{3}$/, '')}
            </p>
            <p className="text-muted-foreground">
              {allocations.reduce((s, a) => s + a.allocated_quantity, 0).toFixed(2)} {allocations[0]?.unit ?? ''}
            </p>
          </div>
        </div>

        {/* Arrow */}
        <div className="flex items-center self-center mt-5">
          <ArrowRight className="h-5 w-5 text-muted-foreground" />
        </div>

        {/* Output PF lot */}
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">Lot PF (sortie)</p>
          <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-2 text-xs">
            <div className="flex items-center gap-1.5 mb-0.5">
              <Package className="h-3 w-3 text-emerald-700" />
              <p className="font-mono font-semibold text-emerald-900">{outputLot.lot_pf_number}</p>
              {outputLot.bio_declared && <Leaf className="h-3 w-3 text-emerald-600" />}
            </div>
            <p className="text-emerald-700">{outputLot.quantity} {outputLot.unit}</p>
            {outputLot.variety && <p className="text-muted-foreground">{outputLot.variety}</p>}
            <p className="text-muted-foreground mt-0.5">
              {new Date(outputLot.recorded_at).toLocaleDateString('fr-FR')}
              {outputLot.recorded_by ? ` · ${outputLot.recorded_by}` : ''}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
