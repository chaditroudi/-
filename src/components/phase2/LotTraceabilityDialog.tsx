import type { ComponentType } from 'react';
import { useLiveLotTraceability } from '@/hooks/useLotTraceability';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import {
  FumigationCycleStatus,
  FUMIGATION_PROTOCOL_CONFIG,
  HYDRATION_PROGRAM_CONFIG,
} from '@/types/phase2';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Factory,
  Flame,
  Loader2,
  Package,
  Shield,
  Truck,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const FUMIGATION_STATUS_LABEL: Record<FumigationCycleStatus, string> = {
  PREPARATION: 'Preparation',
  CHARGEMENT: 'Chargement',
  EN_COURS: 'En cours',
  VENTILATION: 'Ventilation',
  VALIDATION: 'Validation',
  TERMINE: 'Termine',
  INTERROMPU: 'Interrompu',
  ECHEC: 'Echec',
};

function fmt(iso: string | null | undefined, pattern = 'dd/MM/yyyy HH:mm') {
  if (!iso) return '—';
  return format(new Date(iso), pattern, { locale: fr });
}

function boolBadge(value: boolean, label: string) {
  return (
    <Badge className={value ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-white'}>
      {label}
    </Badge>
  );
}

function getControlTone(status: 'ok' | 'warning' | 'missing') {
  if (status === 'ok') return 'border-emerald-200 bg-emerald-50 text-emerald-900';
  if (status === 'warning') return 'border-amber-200 bg-amber-50 text-amber-900';
  return 'border-red-200 bg-red-50 text-red-900';
}

function SummaryCard({
  icon: Icon,
  title,
  value,
  detail,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  value: string;
  detail: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{title}</div>
            <div className="mt-1 text-lg font-semibold">{value}</div>
            <div className="mt-1 text-xs text-muted-foreground">{detail}</div>
          </div>
          <Icon className="h-5 w-5 text-primary" />
        </div>
      </CardContent>
    </Card>
  );
}

function SectionTitle({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <div>
          <div className="text-sm font-semibold">{title}</div>
          {subtitle ? <div className="text-xs text-muted-foreground">{subtitle}</div> : null}
        </div>
      </div>
    </div>
  );
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  lotNumber: string;
}

export function LotTraceabilityDialog({ open, onOpenChange, lotNumber }: Props) {
  const { data, isLoading, isFetching, error, recentChanges, lastLiveUpdateAt } = useLiveLotTraceability(open ? lotNumber : null);
  const recentScopes = new Set(recentChanges.map((change) => change.scope));

  const transformationCount =
    (data?.fumigation_cycles.length ?? 0)
    + (data?.cleaning_cycles.length ?? 0)
    + (data?.hydration_cycles.length ?? 0)
    + (data?.triage_sessions.length ?? 0)
    + (data?.production_orders.length ?? 0)
    + (data?.packaging_orders.length ?? 0);

  const shipmentCount = data?.shipments.length ?? 0;
  const auditCoverage = data?.controls.audit_log_count ?? 0;
  const issuesCount = data?.controls.missing_data.length ?? 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Dossier de tracabilite lot — <span className="font-mono">{lotNumber}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-2 flex-wrap text-xs">
          <Badge variant={recentChanges.length > 0 || isFetching ? 'default' : 'outline'} className="rounded-full">
            {isFetching ? 'Actualisation...' : 'Live'}
          </Badge>
          {data?.match && (
            <Badge variant="outline" className="rounded-full">
              {data.match.entity_type} · {data.match.matched_reference}
            </Badge>
          )}
          {data?.integration_summary.erp_sync_ready ? boolBadge(true, 'ERP lie') : null}
          {data?.integration_summary.scm_sync_ready ? boolBadge(true, 'SCM lie') : null}
          {lastLiveUpdateAt && (
            <span className="text-muted-foreground">
              Mise a jour {formatDistanceToNow(new Date(lastLiveUpdateAt), { addSuffix: true, locale: fr })}
            </span>
          )}
        </div>

        <ScrollArea className="max-h-[78vh] pr-4">
          {isLoading ? (
            <div className="py-16 flex items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Recherche en cours...
            </div>
          ) : error ? (
            <div className="py-10 text-center text-red-600 text-sm">Erreur: {(error as Error).message}</div>
          ) : !data ? null : (
            <div className="space-y-6">
              {recentChanges.length > 0 && (
                <section className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Clock className="h-4 w-4 text-primary" />
                    <span className="text-sm font-semibold">Derniers changements</span>
                  </div>
                  <div className="grid gap-2">
                    {recentChanges.slice(0, 6).map((change) => (
                      <div
                        key={`${change.key}-${change.detail}`}
                        className="flex items-start justify-between gap-3 rounded-lg border bg-background/80 px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{change.title}</p>
                          <p className="text-xs text-muted-foreground">{change.detail}</p>
                        </div>
                        <Badge variant={change.kind === 'new' ? 'default' : 'outline'} className="rounded-full">
                          {change.kind === 'new' ? 'Nouveau' : 'Mis a jour'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <SummaryCard
                  icon={Package}
                  title="Reception"
                  value={data.reception ? data.reception.reception_number : 'Introuvable'}
                  detail={data.reception ? `${data.reception.status} · ${data.reception.quantity_total ?? 0} ${data.reception.unit ?? 'kg'}` : 'Aucune reception reliee'}
                />
                <SummaryCard
                  icon={Shield}
                  title="Qualite"
                  value={`${data.qc_inspections.length} inspection(s)`}
                  detail={data.qc_inspections[0]?.decision ? `Derniere decision: ${data.qc_inspections[0].decision}` : 'Pas de decision QC retrouvee'}
                />
                <SummaryCard
                  icon={Factory}
                  title="Transformations"
                  value={`${transformationCount} etape(s)`}
                  detail={`${data.lineage.finished_good_lot_numbers.length} lot(s) descendants / PF`}
                />
                <SummaryCard
                  icon={Truck}
                  title="Livraison"
                  value={`${shipmentCount} expedition(s)`}
                  detail={shipmentCount > 0 ? (data.integration_summary.customer_names.join(', ') || 'Client(s) relies') : 'Aucune expedition client'}
                />
              </section>

              <section className="space-y-3">
                <SectionTitle
                  icon={CheckCircle2}
                  title="Integrite et controles"
                  subtitle={`${auditCoverage} audit(s) relies · ${issuesCount} point(s) a surveiller`}
                />
                <div className="grid gap-3 lg:grid-cols-2">
                  {data.controls.control_points.map((point) => (
                    <div
                      key={point.code}
                      className={cn('rounded-xl border p-3', getControlTone(point.status))}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-semibold">{point.label}</div>
                        <Badge variant="outline" className="bg-white/70">
                          {point.status === 'ok' ? 'OK' : point.status === 'warning' ? 'Surveillance' : 'Manquant'}
                        </Badge>
                      </div>
                      <div className="mt-1 text-xs">{point.detail}</div>
                    </div>
                  ))}
                </div>
                {data.controls.missing_data.length > 0 && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                    <div className="flex items-center gap-2 text-amber-900 font-semibold text-sm">
                      <AlertTriangle className="h-4 w-4" />
                      Ecarts ou donnees manquantes
                    </div>
                    <div className="mt-2 space-y-1">
                      {data.controls.missing_data.map((entry) => (
                        <div key={entry} className="text-xs text-amber-900">{entry}</div>
                      ))}
                    </div>
                  </div>
                )}
              </section>

              <section className="space-y-3">
                <SectionTitle
                  icon={Package}
                  title="Amont: reception, lots et QC"
                  subtitle={`${data.reception_lots.length} lot(s) reception · ${data.qc_inspections.length} controle(s)`}
                />
                {data.reception ? (
                  <Card className={cn(recentScopes.has('reception') && 'border-primary/40 bg-primary/5')}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-sm font-semibold">{data.reception.reception_number}</span>
                        <Badge variant="secondary">{data.reception.status}</Badge>
                        {data.reception.qc_grade ? <Badge variant="outline">Grade {data.reception.qc_grade}</Badge> : null}
                        {data.reception.qc_decision ? <Badge variant="outline">Decision {data.reception.qc_decision}</Badge> : null}
                      </div>
                      <div className="mt-3 grid gap-2 md:grid-cols-2 text-xs text-muted-foreground">
                        <div>Fournisseur: {data.reception.supplier_name ?? '—'}</div>
                        <div>Arrivee: {fmt(data.reception.actual_arrival_date)}</div>
                        <div>Quantite: {(data.reception.quantity_total ?? 0).toLocaleString('fr-TN')} {data.reception.unit ?? 'kg'}</div>
                        <div>Bon livraison: {data.integration_summary.delivery_note_number ?? '—'}</div>
                        <div>PO/ERP: {data.integration_summary.purchase_order_id ?? '—'}</div>
                        <div>Variete: {data.reception.variety ?? '—'}</div>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <CardContent className="p-4 text-sm text-muted-foreground">
                      Aucune reception directement retrouvee pour cette reference.
                    </CardContent>
                  </Card>
                )}

                {data.reception_lots.length > 0 && (
                  <div className="grid gap-3 lg:grid-cols-2">
                    {data.reception_lots.map((lot) => (
                      <Card key={lot.id}>
                        <CardContent className="p-4">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-sm font-semibold">{lot.lot_internal ?? lot.lot_supplier ?? lot.id}</span>
                            {lot.stock_status ? <Badge variant="outline">{lot.stock_status}</Badge> : null}
                          </div>
                          <div className="mt-2 grid gap-1 text-xs text-muted-foreground">
                            <div>Lot fournisseur: {lot.lot_supplier ?? '—'}</div>
                            <div>Origine: {[lot.origin_country, lot.origin_region, lot.origin_farm].filter(Boolean).join(' / ') || '—'}</div>
                            <div>Recolte: {fmt(lot.harvest_date, 'dd/MM/yyyy')}</div>
                            <div>Quantite: {(lot.quantity ?? 0).toLocaleString('fr-TN')} {lot.unit ?? 'kg'}</div>
                            {lot.quarantine_reason ? <div>Quarantaine: {lot.quarantine_reason}</div> : null}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {data.qc_inspections.length > 0 && (
                  <div className="grid gap-3 lg:grid-cols-2">
                    {data.qc_inspections.map((inspection) => (
                      <Card key={inspection.id} className={cn(recentScopes.has('qc') && 'border-primary/40')}>
                        <CardContent className="p-4">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-sm font-semibold">{inspection.inspection_number ?? inspection.id}</span>
                            {inspection.decision ? <Badge variant="secondary">{inspection.decision}</Badge> : null}
                            {inspection.lab_sample_required ? <Badge variant="outline">Labo</Badge> : null}
                          </div>
                          <div className="mt-2 grid gap-1 text-xs text-muted-foreground">
                            <div>Inspecteur: {inspection.inspector_name ?? '—'}</div>
                            <div>Debut: {fmt(inspection.started_at)}</div>
                            <div>Fin: {fmt(inspection.ended_at)}</div>
                            {inspection.lab_sample_code ? <div>Echantillon: {inspection.lab_sample_code}</div> : null}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {data.reception_stock_movements.length > 0 && (
                  <div className="rounded-xl border p-4">
                    <div className="text-sm font-semibold mb-2">Mouvements de reception</div>
                    <div className="space-y-2">
                      {data.reception_stock_movements.slice(0, 6).map((movement) => (
                        <div key={movement.id} className="flex items-center justify-between gap-3 text-xs">
                          <div>
                            <span className="font-mono font-semibold">{movement.movement_number ?? movement.id}</span>
                            <span className="ml-2 text-muted-foreground">{movement.movement_type}</span>
                          </div>
                          <div className="text-muted-foreground">
                            {(movement.quantity ?? 0).toLocaleString('fr-TN')} {movement.unit ?? 'kg'} · {fmt(movement.performed_at)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>

              <section className="space-y-3">
                <SectionTitle
                  icon={Factory}
                  title="Transformation et genealogie"
                  subtitle={`${data.lineage.sub_lot_numbers.length} sous-lot(s) · ${data.production_orders.length} OF · ${data.output_lots.length} lot(s) PF`}
                />

                {data.fumigation_cycles.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <Flame className="h-4 w-4 text-orange-500" />
                      Fumigation ({data.fumigation_cycles.length})
                    </div>
                    {data.fumigation_cycles.map((cycle) => (
                      <Card key={cycle.id} className={cn(recentChanges.some((change) => change.scope === 'fumigation' && change.key === `fumigation-${cycle.id}`) && 'border-primary/40 bg-primary/5')}>
                        <CardContent className="p-4">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-sm font-semibold">{cycle.cycle_number}</span>
                            <Badge variant="secondary">{cycle.status ? FUMIGATION_STATUS_LABEL[cycle.status as FumigationCycleStatus] : '—'}</Badge>
                            {cycle.protocol && <span className="text-xs text-muted-foreground">{FUMIGATION_PROTOCOL_CONFIG[cycle.protocol as keyof typeof FUMIGATION_PROTOCOL_CONFIG]?.label ?? cycle.protocol}</span>}
                          </div>
                          <div className="mt-2 grid gap-1 md:grid-cols-2 text-xs text-muted-foreground">
                            <div>Chambre: {cycle.chamber}</div>
                            <div>Poids: {(cycle.total_weight_kg ?? 0).toLocaleString('fr-TN')} kg</div>
                            <div>T0: {fmt(cycle.t0_start)}</div>
                            <div>Fin: {fmt(cycle.t_end_real)}</div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {(data.cleaning_cycles.length > 0 || data.hydration_cycles.length > 0 || data.triage_sessions.length > 0) && (
                  <div className="grid gap-3 xl:grid-cols-3">
                    {data.cleaning_cycles.map((cycle) => (
                      <Card key={cycle.id} className={cn(recentChanges.some((change) => change.scope === 'cleaning' && change.key === `cleaning-${cycle.id}`) && 'border-primary/40 bg-primary/5')}>
                        <CardContent className="p-4">
                          <div className="font-mono text-sm font-semibold">{cycle.cycle_number}</div>
                          <div className="mt-1 text-xs text-muted-foreground">{cycle.status} · Programme {cycle.program}</div>
                          <div className="mt-2 text-xs text-muted-foreground">
                            Rendement: {cycle.yield_percent ?? '—'}% · Fin: {fmt(cycle.ended_at)}
                          </div>
                        </CardContent>
                      </Card>
                    ))}

                    {data.hydration_cycles.map((cycle) => (
                      <Card key={cycle.id} className={cn(recentChanges.some((change) => change.scope === 'hydration' && change.key === `hydration-${cycle.id}`) && 'border-primary/40 bg-primary/5')}>
                        <CardContent className="p-4">
                          <div className="font-mono text-sm font-semibold">{cycle.cycle_number}</div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {cycle.status} · {cycle.program_applied ? HYDRATION_PROGRAM_CONFIG[cycle.program_applied as keyof typeof HYDRATION_PROGRAM_CONFIG]?.label ?? cycle.program_applied : 'Programme non defini'}
                          </div>
                          <div className="mt-2 text-xs text-muted-foreground">
                            Entree: {cycle.humidity_in_percent ?? '—'}% · Sortie: {cycle.humidity_out_avg ?? '—'}%
                          </div>
                        </CardContent>
                      </Card>
                    ))}

                    {data.triage_sessions.map((session) => (
                      <Card key={session.id} className={cn(recentChanges.some((change) => change.scope === 'triage' && change.key === `triage-${session.id}`) && 'border-primary/40 bg-primary/5')}>
                        <CardContent className="p-4">
                          <div className="font-mono text-sm font-semibold">{session.session_number}</div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {session.status} · Ligne {session.line} · {session.worker_count} operateur(s)
                          </div>
                          <div className="mt-2 text-xs text-muted-foreground">
                            EX {session.extra_percent ?? 0}% · C1 {session.cat1_percent ?? 0}% · C2 {session.cat2_percent ?? 0}% · RJ {session.reject_percent ?? 0}%
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {data.sub_lots.length > 0 && (
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    {data.sub_lots.map((subLot) => (
                      <Card key={subLot.id} className={cn(recentChanges.some((change) => change.scope === 'sub_lot' && change.key === `sub-lot-${subLot.id}`) && 'border-primary/40 bg-primary/5')}>
                        <CardContent className="p-4">
                          <div className="font-mono text-sm font-semibold">{subLot.lot_number}</div>
                          <div className="mt-1 text-xs text-muted-foreground">{subLot.grade} · {subLot.destination}</div>
                          <div className="mt-2 text-xs text-muted-foreground">
                            {subLot.weight_kg ?? 0} kg ({subLot.percent_of_parent ?? 0}% parent)
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {data.production_orders.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-sm font-semibold">Production</div>
                    {data.production_orders.map((order) => {
                      const orderSteps = data.production_steps.filter((step) => step.production_order_id === order.id);
                      const orderOutputs = data.output_lots.filter((output) => output.production_order_id === order.id);
                      const orderAllocations = data.production_allocations.filter((allocation) => allocation.production_order_id === order.id);
                      return (
                        <Card key={order.id} className={cn(recentScopes.has('production') && 'border-primary/40')}>
                          <CardContent className="p-4 space-y-3">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-sm font-semibold">{order.order_number}</span>
                              <Badge variant="secondary">{order.status}</Badge>
                              <span className="text-xs text-muted-foreground">{order.product_name ?? 'Produit non defini'}</span>
                            </div>
                            <div className="grid gap-2 md:grid-cols-3 text-xs text-muted-foreground">
                              <div>Cible: {(order.target_quantity ?? 0).toLocaleString('fr-TN')} {order.unit ?? 'kg'}</div>
                              <div>Realise: {(order.actual_quantity ?? 0).toLocaleString('fr-TN')} {order.unit ?? 'kg'}</div>
                              <div>Demarrage: {fmt(order.actual_start_date)}</div>
                            </div>
                            <div className="grid gap-2 lg:grid-cols-3">
                              <div className="rounded-lg border p-3">
                                <div className="text-xs font-semibold mb-2">Allocations amont</div>
                                <div className="space-y-1">
                                  {orderAllocations.length === 0 ? (
                                    <div className="text-xs text-muted-foreground">Aucune allocation retrouvee.</div>
                                  ) : (
                                    orderAllocations.map((allocation) => (
                                      <div key={allocation.id} className="text-xs text-muted-foreground">
                                        {(allocation.lot?.lot_internal as string | null) ?? (allocation.lot?.lot_supplier as string | null) ?? allocation.reception_lot_id} · {(allocation.allocated_quantity ?? 0).toLocaleString('fr-TN')} {allocation.unit ?? 'kg'}
                                      </div>
                                    ))
                                  )}
                                </div>
                              </div>
                              <div className="rounded-lg border p-3">
                                <div className="text-xs font-semibold mb-2">Etapes</div>
                                <div className="space-y-1">
                                  {orderSteps.map((step) => (
                                    <div key={step.id} className="text-xs text-muted-foreground">
                                      Etape {step.sequence_order ?? '—'} · {step.status} · {step.operator_name ?? 'non assigne'}
                                    </div>
                                  ))}
                                </div>
                              </div>
                              <div className="rounded-lg border p-3">
                                <div className="text-xs font-semibold mb-2">Lots PF</div>
                                <div className="space-y-1">
                                  {orderOutputs.length === 0 ? (
                                    <div className="text-xs text-muted-foreground">Aucun lot PF enregistre.</div>
                                  ) : (
                                    orderOutputs.map((output) => (
                                      <div key={output.id} className={cn('text-xs text-muted-foreground', recentScopes.has('output_lot') && 'text-primary')}>
                                        {output.lot_pf_number} · {(output.quantity ?? 0).toLocaleString('fr-TN')} {output.unit ?? 'kg'}
                                      </div>
                                    ))
                                  )}
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}

                {data.packaging_orders.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-sm font-semibold">Conditionnement</div>
                    {data.packaging_orders.map((order) => {
                      const palettes = data.packaging_palettes.filter((palette) => palette.order_id === order.id);
                      return (
                        <Card key={order.id}>
                          <CardContent className="p-4">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-sm font-semibold">{order.order_number}</span>
                              <Badge variant="secondary">{order.status}</Badge>
                              <span className="text-xs text-muted-foreground">{order.bom_name ?? order.grade ?? 'Conditionnement'}</span>
                            </div>
                            <div className="mt-2 grid gap-2 md:grid-cols-3 text-xs text-muted-foreground">
                              <div>Source sous-lot: {order.source_lot_number ?? '—'}</div>
                              <div>Unites: {order.produced_units ?? 0} / {order.target_units ?? 0}</div>
                              <div>Palettes: {palettes.length}</div>
                            </div>
                            {palettes.length > 0 && (
                              <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                                {palettes.map((palette) => (
                                  <div key={palette.id} className="rounded-lg border p-3 text-xs text-muted-foreground">
                                    <div className="font-mono font-semibold text-foreground">{palette.palette_number}</div>
                                    <div>{palette.status} · {palette.net_weight_kg ?? 0} kg</div>
                                    <div>SSCC: {palette.sscc ?? '—'}</div>
                                    <div>Sceau: {palette.seal_number ?? '—'}</div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </section>

              <section className="space-y-3">
                <SectionTitle
                  icon={Truck}
                  title="Stock fini et expedition client"
                  subtitle={`${data.stock_lots.length} lot(s) stock · ${data.shipments.length} expedition(s)`}
                />

                {data.stock_lots.length > 0 && (
                  <div className="grid gap-3 xl:grid-cols-2">
                    {data.stock_lots.map((lot) => (
                      <Card key={lot.id} className={cn(recentScopes.has('stock_lot') && 'border-primary/40')}>
                        <CardContent className="p-4">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-sm font-semibold">{lot.lot_number}</span>
                            {lot.status ? <Badge variant="secondary">{lot.status}</Badge> : null}
                            {lot.source_stage ? <Badge variant="outline">{lot.source_stage}</Badge> : null}
                          </div>
                          <div className="mt-2 grid gap-1 text-xs text-muted-foreground">
                            <div>Source: {lot.source_lot_internal ?? lot.source_lot_supplier ?? '—'}</div>
                            <div>Quantite dispo: {(lot.current_quantity ?? 0).toLocaleString('fr-TN')} {lot.unit ?? 'kg'}</div>
                            <div>Emplacement: {lot.storage_location_code ?? '—'}</div>
                            <div>Validation QC: {lot.qc_validated_at ? `${fmt(lot.qc_validated_at)} / ${lot.qc_validated_by ?? '—'}` : '—'}</div>
                            {lot.block_reason ? <div>Blocage: {lot.block_reason}</div> : null}
                            {!lot.block_reason && lot.status === 'BLOCKED' && lot.quality_notes ? <div>Blocage: {lot.quality_notes}</div> : null}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {data.shipments.length > 0 ? (
                  <div className="space-y-2">
                    {data.shipments.map((shipment) => {
                      const lines = data.shipment_lines.filter((line) => line.shipment_id === shipment.id);
                      return (
                        <Card key={shipment.id} className={cn(recentScopes.has('shipment') && 'border-primary/40 bg-primary/5')}>
                          <CardContent className="p-4">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-sm font-semibold">{shipment.shipment_number}</span>
                              <Badge variant="secondary">{shipment.status}</Badge>
                              <span className="text-xs text-muted-foreground">{shipment.customer_name ?? 'Client non defini'}</span>
                            </div>
                            <div className="mt-2 grid gap-2 md:grid-cols-3 text-xs text-muted-foreground">
                              <div>Destination: {shipment.destination ?? '—'}</div>
                              <div>Date demandee: {fmt(shipment.requested_date, 'dd/MM/yyyy')}</div>
                              <div>Expedie: {fmt(shipment.shipped_at)}</div>
                            </div>
                            <div className="mt-3 rounded-lg border p-3">
                              <div className="text-xs font-semibold mb-2">Lignes expedition</div>
                              <div className="space-y-1">
                                {lines.map((line) => {
                                  const stockLot = data.stock_lots.find((lot) => lot.id === line.lot_id);
                                  return (
                                    <div key={line.id} className="text-xs text-muted-foreground">
                                      {stockLot?.lot_number ?? line.lot_id} · {(line.picked_quantity ?? 0).toLocaleString('fr-TN')} {line.unit ?? 'kg'}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                ) : (
                  <Card>
                    <CardContent className="p-4 text-sm text-muted-foreground">
                      Aucune expedition client reliee a ce lot pour l'instant.
                    </CardContent>
                  </Card>
                )}
              </section>

              <section className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
                <div className="space-y-3">
                  <SectionTitle
                    icon={Clock}
                    title="Historique complet"
                    subtitle={`${data.timeline.length} evenement(s) consolides`}
                  />
                  <Card>
                    <CardContent className="p-4">
                      {data.timeline.length === 0 ? (
                        <div className="text-sm text-muted-foreground">Aucun evenement historise.</div>
                      ) : (
                        <div className="space-y-3">
                          {data.timeline.slice(-18).map((event) => (
                            <div key={event.id} className="flex items-start gap-3">
                              <div className={cn(
                                'mt-0.5 h-2.5 w-2.5 rounded-full',
                                event.severity === 'success' ? 'bg-emerald-500' : event.severity === 'warning' ? 'bg-amber-500' : event.severity === 'error' ? 'bg-red-500' : 'bg-slate-400',
                              )} />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-sm font-medium">{event.title}</span>
                                  <Badge variant="outline" className="text-[11px]">{event.stage}</Badge>
                                </div>
                                <div className="text-xs text-muted-foreground mt-0.5">{event.detail}</div>
                                <div className="text-xs text-muted-foreground mt-1">
                                  {fmt(event.timestamp)}{event.actor ? ` · ${event.actor}` : ''}{event.document_number ? ` · ${event.document_number}` : ''}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                <div className="space-y-3">
                  <SectionTitle
                    icon={Shield}
                    title="Audit et integrations"
                    subtitle={`${data.audit_logs.length} trace(s) d'audit`}
                  />
                  <Card>
                    <CardContent className="p-4 space-y-3">
                      <div className="grid gap-2 text-xs">
                        <div className="rounded-lg border p-3">
                          <div className="font-semibold">References synchronisees</div>
                          <div className="mt-1 text-muted-foreground">
                            OF: {data.integration_summary.production_order_numbers.join(', ') || '—'}
                          </div>
                          <div className="text-muted-foreground">
                            Packaging: {data.integration_summary.packaging_order_numbers.join(', ') || '—'}
                          </div>
                          <div className="text-muted-foreground">
                            Expedition: {data.integration_summary.shipment_numbers.join(', ') || '—'}
                          </div>
                        </div>
                        <div className="rounded-lg border p-3">
                          <div className="font-semibold">Collections immuables</div>
                          <div className="mt-1 text-muted-foreground">{data.controls.immutable_collections.join(', ')}</div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        {data.audit_logs.slice(0, 8).map((log) => (
                          <div key={log.id} className="rounded-lg border p-3 text-xs">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold">{log.action_label ?? log.action ?? 'Audit'}</span>
                              {log.entity_type ? <Badge variant="outline">{log.entity_type}</Badge> : null}
                            </div>
                            <div className="mt-1 text-muted-foreground">
                              {fmt(log.performed_at)} · {log.performed_by ?? 'system'}
                            </div>
                            {log.changed_fields && log.changed_fields.length > 0 && (
                              <div className="mt-1 text-muted-foreground">
                                Champs: {log.changed_fields.join(', ')}
                              </div>
                            )}
                          </div>
                        ))}
                        {data.audit_logs.length === 0 && (
                          <div className="text-sm text-muted-foreground">Aucune trace d'audit directement rattachee.</div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </section>

              {data.timeline.length === 0 && !data.reception && (
                <div className="py-8 text-center">
                  <AlertTriangle className="h-8 w-8 text-amber-400 mx-auto mb-2" />
                  <div className="text-sm text-muted-foreground">Aucun enregistrement trouve pour ce numero de lot.</div>
                  <div className="text-xs text-muted-foreground mt-1">Verifiez la reference ou utilisez un numero amont, sous-lot, lot PF ou SSCC.</div>
                </div>
              )}

              {(data.reception_lots.length > 0 || data.production_orders.length > 0 || data.shipments.length > 0) && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <ArrowRight className="h-3.5 w-3.5" />
                  <span>
                    Chaine retracee: {data.lineage.inbound_lot_numbers.length} lot(s) amont → {data.lineage.sub_lot_numbers.length} sous-lot(s) → {data.lineage.finished_good_lot_numbers.length} lot(s) fini(s) → {data.lineage.shipment_numbers.length} expedition(s)
                  </span>
                </div>
              )}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
