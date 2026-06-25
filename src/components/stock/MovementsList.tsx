import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useStockMovements } from '@/hooks/useStock';
import { 
  movementTypeLabels, 
  movementTypeColors,
  lossReasonLabels,
  StockMovementType
} from '@/types/stock';
import { 
  ArrowRightLeft, 
  Search,
  Download,
  ArrowRight,
  Calendar
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export const MovementsList = () => {
  const [typeFilter, setTypeFilter] = useState<StockMovementType | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const { data: movements = [], isLoading } = useStockMovements({
    type: typeFilter === 'all' ? undefined : typeFilter
  });

  const filteredMovements = movements.filter(m => 
    m.movement_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (m.lot as any)?.lot_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (m.product as any)?.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const exportToCSV = () => {
    const headers = ['N° Mouvement', 'Date', 'Type', 'N° Lot', 'Produit', 'Quantité', 'Source', 'Destination', 'Opérateur'];
    const rows = filteredMovements.map(m => [
      m.movement_number,
      format(new Date(m.movement_date), 'dd/MM/yyyy HH:mm'),
      movementTypeLabels[m.movement_type],
      (m.lot as any)?.lot_number || '',
      (m.product as any)?.name || '',
      `${m.quantity} ${m.unit}`,
      (m.source_location as any)?.code || '',
      (m.destination_location as any)?.code || '',
      m.performed_by
    ]);
    
    const csv = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `mouvements_stock_${format(new Date(), 'yyyyMMdd')}.csv`;
    link.click();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <ArrowRightLeft className="h-5 w-5" />
          Journal des Mouvements
        </CardTitle>
        <Button variant="outline" onClick={exportToCSV}>
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </CardHeader>
      <CardContent>
        {/* Filtres */}
        <div className="flex gap-4 mb-4 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par n° mouvement, lot, produit..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Select 
            value={typeFilter} 
            onValueChange={(v) => setTypeFilter(v as StockMovementType | 'all')}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous types</SelectItem>
              <SelectItem value="RECEPTION">Réception</SelectItem>
              <SelectItem value="TRANSFERT">Transfert</SelectItem>
              <SelectItem value="CONSOMMATION">Consommation</SelectItem>
              <SelectItem value="EXPEDITION">Expédition</SelectItem>
              <SelectItem value="PERTE">Perte</SelectItem>
              <SelectItem value="AJUSTEMENT">Ajustement</SelectItem>
              <SelectItem value="RETOUR">Retour</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">
            Chargement...
          </div>
        ) : filteredMovements.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <ArrowRightLeft className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>Aucun mouvement trouvé</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>N° Mouvement</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Lot / Produit</TableHead>
                <TableHead>Quantité</TableHead>
                <TableHead>Emplacements</TableHead>
                <TableHead>Opérateur</TableHead>
                <TableHead>Référence</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMovements.map((movement) => {
                const lot = movement.lot as any;
                const product = movement.product as any;
                const srcLoc = movement.source_location as any;
                const destLoc = movement.destination_location as any;
                
                return (
                  <TableRow key={movement.id}>
                    <TableCell className="font-mono text-sm">
                      {movement.movement_number}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(movement.movement_date), 'dd/MM/yy HH:mm', { locale: fr })}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={`${movementTypeColors[movement.movement_type]} text-white`}>
                        {movementTypeLabels[movement.movement_type]}
                      </Badge>
                      {movement.loss_reason && (
                        <p className="text-xs text-red-600 mt-1">
                          {lossReasonLabels[movement.loss_reason]}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-mono text-sm">{lot?.lot_number || '-'}</p>
                        <p className="text-xs text-muted-foreground">{product?.name}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">{movement.quantity.toLocaleString('fr-FR')}</span>
                      <span className="text-muted-foreground text-xs ml-1">{movement.unit}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <span className="font-mono">{srcLoc?.code || '-'}</span>
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        <span className="font-mono">{destLoc?.code || '-'}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {movement.performed_by}
                    </TableCell>
                    <TableCell>
                      {movement.document_reference && (
                        <div className="text-xs">
                          <p className="text-muted-foreground">{movement.document_type}</p>
                          <p className="font-mono">{movement.document_reference}</p>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};
