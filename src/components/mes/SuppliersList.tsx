import { toast as reportActionFailure } from 'sonner';
import { useMemo, useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, Edit2, Trash2, AlertTriangle, Eye } from 'lucide-react';
import { Supplier } from '@/types/mes';
import { SupplierDialog } from './SupplierDialog';
import { SupplierDetailSheet } from './SupplierDetailSheet';
import { useCreateSupplier, useDeleteSupplier, useUpdateSupplier } from '@/hooks/useSuppliers';
import {
  computeSupplierAlerts,
  computeSupplierCompositeScore,
  computeSupplierScoreM1,
  getActiveSupplierContract,
  getSupplierComplianceClassName,
  getSupplierComplianceLabel,
  getSupplierQualificationLabel,
  getSupplierScoreTone,
  getSupplierStatusClassName,
  getSupplierStatusLabel,
  normalizeSupplierStatus,
} from '@/lib/royalPalmPhase1';
import { ModuleHero } from '@/components/layout/ModuleHero';

interface SuppliersListProps {
  suppliers: Supplier[];
  canManage?: boolean;
}

const contractTypeLabels: Record<NonNullable<Supplier['contract_type']>, string> = {
  annuel: 'Annuel (engagement saison)',
  saisonnier: 'Saisonnier (renouvellement)',
  ponctuel: 'Ponctuel (sans engagement)',
  achat_sur_pied: 'بيع على الشجر (pied sur Achat)',
};

