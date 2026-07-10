import { useState } from 'react';
import { useAllPackagingPalettes, usePackagingOrders, usePackagingBOMs, useSealPalette } from '@/hooks/usePackaging';
import { PackagingPalette, PaletteStatus } from '@/types/packaging';
import { printPaletteLabel } from '../printPaletteLabel';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Loader2, ShieldCheck, Printer, Layers } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const STATUS_STYLE: Record<PaletteStatus, string> = {
  EN_COURS: 'bg-slate-100 text-slate-600',
  SCELLE:   'bg-green-100 text-green-700',
  EXPEDIE:  'bg-blue-100 text-blue-700',
};

const STATUS_LABELS: Record<PaletteStatus, string> = {
  EN_COURS: 'En cours',
  SCELLE:   'Scellée',
  EXPEDIE:  'Expédiée',
};

export function PalettePanel({ currentUser = 'Utilisateur' }: { currentUser?: string }) {
  const { data: palettes = [], isLoading } = useAllPackagingPalettes();
  const { data: orders = [] } = usePackagingOrders();
  const { data: boms = [] } = usePackagingBOMs();
  const sealPalette = useSealPalette();

  const [statusFilter, setStatusFilter] = useState<PaletteStatus | 'TOUS'>('TOUS');
  const [sealingPalette, setSealingPalette] = useState<PackagingPalette | null>(null);
  const [sealForm, setSealForm] = useState({ seal_number: '', sealed_by: currentUser });

  const visible = palettes.filter((p) =>
    statusFilter === 'TOUS' ? true : p.status === statusFilter,
  );

  const today = format(new Date(), 'yyyy-MM-dd');
  const todayPalettes = palettes.filter((p) => p.created_at.startsWith(today));
  const sealedToday = palettes.filter((p) => p.status === 'SCELLE' && p.sealed_at?.startsWith(today)).length;

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card><CardContent className="pt-4 pb-3">
          <div className="text-2xl font-bold">{palettes.filter((p) => p.status === 'EN_COURS').length}</div>
          <div className="text-xs text-muted-foreground">En cours</div>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3">
          <div className="text-2xl font-bold">{sealedToday}</div>
          <div className="text-xs text-muted-foreground">Scellées auj.</div>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3">
          <div className="text-2xl font-bold">{todayPalettes.length}</div>
          <div className="text-xs text-muted-foreground">Créées auj.</div>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3">
          <div className="text-2xl font-bold">{palettes.filter((p) => p.status === 'EXPEDIE').length}</div>
          <div className="text-xs text-muted-foreground">Expédiées</div>
        </CardContent></Card>
      </div>

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        {(['TOUS', 'EN_COURS', 'SCELLE', 'EXPEDIE'] as const).map((s) => (
          <Button
            key={s}
            size="sm"
            variant={statusFilter === s ? 'default' : 'outline'}
            className="h-9 text-xs"
            onClick={() => setStatusFilter(s)}
          >
            {s === 'TOUS' ? `Toutes (${palettes.length})` : `${STATUS_LABELS[s as PaletteStatus]} (${palettes.filter((p) => p.status === s).length})`}
          </Button>
        ))}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="text-sm text-muted-foreground py-8 text-center">Chargement…</div>
      ) : visible.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            <Layers className="h-8 w-8 mx-auto mb-2 opacity-30" />
            Aucune palette trouvée.
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-lg border bg-card divide-y">
          {visible.map((pal) => {
            const order = orders.find((o) => o.id === pal.order_id);
            const bom   = boms.find((b) => b.id === pal.bom_id);
            return (
              <div key={pal.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-semibold text-sm">{pal.palette_number}</span>
                    <Badge className={`text-[10px] px-1.5 ${STATUS_STYLE[pal.status]}`}>
                      {STATUS_LABELS[pal.status]}
                    </Badge>
                    {order && (
                      <Badge variant="outline" className="text-[10px] px-1">{order.order_number}</Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5 flex gap-3 flex-wrap">
                    <span>{pal.box_count} boîtes</span>
                    <span>Brut: {pal.gross_weight_kg} kg</span>
                    <span>Net: {pal.net_weight_kg} kg</span>
                    {bom && <span>{bom.name}</span>}
                    <span>{format(new Date(pal.created_at), 'dd/MM HH:mm', { locale: fr })}</span>
                    {pal.sealed_at && (
                      <span>Scellée: {format(new Date(pal.sealed_at), 'dd/MM HH:mm', { locale: fr })}</span>
                    )}
                    {pal.sscc && (
                      <span className="font-mono text-[10px]">SSCC: {pal.sscc}</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  {pal.status === 'EN_COURS' && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-9 px-2 text-xs"
                      onClick={() => {
                        setSealingPalette(pal);
                        setSealForm({ seal_number: '', sealed_by: currentUser });
                      }}
                    >
                      <ShieldCheck className="h-3 w-3 mr-1" />
                      Sceller
                    </Button>
                  )}
                  {pal.status === 'SCELLE' && order && bom && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-9 px-2 text-xs"
                      onClick={() => printPaletteLabel(pal, order, bom)}
                    >
                      <Printer className="h-3 w-3 mr-1" />
                      Étiquette
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Seal dialog */}
      <Dialog open={!!sealingPalette} onOpenChange={(v) => { if (!v) setSealingPalette(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Sceller palette {sealingPalette?.palette_number}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">N° sceau / film étirable *</Label>
              <Input
                value={sealForm.seal_number}
                onChange={(e) => setSealForm((p) => ({ ...p, seal_number: e.target.value }))}
                placeholder="SC-20260608-001"
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Scellé par</Label>
              <Input
                value={sealForm.sealed_by}
                onChange={(e) => setSealForm((p) => ({ ...p, sealed_by: e.target.value }))}
              />
            </div>
            <div className="bg-muted/40 rounded p-2 text-xs text-muted-foreground">
              Un code SSCC GS1-18 sera généré automatiquement.
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSealingPalette(null)}>Annuler</Button>
            <Button
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={async () => {
                if (!sealingPalette) return;
                await sealPalette.mutateAsync({
                  id: sealingPalette.id,
                  order_id: sealingPalette.order_id,
                  palette_number: sealingPalette.palette_number,
                  seal_number: sealForm.seal_number,
                  sealed_by: sealForm.sealed_by,
                  serial_counter: Date.now() % 100_000_000,
                });
                setSealingPalette(null);
              }}
              disabled={sealPalette.isPending || !sealForm.seal_number}
            >
              {sealPalette.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmer scellage
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
