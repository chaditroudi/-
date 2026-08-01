import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { settlementsApi, type SupplierSettlement } from '@/lib/api/settlements';
import { toast } from 'sonner';
import { CheckCircle2, Banknote, XCircle, Loader2 } from 'lucide-react';

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Brouillon',
  APPROVED: 'Approuvé',
  PAID: 'Payé',
  CANCELLED: 'Annulé',
};

export function SettlementsPanel() {
  const queryClient = useQueryClient();
  const { data = [], isLoading } = useQuery({
    queryKey: ['supplier-settlements'],
    queryFn: () => settlementsApi.list(),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['supplier-settlements'] });

  const approve = useMutation({
    mutationFn: (id: string) => settlementsApi.approve(id),
    onSuccess: () => { toast.success('Règlement approuvé'); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const pay = useMutation({
    mutationFn: (id: string) => settlementsApi.pay(id),
    onSuccess: () => { toast.success('Règlement marqué payé'); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const cancel = useMutation({
    mutationFn: (id: string) => settlementsApi.cancel(id),
    onSuccess: () => { toast.success('Règlement annulé'); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground p-6">
        <Loader2 className="h-4 w-4 animate-spin" /> Chargement des règlements…
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Règlements fournisseurs (grades triage)</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucun règlement. Ils sont créés automatiquement à la clôture triage, ou via API
            <code className="mx-1 text-xs">POST /api/settlements/from-triage/:sessionId</code>.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>N°</TableHead>
                <TableHead>Fournisseur</TableHead>
                <TableHead>Session</TableHead>
                <TableHead className="text-right">Payable kg</TableHead>
                <TableHead className="text-right">Montant TND</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row: SupplierSettlement) => (
                <TableRow key={row.id}>
                  <TableCell className="font-mono text-xs">{row.settlement_number}</TableCell>
                  <TableCell>{row.supplier_name || row.supplier_id}</TableCell>
                  <TableCell className="text-xs">{row.triage_session_number || '—'}</TableCell>
                  <TableCell className="text-right">{row.payable_weight_kg.toFixed(1)}</TableCell>
                  <TableCell className="text-right font-medium">
                    {row.total_amount_tnd.toLocaleString('fr-FR', { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{STATUS_LABEL[row.status] || row.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    {row.status === 'DRAFT' && (
                      <Button size="sm" variant="outline" onClick={() => approve.mutate(row.id)}>
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Approuver
                      </Button>
                    )}
                    {row.status === 'APPROVED' && (
                      <Button size="sm" variant="outline" onClick={() => pay.mutate(row.id)}>
                        <Banknote className="h-3.5 w-3.5 mr-1" /> Payer
                      </Button>
                    )}
                    {(row.status === 'DRAFT' || row.status === 'APPROVED') && (
                      <Button size="sm" variant="ghost" onClick={() => cancel.mutate(row.id)}>
                        <XCircle className="h-3.5 w-3.5 mr-1" /> Annuler
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
