import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useStockLots } from '@/hooks/useStock';
import { StockLotDialog } from './StockLotDialog';
import { StockLotQCDialog } from './StockLotQCDialog';
import { TransferDialog } from './TransferDialog';
import { StockLotBlockDialog } from './StockLotBlockDialog';
import { 
  lotStatusLabels, 
  lotStatusColors, 
  productCategoryLabels,
  ProductCategory,
  LotStatus,
  StockLot
} from '@/types/stock';
import { 
  Plus, 
  Search, 
  Scale, 
  CheckCircle, 
  ArrowRightLeft,
  Lock,
  LockOpen,
  Calendar,
  AlertTriangle
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { fr } from 'date-fns/locale';

export const StockLotsList = () => {
  const [categoryFilter, setCategoryFilter] = useState<ProductCategory | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<LotStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedLotForTransfer, setSelectedLotForTransfer] = useState<StockLot | null>(null);
  const [lotToValidate, setLotToValidate] = useState<StockLot | null>(null);
  const [lotToBlock, setLotToBlock] = useState<StockLot | null>(null);
  const [lotToRelease, setLotToRelease] = useState<StockLot | null>(null);

  const { data: lots = [], isLoading } = useStockLots({
    status: statusFilter === 'all' ? undefined : statusFilter,
    category: categoryFilter === 'all' ? undefined : categoryFilter
  });

  const filteredLots = lots.filter(lot => 
    lot.lot_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (lot.source_lot_internal || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (lot.product as any)?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (lot.supplier as any)?.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getDaysUntilExpiry = (lot: StockLot) => {
    const expiryDate = lot.dlc_date || lot.dluo_date;
    if (!expiryDate) return null;
    return differenceInDays(new Date(expiryDate), new Date());
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5" />
            Lots de stock
          </CardTitle>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nouveau lot de stock
          </Button>
        </CardHeader>
        <CardContent>
          <div className="mb-4 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
            <p className="font-medium">Repère métier Royal Palm</p>
            <p className="mt-1">
              Cette page affiche les <strong>lots de stock</strong>: des lots déjà localisés et suivis par le magasin.
              Les <strong>lots d'entrée</strong> créés au portail et à la réception restent visibles dans le module Réception.
            </p>
          </div>

          {/* Filtres */}
          <div className="flex gap-4 mb-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par n° lot de stock, produit, fournisseur..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select 
              value={categoryFilter} 
              onValueChange={(v) => setCategoryFilter(v as ProductCategory | 'all')}
            >
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Catégorie" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes catégories</SelectItem>
                <SelectItem value="MP">Matière Première</SelectItem>
                <SelectItem value="WIP">En-cours</SelectItem>
                <SelectItem value="PF">Produit Fini</SelectItem>
                <SelectItem value="EMB">Emballage</SelectItem>
              </SelectContent>
            </Select>
            <Select 
              value={statusFilter} 
              onValueChange={(v) => setStatusFilter(v as LotStatus | 'all')}
            >
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous statuts</SelectItem>
                <SelectItem value="QUARANTINE">Quarantaine</SelectItem>
                <SelectItem value="VALIDATED">Validé</SelectItem>
                <SelectItem value="BLOCKED">Bloqué</SelectItem>
                <SelectItem value="EXPIRED">Périmé</SelectItem>
                <SelectItem value="CONSUMED">Consommé</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Chargement...
            </div>
          ) : filteredLots.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Scale className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Aucun lot trouvé</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>N° lot stock</TableHead>
                  <TableHead>Produit</TableHead>
                  <TableHead>Quantité</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Emplacement</TableHead>
                  <TableHead>Réception</TableHead>
                  <TableHead>DLC/DLUO</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLots.map((lot) => {
                  const daysUntilExpiry = getDaysUntilExpiry(lot);
                  const isExpiringSoon = daysUntilExpiry !== null && daysUntilExpiry <= 30;
                  const product = lot.product as any;
                  const productCategory = (product?.category || (lot.product_id ? undefined : 'MP')) as ProductCategory | undefined;
                  const location = (lot as any).storage_location || (lot.location as any);
                  
                  return (
                    <TableRow key={lot.id} className={isExpiringSoon ? 'bg-orange-50' : ''}>
                      <TableCell className="font-mono font-medium">
                        <div>
                          <p>{lot.lot_number}</p>
                          {lot.reception_entry_lot?.lot_internal ? (
                            <p className="text-xs text-muted-foreground">
                              ↑ Lot Réception: {lot.reception_entry_lot.lot_internal}
                            </p>
                          ) : lot.source_lot_internal ? (
                            <p className="text-xs text-muted-foreground">
                              Source: {lot.source_lot_internal}
                            </p>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{product?.name || '-'}</p>
                          <p className="text-xs text-muted-foreground">
                            {productCategory ? productCategoryLabels[productCategory] : '-'}
                            {lot.variety && ` • ${lot.variety}`}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">{lot.current_quantity.toLocaleString('fr-FR')}</span>
                        <span className="text-muted-foreground text-xs ml-1">{lot.unit}</span>
                        {lot.current_quantity < lot.initial_quantity && (
                          <p className="text-xs text-muted-foreground">
                            (initial: {lot.initial_quantity.toLocaleString('fr-FR')})
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={`${lotStatusColors[lot.status]} text-white`}>
                          {lotStatusLabels[lot.status]}
                        </Badge>
                        {(lot.block_reason || (lot.status === 'BLOCKED' && lot.quality_notes)) && (
                          <p className="mt-1 max-w-[220px] text-xs text-red-700">
                            {lot.block_reason || lot.quality_notes}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        {location ? (
                          <div>
                            <p className="font-mono text-sm">{location.code}</p>
                            {lot.position && (
                              <p className="text-xs text-muted-foreground">Pos: {lot.position}</p>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(lot.reception_date), 'dd MMM yyyy', { locale: fr })}
                        </div>
                      </TableCell>
                      <TableCell>
                        {(lot.dlc_date || lot.dluo_date) ? (
                          <div className={isExpiringSoon ? 'text-orange-600' : ''}>
                            <div className="flex items-center gap-1">
                              {isExpiringSoon && <AlertTriangle className="h-3 w-3" />}
                              <span className="text-sm">
                                {format(new Date(lot.dlc_date || lot.dluo_date!), 'dd/MM/yy')}
                              </span>
                            </div>
                            {daysUntilExpiry !== null && (
                              <p className="text-xs">
                                {daysUntilExpiry > 0 ? `J-${daysUntilExpiry}` : 'Expiré'}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {lot.status === 'QUARANTINE' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setLotToValidate(lot)}
                              title="Valider le lot QC"
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                          )}
                          {lot.status === 'VALIDATED' && (
                            <>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => setSelectedLotForTransfer(lot)}
                                title="Transférer le lot"
                              >
                                <ArrowRightLeft className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="border-red-200 text-red-700 hover:bg-red-50"
                                onClick={() => setLotToBlock(lot)}
                                title="Bloquer le lot"
                              >
                                <Lock className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          {lot.status === 'BLOCKED' && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                              onClick={() => setLotToRelease(lot)}
                              title="Débloquer le lot"
                            >
                              <LockOpen className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <StockLotDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
      />

      {selectedLotForTransfer && (
        <TransferDialog
          open={true}
          onOpenChange={() => setSelectedLotForTransfer(null)}
          lot={selectedLotForTransfer}
        />
      )}

      <StockLotQCDialog
        lot={lotToValidate}
        onClose={() => setLotToValidate(null)}
      />

      <StockLotBlockDialog
        lot={lotToBlock}
        mode="block"
        onClose={() => setLotToBlock(null)}
      />

      <StockLotBlockDialog
        lot={lotToRelease}
        mode="release"
        onClose={() => setLotToRelease(null)}
      />
    </>
  );
};
