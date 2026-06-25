import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BatchDialog } from './BatchDialog';
import { InspectionDialog } from './InspectionDialog';
import { StorageDialog } from './StorageDialog';
import { NonConformityDialog } from './NonConformityDialog';
import { 
  Batch, 
  batchStatusLabels, 
  batchStatusColors,
  qualityGradeLabels,
  qualityGradeColors
} from '@/types/batch';
import { Supplier, Material } from '@/types/mes';
import { 
  Plus, 
  ClipboardCheck, 
  Warehouse, 
  AlertTriangle,
  Scale,
  MapPin
} from 'lucide-react';
import { format } from 'date-fns';
import { enUS, fr, ar } from 'date-fns/locale';

interface BatchesListProps {
  batches: Batch[];
  suppliers: Supplier[];
  materials: Material[];
}

export const BatchesList = ({ batches, suppliers, materials }: BatchesListProps) => {
  const { t, i18n } = useTranslation();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);
  const [dialogType, setDialogType] = useState<'inspect' | 'store' | 'nc' | null>(null);

  const getLocale = () => {
    switch (i18n.language) {
      case 'ar': return ar;
      case 'en': return enUS;
      default: return fr;
    }
  };

  const formatBatchDate = (value?: string | null) => {
    if (!value) return '-';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';

    return format(date, 'dd MMM', { locale: getLocale() });
  };

  const openDialog = (batch: Batch, type: 'inspect' | 'store' | 'nc') => {
    setSelectedBatch(batch);
    setDialogType(type);
  };

  const closeDialog = () => {
    setSelectedBatch(null);
    setDialogType(null);
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5" />
            {t('batches.title')}
          </CardTitle>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 me-2" />
            {t('batches.new')}
          </Button>
        </CardHeader>
        <CardContent>
          {batches.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Scale className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>{t('common.noData')}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('batches.batchNumber')}</TableHead>
                  <TableHead>{t('batches.origin')}</TableHead>
                  <TableHead>{t('batches.weight')}</TableHead>
                  <TableHead>{t('quality.grade')}</TableHead>
                  <TableHead>{t('common.status')}</TableHead>
                  <TableHead>{t('batches.storageZone')}</TableHead>
                  <TableHead>{t('common.date')}</TableHead>
                  <TableHead>{t('common.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches.map((batch) => (
                  <TableRow key={batch.id}>
                    <TableCell className="font-mono font-medium">
                      {batch.batch_number}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{batch.supplier?.name || '-'}</p>
                        <p className="text-xs text-muted-foreground">
                          {batch.origin_region || batch.material?.name || '-'}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">{batch.current_weight_kg}</span>
                      <span className="text-muted-foreground text-xs ms-1">kg</span>
                    </TableCell>
                    <TableCell>
                      {batch.quality_grade ? (
                        <Badge className={`${qualityGradeColors[batch.quality_grade]} text-white`}>
                          {qualityGradeLabels[batch.quality_grade]}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={`${batchStatusColors[batch.status]} text-white`}>
                        {batchStatusLabels[batch.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {batch.storage_zone ? (
                        <div className="flex items-center gap-1 text-sm">
                          <MapPin className="h-3 w-3" />
                          {batch.storage_zone.code}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {formatBatchDate(batch.reception_date)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {(batch.status === 'pending_inspection' || batch.status === 'in_inspection') && (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => openDialog(batch, 'inspect')}
                          >
                            <ClipboardCheck className="h-4 w-4" />
                          </Button>
                        )}
                        {batch.status === 'accepted' && (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => openDialog(batch, 'store')}
                          >
                            <Warehouse className="h-4 w-4" />
                          </Button>
                        )}
                        {(batch.status === 'quarantine' || batch.status === 'rejected') && (
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="text-orange-600"
                            onClick={() => openDialog(batch, 'nc')}
                          >
                            <AlertTriangle className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <BatchDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        suppliers={suppliers}
        materials={materials}
      />

      {selectedBatch && dialogType === 'inspect' && (
        <InspectionDialog
          open={true}
          onOpenChange={closeDialog}
          batch={selectedBatch}
        />
      )}

      {selectedBatch && dialogType === 'store' && (
        <StorageDialog
          open={true}
          onOpenChange={closeDialog}
          batch={selectedBatch}
        />
      )}

      {selectedBatch && dialogType === 'nc' && (
        <NonConformityDialog
          open={true}
          onOpenChange={closeDialog}
          batch={selectedBatch}
        />
      )}
    </>
  );
};
