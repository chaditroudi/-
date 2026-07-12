import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAllReceptionLots } from '@/hooks/useStock';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Box,
  CheckCircle2,
  ChevronRight,
  Clock,
  Droplets,
  ExternalLink,
  FlaskConical,
  Layers,
  Loader2,
  MapPin,
  Package,
  PackageCheck,
  Printer,
  QrCode,
  RefreshCw,
  Search,
  Ship,
  Snowflake,
  ThumbsDown,
  ThumbsUp,
  Thermometer,
  Timer,
  TrendingUp,
  Truck,
  Wind,
  X,
  XCircle,
  Zap,
  BarChart3,
  Filter,
  History,
  List,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { QrScannerDialog } from '@/components/reception/QrScannerDialog';
import { LotTraceabilityDialog } from '@/components/phase2/LotTraceabilityDialog';
import { LotGenealogyTree } from '@/components/scan/LotGenealogyTree';
import { receptionsApi } from '@/lib/api/receptions';
import { useLiveLotTraceability } from '@/hooks/useLotTraceability';
import { getSseConnection } from '@/lib/sseClient';
import type {
  LotTraceabilityData,
  TraceabilityFumigationCycle,
  TraceabilityCleaningCycle,
  TraceabilityHydrationCycle,
  TraceabilityTriageSession,
  TraceabilityProductionOrder,
  TraceabilityShipment,
} from '@/lib/api/phase2';
import { cn } from '@/lib/utils';

// ── Formatters ────────────────────────────────────────────────────────────────

const fmtDate = (d?: string | null) =>
  d ? new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(d)) : '—';

const fmtDT = (d?: string | null) =>
  d ? new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(d)) : '—';

const fmtKg = (n?: number | null) =>
  n != null ? new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(n) : '—';

