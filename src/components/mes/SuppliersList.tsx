import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Plus, Search, Edit2, Trash2, AlertTriangle, Eye, MapPin, Leaf, CalendarClock, Scale, ShieldCheck, FileText } from 'lucide-react';
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
      updateMutation.mutate(
        { id: selectedSupplier.id, ...data },
        {
          onSuccess: () => {
            setDialogOpen(false);
            setSelectedSupplier(null);
          },
        },
      );
      return;
    }

    createMutation.mutate(data, {
      onSuccess: () => setDialogOpen(false),
    });
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
      deleteMutation.mutate(id);
    }
  };

  return (
    <>
      <div className="space-y-6">
        <ModuleHero
          kicker="Référentiel • Fournisseurs"
          title="Gestion fournisseurs claire et exploitable"
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
            { label: 'Agrees', value: stats.approved },
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

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="metric-tile">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Fournisseurs actifs</p>
              <p className="text-3xl font-semibold">{stats.active}</p>
            </CardContent>
          </Card>
          <Card className="metric-tile">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Sous surveillance score</p>
              <p className="text-3xl font-semibold text-amber-600">{stats.watch}</p>
            </CardContent>
          </Card>
          <Card className="metric-tile">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Fournisseurs bloques</p>
              <p className="text-3xl font-semibold text-red-600">{stats.blocked}</p>
            </CardContent>
          </Card>
          <Card className="metric-tile">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Agrements valides</p>
              <p className="text-3xl font-semibold text-emerald-600">{stats.approved}</p>
            </CardContent>
          </Card>
        </div>

        <Card className="surface-card">
          <CardHeader className="flex flex-row items-center justify-between gap-4 border-b border-border/60">
            <div>
              <CardTitle>Module 1 - Fournisseurs Royal Palm</CardTitle>
              <p className="text-sm text-muted-foreground">
                Fiches detaillees, score qualite, statuts d'agrement et alertes contractuelles.
              </p>
            </div>
            {canManage && (
              <Button onClick={() => { setSelectedSupplier(null); setDialogOpen(true); }} className="rounded-2xl">
                <Plus className="h-4 w-4 mr-2" />
                Nouveau fournisseur
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_repeat(5,minmax(0,0.7fr))] gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Rechercher par nom, code, ville, CIN"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  <SelectItem value="active">Actifs</SelectItem>
                  <SelectItem value="pending_approval">En agrement</SelectItem>
                  <SelectItem value="blocked">Bloques</SelectItem>
                  <SelectItem value="inactive">Inactifs</SelectItem>
                  <SelectItem value="archived">Archives</SelectItem>
                </SelectContent>
              </Select>
              <Select value={qualificationFilter} onValueChange={setQualificationFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Qualification" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes qualifications</SelectItem>
                  <SelectItem value="prospect">Prospects</SelectItem>
                  <SelectItem value="qualified">Qualifies</SelectItem>
                  <SelectItem value="approved">Agrees</SelectItem>
                  <SelectItem value="suspended">Suspendus</SelectItem>
                  <SelectItem value="blacklisted">Liste noire</SelectItem>
                </SelectContent>
              </Select>
              <Select value={regionFilter} onValueChange={setRegionFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Region" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les regions</SelectItem>
                  {regions.map((region) => (
                    <SelectItem key={region} value={region}>
                      {region}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={varietyFilter} onValueChange={setVarietyFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Variete" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les varietes</SelectItem>
                  {varieties.map((variety) => (
                    <SelectItem key={variety} value={variety}>
                      {variety}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={scoreFilter} onValueChange={setScoreFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Score M1" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les scores</SelectItem>
                  <SelectItem value="excellent">Excellent (≥ 85)</SelectItem>
                  <SelectItem value="good">Bon (70–84)</SelectItem>
                  <SelectItem value="watch">Surveillance (60–69)</SelectItem>
                  <SelectItem value="risk">Risque (&lt; 60)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              {filteredSuppliers.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground border rounded-lg">
                  Aucun fournisseur ne correspond aux filtres.
                </div>
              ) : (
                filteredSuppliers.map((supplier) => {
                  const status = normalizeSupplierStatus(supplier);
                  const score = computeSupplierCompositeScore(supplier);
                  const tone = getSupplierScoreTone(score);
                  const alerts = computeSupplierAlerts(supplier);
                  const activeContract = getActiveSupplierContract(supplier);

                  return (
                    <div key={supplier.id} className="surface-card p-4">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="space-y-3 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-xs text-muted-foreground">{supplier.code}</span>
                            <Badge variant="outline" className={getSupplierStatusClassName(status)}>
                              {getSupplierStatusLabel(status)}
                            </Badge>
                            {supplier.actor_type && (
                              <Badge variant="secondary">{supplier.actor_type.replace(/_/g, ' ')}</Badge>
                            )}
                            <Badge variant="outline">
                              <ShieldCheck className="h-3 w-3 mr-1" />
                              {getSupplierQualificationLabel(supplier.qualification_status)}
                            </Badge>
                            <Badge variant="outline" className={getSupplierComplianceClassName(supplier.compliance_status)}>
                              {getSupplierComplianceLabel(supplier.compliance_status)}
                            </Badge>
                            {supplier.region && (
                              <Badge variant="outline">
                                <MapPin className="h-3 w-3 mr-1" />
                                {supplier.region}
                              </Badge>
                            )}
                          </div>

                          <div>
                            <button
                              type="button"
                              className="text-left hover:underline decoration-muted-foreground/40"
                              onClick={() => handleOpenSheet(supplier)}
                            >
                              <h3 className="text-lg font-semibold">{supplier.name}</h3>
                            </button>
                            {supplier.name_ar && (
                              <p dir="auto" className="text-sm font-medium text-muted-foreground">{supplier.name_ar}</p>
                            )}
                            <p className="text-sm text-muted-foreground">
                              {[supplier.locality || supplier.city, supplier.oasis_name, supplier.phone]
                                .filter(Boolean)
                                .join(' • ') || 'Aucune coordonnee detaillee'}
                            </p>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {(supplier.produced_varieties || []).map((variety) => (
                              <Badge key={variety} variant="secondary">
                                {variety}
                              </Badge>
                            ))}
                            {(supplier.certifications || []).map((certification) => (
                              <Badge key={certification.name} variant="outline" className="border-emerald-200 text-emerald-700">
                                <Leaf className="h-3 w-3 mr-1" />
                                {certification.name}
                              </Badge>
                            ))}
                          </div>

                          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                            <div className="rounded-lg bg-muted/50 p-3">
                              <p className="text-muted-foreground">Score qualite</p>
                              <p className="text-xl font-semibold">{Number(supplier.quality_score ?? supplier.rating ?? 0).toFixed(1)}</p>
                            </div>
                            <div className="rounded-lg bg-muted/50 p-3">
                              <p className="text-muted-foreground">Fiabilite</p>
                              <p className="text-xl font-semibold">{supplier.delivery_reliability_score ?? 0}</p>
                            </div>
                            <div className="rounded-lg bg-muted/50 p-3">
                              <p className="text-muted-foreground">Tracabilite</p>
                              <p className="text-xl font-semibold">{supplier.traceability_score ?? 0}</p>
                            </div>
                            <div className="rounded-lg bg-muted/50 p-3">
                              <p className="text-muted-foreground">Taux rejet</p>
                              <p className="text-xl font-semibold">{supplier.rejection_rate ?? 0}%</p>
                            </div>
                          </div>
                        </div>

                        <div className="w-full lg:w-[320px] space-y-3">
                          <div className="rounded-lg border p-3">
                            <div className="flex items-center justify-between text-sm mb-2">
                              <span className="text-muted-foreground">Indice performance</span>
                              <span
                                className={
                                  tone === 'excellent'
                                    ? 'text-emerald-700 font-medium'
                                    : tone === 'watch'
                                      ? 'text-amber-700 font-medium'
                                      : 'text-red-700 font-medium'
                                }
                              >
                                {tone === 'excellent' ? 'Solide' : tone === 'watch' ? 'A surveiller' : 'Risque'}
                              </span>
                            </div>
                            <Progress value={Math.max(0, Math.min(score, 100))} className="h-2" />
                            <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                              <span className="inline-flex items-center gap-1">
                                <CalendarClock className="h-3.5 w-3.5" />
                                Derniere livraison: {supplier.last_delivery_date || '-'}
                              </span>
                              <span className="inline-flex items-center gap-1">
                                <FileText className="h-3.5 w-3.5" />
                                Contrat: {activeContract?.reference || supplier.contract_records?.[0]?.reference || '-'}
                              </span>
                              <span className="inline-flex items-center gap-1" dir={supplier.contract_type === 'achat_sur_pied' ? 'auto' : 'ltr'}>
                                {contractTypeLabels[supplier.contract_type || 'saisonnier']}
                              </span>
                              <span className="inline-flex items-center gap-1">
                                Echeance: {supplier.contract_end_date || activeContract?.end_date || '-'}
                              </span>
                              <span className="inline-flex items-center gap-1">
                                <Scale className="h-3.5 w-3.5" />
                                Prix: {supplier.agreed_price_tnd_per_kg ?? '-'} TND/kg
                              </span>
                            </div>
                          </div>

                          <div className="rounded-lg border p-3 space-y-2">
                            <p className="text-sm font-medium">Alertes de gestion</p>
                            {alerts.length === 0 ? (
                              <p className="text-sm text-muted-foreground">Aucune alerte ouverte.</p>
                            ) : (
                              alerts.map((alert) => (
                                <div key={alert} className="flex items-start gap-2 text-sm text-amber-800">
                                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                                  <span>{alert}</span>
                                </div>
                              ))
                            )}
                          </div>

                          {canManage && (
                            <div className="flex justify-end gap-2">
                              <Button variant="outline" size="icon" onClick={() => handleEdit(supplier)}>
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button variant="outline"size="icon" onClick={() => handleDelete(supplier.id)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
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
