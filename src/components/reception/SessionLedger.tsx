import { useMemo, useState } from 'react';
import { AlertTriangle, Clock3, Eye, Printer, Search, Trash2, Truck } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ReceptionV2, receptionStatusColors, receptionStatusLabels } from '@/types/reception';

interface SessionLedgerProps {
  receptions: ReceptionV2[];
  onView: (reception: ReceptionV2) => void;
  onPrint: (reception: ReceptionV2) => void;
  onDelete: (id: string) => void;
}

export const SessionLedger = ({ receptions, onView, onPrint, onDelete }: SessionLedgerProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReception, setSelectedReception] = useState<ReceptionV2 | null>(null);

  const filteredReceptions = useMemo(() => {
    const search = searchTerm.toLowerCase();
    return receptions.filter((reception) => {
      return (
        reception.reception_number.toLowerCase().includes(search) ||
        reception.supplier?.name?.toLowerCase().includes(search) ||
        reception.vehicle_number?.toLowerCase().includes(search) ||
        reception.delivery_note_number?.toLowerCase().includes(search)
      );
    });
  }, [receptions, searchTerm]);

  const handleView = (reception: ReceptionV2) => {
    setSelectedReception(reception);
    onView(reception);
  };

  return (
    <>
      <Card className="surface-card">
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <CardTitle>Registre reception Royal Palm</CardTitle>
              <CardDescription>
                Camion, pesée, LOT-ID et lancement QC du {format(new Date(), 'dd/MM/yyyy', { locale: fr })}
              </CardDescription>
            </div>
            <div className="relative min-w-[260px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} className="pl-9" placeholder="LOT-ID, fournisseur, BL, véhicule..." />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reception / LOT-ID</TableHead>
                <TableHead>Fournisseur</TableHead>
                <TableHead>Vehicule</TableHead>
                <TableHead>Poids net</TableHead>
                <TableHead>Zone</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredReceptions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <AlertTriangle className="h-8 w-8" />
                      <p>Aucune reception enregistree sur cette plage.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredReceptions.map((reception) => (
                  <TableRow key={reception.id}>
                    <TableCell>
                      <div className="space-y-1">
                        <p className="font-mono font-medium">{reception.reception_number}</p>
                        <p className="text-xs text-muted-foreground">
                          {reception.supplier_code_snapshot || reception.supplier?.code || 'C000'} • {format(new Date(reception.created_at), 'HH:mm', { locale: fr })}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="font-medium">{reception.supplier?.name || reception.supplier_name_snapshot || '-'}</p>
                      <p className="text-xs text-muted-foreground">{reception.origin_oasis || reception.supplier?.oasis_name || '-'}</p>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Truck className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p>{reception.vehicle_number || '-'}</p>
                          <p className="text-xs text-muted-foreground">BL {reception.delivery_note_number || '-'}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="font-semibold">{Number(reception.quantity_total || 0).toLocaleString()} {reception.unit}</p>
                      <p className="text-xs text-muted-foreground">
                        Brut {reception.gross_weight_kg ?? '-'} / Tare {reception.tare_weight_kg ?? '-'}
                      </p>
                    </TableCell>
                    <TableCell>
                      <p>{reception.storage_zone_code || '-'}</p>
                      <p className="text-xs text-muted-foreground">{reception.presentation || '-'}</p>
                    </TableCell>
                    <TableCell>
                      <Badge className={receptionStatusColors[reception.status]}>
                        {receptionStatusLabels[reception.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleView(reception)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => onPrint(reception)}>
                          <Printer className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (confirm(`Supprimer la reception ${reception.reception_number} ?`)) {
                              onDelete(reception.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={Boolean(selectedReception)} onOpenChange={() => setSelectedReception(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedReception?.reception_number}
              {selectedReception && (
                <Badge className={receptionStatusColors[selectedReception.status]}>
                  {receptionStatusLabels[selectedReception.status]}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          {selectedReception && (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl bg-muted/35 p-4">
                  <p className="text-sm text-muted-foreground">LOT-ID preview</p>
                  <p className="mt-1 font-mono">{selectedReception.reception_number}</p>
                </div>
                <div className="rounded-2xl bg-muted/35 p-4">
                  <p className="text-sm text-muted-foreground">Cycle reception</p>
                  <p className="mt-1 flex items-center gap-2 font-medium">
                    <Clock3 className="h-4 w-4 text-primary" />
                    {selectedReception.reception_duration_minutes ?? '-'} min
                  </p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Fournisseur et origine</p>
                  <p className="font-medium">{selectedReception.supplier?.name || selectedReception.supplier_name_snapshot || '-'}</p>
                  <p className="text-sm">{selectedReception.origin_oasis || '-'}</p>
                  <p className="text-sm text-muted-foreground">{selectedReception.origin_gps || '-'}</p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Produit & transport</p>
                  <p className="font-medium">{selectedReception.variety || '-'} • {selectedReception.maturity_stage || '-'}</p>
                  <p className="text-sm">{selectedReception.transport_condition || '-'} • {selectedReception.quick_visual_state || '-'}</p>
                  <p className="text-sm text-muted-foreground">Temp. arrivee {selectedReception.arrival_temperature_c ?? '-'}°C</p>
                </div>
              </div>

              <Separator />

              {selectedReception.phase1_alerts && selectedReception.phase1_alerts.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Alertes phase 1</p>
                  {selectedReception.phase1_alerts.map((alert) => (
                    <div key={alert} className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                      {alert}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
