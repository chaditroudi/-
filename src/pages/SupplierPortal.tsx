import { useQuery } from '@tanstack/react-query';
import { suppliersApi } from '@/lib/api/suppliers';
import { useAuthContext } from '@/contexts/AuthContext';
import type { Supplier } from '@/types/mes';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
} from 'recharts';
import {
  Award,
  CreditCard,
  FileText,
  Leaf,
  MapPin,
  ShieldCheck,
  Truck,
} from 'lucide-react';
import {
  computeSupplierScoreM1,
  getSupplierStatusClassName,
  getSupplierStatusLabel,
  hasValidBioCertification,
  normalizeSupplierStatus,
} from '@/lib/royalPalmPhase1';
import { useSupplierLots, useSupplierPayments } from '@/hooks/useSuppliers';

// ─── Portail fournisseur — RG-F10 ────────────────────────────────────────────
// Read-only access for active suppliers identified by their registered email.

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

function ScoreCard({ supplier }: { supplier: Supplier }) {
  const score = computeSupplierScoreM1(supplier);
  const gradeClass =
    score.grade === 'excellent'
      ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
      : score.grade === 'good'
        ? 'bg-sky-50 border-sky-200 text-sky-700'
        : score.grade === 'watch'
          ? 'bg-amber-50 border-amber-200 text-amber-700'
          : 'bg-red-50 border-red-200 text-red-700';

  return (
    <div className="space-y-6">
      <div className={`rounded-2xl border p-5 text-center ${gradeClass}`}>
        <p className="text-xs font-semibold uppercase tracking-widest opacity-70 mb-1">
          Score qualité Royal Palm — §1.2
        </p>
        <p className="text-6xl font-black leading-none tabular-nums">{score.finalScore.toFixed(1)}</p>
        <p className="text-sm mt-1 opacity-70">points sur 100</p>
        {score.autoBlockTriggered && (
          <div className="mt-3 rounded-lg bg-red-100 border border-red-300 px-3 py-2 text-sm text-red-800 font-medium">
            ⚠ Taux de rejet &gt; 20 % — contactez votre responsable achats
          </div>
        )}
      </div>

      <ResponsiveContainer width="100%" height={200}>
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
          <Radar dataKey="score" stroke="#16a34a" fill="#16a34a" fillOpacity={0.18} strokeWidth={2} />
        </RadarChart>
      </ResponsiveContainer>

      <div className="space-y-3">
        {[
          { label: 'Qualité des lots', score: score.qualityScore, weight: 40 },
          { label: 'Taux de rejet', score: score.rejectionScore, weight: 20 },
          { label: 'Respect quantités', score: score.quantityScore, weight: 15 },
          { label: 'Ponctualité', score: score.punctualityScore, weight: 15 },
          { label: 'Documents complets', score: score.documentScore, weight: 10 },
        ].map(({ label, score: s, weight }) => (
          <div key={label} className="space-y-1">
            <div className="flex justify-between text-sm">
              <span>{label} <span className="text-muted-foreground text-xs">({weight} %)</span></span>
              <span className="font-semibold tabular-nums">{s.toFixed(1)} / 100</span>
            </div>
            <Progress value={s} className="h-1.5" />
          </div>
        ))}
      </div>
    </div>
  );
}