const elapsed = (from?: string | null, to?: string | null) => {
  if (!from) return null;
  const ms = new Date(to ?? Date.now()).getTime() - new Date(from).getTime();
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

// ── Constants ──────────────────────────────────────────────────────────────────

const STATUS_META: Record<string, { label: string; color: string; ring: string; dot: string }> = {
  STOCK_LIBERE:   { label: 'Libéré',      color: 'text-emerald-700 bg-emerald-100 border-emerald-300', ring: 'ring-emerald-400', dot: 'bg-emerald-500' },
  EN_QUARANTAINE: { label: 'Quarantaine', color: 'text-amber-700 bg-amber-100 border-amber-300',       ring: 'ring-amber-400',   dot: 'bg-amber-500'   },
  STOCK_REJETE:   { label: 'Rejeté',      color: 'text-red-700 bg-red-100 border-red-300',             ring: 'ring-red-400',     dot: 'bg-red-500'     },
  NON_STOCKE:     { label: 'Non stocké',  color: 'text-gray-600 bg-gray-100 border-gray-300',          ring: 'ring-gray-300',    dot: 'bg-gray-400'    },
};

const GRADE: Record<string, { label: string; cls: string }> = {
  EXTRA:        { label: 'Extra',         cls: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  CATEGORIE_I:  { label: 'Catégorie I',   cls: 'bg-blue-100 text-blue-800 border-blue-300' },
  CATEGORIE_II: { label: 'Catégorie II',  cls: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
  REJETE:       { label: 'Rejeté',        cls: 'bg-red-100 text-red-800 border-red-300' },
};

const FUM_STATUS: Record<string, string> = {
  PLANNED: 'Planifié', IN_PROGRESS: 'En cours', COMPLETED: 'Terminé', FAILED: 'Échoué', CANCELLED: 'Annulé',
};

const PROD_STATUS: Record<string, string> = {
  draft: 'Brouillon', planned: 'Planifié', in_progress: 'En cours', completed: 'Terminé', cancelled: 'Annulé',
};

// ── Small UI helpers ───────────────────────────────────────────────────────────

const Kv = ({ label, value, mono }: { label: string; value?: React.ReactNode; mono?: boolean }) => (
  <div>
    <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
    <p className={cn('text-sm font-semibold mt-0.5', mono && 'font-mono')}>{value ?? '—'}</p>
  </div>
);

const SectionCard = ({ title, icon: Icon, children, className }: {
  title: string; icon: typeof Package; children: React.ReactNode; className?: string;
}) => (
  <Card className={cn('border', className)}>
    <CardHeader className="py-3 px-4 border-b bg-muted/30">
      <CardTitle className="text-sm flex items-center gap-2 font-semibold">
        <Icon className="h-4 w-4 text-muted-foreground" />
        {title}
      </CardTitle>
    </CardHeader>
    <CardContent className="p-4">{children}</CardContent>
  </Card>
);

const StepBadge = ({ ok, label }: { ok: boolean | null | undefined; label: string }) => (
  <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border',
    ok === true  ? 'bg-emerald-50 text-emerald-700 border-emerald-300' :
    ok === false ? 'bg-red-50 text-red-700 border-red-300' :
                   'bg-gray-50 text-gray-500 border-gray-200',
  )}>
    {ok === true ? <CheckCircle2 className="h-3 w-3" /> : ok === false ? <XCircle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
    {label}
  </span>
);

// ── Process chain (visual header) ─────────────────────────────────────────────

const ChainNode = ({ done, active, label, Icon }: { done: boolean; active?: boolean; label: string; Icon: typeof Package }) => (
  <div className="flex flex-col items-center gap-1 min-w-[52px]">
    <div className={cn(
      'h-9 w-9 rounded-full flex items-center justify-center border-2 transition-all',
      done    ? 'bg-emerald-500 border-emerald-600 text-white shadow-sm'
              : active ? 'bg-blue-100 border-blue-400 text-blue-600 animate-pulse'
              : 'bg-gray-100 border-gray-200 text-gray-300',
    )}>
      <Icon className="h-4 w-4" />
    </div>
    <span className={cn('text-[11px] font-semibold text-center leading-tight uppercase tracking-wide',
      done ? 'text-emerald-700' : active ? 'text-blue-600' : 'text-gray-300',
    )}>{label}</span>
  </div>
);

const ProcessBar = ({ data }: { data: LotTraceabilityData }) => {
  const f = data.fumigation_cycles;
  const c = data.cleaning_cycles;
  const h = data.hydration_cycles;
  const t = data.triage_sessions;
  const p = data.production_orders;
  const pk = data.packaging_orders;
  const s = data.shipments;

  const fumDone = f.some(x => x.status === 'COMPLETED');
  const fumActive = f.some(x => x.status === 'IN_PROGRESS');
  const cleanDone = c.some(x => x.status === 'COMPLETED');
  const cleanActive = c.some(x => x.status === 'IN_PROGRESS' || x.status === 'in_progress');
  const hydDone = h.some(x => x.status === 'COMPLETED' || x.status === 'completed');
  const hydActive = h.some(x => x.status === 'IN_PROGRESS' || x.status === 'in_progress');
  const triDone = t.some(x => x.status === 'COMPLETED' || x.status === 'completed');
  const triActive = t.some(x => x.status === 'IN_PROGRESS' || x.status === 'in_progress');
  const prodDone = p.some(x => x.status === 'completed');
  const prodActive = p.some(x => x.status === 'in_progress');
  const packDone = pk.some(x => x.status === 'completed');
  const packActive = pk.some(x => x.status === 'in_progress' || x.status === 'IN_PROGRESS');
  const shipDone = s.some(x => x.status === 'SHIPPED' || x.status === 'DELIVERED');
  const shipActive = s.some(x => x.status === 'PREPARED' || x.status === 'IN_TRANSIT');

  const arrow = <ChevronRight className="h-3 w-3 text-gray-300 shrink-0 mt-3" />;

  return (
    <div className="flex items-start gap-0.5 overflow-x-auto pb-1">
      <ChainNode done Icon={Package}     label="Réception"   />
      {arrow}
      <ChainNode done={fumDone}   active={fumActive}   Icon={Wind}        label="Fumig."    />
      {arrow}
      <ChainNode done={cleanDone} active={cleanActive} Icon={Droplets}    label="Nettoy."   />
      {arrow}
      <ChainNode done={hydDone}   active={hydActive}   Icon={Thermometer} label="Hydrat."   />
      {arrow}
      <ChainNode done={triDone}   active={triActive}   Icon={Layers}      label="Triage"    />
      {arrow}
      <ChainNode done={prodDone}  active={prodActive}  Icon={TrendingUp}  label="Prod."     />
      {arrow}
      <ChainNode done={packDone}  active={packActive}  Icon={PackageCheck} label="Cond."   />
      {arrow}
      <ChainNode done={shipDone}  active={shipActive}  Icon={Ship}        label="Expéd."   />
    </div>
  );
};

// ── Tab: Qualité ──────────────────────────────────────────────────────────────

const QualiteTab = ({ data }: { data: LotTraceabilityData }) => {
  const inspections = data.qc_inspections;
  const checks = data.qc_check_results;

  if (inspections.length === 0) {
    return <p className="text-sm text-muted-foreground italic py-4 text-center">Aucune inspection QC enregistrée.</p>;
  }

  return (
    <div className="space-y-3">
      {inspections.map((insp) => {
        const myChecks = checks.filter(c => c.inspection_id === insp.id);
        const passed = myChecks.filter(c => c.result === 'PASS' || c.result === 'pass').length;
        const failed = myChecks.filter(c => c.result === 'FAIL' || c.result === 'fail').length;

        return (
          <SectionCard key={insp.id} title={`Inspection ${insp.inspection_number || insp.id.slice(-6)}`} icon={FlaskConical}>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
              <Kv label="Inspecteur" value={insp.inspector_name} />
              <Kv label="Décision" value={
                <span className={cn('font-bold',
                  insp.decision === 'ACCEPTED' ? 'text-emerald-600' :
                  insp.decision === 'REJECTED' ? 'text-red-600' : 'text-amber-600',
                )}>
                  {insp.decision === 'ACCEPTED' ? '✓ Accepté' : insp.decision === 'REJECTED' ? '✗ Rejeté' : insp.decision || '—'}
                </span>
              } />
              <Kv label="Début" value={fmtDT(insp.started_at)} />
              <Kv label="Fin" value={fmtDT(insp.ended_at)} />
            </div>
            {insp.nonconformity_codes && insp.nonconformity_codes.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-1">
                {insp.nonconformity_codes.map(c => (
                  <span key={c} className="text-xs px-2 py-0.5 rounded bg-red-50 border border-red-200 text-red-700 font-mono">{c}</span>
                ))}
              </div>
            )}
            {insp.comment && <p className="text-xs text-muted-foreground italic mb-3">« {insp.comment} »</p>}
            {myChecks.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <p className="text-xs font-semibold text-muted-foreground">Points de contrôle ({myChecks.length})</p>
                  {passed > 0 && <span className="text-xs text-emerald-600 font-medium">{passed} ✓</span>}
                  {failed > 0 && <span className="text-xs text-red-600 font-medium">{failed} ✗</span>}
                </div>
                <div className="space-y-1">
                  {myChecks.map((ck) => (
                    <div key={ck.id} className={cn(
                      'flex items-center justify-between px-2 py-1 rounded text-xs border',
                      ck.result === 'PASS' || ck.result === 'pass' ? 'bg-emerald-50 border-emerald-100' :
                      ck.result === 'FAIL' || ck.result === 'fail' ? 'bg-red-50 border-red-100' : 'bg-gray-50 border-gray-100',
                    )}>
                      <span className="font-medium">{ck.check_name || ck.check_code}</span>
                      <StepBadge ok={ck.result === 'PASS' || ck.result === 'pass'} label={ck.result || '—'} />
                    </div>
                  ))}
                </div>
              </div>
            )}
            {insp.lab_sample_required && (
              <div className="mt-3 flex items-center gap-2 text-xs text-purple-700 bg-purple-50 border border-purple-200 rounded px-2 py-1.5">
                <FlaskConical className="h-3.5 w-3.5" />
                Échantillon laboratoire requis{insp.lab_sample_code ? ` · ${insp.lab_sample_code}` : ''}
              </div>
            )}
          </SectionCard>
        );
      })}
    </div>
  );
};

// ── Tab: Transformation ───────────────────────────────────────────────────────

