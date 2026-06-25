import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, Edit2, Trash2 } from 'lucide-react';
import { Material } from '@/types/mes';
import { MaterialDialog } from './MaterialDialog';
import { useCreateMaterial, useUpdateMaterial, useDeleteMaterial } from '@/hooks/useMaterials';

interface MaterialsListProps {
  materials: Material[];
  canManage?: boolean;
}

export const MaterialsList = ({ materials, canManage = true }: MaterialsListProps) => {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);

  const createMutation = useCreateMaterial();
  const updateMutation = useUpdateMaterial();
  const deleteMutation = useDeleteMaterial();

  const filteredMaterials = materials.filter(m => 
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    m.code.toLowerCase().includes(search.toLowerCase())
  );

  const handleSave = (data: Omit<Material, 'id' | 'created_at' | 'updated_at'>) => {
    if (selectedMaterial) {
      updateMutation.mutate({ id: selectedMaterial.id, ...data }, {
        onSuccess: () => {
          setDialogOpen(false);
          setSelectedMaterial(null);
        }
      });
    } else {
      createMutation.mutate(data, {
        onSuccess: () => {
          setDialogOpen(false);
        }
      });
    }
  };

  const handleEdit = (material: Material) => {
    setSelectedMaterial(material);
    setDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm(t('messages.deleteConfirm'))) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-lg font-semibold">{t('materials.title')}</CardTitle>
          {canManage && (
            <Button size="sm" onClick={() => { setSelectedMaterial(null); setDialogOpen(true); }}>
              <Plus className="h-4 w-4 me-2" />
              {t('materials.new')}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('common.search')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="ps-10"
              />
            </div>
          </div>
          
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('materials.code')}</TableHead>
                  <TableHead>{t('materials.name')}</TableHead>
                  <TableHead>{t('materials.category')}</TableHead>
                  <TableHead>{t('materials.unit')}</TableHead>
                  <TableHead>{t('materials.minStock')}</TableHead>
                  <TableHead className="text-end">{t('common.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMaterials.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      {t('common.noResults')}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredMaterials.map((material) => (
                    <TableRow key={material.id}>
                      <TableCell className="font-mono text-sm">{material.code}</TableCell>
                      <TableCell className="font-medium">{material.name}</TableCell>
                      <TableCell>
                        {material.category ? (
                          <Badge variant="outline">{material.category}</Badge>
                        ) : '-'}
                      </TableCell>
                      <TableCell>{material.unit}</TableCell>
                      <TableCell>{material.min_stock}</TableCell>
                      <TableCell className="text-end">
                        {canManage && (
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => handleEdit(material)}>
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(material.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      
      <MaterialDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        material={selectedMaterial}
        onSave={handleSave}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />
    </>
  );
};