function LotsSection({ supplierId }: { supplierId: string }) {
  const { data: lots, isLoading } = useSupplierLots(supplierId);

  if (isLoading) return <p className="text-sm text-muted-foreground text-center py-4">Chargement…</p>;
  if (!lots || lots.length === 0) return (
    <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground text-sm">
      <Truck className="h-8 w-8 opacity-30" />
      <p>Aucune livraison enregistrée.</p>
    </div>
  );

  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground mb-2">{lots.length} lot(s) — du plus récent</p>
      <div className="divide-y rounded-xl border overflow-hidden">
        {lots.slice(0, 20).map((lot) => (
          <div key={lot.id} className="flex items-center justify-between px-3 py-2.5 text-sm">
            <div>
              <p className="font-mono text-xs text-muted-foreground">{lot.reception_number}</p>
              <p className="font-medium text-xs">{lot.variety ?? '—'} · {new Date(lot.actual_arrival_date).toLocaleDateString('fr-TN')}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold tabular-nums">{lot.quantity_total.toLocaleString('fr-TN')} {lot.unit}</span>
              {lot.qc_grade && (
                <Badge variant="outline" className={`text-[0.65rem] px-1.5 ${GRADE_COLORS[lot.qc_grade] ?? ''}`}>
                  {GRADE_LABELS[lot.qc_grade] ?? lot.qc_grade}
                </Badge>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PaiementsSection({ supplierId, totalPaid }: { supplierId: string; totalPaid: number }) {
  const { data: payments, isLoading } = useSupplierPayments(supplierId);

  if (isLoading) return <p className="text-sm text-muted-foreground text-center py-4">Chargement…</p>;

  const paid = payments && payments.length > 0
    ? payments.reduce((s, p) => s + (p.amount_tnd ?? 0), 0)
    : totalPaid;

  return (
    <div className="space-y-3">
      <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-center">
        <p className="text-xs text-emerald-700 mb-1">Montant total payé</p>
        <p className="text-3xl font-black tabular-nums text-emerald-800">
          {paid.toLocaleString('fr-TN', { minimumFractionDigits: 2 })} TND
        </p>
      </div>
      {payments && payments.length > 0 && (
        <div className="divide-y rounded-xl border overflow-hidden">
          {payments.slice(0, 20).map((p) => (
            <div key={p.id} className="flex items-center justify-between px-3 py-2.5 text-sm">
              <div>
                <p className="font-mono text-xs text-muted-foreground">{p.reference ?? '—'}</p>
                <p className="text-xs text-muted-foreground">{new Date(p.payment_date).toLocaleDateString('fr-TN')}</p>
              </div>
              <span className="font-semibold tabular-nums text-emerald-700">
                +{p.amount_tnd.toLocaleString('fr-TN', { minimumFractionDigits: 2 })} TND
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SupplierPortal() {
  const { user } = useAuthContext();
  const userEmail = user?.email ?? null;

  const { data: suppliers, isLoading, error } = useQuery({
    queryKey: ['portail-supplier', userEmail],
    queryFn: async () => {
      const all = await suppliersApi.list() as Supplier[];
      return all.filter(s => s.email === userEmail).slice(0, 2);
    },
    enabled: !!userEmail,
  });

  const supplier = suppliers?.[0] ?? null;

  if (!userEmail) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <div className="text-center space-y-2">
          <ShieldCheck className="h-12 w-12 mx-auto text-muted-foreground opacity-40" />
          <p className="font-semibold">Accès non autorisé</p>
          <p className="text-sm text-muted-foreground">Connectez-vous avec votre email fournisseur.</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Chargement de votre portail…</p>
      </div>
    );
  }

  if (error || !supplier) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <div className="text-center space-y-2 max-w-sm">
          <ShieldCheck className="h-12 w-12 mx-auto text-muted-foreground opacity-40" />
          <p className="font-semibold">Aucun compte fournisseur associé</p>
          <p className="text-sm text-muted-foreground">
            Aucune fiche fournisseur active n'est liée à l'adresse <strong>{userEmail}</strong>.
            Contactez l'équipe achats Royal Palm pour activer votre accès portail.
          </p>
        </div>
      </div>
    );
  }

  const status = normalizeSupplierStatus(supplier);
  const isBioValid = hasValidBioCertification(supplier);
  const certs = supplier.certifications ?? [];

  if (status !== 'active') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <div className="text-center space-y-2 max-w-sm">
          <ShieldCheck className="h-12 w-12 mx-auto text-amber-400 opacity-70" />
          <p className="font-semibold">Compte fournisseur {getSupplierStatusLabel(status)}</p>
          <p className="text-sm text-muted-foreground">
            Votre compte est en statut <Badge className={getSupplierStatusClassName(status)}>{getSupplierStatusLabel(status)}</Badge>.
            Contactez votre responsable achats pour plus d'informations.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/20">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-mono text-muted-foreground">{supplier.code}</p>
            <h1 className="text-lg font-bold leading-tight">{supplier.name}</h1>
            {supplier.name_ar && <p dir="auto" className="text-sm text-muted-foreground">{supplier.name_ar}</p>}
          </div>
          <div className="flex flex-col items-end gap-1">
            <Badge className={getSupplierStatusClassName(status)}>{getSupplierStatusLabel(status)}</Badge>
            <span className="text-[10px] text-muted-foreground">Portail fournisseur — lecture seule</span>
          </div>
        </div>
        <div className="max-w-2xl mx-auto px-4 pb-3 flex flex-wrap gap-2">
          {supplier.region && (
            <Badge variant="outline"><MapPin className="h-3 w-3 mr-1" />{supplier.region}</Badge>
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
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-8">

        {/* Score M1 */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Award className="h-5 w-5 text-amber-500" />
            <h2 className="font-semibold">Votre score qualité Royal Palm</h2>
          </div>
          <ScoreCard supplier={supplier} />
        </section>

        <Separator />

        {/* Contract summary */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-sky-600" />
            <h2 className="font-semibold">Informations contractuelles</h2>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              ['Type de contrat', supplier.contract_type ?? '—'],
              ['Début', supplier.contract_start_date ?? '—'],
              ['Fin', supplier.contract_end_date ?? '—'],
              ['Modalités paiement', supplier.payment_terms ?? '—'],
              ['Prix convenu', supplier.agreed_price_tnd_per_kg != null ? `${supplier.agreed_price_tnd_per_kg} TND/kg` : '—'],
              ['Conformité', supplier.compliance_status ?? '—'],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-xl bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-sm font-medium">{value}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Certifications */}
        {certs.length > 0 && (
          <>
            <Separator />
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <Leaf className="h-5 w-5 text-emerald-600" />
                <h2 className="font-semibold">Certifications</h2>
              </div>
              <div className="space-y-2">
                {certs.map((cert) => {
                  const expired = cert.validUntil && new Date(cert.validUntil) < new Date();
                  return (
                    <div key={cert.name} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                      <span className="font-medium">{cert.name}</span>
                      {cert.validUntil && (
                        <Badge variant="outline" className={expired ? 'border-red-200 bg-red-50 text-red-700 text-xs' : 'border-emerald-200 bg-emerald-50 text-emerald-700 text-xs'}>
                          {expired ? 'Expirée' : 'Valide'} — {new Date(cert.validUntil).toLocaleDateString('fr-TN')}
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          </>
        )}

        <Separator />

        {/* Livraisons */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-indigo-500" />
            <h2 className="font-semibold">Historique de mes livraisons</h2>
          </div>
          <LotsSection supplierId={supplier.id} />
        </section>

        <Separator />

        {/* Paiements */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-emerald-600" />
            <h2 className="font-semibold">Paiements reçus</h2>
          </div>
          <PaiementsSection supplierId={supplier.id} totalPaid={supplier.total_paid_amount_tnd ?? 0} />
        </section>

        <p className="text-center text-xs text-muted-foreground pb-4">
          Royal Palm · Groupe Ennour Investissement Tozeur · Portail fournisseur (RG-F10)
        </p>
      </div>
    </div>
  );
}
