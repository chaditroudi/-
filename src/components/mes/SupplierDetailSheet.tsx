import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  AlertTriangle,
  Archive,
  CheckCircle,
  ClipboardList,
  Clock,
  Edit2,
  FileText,
  Leaf,
  MapPin,
  ShieldBan,
  Truck,
  X,
} from 'lucide-react';
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import type { Supplier } from '@/types/mes';
import {
  computeSupplierAlerts,
  computeSupplierScoreM1,
  getSupplierStatusClassName,
  getSupplierStatusLabel,
  hasValidBioCertification,
  normalizeSupplierStatus,
} from '@/lib/royalPalmPhase1';
import {
  useApproveSupplier,
  useArchiveSupplier,
  useBlockSupplier,
  useSupplierAuditLog,
  useSupplierLots,
  useSupplierOrders,
  useSupplierPayments,
} from '@/hooks/useSuppliers';
import { CreditCard, ShoppingCart } from 'lucide-react';

type SupplierLotRow    = { id: string; reception_number?: string; variety?: string; [k: string]: unknown };
type PurchaseOrderRow  = { id: string; order_number?: string; order_date?: string; quantity_kg?: number; total_amount_tnd?: number; [k: string]: unknown };
type PaymentRow        = { id: string; reference?: string; payment_date?: string; amount_tnd?: number; [k: string]: unknown };
type AuditEntryRow     = { id: string; action_label?: string; action?: string; performed_at?: string; [k: string]: unknown };

interface Props {
  supplier: Supplier | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (supplier: Supplier) => void;
}

// ─── Criterion bar ────────────────────────────────────────────────────────────

function CriterionBar({
  label,
  score,
  weight,
  description,
}: {
  label: string;
  score: number;
  weight: number;
  description: string;
}) {
  const colorClass =
    score >= 85
      ? 'text-emerald-700'
      : score >= 60
        ? 'text-amber-700'
        : 'text-red-700';

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span>
          <span className="font-medium">{label}</span>
          <span className="text-muted-foreground ml-2 text-xs">({weight} %)</span>
        </span>
        <span className={`font-semibold tabular-nums ${colorClass}`}>
          {score.toFixed(1)} / 100
        </span>
      </div>
      <Progress value={score} className="h-2" />
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
  );
}

// ─── Field row ────────────────────────────────────────────────────────────────