const TransformationTab = ({ data }: { data: LotTraceabilityData }) => {
  const empty = data.fumigation_cycles.length + data.cleaning_cycles.length +
    data.hydration_cycles.length + data.triage_sessions.length === 0;

  if (empty) {
    return <p className="text-sm text-muted-foreground italic py-4 text-center">Aucune transformation enregistrée.</p>;
  }

  return (
    <div className="space-y-3">
      {/* Fumigation */}
      {data.fumigation_cycles.map((f) => (
        <SectionCard key={f.id} title={`Fumigation ${f.cycle_number}`} icon={Wind}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
            <Kv label="Statut" value={<StepBadge ok={f.status === 'COMPLETED'} label={FUM_STATUS[f.status] || f.status} />} />
            <Kv label="Chambre" value={f.chamber} mono />
            <Kv label="Protocole" value={f.protocol} mono />
            <Kv label="Poids traité" value={f.total_weight_kg ? `${fmtKg(f.total_weight_kg)} kg` : undefined} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
            <Kv label="Début (T0)" value={fmtDT(f.t0_start)} />
            <Kv label="Fin réelle" value={fmtDT(f.t_end_real)} />
            <Kv label="Durée" value={f.duration_minutes ? `${f.duration_minutes} min` : elapsed(f.t0_start, f.t_end_real)} />
            <Kv label="Opérateur" value={f.operator_name} />
          </div>
          <div className="flex flex-wrap gap-2">
            <StepBadge ok={f.duration_compliant} label="Durée conforme" />
            <StepBadge ok={f.parameters_compliant} label="Paramètres conformes" />
            {f.operator_signed_at && <StepBadge ok label={`Signé opérateur ${fmtDT(f.operator_signed_at)}`} />}
            {f.quality_signed_at && <StepBadge ok label={`Signé QC ${fmtDT(f.quality_signed_at)}`} />}
          </div>
        </SectionCard>
      ))}

      {/* Nettoyage */}
      {data.cleaning_cycles.map((c) => (
        <SectionCard key={c.id} title={`Nettoyage ${c.cycle_number}`} icon={Droplets}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
            <Kv label="Statut" value={<StepBadge ok={c.status === 'COMPLETED' || c.status === 'completed'} label={c.status || '—'} />} />
            <Kv label="Programme" value={c.program} mono />
            <Kv label="Poids entrée" value={c.weight_in_kg ? `${fmtKg(c.weight_in_kg)} kg` : undefined} />
            <Kv label="Poids sortie" value={c.weight_out_kg ? `${fmtKg(c.weight_out_kg)} kg` : undefined} />
          </div>
          {c.yield_percent != null && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Rendement</span>
                <span className="font-bold text-blue-700">{c.yield_percent.toFixed(1)} %</span>
              </div>
              <Progress value={c.yield_percent} className="h-2" />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3 mt-3">
            <Kv label="Début" value={fmtDT(c.started_at)} />
            <Kv label="Fin" value={fmtDT(c.ended_at)} />
          </div>
        </SectionCard>
      ))}

      {/* Hydratation */}
      {data.hydration_cycles.map((h) => (
        <SectionCard key={h.id} title={`Hydratation ${h.cycle_number}`} icon={Thermometer}>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
            <Kv label="Statut" value={<StepBadge ok={h.status === 'COMPLETED' || h.status === 'completed'} label={h.status || '—'} />} />
            <Kv label="Chambre" value={h.chamber} mono />
            <Kv label="Programme appliqué" value={h.program_applied || h.program_suggested} mono />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
            <Kv label="Humidité entrée" value={h.humidity_in_percent ? `${h.humidity_in_percent} %` : undefined} />
            <Kv label="Humidité sortie" value={h.humidity_out_avg ? `${h.humidity_out_avg} %` : undefined} />
            <Kv label="Conformité" value={
              <StepBadge
                ok={h.conformity === 'CONFORME' || h.conformity === 'OK'}
                label={h.conformity || '—'}
              />
            } />
          </div>
          <Kv label="Fin" value={fmtDT(h.ended_at)} />
        </SectionCard>
      ))}

      {/* Triage */}
      {data.triage_sessions.map((t) => {
        const checks = data.triage_quality_checks.filter(c => c.session_id === t.id);
        return (
          <SectionCard key={t.id} title={`Triage ${t.session_number}`} icon={Layers}>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
              <Kv label="Statut" value={<StepBadge ok={t.status === 'COMPLETED' || t.status === 'completed'} label={t.status || '—'} />} />
              <Kv label="Ligne" value={t.line} mono />
              <Kv label="Opérateurs" value={t.worker_count ? `${t.worker_count} pers.` : undefined} />
              <Kv label="Poids total" value={t.total_sorted_kg ? `${fmtKg(t.total_sorted_kg)} kg` : undefined} />
            </div>
            {/* Grade distribution */}
            {(t.extra_percent != null || t.cat1_percent != null || t.cat2_percent != null || t.reject_percent != null) && (
              <div className="space-y-2 mb-3">
                <p className="text-xs font-semibold text-muted-foreground">Distribution grades</p>
                {[
                  { label: 'Extra', pct: t.extra_percent, cls: 'bg-emerald-500' },
                  { label: 'Cat. I', pct: t.cat1_percent, cls: 'bg-blue-500' },
                  { label: 'Cat. II', pct: t.cat2_percent, cls: 'bg-yellow-500' },
                  { label: 'Rejet', pct: t.reject_percent, cls: 'bg-red-500' },
                ].filter(r => r.pct != null).map(r => (
                  <div key={r.label} className="space-y-0.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{r.label}</span>
                      <span className="font-bold">{(r.pct!).toFixed(1)} %</span>
                    </div>
                    <Progress value={r.pct!} className={cn('h-1.5')} />
                  </div>
                ))}
              </div>
            )}
            {t.quality_score_percent != null && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Score qualité triage :</span>
                <span className={cn('font-bold', t.quality_score_percent >= 90 ? 'text-emerald-600' : t.quality_score_percent >= 70 ? 'text-amber-600' : 'text-red-600')}>
                  {t.quality_score_percent.toFixed(1)} %
                </span>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 mt-3">
              <Kv label="Début" value={fmtDT(t.started_at)} />
              <Kv label="Fin" value={fmtDT(t.ended_at)} />
            </div>
            {/* Sub-lots from this triage */}
            {data.sub_lots.filter(sl => sl.session_id === t.id).length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-semibold text-muted-foreground mb-1">Sous-lots créés</p>
                <div className="flex flex-wrap gap-2">
                  {data.sub_lots.filter(sl => sl.session_id === t.id).map(sl => (
                    <span key={sl.id} className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs border font-mono',
                      GRADE[sl.grade ?? '']?.cls ?? 'bg-gray-50 border-gray-200 text-gray-700',
                    )}>
                      {sl.lot_number}
                      {sl.weight_kg && <span className="opacity-70">· {fmtKg(sl.weight_kg)} kg</span>}
                      {sl.percent_of_parent && <span className="opacity-60">({sl.percent_of_parent.toFixed(0)}%)</span>}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {/* Triage QC checks */}
            {checks.length > 0 && (
              <div className="mt-3 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground">Contrôles qualité triage</p>
                {checks.map((ck) => (
                  <div key={ck.id} className="text-xs grid grid-cols-2 sm:grid-cols-4 gap-2 border rounded p-2 bg-muted/20">
                    <Kv label="Inspecteur" value={ck.inspector_name} />
                    <Kv label="Échantillon" value={ck.sample_weight_kg ? `${ck.sample_weight_kg} kg` : undefined} />
                    <Kv label="Taux erreur" value={ck.error_rate_percent != null ? `${ck.error_rate_percent} %` : undefined} />
                    <Kv label="Date" value={fmtDT(ck.checked_at)} />
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        );
      })}
    </div>
  );
};

// ── Tab: Production ────────────────────────────────────────────────────────────

const ProductionTab = ({ data }: { data: LotTraceabilityData }) => {
  if (data.production_orders.length === 0) {
    return <p className="text-sm text-muted-foreground italic py-4 text-center">Aucun ordre de production lié.</p>;
  }

  return (
    <div className="space-y-3">
      {data.production_orders.map((po) => {
        const steps = data.production_steps.filter(s => s.production_order_id === po.id);
        const qcChecks = data.production_quality_checks.filter(q =>
          steps.some(s => s.id === q.production_step_id),
        );
        const outputLots = data.output_lots.filter(o => o.production_order_id === po.id);

        return (
          <SectionCard key={po.id} title={`Ordre ${po.order_number || po.id.slice(-6)}`} icon={TrendingUp}>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
              <Kv label="Produit" value={po.product_name} />
              <Kv label="Statut" value={<StepBadge ok={po.status === 'completed'} label={PROD_STATUS[po.status ?? ''] || po.status || '—'} />} />
              <Kv label="Qté cible" value={po.target_quantity ? `${fmtKg(po.target_quantity)} ${po.unit || 'kg'}` : undefined} />
              <Kv label="Qté réelle" value={po.actual_quantity ? `${fmtKg(po.actual_quantity)} ${po.unit || 'kg'}` : undefined} />
            </div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <Kv label="Début" value={fmtDT(po.actual_start_date)} />
              <Kv label="Fin" value={fmtDT(po.actual_end_date)} />
            </div>

            {/* Steps */}
            {steps.length > 0 && (
              <div className="mb-3">
                <p className="text-xs font-semibold text-muted-foreground mb-2">Étapes ({steps.length})</p>
                <div className="space-y-1.5">
                  {steps.map((s, i) => (
                    <div key={s.id} className="border rounded px-3 py-2 bg-muted/20">
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="text-xs font-semibold">Étape {s.sequence_order ?? i + 1}</span>
                        <StepBadge ok={s.status === 'completed'} label={PROD_STATUS[s.status ?? ''] || s.status || '—'} />
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                        <Kv label="Opérateur" value={s.operator_name} />
                        <Kv label="Entrée" value={s.input_quantity ? `${fmtKg(s.input_quantity)} kg` : undefined} />
                        <Kv label="Sortie" value={s.output_quantity ? `${fmtKg(s.output_quantity)} kg` : undefined} />
                        <Kv label="Déchet" value={s.waste_quantity ? `${fmtKg(s.waste_quantity)} kg` : undefined} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* QC checks */}
            {qcChecks.length > 0 && (
              <div className="mb-3">
                <p className="text-xs font-semibold text-muted-foreground mb-1">Contrôles qualité ({qcChecks.length})</p>
                <div className="space-y-1">
                  {qcChecks.map((q) => (
                    <div key={q.id} className={cn('flex items-center gap-2 px-2 py-1 rounded text-xs border',
                      q.is_passed ? 'bg-emerald-50 border-emerald-100' : q.is_passed === false ? 'bg-red-50 border-red-100' : 'bg-gray-50 border-gray-100',
                    )}>
                      <StepBadge ok={q.is_passed} label={q.is_passed ? 'OK' : q.is_passed === false ? 'NOK' : '—'} />
                      <span className="font-medium">{q.parameter_name || q.check_type}</span>
                      {q.expected_value && <span className="text-muted-foreground">attendu: {q.expected_value}</span>}
                      {q.actual_value && <span>→ {q.actual_value}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Output lots */}
            {outputLots.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1">Lots PF créés</p>
                <div className="flex flex-wrap gap-2">
                  {outputLots.map(ol => (
                    <div key={ol.id} className="px-2 py-1.5 rounded border bg-blue-50 border-blue-200 text-xs">
                      <p className="font-mono font-bold text-blue-800">{ol.lot_pf_number}</p>
                      <p className="text-blue-600">{fmtKg(ol.quantity)} {ol.unit || 'kg'}{ol.bio_declared ? ' · BIO' : ''}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </SectionCard>
        );
      })}
    </div>
  );
};

// ── Tab: Stock & Conditionnement ───────────────────────────────────────────────

const StockTab = ({ data }: { data: LotTraceabilityData }) => {
  const mvts = [...data.reception_stock_movements, ...data.stock_movements];

  return (
    <div className="space-y-3">
      {/* Stock lots */}
      {data.stock_lots.length > 0 && (
        <SectionCard title="Lots en stock" icon={Box}>
          <div className="space-y-2">
            {data.stock_lots.map((sl) => (
              <div key={sl.id} className="border rounded px-3 py-2 bg-muted/20">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="font-mono font-bold text-sm">{sl.lot_number || sl.source_lot_internal}</span>
                  <span className={cn('text-xs px-2 py-0.5 rounded-full border font-medium',
                    sl.status === 'AVAILABLE' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                    sl.status === 'RESERVED'  ? 'bg-blue-50 text-blue-700 border-blue-200' :
                    'bg-gray-50 text-gray-600 border-gray-200',
                  )}>
                    {sl.status}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <Kv label="Qté actuelle" value={sl.current_quantity ? `${fmtKg(sl.current_quantity)} ${sl.unit || 'kg'}` : undefined} />
                  <Kv label="Zone" value={sl.storage_location_code} mono />
                  <Kv label="Validé QC par" value={sl.qc_validated_by} />
                  <Kv label="Date QC" value={fmtDT(sl.qc_validated_at)} />
                </div>
                {sl.quality_notes && <p className="text-xs text-muted-foreground mt-1 italic">« {sl.quality_notes} »</p>}
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Packaging */}
      {data.packaging_orders.length > 0 && (
        <SectionCard title="Conditionnement" icon={PackageCheck}>
          {data.packaging_orders.map((pk) => {
            const palettes = data.packaging_palettes.filter(p => p.order_id === pk.id);
            return (
              <div key={pk.id} className="border rounded px-3 py-2 bg-muted/20 mb-2">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="font-mono font-bold">{pk.order_number}</span>
                  <StepBadge ok={pk.status === 'completed'} label={pk.status || '—'} />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
                  <Kv label="Grade" value={pk.grade ? <span className={cn('px-1.5 py-0.5 rounded border text-xs', GRADE[pk.grade]?.cls ?? 'bg-gray-50 border-gray-200')}>{GRADE[pk.grade]?.label ?? pk.grade}</span> : undefined} />
                  <Kv label="BOM" value={pk.bom_name} />
                  <Kv label="Unités cible" value={pk.target_units} />
                  <Kv label="Unités prod." value={pk.produced_units} />
                </div>
                {palettes.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-1">Palettes ({palettes.length})</p>
                    <div className="space-y-1">
                      {palettes.map(p => (
                        <div key={p.id} className="flex gap-3 text-xs border rounded px-2 py-1 bg-white">
                          <span className="font-mono font-bold">{p.palette_number}</span>
                          <span className="text-muted-foreground">{fmtKg(p.net_weight_kg)} kg</span>
                          {p.sscc && <span className="font-mono text-blue-700">SSCC: {p.sscc}</span>}
                          {p.seal_number && <span className="text-purple-700">Scellé: {p.seal_number}</span>}
                          <StepBadge ok={p.status === 'SEALED' || p.status === 'SHIPPED'} label={p.status || '—'} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </SectionCard>
      )}

      {/* Movements */}
      {mvts.length > 0 && (
        <SectionCard title={`Mouvements de stock (${mvts.length})`} icon={ArrowRight}>
          <div className="space-y-1.5">
            {mvts.map((m, i) => (
              <div key={m.id ?? i} className="flex items-start gap-2 text-xs border-b pb-1.5 last:border-0">
                <div className="mt-0.5 h-5 w-5 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                  <ArrowRight className="h-2.5 w-2.5 text-blue-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-gray-100 border">{m.movement_type}</span>
                    <span className="font-medium">{fmtKg(m.quantity)} {m.unit || 'kg'}</span>
                    {m.performed_by && <span className="text-muted-foreground">· {m.performed_by}</span>}
                  </div>
                  <span className="text-muted-foreground">{fmtDT('performed_at' in m ? m.performed_at : (m as { movement_date?: string | null }).movement_date)}</span>
                  {m.notes && <p className="text-muted-foreground italic">« {m.notes} »</p>}
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  );
};

// ── Tab: Expédition ────────────────────────────────────────────────────────────

const ExpeditionTab = ({ data }: { data: LotTraceabilityData }) => {
  if (data.shipments.length === 0) {
    return <p className="text-sm text-muted-foreground italic py-4 text-center">Aucune expédition liée à ce lot.</p>;
  }

  return (
    <div className="space-y-3">
      {data.shipments.map((sh) => {
        const lines = data.shipment_lines.filter(l => l.shipment_id === sh.id);
        return (
          <SectionCard key={sh.id} title={`Expédition ${sh.shipment_number}`} icon={Truck}>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
              <Kv label="Client" value={sh.customer_name} />
              <Kv label="Destination" value={sh.destination} />
              <Kv label="Statut" value={
                <span className={cn('font-bold',
                  sh.status === 'SHIPPED' || sh.status === 'DELIVERED' ? 'text-emerald-600' :
                  sh.status === 'PREPARED' ? 'text-blue-600' : 'text-gray-600',
                )}>
                  {sh.status}
                </span>
              } />
              <Kv label="Validé par" value={sh.validated_by} />
            </div>
            <div className="grid grid-cols-3 gap-3 mb-3">
              <Kv label="Date demandée" value={fmtDate(sh.requested_date)} />
              <Kv label="Préparé le" value={fmtDT(sh.prepared_at)} />
              <Kv label="Expédié le" value={fmtDT(sh.shipped_at)} />
            </div>
            {lines.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1">Lignes ({lines.length})</p>
                <div className="space-y-1">
                  {lines.map(l => (
                    <div key={l.id} className="text-xs border rounded px-2 py-1.5 bg-muted/20 grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <Kv label="Demandé" value={l.requested_quantity ? `${fmtKg(l.requested_quantity)} ${l.unit || 'kg'}` : undefined} />
                      <Kv label="Prélevé" value={l.picked_quantity ? `${fmtKg(l.picked_quantity)} ${l.unit || 'kg'}` : undefined} />
                      <Kv label="Par" value={l.picked_by} />
                      <Kv label="Le" value={fmtDT(l.picked_at)} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </SectionCard>
        );
      })}
    </div>
  );
};

// ── Tab: Historique ────────────────────────────────────────────────────────────

const HistoriqueTab = ({ data, liveAt }: { data: LotTraceabilityData; liveAt: string | null }) => {
  const timeline = [...data.timeline].sort((a, b) =>
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
  const audits = data.audit_logs;

  const SEV_DOT: Record<string, string> = {
    success: 'bg-emerald-500', info: 'bg-blue-500', warning: 'bg-amber-500', error: 'bg-red-500',
  };

  return (
    <div className="space-y-4">
      {/* Timeline */}
      {timeline.length > 0 && (
        <SectionCard title={`Chronologie (${timeline.length} événements)`} icon={Timer}>
          <div className="space-y-2">
            {timeline.map((ev) => (
              <div key={ev.id} className="flex gap-3">
                <div className="flex flex-col items-center gap-0.5 shrink-0">
                  <div className={cn('h-2.5 w-2.5 rounded-full mt-1 shrink-0', SEV_DOT[ev.severity] ?? 'bg-gray-400')} />
                  <div className="w-px flex-1 bg-gray-200" />
                </div>
                <div className="pb-2 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold">{ev.title}</span>
                    <span className="text-[11px] text-muted-foreground">{fmtDT(ev.timestamp)}</span>
                    {ev.stage && <span className="text-[11px] px-1.5 py-0.5 rounded bg-gray-100 border font-mono">{ev.stage}</span>}
                  </div>
                  {ev.detail && <p className="text-xs text-muted-foreground mt-0.5">{ev.detail}</p>}
                  {ev.actor && <p className="text-[11px] text-muted-foreground">👤 {ev.actor}{ev.document_number ? ` · ${ev.document_number}` : ''}</p>}
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Audit logs */}
      <SectionCard title={`Journal d'audit (${audits.length} entrées)`} icon={History}>
        {liveAt && (
          <p className="text-xs text-green-600 mb-2 flex items-center gap-1">
            <Zap className="h-3 w-3" /> Dernière mise à jour live : {fmtDT(liveAt)}
          </p>
        )}
        {audits.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">Aucune entrée d'audit.</p>
        ) : (
          <div className="space-y-1.5">
            {audits.map((log, i) => (
              <div key={i} className="flex gap-2 text-xs border-b pb-1.5 last:border-0">
                <Clock className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <span className="font-semibold">{log.action_label || log.action}</span>
                  {log.performed_by && <span className="text-muted-foreground"> · {log.performed_by}</span>}
                  {log.module && <span className="text-muted-foreground"> · [{log.module}]</span>}
                  <p className="text-muted-foreground">{fmtDT(log.performed_at)}</p>
                  {log.changed_fields && log.changed_fields.length > 0 && (
                    <p className="text-[11px] text-muted-foreground font-mono">Champs : {log.changed_fields.join(', ')}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
};

// ── Main: LotPassport ─────────────────────────────────────────────────────────

const LotPassport = ({ lotCode, onClose }: { lotCode: string; onClose: () => void }) => {
  const [traceOpen, setTraceOpen] = useState(false);
  const [genealogyOpen, setGenealogyOpen] = useState(false);
  const queryClient = useQueryClient();
  const queryKey = ['lot-lookup', lotCode];

  // 1. Look up lot
  const { data: looked, isLoading: looking, error: lookupErr } = useQuery({
    queryKey,
    queryFn: () => receptionsApi.lookupLot(lotCode),
    enabled: !!lotCode,
    staleTime: 30_000,
    retry: 1,
  });

  // 2. Live genealogy
  const traceLotNumber = looked?.lot_internal || looked?.lot_supplier || lotCode;
  const {
    data: trace,
    isLoading: traceLoading,
    isError: traceError,
    refetch,
    recentChanges,
    lastLiveUpdateAt,
  } = useLiveLotTraceability(looked ? traceLotNumber : null);

  // 3. SSE: invalidate on any db_change for this lot
  useEffect(() => {
    const sse = getSseConnection();
    return sse.subscribe((msg) => {
      if (msg.eventName !== 'db_change') return;
      const res: string = msg.payload.resource ?? '';
      if (['reception_lots', 'receptions', 'qc_inspections', 'fumigation_cycles', 'cleaning_cycles',
           'hydration_cycles', 'triage_sessions', 'production_orders', 'stock_lots', 'shipments'].includes(res)) {
        void refetch();
        void queryClient.invalidateQueries({ queryKey });
      }
    });
  }, [refetch, queryClient, queryKey]);

  const isLoading = looking || (!!looked && traceLoading);

  const lot = looked;
  const receptionV2 = lot?.reception;
  const traceReception = trace?.reception;
  const qcGrade = receptionV2?.qc_grade ?? traceReception?.qc_grade ?? null;
  const storageZoneCode = receptionV2?.storage_zone_code ?? null;
  const status = lot?.stock_status ?? 'NON_STOCKE';
  const statusMeta = STATUS_META[status] ?? STATUS_META.NON_STOCKE;

  if (lookupErr) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="p-8 flex flex-col items-center gap-3 text-center">
          <XCircle className="h-12 w-12 text-red-400" />
          <div>
            <p className="font-bold text-red-700 text-lg">Lot introuvable</p>
            <p className="text-sm text-red-600 mt-1">Aucun lot trouvé pour <span className="font-mono font-bold">{lotCode}</span></p>
          </div>
          <Button variant="outline" size="sm" onClick={onClose}>Fermer</Button>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-10 flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-sm">Chargement de la fiche lot…</p>
        </CardContent>
      </Card>
    );
  }

  if (!lot) return null;

  // Counts for tab badges
  const qcCount = trace?.qc_inspections?.length ?? 0;
  const transCount = (trace?.fumigation_cycles?.length ?? 0) + (trace?.cleaning_cycles?.length ?? 0) +
    (trace?.hydration_cycles?.length ?? 0) + (trace?.triage_sessions?.length ?? 0);
  const prodCount = trace?.production_orders?.length ?? 0;
  const stockCount = (trace?.stock_lots?.length ?? 0) + (trace?.packaging_orders?.length ?? 0);
  const shipCount = trace?.shipments?.length ?? 0;
  const histCount = trace?.audit_logs?.length ?? 0;

  return (
    <>
      {/* ── Passport header ──────────────────────────────────────────────────── */}
      <div className={cn('rounded-xl border-2 p-4 space-y-3', statusMeta.ring, 'ring-2')}>
        {/* Top bar: id + status + actions */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono font-black text-2xl tracking-tight">{lot.lot_internal || lot.lot_supplier}</span>
              {lot.lot_internal && lot.lot_supplier && lot.lot_internal !== lot.lot_supplier && (
                <span className="font-mono text-sm text-muted-foreground">({lot.lot_supplier})</span>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={cn('inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-sm font-bold border', statusMeta.color)}>
                <span className={cn('h-2 w-2 rounded-full', statusMeta.dot)} />
                {statusMeta.label}
              </span>
              {qcGrade && (
                <span className={cn('inline-flex items-center px-2 py-0.5 rounded border text-xs font-semibold', GRADE[qcGrade]?.cls ?? 'bg-gray-100 border-gray-300 text-gray-700')}>
                  {GRADE[qcGrade]?.label ?? qcGrade}
                </span>
              )}
              {recentChanges.length > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 border border-green-300 text-green-700 text-xs font-semibold animate-pulse">
                  <Zap className="h-3 w-3" />
                  {recentChanges.length} mise(s) à jour live
                </span>
              )}
            </div>
            {(receptionV2 || traceReception) && (
              <p className="text-sm text-muted-foreground">
                {receptionV2?.reception_number || traceReception?.reception_number}
                {' · '}
                {receptionV2?.supplier_name_snapshot || traceReception?.supplier_name || '—'}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button size="icon" variant="ghost" className="h-9 w-9" onClick={() => void refetch()} title="Actualiser">
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
            <Button size="icon" variant="ghost" className="h-9 w-9" onClick={() => window.print()} title="Imprimer">
              <Printer className="h-3.5 w-3.5" />
            </Button>
            <Button size="icon" variant="ghost" className="h-9 w-9" onClick={onClose}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
          {[
            { label: 'Quantité', value: `${fmtKg(lot.quantity)} ${lot.unit || 'kg'}` },
            { label: 'Variété', value: lot.variety || receptionV2?.variety || traceReception?.variety },
            { label: 'Récolte', value: fmtDate(lot.harvest_date || receptionV2?.estimated_harvest_date) },
            { label: 'Arrivée', value: fmtDate(receptionV2?.actual_arrival_date || traceReception?.actual_arrival_date) },
            { label: 'Zone', value: storageZoneCode ?? '⚠ Non localisé', mono: true },
            { label: 'Pays origine', value: lot.origin_country },
          ].map(({ label, value, mono }) => (
            <div key={label} className="rounded-lg bg-white/70 border px-2.5 py-2 backdrop-blur-sm">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium">{label}</p>
              <p className={cn('text-sm font-bold truncate mt-0.5', mono && 'font-mono', !value && 'text-muted-foreground')}>
                {value || '—'}
              </p>
            </div>
          ))}
        </div>

        {/* Warnings */}
        {lot.quarantine_reason && (
          <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-300 px-3 py-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-bold text-amber-800">Motif de quarantaine</p>
              <p className="text-sm text-amber-700">{lot.quarantine_reason}</p>
            </div>
          </div>
        )}

        {/* Process chain */}
        {trace && (
          <div className="bg-white/60 rounded-lg border p-3">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Chaîne de transformation</p>
            <ProcessBar data={trace} />
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2 pt-1">
          <Button onClick={() => setTraceOpen(true)} className="gap-1.5">
            <ExternalLink className="h-4 w-4" />
            Traçabilité complète
          </Button>
          <Button variant="outline" onClick={() => setGenealogyOpen(true)} className="gap-1.5 border-violet-300 text-violet-700 hover:bg-violet-50">
            <TrendingUp className="h-4 w-4" />
            Arbre généalogique
          </Button>
          {lot.stock_status === 'STOCK_LIBERE' && !storageZoneCode && (
            <Button variant="outline" className="gap-1.5 border-amber-400 text-amber-800 hover:bg-amber-50">
              <MapPin className="h-4 w-4" />
              Affecter une zone
            </Button>
          )}
          {lot.stock_status === 'EN_QUARANTAINE' && (
            <Button variant="outline" className="gap-1.5 border-red-300 text-red-700 hover:bg-red-50">
              <AlertTriangle className="h-4 w-4" />
              Voir blocage qualité
            </Button>
          )}
        </div>
      </div>

      {/* ── Detailed tabs ────────────────────────────────────────────────────── */}
      {trace ? (
        <Tabs defaultValue="qualite" className="w-full">
          <TabsList className="w-full flex flex-wrap h-auto gap-1 p-1">
            {[
              { value: 'qualite',    label: 'Qualité',        count: qcCount,    Icon: FlaskConical },
              { value: 'transfo',    label: 'Transformation', count: transCount,  Icon: Wind        },
              { value: 'production', label: 'Production',     count: prodCount,   Icon: TrendingUp  },
              { value: 'stock',      label: 'Stock & Cond.',  count: stockCount,  Icon: Box         },
              { value: 'expedition', label: 'Expédition',     count: shipCount,   Icon: Truck       },
              { value: 'historique', label: 'Historique',     count: histCount,   Icon: History     },
            ].map(({ value, label, count, Icon }) => (
              <TabsTrigger key={value} value={value} className="flex items-center gap-1.5 h-8 flex-1 min-w-[100px]">
                <Icon className="h-3.5 w-3.5" />
                {label}
                {count > 0 && (
                  <span className="ml-1 inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full bg-primary/15 text-[11px] font-bold">
                    {count}
                  </span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="qualite"    className="mt-3"><QualiteTab        data={trace} /></TabsContent>
          <TabsContent value="transfo"    className="mt-3"><TransformationTab data={trace} /></TabsContent>
          <TabsContent value="production" className="mt-3"><ProductionTab     data={trace} /></TabsContent>
          <TabsContent value="stock"      className="mt-3"><StockTab          data={trace} /></TabsContent>
          <TabsContent value="expedition" className="mt-3"><ExpeditionTab     data={trace} /></TabsContent>
          <TabsContent value="historique" className="mt-3"><HistoriqueTab     data={trace} liveAt={lastLiveUpdateAt} /></TabsContent>
        </Tabs>
      ) : traceError ? (
        <Card>
          <CardContent className="p-6 flex flex-wrap items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />
            <span className="text-sm text-red-700">
              La traçabilité complète n'a pas pu être chargée.
            </span>
            <Button size="sm" variant="outline" onClick={() => refetch()}>
              Réessayer
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-6 flex items-center gap-3 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Chargement de la traçabilité complète…</span>
          </CardContent>
        </Card>
      )}

      <LotTraceabilityDialog open={traceOpen} onOpenChange={setTraceOpen} lotNumber={traceLotNumber} />
      <LotGenealogyTree open={genealogyOpen} onOpenChange={setGenealogyOpen} lotNumber={traceLotNumber} />
    </>
  );
};

// ── Status helpers ────────────────────────────────────────────────────────────

const statusLabel: Record<string, string> = {
  STOCK_LIBERE:    'Libéré',
  EN_QUARANTAINE:  'Quarantaine',
  STOCK_REJETE:    'Rejeté',
  EN_ATTENTE:      'En attente',
  EN_TRANSIT:      'En transit',
  CONSOMME:        'Consommé',
};

const statusColor: Record<string, string> = {
  STOCK_LIBERE:   'bg-emerald-100 text-emerald-700 border-emerald-200',
  EN_QUARANTAINE: 'bg-amber-100 text-amber-700 border-amber-200',
  STOCK_REJETE:   'bg-red-100 text-red-700 border-red-200',
  EN_ATTENTE:     'bg-slate-100 text-slate-600 border-slate-200',
  EN_TRANSIT:     'bg-blue-100 text-blue-700 border-blue-200',
  CONSOMME:       'bg-gray-100 text-gray-500 border-gray-200',
};

// ── ScanStation ───────────────────────────────────────────────────────────────

interface ScannedEntry { code: string; scannedAt: string }

export const ScanStation = () => {
  const [scanOpen, setScanOpen] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const [activeLotCode, setActiveLotCode] = useState<string | null>(null);
  const [history, setHistory] = useState<ScannedEntry[]>([]);
  const [tableSearch, setTableSearch] = useState('');
  const [tableStatus, setTableStatus] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: allLots = [], isLoading: lotsLoading } = useAllReceptionLots();

  const loadLot = useCallback((code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return;
    setActiveLotCode(trimmed);
    setManualInput('');
    setHistory((prev) => {
      const deduped = prev.filter((e) => e.code !== trimmed);
      return [{ code: trimmed, scannedAt: new Date().toISOString() }, ...deduped].slice(0, 10);
    });
  }, []);

  const filteredLots = useMemo(() => {
    let list = allLots;
    if (tableStatus) list = list.filter((l) => l.stock_status === tableStatus);
    if (tableSearch) {
      const q = tableSearch.toLowerCase();
      list = list.filter((l) =>
        (l.lot_internal ?? '').toLowerCase().includes(q) ||
        (l.lot_supplier ?? '').toLowerCase().includes(q) ||
        (l.variety ?? '').toLowerCase().includes(q) ||
        (l.storage_zone_code ?? '').toLowerCase().includes(q),
      );
    }
    return list;
  }, [allLots, tableSearch, tableStatus]);

  const handleScanDetected = useCallback((value: string) => {
    let code = value.trim();
    try {
      const parsed = JSON.parse(value) as Record<string, unknown>;
      code = String(
        parsed.lot_internal || parsed.lot_supplier || parsed.lot_id ||
        parsed.lotId || parsed.lot_code || parsed.barcode || code,
      );
    } catch { /* plain text */ }
    loadLot(code);
    toast.success(`Lot scanné : ${code}`, { duration: 2000 });
  }, [loadLot]);

  return (
    <div className="space-y-5">
      {/* ── Scan bar ───────────────────────────────────────────────────────── */}
      <Card className="border-2 border-dashed border-primary/25 bg-gradient-to-br from-primary/5 to-transparent">
        <CardContent className="p-5 space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              size="lg"
              className="gap-2 text-base h-12 shrink-0 sm:w-48"
              onClick={() => setScanOpen(true)}
            >
              <QrCode className="h-5 w-5" />
              Scanner QR
            </Button>
            <div className="flex flex-1 gap-2">
              <Input
                ref={inputRef}
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && manualInput.trim() && loadLot(manualInput)}
                placeholder="Code lot : LOT-0001 · REC-042 · fournisseur…"
                className="h-12 font-mono text-sm"
                autoFocus
              />
              <Button
                size="lg"
                variant="outline"
                className="h-12 shrink-0 px-5"
                onClick={() => manualInput.trim() && loadLot(manualInput)}
                disabled={!manualInput.trim()}
              >
                <Search className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {history.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground shrink-0 font-medium">Récents :</span>
              {history.map((h) => (
                <button
                  key={h.code}
                  onClick={() => loadLot(h.code)}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono border transition-all',
                    activeLotCode === h.code
                      ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                      : 'bg-white border-gray-200 hover:border-gray-400 text-gray-700 hover:bg-gray-50',
                  )}
                >
                  {activeLotCode === h.code && <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />}
                  {h.code}
                </button>
              ))}
              <button
                onClick={() => setHistory([])}
                className="text-xs text-muted-foreground hover:text-destructive ml-auto"
              >
                Effacer
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Passport ────────────────────────────────────────────────────────── */}
      {activeLotCode && (
        <LotPassport key={activeLotCode} lotCode={activeLotCode} onClose={() => setActiveLotCode(null)} />
      )}

      {/* ── All lots table ──────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <List className="h-4 w-4 text-muted-foreground shrink-0" />
              <CardTitle className="text-base font-semibold">
                Tous les lots
                {!lotsLoading && (
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    ({filteredLots.length}/{allLots.length})
                  </span>
                )}
              </CardTitle>
            </div>

            <div className="flex flex-1 gap-2 items-center">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                  placeholder="Code, variété, zone…"
                  className="pl-8 h-8 text-sm"
                />
              </div>

              <div className="flex gap-1 flex-wrap">
                {['', 'STOCK_LIBERE', 'EN_QUARANTAINE', 'STOCK_REJETE'].map((s) => (
                  <button
                    key={s}
                    onClick={() => setTableStatus(s)}
                    className={cn(
                      'px-2.5 py-1 rounded-full text-xs font-medium border transition-all',
                      tableStatus === s
                        ? 'bg-primary text-primary-foreground border-primary'
                        : s === ''
                          ? 'border-gray-200 text-gray-600 hover:border-gray-400 bg-white'
                          : cn(statusColor[s] ?? 'bg-gray-100 text-gray-600 border-gray-200', 'hover:opacity-80'),
                    )}
                  >
                    {s === '' ? 'Tous' : (statusLabel[s] ?? s)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {lotsLoading ? (
            <div className="flex items-center gap-2 p-8 text-muted-foreground justify-center">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Chargement des lots…</span>
            </div>
          ) : filteredLots.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              {allLots.length === 0 ? 'Aucun lot enregistré.' : 'Aucun lot ne correspond aux filtres.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/70">
                    <TableHead className="text-xs font-semibold pl-4 w-40">Code lot</TableHead>
                    <TableHead className="text-xs font-semibold w-36">Fournisseur</TableHead>
                    <TableHead className="text-xs font-semibold w-28">Variété</TableHead>
                    <TableHead className="text-xs font-semibold w-28 text-right">Quantité</TableHead>
                    <TableHead className="text-xs font-semibold w-32">Statut</TableHead>
                    <TableHead className="text-xs font-semibold w-32">Zone</TableHead>
                    <TableHead className="text-xs font-semibold w-28">Arrivée</TableHead>
                    <TableHead className="text-xs font-semibold text-right pr-4 w-32">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLots.map((lot) => {
                    const code = lot.lot_internal || lot.id;
                    const isActive = activeLotCode === code;
                    return (
                      <TableRow
                        key={lot.id}
                        className={cn(
                          'transition-colors cursor-pointer group',
                          isActive
                            ? 'bg-primary/8 border-l-2 border-l-primary'
                            : 'hover:bg-slate-50',
                        )}
                        onClick={() => loadLot(code)}
                      >
                        <TableCell className="pl-4 py-2.5">
                          <div className="flex items-center gap-1.5">
                            {isActive && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />}
                            <span className="font-mono text-xs font-semibold text-foreground">{code}</span>
                          </div>
                        </TableCell>
                        <TableCell className="py-2.5">
                          <span className="text-xs text-muted-foreground">{lot.lot_supplier ?? '—'}</span>
                        </TableCell>
                        <TableCell className="py-2.5">
                          <span className="text-xs">{lot.variety ?? '—'}</span>
                        </TableCell>
                        <TableCell className="py-2.5 text-right">
                          <span className="text-xs font-medium tabular-nums">
                            {lot.quantity != null ? `${fmtKg(lot.quantity)} ${lot.unit ?? 'kg'}` : '—'}
                          </span>
                        </TableCell>
                        <TableCell className="py-2.5">
                          {lot.stock_status ? (
                            <span className={cn(
                              'inline-flex px-2 py-0.5 rounded-full text-xs font-medium border',
                              statusColor[lot.stock_status] ?? 'bg-gray-100 text-gray-600 border-gray-200',
                            )}>
                              {statusLabel[lot.stock_status] ?? lot.stock_status}
                            </span>
                          ) : <span className="text-xs text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="py-2.5">
                          {lot.storage_zone_code
                            ? <span className="text-xs font-mono text-muted-foreground">{lot.storage_zone_code}</span>
                            : <span className="text-xs text-amber-500 font-medium">Non placé</span>
                          }
                        </TableCell>
                        <TableCell className="py-2.5">
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {fmtDate(lot.created_at)}
                          </span>
                        </TableCell>
                        <TableCell className="py-2.5 pr-4">
                          <div className="flex items-center gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
                            <Button
                              size="sm"
                              variant={isActive ? 'default' : 'outline'}
                              className="h-9 px-2.5 text-xs gap-1.5"
                              onClick={() => loadLot(code)}
                            >
                              <Search className="h-3 w-3" />
                              Scanner
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-9 w-9 p-0"
                              title="Scanner via caméra"
                              onClick={() => { loadLot(code); setScanOpen(false); }}
                            >
                              <QrCode className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <QrScannerDialog open={scanOpen} onOpenChange={setScanOpen} onDetected={handleScanDetected} />
    </div>
  );
};