export const SuppliersList = ({ suppliers, canManage = true }: SuppliersListProps) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [qualificationFilter, setQualificationFilter] = useState('all');
  const [regionFilter, setRegionFilter] = useState('all');
  const [varietyFilter, setVarietyFilter] = useState('all');
  const [scoreFilter, setScoreFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetSupplier, setSheetSupplier] = useState<Supplier | null>(null);

  const createMutation = useCreateSupplier();
  const updateMutation = useUpdateSupplier();
  const deleteMutation = useDeleteSupplier();

  const regions = useMemo(
    () => Array.from(new Set(suppliers.map((supplier) => supplier.region).filter(Boolean))).sort(),
    [suppliers],
  );
  const varieties = useMemo(
    () =>
      Array.from(
        new Set(
          suppliers.flatMap((supplier) => supplier.produced_varieties?.filter(Boolean) || []),
        ),
      ).sort(),
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
      const matchesVariety =
        varietyFilter === 'all' || supplier.produced_varieties?.includes(varietyFilter);
      const matchesScore = (() => {
        if (scoreFilter === 'all') return true;
        const { grade } = computeSupplierScoreM1(supplier);
        return grade === scoreFilter;
      })();
      return matchesSearch && matchesStatus && matchesQualification && matchesRegion && matchesVariety && matchesScore;
    });
  }, [qualificationFilter, regionFilter, scoreFilter, search, statusFilter, suppliers, varietyFilter]);

  const stats = useMemo(() => {
    const active = suppliers.filter((supplier) => normalizeSupplierStatus(supplier) === 'active').length;
    const blocked = suppliers.filter((supplier) => normalizeSupplierStatus(supplier) === 'blocked').length;
    const watch = suppliers.filter((supplier) => computeSupplierCompositeScore(supplier) < 60 || supplier.compliance_status === 'warning').length;
    const bio = suppliers.filter((supplier) =>
      supplier.certifications?.some((certification) =>
        certification.name === 'Bio UE' || certification.name === 'Bio Tunisie',
      ),
    ).length;
    const approved = suppliers.filter((supplier) => supplier.qualification_status === 'approved').length;
    const nonCompliant = suppliers.filter((supplier) => supplier.compliance_status === 'non_compliant').length;
    return { active, blocked, watch, bio, approved, nonCompliant };
  }, [suppliers]);

  const handleSave = (data: Omit<Supplier, 'id' | 'created_at' | 'updated_at'>) => {
    if (selectedSupplier) {
      void updateMutation.mutateAsync({ id: selectedSupplier.id, ...data }).then(() => {
            setDialogOpen(false);
            setSelectedSupplier(null);
          }).catch(error => reportActionFailure.error(error instanceof Error ? error.message : 'Action indisponible'));
      return;
    }

    void createMutation.mutateAsync(data).then(() => setDialogOpen(false)).catch(error => reportActionFailure.error(error instanceof Error ? error.message : 'Action indisponible'));
  };

  const handleOpenSheet = (supplier: Supplier) => {
    setSheetSupplier(supplier);
    setSheetOpen(true);
  };

  const handleEdit = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('Supprimer cette fiche fournisseur ?')) {
      void deleteMutation.mutateAsync(id).catch(error => reportActionFailure.error(error instanceof Error ? error.message : 'Action indisponible'));
    }
  };

  return (
    <>
      <div className="space-y-3">
        <ModuleHero
          title="Fournisseurs"
          description="Les equipes doivent pouvoir retrouver un fournisseur, voir son statut, comprendre son niveau de risque et agir rapidement sans se perdre dans des formulaires trop lourds."
          primaryAction={canManage ? {
            label: "Nouveau fournisseur",
            onClick: () => {
              setSelectedSupplier(null);
              setDialogOpen(true);
            },
            icon: <Plus className="h-4 w-4 mr-2" />,
          } : undefined}
          stats={[
            { label: 'Actifs', value: stats.active },
            { label: 'Agréés', value: stats.approved },
            { label: 'Surveillance', value: stats.watch },
            { label: 'Bloqués', value: stats.blocked },
          ]}
        />

        {!canManage && (
          <div className="flex items-start gap-3 rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
            <Eye className="h-5 w-5 shrink-0 text-sky-600 mt-0.5" />
            <div>
              <p className="font-semibold">Portail fournisseur — accès lecture seule</p>
              <p className="mt-0.5 text-sky-800">
                Vous consultez vos informations en mode portail. Cliquez sur votre fiche pour voir votre score qualité, l'historique de vos livraisons et vos documents.
              </p>
            </div>
          </div>
        )}

        <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
          <div className="flex items-baseline gap-1.5"><dd className="font-display text-lg font-semibold">{stats.active}</dd><dt className="text-muted-foreground">actifs</dt></div>
          <div className="flex items-baseline gap-1.5"><dd className="font-display text-lg font-semibold">{stats.approved}</dd><dt className="text-muted-foreground">agréés</dt></div>
          <div className="flex items-baseline gap-1.5"><dd className="font-display text-lg font-semibold text-amber-700">{stats.watch}</dd><dt className="text-muted-foreground">sous surveillance</dt></div>
          <div className="flex items-baseline gap-1.5"><dd className="font-display text-lg font-semibold text-red-600">{stats.blocked}</dd><dt className="text-muted-foreground">bloqués</dt></div>
        </dl>

        <div className="grid grid-cols-2 gap-2 lg:grid-cols-[minmax(14rem,1.4fr)_repeat(5,minmax(0,0.7fr))]">
          <div className="relative col-span-2 lg:col-span-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Nom, code, ville, CIN" aria-label="Rechercher un fournisseur" value={search} onChange={(event) => setSearch(event.target.value)} />
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
          <Select value={varietyFilter} onValueChange={setVarietyFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Variété" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Variété</SelectItem>
              {varieties.map((variety) => (
                <SelectItem key={variety} value={variety}>
                  {variety}
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
          <p className="rounded-lg border bg-card py-10 text-center text-muted-foreground">Aucun fournisseur ne correspond aux filtres.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fournisseur</TableHead>
                <TableHead className="hidden md:table-cell">Région</TableHead>
                <TableHead className="hidden lg:table-cell">Variétés</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="hidden lg:table-cell">Qualification</TableHead>
                <TableHead className="text-right">Score</TableHead>
                <TableHead className="hidden text-right md:table-cell">Rejet</TableHead>
                <TableHead className="hidden lg:table-cell">Alertes</TableHead>
                {canManage && <TableHead className="w-20"><span className="sr-only">Actions</span></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSuppliers.map((supplier) => {
                const status = normalizeSupplierStatus(supplier);
                const score = computeSupplierCompositeScore(supplier);
                const tone = getSupplierScoreTone(score);
                const alerts = computeSupplierAlerts(supplier);
                return (
                  <TableRow key={supplier.id}>
                    <TableCell>
                      <button type="button" className="text-left font-medium hover:underline" onClick={() => handleOpenSheet(supplier)}>
                        {supplier.name}
                      </button>
                      <span className="block font-mono text-xs text-muted-foreground">{supplier.code}</span>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">{supplier.region || '—'}</TableCell>
                    <TableCell className="hidden max-w-[14rem] truncate lg:table-cell">{(supplier.produced_varieties || []).join(', ') || '—'}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={getSupplierStatusClassName(status)}>{getSupplierStatusLabel(status)}</Badge>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">{getSupplierQualificationLabel(supplier.qualification_status)}</TableCell>
                    <TableCell className="text-right">
                      <span className="font-semibold">{score.toFixed(0)}</span>
                      <span className={tone === 'excellent' ? 'block text-xs text-emerald-700' : tone === 'watch' ? 'block text-xs text-amber-700' : 'block text-xs text-red-700'}>
                        {tone === 'excellent' ? 'Solide' : tone === 'watch' ? 'À surveiller' : 'Risque'}
                      </span>
                    </TableCell>
                    <TableCell className="hidden text-right md:table-cell">{(supplier.total_delivered_tons ?? 0) > 0 && supplier.rejection_rate != null ? `${supplier.rejection_rate} %` : 'Non mesuré'}</TableCell>
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
                          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Supprimer ${supplier.name}`} onClick={() => handleDelete(supplier.id)}>
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
