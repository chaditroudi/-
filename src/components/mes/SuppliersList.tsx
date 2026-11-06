import { toast as reportActionFailure } from 'sonner';
import { useMemo, useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, Edit2, Trash2, AlertTriangle, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { Supplier } from '@/types/mes';
import { SupplierDialog } from './SupplierDialog';
import { SupplierDetailSheet } from './SupplierDetailSheet';
import {
  useArchiveSupplier,
  useBlockSupplier,
  useCreateSupplier,
  useDeleteSupplier,
  useUpdateSupplier,
} from '@/hooks/useSuppliers';
import { suppliersApi } from '@/lib/api/suppliers';
import {
  computeSupplierAlerts,
  computeSupplierScoreM1,
  getSupplierScoreGradeLabel,
  getSupplierStatusClassName,
  getSupplierStatusLabel,
  getSupplierQualificationLabel,
  hasSupplierScoreData,
  normalizeSupplierStatus,
} from '@/lib/royalPalmPhase1';
import { ModuleHero } from '@/components/layout/ModuleHero';
import { SummaryStrip } from '@/components/shared/SummaryStrip';
import { EmptyState } from '@/components/shared/EmptyState';

interface SuppliersListProps {
  suppliers: Supplier[];
  canManage?: boolean;
}

export const SuppliersList = ({ suppliers, canManage = true }: SuppliersListProps) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [qualificationFilter, setQualificationFilter] = useState('all');
  const [regionFilter, setRegionFilter] = useState('all');
  const [scoreFilter, setScoreFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetSupplier, setSheetSupplier] = useState<Supplier | null>(null);

  const createMutation = useCreateSupplier();
  const updateMutation = useUpdateSupplier();
  const deleteMutation = useDeleteSupplier();
  const archiveMutation = useArchiveSupplier();
  const blockMutation = useBlockSupplier();

  const regions = useMemo(
    () => Array.from(new Set(suppliers.map((supplier) => supplier.region).filter(Boolean))).sort(),
    [suppliers],
  );

  const filteredSuppliers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return suppliers.filter((supplier) => {
      const status = normalizeSupplierStatus(supplier);
      const matchesSearch =
        !query ||
        supplier.name.toLowerCase().includes(query) ||
        supplier.name_ar?.toLowerCase().includes(query) ||
        supplier.code.toLowerCase().includes(query) ||
        supplier.city?.toLowerCase().includes(query) ||
        supplier.locality?.toLowerCase().includes(query) ||
        supplier.fiscal_identifier?.toLowerCase().includes(query) ||
        supplier.id_document_number?.toLowerCase().includes(query) ||
        supplier.oasis_name?.toLowerCase().includes(query);
      const matchesStatus = statusFilter === 'all' || status === statusFilter;
      const matchesQualification = qualificationFilter === 'all' || supplier.qualification_status === qualificationFilter;
      const matchesRegion = regionFilter === 'all' || supplier.region === regionFilter;
      const matchesScore = (() => {
        if (scoreFilter === 'all') return true;
        if (!hasSupplierScoreData(supplier)) return false;
        return computeSupplierScoreM1(supplier).grade === scoreFilter;
      })();
      return matchesSearch && matchesStatus && matchesQualification && matchesRegion && matchesScore;
    });
  }, [qualificationFilter, regionFilter, scoreFilter, search, statusFilter, suppliers]);

  const stats = useMemo(() => {
    const active = suppliers.filter((supplier) => normalizeSupplierStatus(supplier) === 'active').length;
    const blocked = suppliers.filter((supplier) => normalizeSupplierStatus(supplier) === 'blocked').length;
    const watch = suppliers.filter((supplier) => {
      if (!hasSupplierScoreData(supplier)) return supplier.compliance_status === 'warning';
      return computeSupplierScoreM1(supplier).grade === 'watch' || supplier.compliance_status === 'warning';
    }).length;
    const approved = suppliers.filter((supplier) => supplier.qualification_status === 'approved').length;
    return { active, blocked, watch, approved };
  }, [suppliers]);

  const handleSave = async (data: Omit<Supplier, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      if (selectedSupplier) {
        await updateMutation.mutateAsync({ id: selectedSupplier.id, ...data });
        setDialogOpen(false);
        setSelectedSupplier(null);
        return;
      }
      await createMutation.mutateAsync(data);
      setDialogOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Enregistrement impossible');
    }
  };

  const handleOpenSheet = (supplier: Supplier) => {
    setSheetSupplier(supplier);
    setSheetOpen(true);
  };

  const handleEdit = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setDialogOpen(true);
  };

  const handleDelete = async (supplier: Supplier) => {
    if (!confirm(`Supprimer la fiche « ${supplier.name} » ?`)) return;
    try {
      const check = await suppliersApi.receptionCheck(supplier.id);
      if (check.hasReceptions) {
        const archiveInstead = confirm(
          'Ce fournisseur a déjà des réceptions. Suppression refusée — archiver ou bloquer à la place ?\n\nOK = archiver, Annuler = bloquer.',
        );
        if (archiveInstead) {
          await archiveMutation.mutateAsync(supplier.id);
        } else {
          await blockMutation.mutateAsync(supplier.id, 'Suppression refusée : réceptions existantes');
        }
        return;
      }
      await deleteMutation.mutateAsync(supplier.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Suppression impossible');
    }
  };

  return (
    <>
      <div className="space-y-3">
        <ModuleHero
          primaryAction={canManage ? {
            label: 'Nouveau fournisseur',
            onClick: () => {
              setSelectedSupplier(null);
              setDialogOpen(true);
            },
            icon: <Plus className="h-4 w-4" />,
          } : undefined}
        />

        <SummaryStrip
          items={[
            { label: 'Actifs', value: stats.active, tone: 'good' },
            { label: 'Agréés', value: stats.approved },
            { label: 'Surveillance', value: stats.watch, tone: stats.watch > 0 ? 'watch' : 'default' },
            { label: 'Bloqués', value: stats.blocked, tone: stats.blocked > 0 ? 'bad' : 'default' },
          ]}
        />

        {!canManage && (
          <div className="flex items-start gap-3 rounded-lg border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
            <Eye className="h-5 w-5 shrink-0 text-sky-600 mt-0.5" />
            <div>
              <p className="font-semibold">Portail fournisseur — accès lecture seule</p>
              <p className="mt-0.5 text-sky-800">
                Vous consultez vos informations en mode portail. Cliquez sur votre fiche pour voir votre score qualité, l&apos;historique de vos livraisons et vos documents.
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 lg:grid-cols-[minmax(14rem,1.4fr)_repeat(4,minmax(0,0.7fr))]">
          <div className="relative col-span-2 lg:col-span-1">
            <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="min-h-11 ps-9" placeholder="Nom, code, ville, CIN" aria-label="Rechercher un fournisseur" value={search} onChange={(event) => setSearch(event.target.value)} />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Statut</SelectItem>
              <SelectItem value="active">Actifs</SelectItem>
              <SelectItem value="pending_approval">En agrément</SelectItem>
              <SelectItem value="blocked">Bloqués</SelectItem>
              <SelectItem value="inactive">Inactifs</SelectItem>
              <SelectItem value="archived">Archives</SelectItem>
            </SelectContent>
          </Select>
          <Select value={qualificationFilter} onValueChange={setQualificationFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Qualification" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Qualification</SelectItem>
              <SelectItem value="prospect">Prospects</SelectItem>
              <SelectItem value="qualified">Qualifiés</SelectItem>
              <SelectItem value="approved">Agréés</SelectItem>
              <SelectItem value="suspended">Suspendus</SelectItem>
              <SelectItem value="blacklisted">Liste noire</SelectItem>
            </SelectContent>
          </Select>
          <Select value={regionFilter} onValueChange={setRegionFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Région" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Région</SelectItem>
              {regions.map((region) => (
                <SelectItem key={region} value={region}>
                  {region}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={scoreFilter} onValueChange={setScoreFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Score" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Score</SelectItem>
              <SelectItem value="excellent">Excellent (≥ 85)</SelectItem>
              <SelectItem value="good">Bon (70–84)</SelectItem>
              <SelectItem value="watch">Surveillance (60–69)</SelectItem>
              <SelectItem value="risk">Risque (&lt; 60)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {filteredSuppliers.length === 0 ? (
          <EmptyState
            title={suppliers.length === 0 ? 'Aucun fournisseur enregistré' : 'Aucun fournisseur ne correspond'}
            description={
              suppliers.length === 0
                ? 'Ajoutez un producteur, collecteur ou coopérative pour démarrer les réceptions.'
                : 'Élargissez la recherche ou retirez un filtre.'
            }
            actionLabel={canManage && suppliers.length === 0 ? 'Nouveau fournisseur' : undefined}
            onAction={canManage && suppliers.length === 0 ? () => {
              setSelectedSupplier(null);
              setDialogOpen(true);
            } : undefined}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fournisseur</TableHead>
                <TableHead className="hidden md:table-cell">Région</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="hidden lg:table-cell">Qualification</TableHead>
                <TableHead className="text-end">Score</TableHead>
                <TableHead className="hidden text-end md:table-cell">Rejet</TableHead>
                <TableHead className="hidden lg:table-cell">Alertes</TableHead>
                {canManage && <TableHead className="w-20"><span className="sr-only">Actions</span></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSuppliers.map((supplier) => {
                const status = normalizeSupplierStatus(supplier);
                const scoreReady = hasSupplierScoreData(supplier);
                const score = scoreReady ? computeSupplierScoreM1(supplier) : null;
                const alerts = computeSupplierAlerts(supplier);
                return (
                  <TableRow key={supplier.id}>
                    <TableCell>
                      <button type="button" className="text-start font-medium hover:underline" onClick={() => handleOpenSheet(supplier)}>
                        {supplier.name}
                      </button>
                      <span className="block font-mono text-xs text-muted-foreground">{supplier.code}</span>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">{supplier.region || '—'}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={getSupplierStatusClassName(status)}>{getSupplierStatusLabel(status)}</Badge>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">{getSupplierQualificationLabel(supplier.qualification_status)}</TableCell>
                    <TableCell className="text-end">
                      {score ? (
                        <>
                          <span className="font-semibold">{score.finalScore.toFixed(0)}</span>
                          <span className={
                            score.grade === 'excellent' || score.grade === 'good'
                              ? 'block text-xs text-emerald-700'
                              : score.grade === 'watch'
                                ? 'block text-xs text-amber-700'
                                : 'block text-xs text-red-700'
                          }>
                            {getSupplierScoreGradeLabel(score.grade)}
                          </span>
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground">Score indisponible</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden text-end md:table-cell">
                      {scoreReady ? `${supplier.rejection_rate ?? 0} %` : '—'}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {alerts.length === 0 ? <span className="text-muted-foreground">Aucune</span> : (
                        <span className="inline-flex items-center gap-1 text-amber-800" title={alerts.join('\n')}>
                          <AlertTriangle className="h-4 w-4" />
                          {alerts.length}
                        </span>
                      )}
                    </TableCell>
                    {canManage && (
                      <TableCell>
                        <div className="flex justify-end">
                          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Modifier ${supplier.name}`} onClick={() => handleEdit(supplier)}>
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Supprimer ${supplier.name}`} onClick={() => handleDelete(supplier)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <SupplierDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        supplier={selectedSupplier}
        onSave={handleSave}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />

      <SupplierDetailSheet
        supplier={sheetSupplier}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onEdit={(s) => { setSheetOpen(false); handleEdit(s); }}
      />
    </>
  );
};