function Field({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium text-sm">{value ?? '—'}</p>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export const SupplierDetailSheet = ({ supplier, open, onOpenChange, onEdit }: Props) => {
  const approveMutation = useApproveSupplier();
  const blockMutation   = useBlockSupplier();
  const archiveMutation = useArchiveSupplier();
  const updateSupplier  = useUpdateSupplier();

  if (!supplier) return null;

  const status        = normalizeSupplierStatus(supplier);
  const score         = computeSupplierScoreM1(supplier);
  const alerts        = computeSupplierAlerts(supplier);
  const isBioValid    = hasValidBioCertification(supplier);

  // Bloquer/archiver sont des changements de statut réversibles : action
  // immédiate + toast « Annuler » qui restaure le statut précédent.
  const undoStatusChange = () =>
    updateSupplier.mutateAsync({
      id: supplier.id,
      supplier_status: status,
      is_active: supplier.is_active,
    } as Partial<Supplier> & { id: string });

  const handleApprove = async () => {
    await approveMutation.mutateAsync(supplier.id);
    onOpenChange(false);
  };

  const handleBlock = async () => {
    await blockMutation.mutateAsync(supplier.id);
    onOpenChange(false);
    toast(`${supplier.name} bloqué`, { action: { label: 'Annuler', onClick: undoStatusChange } });
  };

  const handleArchive = async () => {
    await archiveMutation.mutateAsync(supplier.id);
    onOpenChange(false);
    toast(`${supplier.name} archivé (RG-F06)`, { action: { label: 'Annuler', onClick: undoStatusChange } });
  };

  // Grade colour
  const gradeClass =
    score.grade === 'excellent'
      ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
      : score.grade === 'good'
        ? 'bg-sky-50 border-sky-200 text-sky-700'
        : score.grade === 'watch'
          ? 'bg-amber-50 border-amber-200 text-amber-700'
          : 'bg-red-50 border-red-200 text-red-700';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">

        {/* Header */}
        <SheetHeader className="space-y-3 pb-4 border-b">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-mono text-muted-foreground">{supplier.code}</p>
              <SheetTitle className="text-xl leading-tight">{supplier.name}</SheetTitle>
              {supplier.name_ar && (
                <p dir="auto" className="text-sm text-muted-foreground">{supplier.name_ar}</p>
              )}
            </div>
            <Badge className={getSupplierStatusClassName(status)}>
              {getSupplierStatusLabel(status)}
            </Badge>
          </div>

          <div className="flex flex-wrap gap-2">
            {supplier.region && (
              <Badge variant="outline">
                <MapPin className="h-3 w-3 mr-1" />{supplier.region}
              </Badge>
            )}
            {supplier.actor_type && (
              <Badge variant="secondary">{supplier.actor_type.replace(/_/g, ' ')}</Badge>
            )}
            {(supplier.produced_varieties ?? []).map((v) => (
              <Badge key={v} variant="outline">{v}</Badge>
            ))}
            {isBioValid && (
              <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">
                <Leaf className="h-3 w-3 mr-1" />Bio certifié ✓
              </Badge>
            )}
          </div>
        </SheetHeader>

        {/* Tabs */}
        <Tabs defaultValue="performance" className="mt-4">
          <TabsList className="w-full flex flex-wrap h-auto gap-0.5">
            <TabsTrigger value="performance" className="py-1.5 flex-1 min-w-[5rem]">Performance</TabsTrigger>
            <TabsTrigger value="identite" className="py-1.5 flex-1 min-w-[4rem]">Identité</TabsTrigger>
            <TabsTrigger value="livraisons" className="py-1.5 flex-1 min-w-[4rem]">
              <Truck className="h-3 w-3 mr-1" />Lots
            </TabsTrigger>
            <TabsTrigger value="commandes" className="py-1.5 flex-1 min-w-[5rem]">
              <ShoppingCart className="h-3 w-3 mr-1" />Commandes
            </TabsTrigger>
            <TabsTrigger value="paiements" className="py-1.5 flex-1 min-w-[5rem]">
              <CreditCard className="h-3 w-3 mr-1" />Paiements
            </TabsTrigger>
            <TabsTrigger value="documents" className="py-1.5 flex-1 min-w-[3.5rem]">
              <FileText className="h-3 w-3 mr-1" />Docs
            </TabsTrigger>
            <TabsTrigger value="historique" className="py-1.5 flex-1 min-w-[3rem]">
              <ClipboardList className="h-3 w-3 mr-1" />Log
            </TabsTrigger>
            <TabsTrigger value="alertes" className="py-1.5 flex-1 min-w-[4rem]">
              Alertes
              {alerts.length > 0 && (
                <span className="ml-1 rounded-full bg-red-500 text-white text-[0.6rem] px-1 py-0.5 leading-none">
                  {alerts.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="actions" className="py-1.5 flex-1 min-w-[4rem]">Actions</TabsTrigger>
          </TabsList>

          {/* ── Performance ─────────────────────────────────────────────── */}
          <TabsContent value="performance" className="space-y-6 mt-4">

            {/* Score summary */}
            <div className={`rounded-2xl border p-5 text-center ${gradeClass}`}>
              <p className="text-xs font-semibold uppercase tracking-widest opacity-70 mb-1">
                Score M1 Royal Palm — §1.2
              </p>
              <p className="text-6xl font-black leading-none tabular-nums">
                {score.finalScore.toFixed(1)}
              </p>
              <p className="text-sm mt-1 opacity-70">points sur 100</p>
              {score.autoBlockTriggered && (
                <div className="mt-3 rounded-lg bg-red-100 border border-red-300 px-3 py-2 text-sm text-red-800 font-medium">
                  ⚠ Blocage automatique requis — Taux de rejet &gt; 20 % (RG-F03)
                </div>
              )}
            </div>

            {/* Radar chart — 5 criteria */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Vue radar des 5 critères
              </p>
              <ResponsiveContainer width="100%" height={220}>
                <RadarChart
                  data={[
                    { critere: 'Qualité lots', score: score.qualityScore },
                    { critere: 'Rejet', score: score.rejectionScore },
                    { critere: 'Quantités', score: score.quantityScore },
                    { critere: 'Ponctualité', score: score.punctualityScore },
                    { critere: 'Documents', score: score.documentScore },
                  ]}
                >
                  <PolarGrid />
                  <PolarAngleAxis dataKey="critere" tick={{ fontSize: 11 }} />
                  <Radar
                    dataKey="score"
                    stroke="#16a34a"
                    fill="#16a34a"
                    fillOpacity={0.18}
                    strokeWidth={2}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            {/* Criteria bars */}
            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Décomposition par critère — §1.2
              </p>
              <CriterionBar label="Qualité des lots" score={score.qualityScore} weight={40}
                description="Extra=100 · Cat.I=80 · Cat.II=60 · Rejeté=0 (12 mois)" />
              <Separator />
              <CriterionBar label="Taux de rejet" score={score.rejectionScore} weight={20}
                description={`(1 − ${supplier.rejection_rate ?? 0} %) × 100 — blocage auto si > 20 %`} />
              <Separator />
              <CriterionBar label="Respect des quantités" score={score.quantityScore} weight={15}
                description="100 − |écart moyen %| — tolérance ±5 % = 100 pts" />
              <Separator />
              <CriterionBar label="Ponctualité" score={score.punctualityScore} weight={15}
                description="% livraisons dans le délai (±1 jour = conforme)" />
              <Separator />
              <CriterionBar label="Documents complets" score={score.documentScore} weight={10}
                description="% livraisons avec bon de livraison complet" />
            </div>

            {/* Score trend (last 12 snapshots from performance_history) */}
            {(supplier.performance_history ?? []).length >= 2 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  Évolution du score qualité
                </p>
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart
                    data={(supplier.performance_history ?? [])
                      .slice(-12)
                      .map((snap) => ({
                        date: snap.at ? new Date(snap.at).toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' }) : '',
                        score: snap.quality_score ?? 0,
                        rejet: snap.rejection_rate ?? 0,
                      }))}
                    margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                    <Tooltip
                      formatter={(value: number, name: string) => [
                        `${value.toFixed(1)}`,
                        name === 'score' ? 'Score qualité' : 'Taux rejet %',
                      ]}
                    />
                    <Line type="monotone" dataKey="score" stroke="#16a34a" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="rejet" stroke="#ef4444" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
                  </LineChart>
                </ResponsiveContainer>
                <div className="flex gap-4 mt-1 text-[11px] text-muted-foreground justify-center">
                  <span className="flex items-center gap-1"><span className="inline-block h-0.5 w-4 bg-emerald-600" />Score qualité</span>
                  <span className="flex items-center gap-1"><span className="inline-block h-0.5 w-4 bg-red-500 border-dashed border-t border-red-500" />Taux rejet %</span>
                </div>
              </div>
            )}

            {/* KPI tiles */}
            <div className="grid grid-cols-2 gap-3">
              {[
                ['Lots livrés', supplier.delivered_lots_count ?? '—'],
                ['Poids total livré', supplier.total_delivered_tons != null ? `${supplier.total_delivered_tons} T` : '—'],
                ['Taux de rejet', `${supplier.rejection_rate ?? 0} %`],
                ['Montant payé', supplier.total_paid_amount_tnd != null ? `${supplier.total_paid_amount_tnd} TND` : '—'],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-xl bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="text-lg font-semibold tabular-nums">{value}</p>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* ── Identité ────────────────────────────────────────────────── */}
          <TabsContent value="identite" className="space-y-4 mt-4">
            <div className="flex justify-end">
              <Button size="sm" variant="outline" onClick={() => onEdit(supplier)}>
                <Edit2 className="h-3.5 w-3.5 mr-1.5" />Modifier
              </Button>
            </div>

            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Bloc Identité</p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                <Field label="Code fournisseur" value={supplier.code} />
                <Field label="Type d'acteur" value={supplier.actor_type?.replace(/_/g, ' ')} />
                <Field label="Nom / raison sociale" value={supplier.name} />
                <Field label="Surnom / nom usuel" value={supplier.nickname} />
                <Field label="CIN / Matricule fiscal" value={supplier.fiscal_identifier || supplier.id_document_number} />
                <Field label="Téléphone principal" value={supplier.phone} />
                <Field label="Téléphone secondaire" value={supplier.secondary_phone} />
                <Field label="Email" value={supplier.email} />
                <Field label="Adresse postale" value={supplier.postal_address || supplier.address} />
              </div>

              <Separator />
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Bloc Oasis et Production</p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                <Field label="Région" value={supplier.region} />
                <Field label="Ville / Localité" value={supplier.locality || supplier.city} />
                <Field label="Nom de l'oasis" value={supplier.oasis_name} />
                <Field label="Coordonnées GPS" value={supplier.gps_coordinates} />
                <Field label="Surface exploitée (ha)" value={supplier.exploited_area_ha} />
                <Field label="Nombre de palmiers" value={supplier.palm_tree_count} />
                <Field label="Production annuelle est. (T)" value={supplier.annual_production_tons} />
                <Field label="Mode de culture" value={supplier.farming_mode} />
                <Field label="Irrigué par" value={supplier.irrigation_source} />
              </div>

              <Separator />
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Bloc Commercial et Contractuel</p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                <Field label="Type de contrat" value={supplier.contract_type} />
                <Field label="Date début contrat" value={supplier.contract_start_date} />
                <Field label="Date fin contrat" value={supplier.contract_end_date} />
                <Field label="Conditions de paiement" value={supplier.payment_terms} />
                <Field
                  label="RIB bancaire"
                  value={supplier.bank_rib ? `••••${String(supplier.bank_rib).slice(-4)}` : undefined}
                />
                <Field label="Prix convenu (TND/kg)" value={supplier.agreed_price_tnd_per_kg} />
              </div>

              {(supplier.certifications ?? []).length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Certifications</p>
                  <div className="flex flex-wrap gap-2">
                    {(supplier.certifications ?? []).map((c) => (
                      <Badge key={c.name} className="border-emerald-200 bg-emerald-50 text-emerald-700">
                        <Leaf className="h-3 w-3 mr-1" />
                        {c.name}{c.validUntil ? ` · jusqu'au ${c.validUntil}` : ''}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <Separator />
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Bloc Statut et Qualification</p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                <Field label="Statut" value={getSupplierStatusLabel(status)} />
                <Field label="Qualification" value={supplier.qualification_status} />
                <Field label="Conformité" value={supplier.compliance_status} />
                <Field label="Niveau de risque" value={supplier.risk_level} />
                <Field label="Date agrément" value={supplier.approval_date} />
                <Field label="Approuvé par" value={supplier.approved_by} />
                <Field label="Dernière livraison" value={supplier.last_delivery_date} />
                <Field label="Dernière évaluation" value={supplier.last_evaluation_date} />
                <Field label="Prochaine évaluation" value={supplier.next_evaluation_date} />
              </div>
            </div>
          </TabsContent>

          {/* ── Alertes ─────────────────────────────────────────────────── */}
          <TabsContent value="alertes" className="space-y-3 mt-4">
            {alerts.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
                <CheckCircle className="h-10 w-10 text-emerald-400" />
                <p className="text-sm font-medium">Aucune alerte ouverte</p>
                <p className="text-xs">Ce fournisseur est conforme à toutes les règles de gestion.</p>
              </div>
            ) : (
              alerts.map((alert, i) => {
                const isCritical =
                  alert.includes('rejet') ||
                  alert.includes('blocage') ||
                  alert.includes('Conformite') ||
                  alert.includes('Bio');
                return (
                  <div
                    key={i}
                    className={`flex items-start gap-3 rounded-xl border p-4 ${
                      isCritical
                        ? 'border-red-200 bg-red-50 text-red-800'
                        : 'border-amber-200 bg-amber-50 text-amber-800'
                    }`}
                  >
                    <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium">{alert}</p>
                    </div>
                  </div>
                );
              })
            )}
          </TabsContent>

          {/* ── Actions ─────────────────────────────────────────────────── */}
          <TabsContent value="actions" className="space-y-5 mt-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Workflow agrément — §1.4.1
            </p>

            {/* Pending approval */}
            {status === 'pending_approval' && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
                <p className="text-sm font-semibold text-amber-800">
                  En attente d'agrément
                </p>
                <p className="text-xs text-amber-700">
                  Vérifiez les informations, les documents CIN / contrat et les certifications avant de valider.
                </p>
                <div className="flex gap-2">
                  <Button className="flex-1" onClick={handleApprove} disabled={approveMutation.isPending}>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Approuver → Actif
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 border-red-200 text-red-700 hover:bg-red-50"
                    onClick={handleBlock}
                    disabled={blockMutation.isPending}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Rejeter → Inactif
                  </Button>
                </div>
              </div>
            )}

            {/* Active */}
            {status === 'active' && (
              <div className="rounded-xl border p-4 space-y-3">
                <p className="text-sm font-medium">Fournisseur actif</p>
                {score.autoBlockTriggered && (
                  <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-800">
                    <span className="font-semibold">RG-F03 :</span> Le taux de rejet ({supplier.rejection_rate} %) dépasse 20 %. Le blocage manuel est recommandé par le responsable achats.
                  </div>
                )}
                <Button
                  variant="outline"
                  className="w-full border-red-200 text-red-700 hover:bg-red-50"
                  onClick={handleBlock}
                  disabled={blockMutation.isPending}
                >
                  <ShieldBan className="h-4 w-4 mr-2" />
                  Bloquer ce fournisseur
                </Button>
              </div>
            )}

            {/* Blocked / Inactive */}
            {(status === 'blocked' || status === 'inactive') && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                <p className="text-sm font-semibold">
                  Fournisseur {status === 'blocked' ? 'bloqué' : 'inactif'}
                </p>
                <div className="flex gap-2">
                  <Button className="flex-1" variant="outline" onClick={handleApprove} disabled={approveMutation.isPending}>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Réactiver
                  </Button>
                  <Button className="flex-1" variant="outline" onClick={handleArchive} disabled={archiveMutation.isPending}>
                    <Archive className="h-4 w-4 mr-2" />
                    Archiver (RG-F06)
                  </Button>
                </div>
              </div>
            )}

            {/* Archived */}
            {status === 'archived' && (
              <div className="rounded-xl border bg-muted/50 p-4 text-sm text-muted-foreground">
                Ce fournisseur est archivé. Il reste consultable mais ne peut plus livrer ni être sélectionné à la réception.
              </div>
            )}

            <Separator />

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Modifier la fiche complète
              </p>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => { onEdit(supplier); onOpenChange(false); }}
              >
                <Edit2 className="h-4 w-4 mr-2" />
                Ouvrir le formulaire complet (39 champs)
              </Button>
            </div>
          </TabsContent>

          {/* ── Livraisons ──────────────────────────────────────────────── */}
          <TabsContent value="livraisons" className="mt-4">
            <SupplierLotsTab supplierId={supplier.id} />
          </TabsContent>

          {/* ── Commandes ───────────────────────────────────────────────── */}
          <TabsContent value="commandes" className="mt-4">
            <SupplierCommandesTab supplierId={supplier.id} agreedPrice={supplier.agreed_price_tnd_per_kg ?? null} />
          </TabsContent>

          {/* ── Paiements ───────────────────────────────────────────────── */}
          <TabsContent value="paiements" className="mt-4">
            <SupplierPaiementsTab supplierId={supplier.id} totalPaid={supplier.total_paid_amount_tnd ?? 0} />
          </TabsContent>

          {/* ── Documents ───────────────────────────────────────────────── */}
          <TabsContent value="documents" className="mt-4">
            <SupplierDocumentsTab supplier={supplier} />
          </TabsContent>

          {/* ── Historique modifications ─────────────────────────────────── */}
          <TabsContent value="historique" className="mt-4">
            <SupplierHistoriqueTab supplierId={supplier.id} />
          </TabsContent>

        </Tabs>
      </SheetContent>
    </Sheet>
  );
};

// ─── Livraisons tab ──────────────────────────────────────────────────────────

const GRADE_COLORS: Record<string, string> = {
  EXTRA: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  CATEGORIE_I: 'bg-sky-100 text-sky-800 border-sky-200',
  CATEGORIE_II: 'bg-amber-100 text-amber-800 border-amber-200',
  REJETE: 'bg-red-100 text-red-800 border-red-200',
};

const GRADE_LABELS: Record<string, string> = {
  EXTRA: 'Extra',
  CATEGORIE_I: 'Cat. I',
  CATEGORIE_II: 'Cat. II',
  REJETE: 'Rejeté',
};

function SupplierLotsTab({ supplierId }: { supplierId: string }) {
  const { data: lots, isLoading } = useSupplierLots(supplierId);

  if (isLoading) {
    return <p className="text-sm text-muted-foreground p-4 text-center">Chargement des livraisons…</p>;
  }

  if (!lots || lots.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground text-sm">
        <Truck className="h-8 w-8 opacity-30" />
        <p>Aucune livraison enregistrée pour ce fournisseur.</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground mb-2">{lots.length} lot(s) — du plus récent au plus ancien</p>
      <div className="divide-y rounded-xl border overflow-hidden">
        {(lots as SupplierLotRow[]).map((lot) => (
          <div key={lot.id} className="flex items-center justify-between px-3 py-2.5 text-sm hover:bg-muted/30 transition-colors">
            <div className="min-w-0">
              <p className="font-mono text-xs text-muted-foreground">{lot.reception_number}</p>
              <p className="font-medium truncate">{lot.variety ?? '—'}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0 ml-3">
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {new Date(lot.actual_arrival_date).toLocaleDateString('fr-TN')}
              </span>
              <span className="text-xs font-semibold tabular-nums">
                {lot.quantity_total.toLocaleString('fr-TN')} {lot.unit}
              </span>
              {lot.qc_grade && (
                <Badge variant="outline" className={`text-[0.65rem] px-1.5 ${GRADE_COLORS[lot.qc_grade] ?? ''}`}>
                  {GRADE_LABELS[lot.qc_grade] ?? lot.qc_grade}
                </Badge>
              )}
              {lot.qc_score != null && (
                <span className="text-xs tabular-nums text-muted-foreground">
                  {lot.qc_score.toFixed(0)}/100
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Documents tab ───────────────────────────────────────────────────────────

function SupplierDocumentsTab({ supplier }: { supplier: import('@/types/mes').Supplier }) {
  const certs = supplier.certifications ?? [];
  const contractDocs = supplier.contract_documents ?? [];

  return (
    <div className="space-y-5">
      {/* CIN / ID document */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          Document identité
        </p>
        {supplier.cin_document_url ? (
          <a
            href={supplier.cin_document_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-muted/40 transition-colors"
          >
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span>CIN / Document identité</span>
          </a>
        ) : (
          <p className="text-xs text-muted-foreground italic">Aucun document chargé.</p>
        )}
      </div>

      {/* Certifications */}
      {certs.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Certifications
          </p>
          <div className="space-y-1.5">
            {certs.map((cert, idx) => {
              const expired = cert.validUntil && new Date(cert.validUntil) < new Date();
              return (
                <div key={idx} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Leaf className="h-4 w-4 text-emerald-600" />
                    <span className="font-medium">{cert.name}</span>
                  </div>
                  {cert.validUntil && (
                    <Badge
                      variant="outline"
                      className={expired ? 'border-red-200 bg-red-50 text-red-700 text-xs' : 'border-emerald-200 bg-emerald-50 text-emerald-700 text-xs'}
                    >
                      {expired ? 'Expirée' : 'Valide'} — {new Date(cert.validUntil).toLocaleDateString('fr-TN')}
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Contract documents */}
      {contractDocs.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Documents contractuels
          </p>
          <div className="space-y-1.5">
            {contractDocs.map((url, idx) => (
              <a
                key={idx}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-muted/40 transition-colors"
              >
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span>Document {idx + 1}</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {certs.length === 0 && contractDocs.length === 0 && !supplier.cin_document_url && (
        <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground text-sm">
          <FileText className="h-8 w-8 opacity-30" />
          <p>Aucun document enregistré.</p>
          <p className="text-xs">Modifiez la fiche pour ajouter les documents.</p>
        </div>
      )}
    </div>
  );
}

// ─── Commandes tab ───────────────────────────────────────────────────────────

const ORDER_STATUS_COLORS: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700 border-slate-200',
  confirmed: 'bg-sky-100 text-sky-800 border-sky-200',
  delivered: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  cancelled: 'bg-red-100 text-red-800 border-red-200',
  pending: 'bg-amber-100 text-amber-800 border-amber-200',
};

const ORDER_STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon', confirmed: 'Confirmée', delivered: 'Livrée',
  cancelled: 'Annulée', pending: 'En attente',
};

function SupplierCommandesTab({ supplierId, agreedPrice }: { supplierId: string; agreedPrice: number | null }) {
  const { data: orders, isLoading, error } = useSupplierOrders(supplierId);

  if (isLoading) return <p className="text-sm text-muted-foreground p-4 text-center">Chargement des commandes…</p>;

  if (error) return (
    <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground text-sm">
      <ShoppingCart className="h-8 w-8 opacity-30" />
      <p>Données commandes non disponibles.</p>
      <p className="text-xs">Collection purchase_orders introuvable ou vide.</p>
    </div>
  );

  if (!orders || orders.length === 0) return (
    <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground text-sm">
      <ShoppingCart className="h-8 w-8 opacity-30" />
      <p>Aucune commande enregistrée pour ce fournisseur.</p>
      {agreedPrice != null && (
        <p className="text-xs text-emerald-700 mt-1">Prix convenu : {agreedPrice} TND/kg (RG-F09)</p>
      )}
    </div>
  );

  const typedOrders = orders as PurchaseOrderRow[];
  const totalKg = typedOrders.reduce((sum, o) => sum + (o.quantity_kg ?? 0), 0);
  const totalTnd = typedOrders.reduce((sum, o) => sum + (o.total_amount_tnd ?? 0), 0);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        {[
          ['Commandes', orders.length],
          ['Total kg', `${totalKg.toLocaleString('fr-TN')} kg`],
          ['Montant total', `${totalTnd.toLocaleString('fr-TN', { minimumFractionDigits: 2 })} TND`],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-xl bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-base font-semibold tabular-nums">{value}</p>
          </div>
        ))}
      </div>
      {agreedPrice != null && (
        <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
          Prix convenu contrat : {agreedPrice} TND/kg (RG-F09 — pré-rempli à la création de commande)
        </p>
      )}
      <div className="divide-y rounded-xl border overflow-hidden">
        {typedOrders.map((order) => (
          <div key={order.id} className="flex items-center justify-between px-3 py-2.5 text-sm hover:bg-muted/30 transition-colors">
            <div className="min-w-0">
              <p className="font-mono text-xs text-muted-foreground">{order.order_number}</p>
              <p className="text-xs text-muted-foreground">{new Date(order.order_date).toLocaleDateString('fr-TN')}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0 ml-3">
              <span className="text-xs tabular-nums font-medium">{order.quantity_kg?.toLocaleString('fr-TN')} kg</span>
              {order.unit_price_tnd != null && (
                <span className="text-xs text-muted-foreground">{order.unit_price_tnd} TND/kg</span>
              )}
              <Badge variant="outline" className={`text-[0.65rem] px-1.5 ${ORDER_STATUS_COLORS[order.status] ?? ''}`}>
                {ORDER_STATUS_LABELS[order.status] ?? order.status}
              </Badge>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Paiements tab ───────────────────────────────────────────────────────────

function SupplierPaiementsTab({ supplierId, totalPaid }: { supplierId: string; totalPaid: number }) {
  const { data: payments, isLoading, error } = useSupplierPayments(supplierId);

  if (isLoading) return <p className="text-sm text-muted-foreground p-4 text-center">Chargement des paiements…</p>;

  if (error) return (
    <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground text-sm">
      <CreditCard className="h-8 w-8 opacity-30" />
      <p>Données paiements non disponibles.</p>
      <p className="text-xs">Collection supplier_payments introuvable ou vide.</p>
    </div>
  );

  if (!payments || payments.length === 0) return (
    <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground text-sm">
      <CreditCard className="h-8 w-8 opacity-30" />
      <p>Aucun paiement enregistré pour ce fournisseur.</p>
      {totalPaid > 0 && (
        <p className="text-xs text-emerald-700 mt-1">
          Montant cumulé (fiche) : {totalPaid.toLocaleString('fr-TN', { minimumFractionDigits: 2 })} TND
        </p>
      )}
    </div>
  );

  const typedPayments = payments as PaymentRow[];
  const total = typedPayments.reduce((sum, p) => sum + (p.amount_tnd ?? 0), 0);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-muted/50 p-3">
          <p className="text-xs text-muted-foreground">Versements</p>
          <p className="text-base font-semibold tabular-nums">{payments.length}</p>
        </div>
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3">
          <p className="text-xs text-emerald-700">Total payé</p>
          <p className="text-base font-semibold tabular-nums text-emerald-800">
            {total.toLocaleString('fr-TN', { minimumFractionDigits: 2 })} TND
          </p>
        </div>
      </div>
      <div className="divide-y rounded-xl border overflow-hidden">
        {typedPayments.map((payment) => (
          <div key={payment.id} className="flex items-center justify-between px-3 py-2.5 text-sm hover:bg-muted/30 transition-colors">
            <div className="min-w-0">
              <p className="font-mono text-xs text-muted-foreground">{payment.reference ?? '—'}</p>
              <p className="text-xs text-muted-foreground">{new Date(payment.payment_date).toLocaleDateString('fr-TN')}</p>
              {payment.lot_reference && (
                <p className="text-xs text-muted-foreground">Lot: {payment.lot_reference}</p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0 ml-3">
              <span className="text-sm font-semibold tabular-nums text-emerald-700">
                +{payment.amount_tnd.toLocaleString('fr-TN', { minimumFractionDigits: 2 })} TND
              </span>
              {payment.payment_method && (
                <Badge variant="outline" className="text-[0.65rem] px-1.5">
                  {payment.payment_method}
                </Badge>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Historique tab ──────────────────────────────────────────────────────────

function SupplierHistoriqueTab({ supplierId }: { supplierId: string }) {
  const { data: entries, isLoading } = useSupplierAuditLog(supplierId);

  if (isLoading) {
    return <p className="text-sm text-muted-foreground p-4 text-center">Chargement…</p>;
  }

  if (!entries || entries.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground text-sm">
        <ClipboardList className="h-8 w-8 opacity-30" />
        <p>Aucune modification enregistrée.</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground mb-2">{entries.length} entrée(s)</p>
      <div className="divide-y rounded-xl border overflow-hidden">
        {(entries as AuditEntryRow[]).map((entry) => (
          <div key={entry.id} className="px-3 py-2.5 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium truncate">{entry.action_label || entry.action}</span>
              <span className="text-xs text-muted-foreground whitespace-nowrap flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {new Date(entry.performed_at).toLocaleString('fr-TN')}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">Par: {entry.performed_by}</p>
            {entry.changed_fields && entry.changed_fields.length > 0 && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Champs: {entry.changed_fields.join(', ')}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
