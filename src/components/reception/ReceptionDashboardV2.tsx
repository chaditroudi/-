import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { format, isToday } from 'date-fns';
import { fr, enUS, ar } from 'date-fns/locale';
import { DateRange } from 'react-day-picker';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { ModuleHero } from '@/components/layout/ModuleHero';
import { cn } from '@/lib/utils';
import {
  AlertTriangle,
  Bell,
  Camera,
  CheckCircle2,
  Clock3,
  FlaskConical,
  List,
  Package,
  Plus,
  Printer,
  QrCode,
  Search,
  Shield,
  TabletSmartphone,
  Truck,
} from 'lucide-react';
import { useMaterials } from '@/hooks/useMaterials';
import { useSuppliers } from '@/hooks/useSuppliers';
import { findReceptionLotByScan, useLabPendingInspections, useReceptionAlerts, useReceptionsV2, useReceptionStats } from '@/hooks/useReceptionsV2';
import { QCInspection, ReceptionV2, receptionStatusColors, receptionStatusLabels } from '@/types/reception';
import { ReceptionWizard } from './ReceptionWizard';
import { printDailyReceptionReport } from './printDailyReceptionReport';
import { ReceptionDetailV2 } from './ReceptionDetailV2';
import { QCInspectionDialog } from './QCInspectionDialog';
import { LabResultsDialog } from './LabResultsDialog';
import { AlertsPanel } from './AlertsPanel';
import { DateRangeFilter, filterByDateRange } from './DateRangeFilter';
import { QrScannerDialog } from './QrScannerDialog';
import { ReceptionTabletOperatorScreen } from './ReceptionTabletOperatorScreen';
import { InboundNoticeDialog } from './InboundNoticeDialog';
import { useAuthContext } from '@/contexts/AuthContext';
import { canPerformAction } from '@/lib/roleAccess';
import { useTodayPendingNotices } from '@/hooks/useInboundNotices';
import { usePhase2Pipeline } from '@/hooks/usePhase2Pipeline';
import { BonReceptionAchatDashboard } from '@/components/bon-reception-achat/BonReceptionAchatDashboard';
import { BonExpeditionDashboard } from '@/components/bon-expedition/BonExpeditionDashboard';

type ActiveView = 'receptions' | 'tablet' | 'alerts';
type SubTab = 'today' | 'qc' | 'registry' | 'bra' | 'bde';

interface ActionQueueItem {
  reception: ReceptionV2;
  urgencyLabel: string;
  urgencyClassName: string;
  helperText: string;
}

const getPriorityRank = (reception: ReceptionV2) => {
  const ageHours = (Date.now() - new Date(reception.created_at).getTime()) / (1000 * 60 * 60);
  if (reception.status === 'EN_ATTENTE_QC' && ageHours >= 12) return 0;
  if (reception.status === 'EN_ATTENTE_QC') return 1;
  if (reception.status === 'EN_QC') return 2;
  if (reception.status === 'BROUILLON') return 3;
  if (reception.status === 'BLOQUE') return 4;
  return 5;
};

const getUrgencyMeta = (reception: ReceptionV2) => {
  const ageHours = (Date.now() - new Date(reception.created_at).getTime()) / (1000 * 60 * 60);
  if (reception.status === 'EN_ATTENTE_QC' && ageHours >= 12)
    return { label: 'Urgent', className: 'bg-red-600 text-white hover:bg-red-600', helper: 'Contrôle qualité en attente depuis plus de 12 heures.' };
  if (reception.status === 'EN_ATTENTE_QC')
    return { label: 'À traiter', className: 'bg-amber-500 text-white hover:bg-amber-500', helper: 'Cette réception attend le lancement du contrôle qualité.' };
  if (reception.status === 'EN_QC')
    return { label: 'En cours', className: 'bg-sky-600 text-white hover:bg-sky-600', helper: 'Le contrôle qualité est en cours et peut être repris.' };
  if (reception.status === 'BROUILLON')
    return { label: 'À compléter', className: 'bg-slate-700 text-white hover:bg-slate-700', helper: 'La réception a été démarrée mais demande encore une validation.' };
  if (reception.status === 'BLOQUE')
    return { label: 'Bloqué', className: 'bg-orange-600 text-white hover:bg-orange-600', helper: 'La réception demande une décision avant de poursuivre le flux.' };
  return { label: 'Suivi', className: 'bg-emerald-600 text-white hover:bg-emerald-600', helper: 'Réception disponible en consultation.' };
};

const ss = {
  get: (key: string, fallback: string) => { try { return sessionStorage.getItem(key) ?? fallback; } catch { return fallback; } },
  set: (key: string, v: string) => { try { sessionStorage.setItem(key, v); } catch {} },
};

const getSamplingGuidance = (quantityTotal: number) => {
  if (quantityTotal <= 1000) return "Échantillonnage recommandé: minimum 2 kg pour un lot jusqu'à 1 tonne.";
  if (quantityTotal > 5000) return 'Échantillonnage recommandé: minimum 5 kg pour un lot au-delà de 5 tonnes.';
  return 'Échantillonnage recommandé: entre 2 kg et 5 kg selon la représentativité du lot.';
};

export const ReceptionDashboardV2 = ({ prefillPurchaseOrderId }: { prefillPurchaseOrderId?: string }) => {
  const { t, i18n } = useTranslation();
  const { roles } = useAuthContext();
  const [search, setSearch] = useState(() => ss.get('rdv2-search', ''));
  const [statusFilter, setStatusFilter] = useState<string>(() => ss.get('rdv2-status', 'active'));
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [activeView, setActiveView] = useState<ActiveView>('receptions');
  const [subTab, setSubTab] = useState<SubTab>(() => ss.get('rdv2-subtab', 'today') as SubTab);

  const updateSearch = useCallback((v: string) => { setSearch(v); ss.set('rdv2-search', v); }, []);
  const updateStatusFilter = useCallback((v: string) => { setStatusFilter(v); ss.set('rdv2-status', v); }, []);
  const updateSubTab = useCallback((v: SubTab) => { setSubTab(v); ss.set('rdv2-subtab', v); }, []);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [selectedReception, setSelectedReception] = useState<ReceptionV2 | null>(null);

  useEffect(() => {
    if (prefillPurchaseOrderId) setWizardOpen(true);
  }, [prefillPurchaseOrderId]);
  const [detailOpen, setDetailOpen] = useState(false);
  const [qcDialogOpen, setQcDialogOpen] = useState(false);
  const [labDialogOpen, setLabDialogOpen] = useState(false);
  const [selectedInspection, setSelectedInspection] = useState<QCInspection | null>(null);
  const [scanValue, setScanValue] = useState('');
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [isScanLoading, setIsScanLoading] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [noticeOpen, setNoticeOpen] = useState(false);

  const getLocale = useCallback(() => {
    switch (i18n.language) {
      case 'ar': return ar;
      case 'en': return enUS;
      default: return fr;
    }
  }, [i18n.language]);

  const { data: receptions = [], isLoading, isError } = useReceptionsV2();
  const { data: stats } = useReceptionStats();
  const { data: alerts = [] } = useReceptionAlerts();
  const { data: labPendingInspections = [] } = useLabPendingInspections();
  const { lotStages } = usePhase2Pipeline();
  const { data: suppliers = [] } = useSuppliers();
  const { data: materials = [] } = useMaterials();
  const { data: todayNotices = [] } = useTodayPendingNotices();

  const canManageReception = useMemo(
    () => canPerformAction(roles, 'reception_data_entry') || canPerformAction(roles, 'reception_weighing'),
    [roles],
  );
  const canUseTablet = canManageReception;
  const canUseQcScan = useMemo(
    () => canPerformAction(roles, 'qc_entry_scan') || canPerformAction(roles, 'quality_supervision'),
    [roles],
  );

  const receptionsToday = useMemo(() => receptions.filter((r) => isToday(new Date(r.created_at))), [receptions]);
  const awaitingQc = useMemo(() => receptions.filter((r) => r.status === 'EN_ATTENTE_QC'), [receptions]);
  const inQc = useMemo(() => receptions.filter((r) => r.status === 'EN_QC'), [receptions]);
  const draftReceptions = useMemo(() => receptions.filter((r) => r.status === 'BROUILLON'), [receptions]);
  const blockedReceptions = useMemo(() => receptions.filter((r) => r.status === 'BLOQUE'), [receptions]);
  const activeQueueBase = useMemo(
    () => receptions.filter((r) => ['BROUILLON', 'EN_ATTENTE_QC', 'EN_QC', 'BLOQUE'].includes(r.status)),
    [receptions],
  );

  const overdueInspections = useMemo(
    () => receptions.filter((r) => {
      if (!['EN_ATTENTE_QC', 'EN_QC'].includes(r.status)) return false;
      return Date.now() - new Date(r.created_at).getTime() > 4 * 60 * 60 * 1000;
    }),
    [receptions],
  );
  const criticalOverdueInspections = useMemo(
    () => overdueInspections.filter((r) => Date.now() - new Date(r.created_at).getTime() > 12 * 60 * 60 * 1000),
    [overdueInspections],
  );

  const actionQueue = useMemo<ActionQueueItem[]>(
    () => [...activeQueueBase]
      .sort((a, b) => {
        const byPriority = getPriorityRank(a) - getPriorityRank(b);
        return byPriority !== 0 ? byPriority : new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      })
      .slice(0, 5)
      .map((reception) => {
        const urgency = getUrgencyMeta(reception);
        return { reception, urgencyLabel: urgency.label, urgencyClassName: urgency.className, helperText: urgency.helper };
      }),
    [activeQueueBase],
  );

  const filteredReceptions = useMemo(() => {
    const dateFiltered = filterByDateRange(receptions, dateRange);
    const searchLower = search.toLowerCase();
    return dateFiltered.filter((r) => {
      const supplierName = r.supplier?.name || r.supplier_name_snapshot || '';
      const matchesSearch =
        r.reception_number.toLowerCase().includes(searchLower) ||
        supplierName.toLowerCase().includes(searchLower) ||
        r.delivery_note_number?.toLowerCase().includes(searchLower);
      if (!matchesSearch) return false;
      if (statusFilter === 'all') return true;
      if (statusFilter === 'active') return ['BROUILLON', 'EN_ATTENTE_QC', 'EN_QC', 'BLOQUE'].includes(r.status);
      if (statusFilter === 'today') return isToday(new Date(r.created_at));
      return r.status === statusFilter;
    });
  }, [receptions, dateRange, search, statusFilter]);

  const handleOpenDetail = useCallback((reception: ReceptionV2) => { setSelectedReception(reception); setDetailOpen(true); }, []);
  const handleStartQC = useCallback((reception: ReceptionV2) => { setSelectedReception(reception); setQcDialogOpen(true); }, []);

  const handleScanLot = useCallback(async (explicitValue?: string) => {
    const normalizedValue = (explicitValue ?? scanValue).trim();
    if (!normalizedValue) return;
    setIsScanLoading(true);
    setScanMessage(null);
    if (explicitValue) setScanValue(normalizedValue);
    try {
      const match = await findReceptionLotByScan(normalizedValue);
      if (!match?.reception) {
        setScanMessage("Aucun LOT-ID ou QR code correspondant n'a été trouvé.");
        return;
      }
      setSelectedReception(match.reception);
      setScanMessage(`${match.lot_internal || match.lot_supplier || normalizedValue} chargé. ${getSamplingGuidance(match.reception.quantity_total)}`);
      setQcDialogOpen(true);
    } catch (error) {
      setScanMessage(error instanceof Error ? error.message : 'Erreur pendant la recherche du LOT-ID.');
    } finally {
      setIsScanLoading(false);
    }
  }, [scanValue]);

  const metricChips = useMemo(() => [
    {
      icon: Truck,
      label: "Aujourd'hui",
      value: stats?.today ?? receptionsToday.length,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50 border-emerald-200',
      onClick: () => { updateSubTab('registry'); updateStatusFilter('today'); },
    },
    {
      icon: Shield,
      label: 'En attente QC',
      value: awaitingQc.length,
      color: 'text-amber-600',
      bg: awaitingQc.length > 0 ? 'bg-amber-50 border-amber-200' : 'bg-muted/30 border-border',
      onClick: () => { updateSubTab('qc'); },
    },
    {
      icon: AlertTriangle,
      label: 'Alertes',
      value: alerts.length,
      color: 'text-red-600',
      bg: alerts.length > 0 ? 'bg-red-50 border-red-200' : 'bg-muted/30 border-border',
      onClick: () => setActiveView('alerts'),
    },
    {
      icon: Clock3,
      label: 'En QC',
      value: inQc.length,
      color: 'text-sky-600',
      bg: inQc.length > 0 ? 'bg-sky-50 border-sky-200' : 'bg-muted/30 border-border',
      onClick: () => { updateSubTab('registry'); updateStatusFilter('EN_QC'); },
    },
  ], [stats, receptionsToday.length, awaitingQc.length, alerts.length, inQc.length, updateSubTab, updateStatusFilter]);

  return (
    <div className="space-y-5">
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <ModuleHero
        kicker="Réception • Poste de travail"
        title="Lancer, suivre et décider sans détour"
        description="Démarrez une réception, lancez le contrôle qualité ou consultez le registre."
        primaryAction={{
          label: canManageReception ? t('receptions.new') : 'Voir les réceptions du jour',
          onClick: () => (canManageReception ? setWizardOpen(true) : updateStatusFilter('today')),
          icon: <Plus className="h-4 w-4" />,
        }}
        secondaryAction={{
          label: `Pré-annonces${todayNotices.length > 0 ? ` (${todayNotices.length})` : ''}`,
          onClick: () => setNoticeOpen(true),
          icon: <Bell className="h-4 w-4" />,
          variant: 'secondary',
        }}
      />

      {/* ── Notice banner ────────────────────────────────────────────────── */}
      {todayNotices.length > 0 && (
        <button
          type="button"
          onClick={() => setNoticeOpen(true)}
          className="flex w-full items-center gap-3 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-left text-sm text-sky-900 hover:bg-sky-100 transition-colors"
        >
          <Bell className="h-4 w-4 shrink-0 text-sky-600" />
          <span>
            <span className="font-semibold">
              {todayNotices.length}{' '}
              {todayNotices.length > 1 ? 'pre-annonces' : 'pre-annonce'}{' '}
              en attente
            </span>
            {' — '}
            {todayNotices.map((n) => `${n.vehicle_number} (${n.supplier_name ?? n.supplier_code ?? '-'})`).join(', ')}
          </span>
          <span className="ml-auto text-xs underline shrink-0">Voir</span>
        </button>
      )}

      {/* ── Top-level view switcher ───────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        {[
          { value: 'receptions' as ActiveView, label: 'Réceptions', icon: Package, badge: actionQueue.length },
          ...(canUseTablet ? [{ value: 'tablet' as ActiveView, label: 'Tablette', icon: TabletSmartphone, badge: draftReceptions.length }] : []),
          { value: 'alerts' as ActiveView, label: 'Alertes', icon: AlertTriangle, badge: alerts.length },
        ].map((item) => (
          <Button
            key={item.value}
            type="button"
            variant={activeView === item.value ? 'default' : 'outline'}
            className="h-10 rounded-full gap-1.5"
            onClick={() => setActiveView(item.value)}
          >
            <item.icon className="h-3.5 w-3.5" />
            {item.label}
            {item.badge > 0 && (
              <Badge
                variant={activeView === item.value ? 'secondary' : 'destructive'}
                className={cn('rounded-full px-1.5 py-0 text-[10px]', activeView === item.value && 'bg-white/90 text-foreground')}
              >
                {item.badge}
              </Badge>
            )}
          </Button>
        ))}
      </div>

      {/* ── Receptions view ──────────────────────────────────────────────── */}
      {activeView === 'receptions' && (
        <Tabs value={subTab} onValueChange={(v) => updateSubTab(v as SubTab)}>
          {/* Sub-tab bar — scrollable, clearly clickable */}
          <div className="overflow-x-auto scrollbar-hide">
            <div className="flex gap-1 border-b border-border pb-0 min-w-max">
              {([
                {
                  value: 'today' as SubTab,
                  icon: Clock3,
                  label: 'Travail du jour',
                  badge: actionQueue.length > 0 ? actionQueue.length : null,
                  badgeClass: 'bg-primary text-primary-foreground',
                },
                {
                  value: 'qc' as SubTab,
                  icon: QrCode,
                  label: 'Contrôle QC',
                  badge: awaitingQc.length > 0 ? awaitingQc.length : null,
                  badgeClass: 'bg-amber-500 text-white',
                },
                { value: 'registry' as SubTab, icon: List, label: 'Registre', badge: null, badgeClass: '' },
                { value: 'bra' as SubTab, icon: Printer, label: 'Bons BRA', badge: null, badgeClass: '' },
                { value: 'bde' as SubTab, icon: Truck, label: 'Bons BDE', badge: null, badgeClass: '' },
              ]).map((tab) => {
                const active = subTab === tab.value;
                return (
                  <button
                    key={tab.value}
                    type="button"
                    onClick={() => updateSubTab(tab.value)}
                    className={cn(
                      'group relative flex cursor-pointer select-none items-center gap-2 whitespace-nowrap px-4 py-3 text-sm font-medium outline-none transition-colors',
                      active
                        ? 'text-primary'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    <tab.icon className={cn('h-4 w-4 shrink-0 transition-colors', active ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground')} />
                    {tab.label}
                    {tab.badge != null && (
                      <span className={cn('flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold leading-none', tab.badgeClass)}>
                        {tab.badge}
                      </span>
                    )}
                    {/* Active underline */}
                    <span
                      className={cn(
                        'absolute bottom-0 left-0 h-0.5 w-full rounded-full transition-all duration-200',
                        active ? 'bg-primary scale-x-100' : 'bg-transparent scale-x-0 group-hover:bg-border group-hover:scale-x-100',
                      )}
                    />
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Tab: Travail du jour ─────────────────────────────────────── */}
          <TabsContent value="today" className="mt-5 space-y-4">
            {/* Metric chips row */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {metricChips.map((chip) => (
                <button
                  key={chip.label}
                  type="button"
                  onClick={chip.onClick}
                  className={cn(
                    'flex flex-col gap-1 rounded-2xl border p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-md',
                    chip.bg,
                  )}
                >
                  <div className="flex items-center gap-2">
                    <chip.icon className={cn('h-4 w-4', chip.color)} />
                    <span className="text-xs font-medium text-muted-foreground">{chip.label}</span>
                  </div>
                  <p className={cn('text-3xl font-semibold', chip.color)}>{chip.value}</p>
                </button>
              ))}
            </div>

            <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
              {/* Action queue */}
              <Card className="surface-card rounded-[24px]">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Clock3 className="h-4 w-4 text-primary" />
                    File de travail
                  </CardTitle>
                  <CardDescription className="text-xs">Réceptions qui demandent une action maintenant.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 pt-1">
                  {actionQueue.length === 0 ? (
                    <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                      <CheckCircle2 className="h-5 w-5 shrink-0" />
                      Aucune réception urgente en attente.
                    </div>
                  ) : (
                    actionQueue.map((item) => (
                      <button
                        key={item.reception.id}
                        type="button"
                        onClick={() => handleOpenDetail(item.reception)}
                        className="flex w-full items-center gap-3 rounded-2xl border border-border/60 bg-background/85 p-3 text-left transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <div className={cn('h-10 w-1 shrink-0 rounded-full', receptionStatusColors[item.reception.status])} />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-mono text-sm font-semibold">{item.reception.reception_number}</span>
                            <Badge className={cn('text-[10px] px-1.5 py-px', item.urgencyClassName)}>{item.urgencyLabel}</Badge>
                          </div>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {item.reception.supplier?.name || item.reception.supplier_name_snapshot || '—'} • {item.reception.quantity_total} {item.reception.unit}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          {(item.reception.status === 'EN_ATTENTE_QC' || item.reception.status === 'EN_QC') && (
                            <Button
                              type="button"
                              size="sm"
                              className={cn('h-7 rounded-xl px-2 text-xs', item.reception.status === 'EN_QC' && 'bg-sky-600 hover:bg-sky-700')}
                              variant={item.reception.status === 'EN_QC' ? 'default' : 'outline'}
                              onClick={(e) => { e.stopPropagation(); handleStartQC(item.reception); }}
                            >
                              <Shield className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </button>
                    ))
                  )}
                  {actionQueue.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full rounded-xl text-xs text-muted-foreground"
                      onClick={() => { updateSubTab('registry'); updateStatusFilter('active'); }}
                    >
                      Voir tout le registre →
                    </Button>
                  )}
                </CardContent>
              </Card>

              {/* Watch panel */}
              <Card className="surface-card rounded-[24px]">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <AlertTriangle className="h-4 w-4 text-primary" />
                    Points à surveiller
                  </CardTitle>
                  <CardDescription className="text-xs">Retards, alertes et vue rapide du jour.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 pt-1">
                  {/* Overdue QC */}
                  <div className={cn(
                    'rounded-2xl border p-3',
                    criticalOverdueInspections.length > 0 ? 'border-red-200 bg-red-50' :
                    overdueInspections.length > 0 ? 'border-orange-200 bg-orange-50' :
                    'border-emerald-200 bg-emerald-50',
                  )}>
                    <div className="flex items-center gap-2">
                      <Clock3 className={cn('h-4 w-4', criticalOverdueInspections.length > 0 ? 'text-red-600' : overdueInspections.length > 0 ? 'text-orange-600' : 'text-emerald-600')} />
                      <p className="text-sm font-medium">Retards QC</p>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {overdueInspections.length > 0
                        ? `${overdueInspections.length} réception(s) en retard, dont ${criticalOverdueInspections.length} critique(s).`
                        : 'Aucun retard QC pour le moment.'}
                    </p>
                  </div>

                  {/* Alerts summary */}
                  <div className="rounded-2xl border border-border/60 bg-background/85 p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Bell className="h-4 w-4 text-primary" />
                        <p className="text-sm font-medium">Alertes réception</p>
                      </div>
                      {alerts.length > 0 && (
                        <Badge variant="destructive" className="text-xs">{alerts.length}</Badge>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {alerts.length > 0 ? `${alerts.length} alerte(s) active(s).` : 'Aucune alerte active.'}
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-2 h-9 rounded-xl text-xs"
                      onClick={() => setActiveView('alerts')}
                    >
                      Voir les alertes
                    </Button>
                  </div>

                  {/* Day snapshot */}
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: 'Brouillons', value: draftReceptions.length },
                      { label: 'En QC', value: inQc.length },
                      { label: 'Bloqués', value: blockedReceptions.length },
                    ].map((stat) => (
                      <div key={stat.label} className="rounded-2xl bg-muted/35 p-2.5 text-center">
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{stat.label}</p>
                        <p className="mt-0.5 text-xl font-semibold">{stat.value}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ── Tab: Contrôle QC ────────────────────────────────────────── */}
          <TabsContent value="qc" className="mt-5">
            <Card className="surface-card rounded-[24px]">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <QrCode className="h-5 w-5 text-primary" />
                  Contrôle Qualité Entrée
                </CardTitle>
                <CardDescription>
                  Scannez ou saisissez un LOT-ID pour charger la fiche et ouvrir le contrôle qualité entrant.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Scan row */}
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    value={scanValue}
                    onChange={(e) => setScanValue(e.target.value)}
                    placeholder="LOT-ID / QR code / référence lot"
                    className="h-12 flex-1 rounded-2xl bg-background/85"
                    onKeyDown={(e) => { if (e.key === 'Enter') void handleScanLot(); }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="h-12 rounded-2xl px-4 shrink-0"
                    onClick={() => setScannerOpen(true)}
                    disabled={!canUseQcScan}
                  >
                    <Camera className="mr-2 h-4 w-4" />
                    Caméra QR
                  </Button>
                  <Button
                    type="button"
                    className="h-12 rounded-2xl px-5 shrink-0"
                    onClick={() => void handleScanLot()}
                    disabled={isScanLoading || !scanValue.trim()}
                  >
                    <QrCode className="mr-2 h-4 w-4" />
                    {isScanLoading ? 'Chargement…' : 'Scanner'}
                  </Button>
                </div>

                {/* Scan result */}
                {scanMessage && (
                  <div className={cn(
                    'rounded-2xl border p-4 text-sm',
                    selectedReception ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-amber-200 bg-amber-50 text-amber-900',
                  )}>
                    {scanMessage}
                  </div>
                )}

                {!canUseQcScan && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                    Cette étape est réservée aux rôles qualité ou supervision réception.
                  </div>
                )}

                {/* Info panels side by side */}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-border/60 bg-muted/25 p-4 text-sm">
                    <p className="font-medium text-foreground">Règles d'échantillonnage</p>
                    <ul className="mt-2 space-y-1 text-muted-foreground text-xs leading-5">
                      <li>• Lot ≤ 1 tonne → minimum 2 kg</li>
                      <li>• Lot &gt; 5 tonnes → minimum 5 kg</li>
                      <li>• Entre les deux → prélèvement représentatif</li>
                    </ul>
                  </div>
                  <div className="rounded-2xl border border-border/60 bg-muted/25 p-4 text-sm">
                    <p className="font-medium text-foreground">Ce qui est chargé après scan</p>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">
                      Fournisseur, variété, poids, statut et lot — aucune ressaisie avant le contrôle.
                    </p>
                  </div>
                </div>

                {/* Awaiting QC mini-list */}
                {awaitingQc.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Lots en attente QC ({awaitingQc.length})
                    </p>
                    {awaitingQc.slice(0, 4).map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => handleStartQC(r)}
                        className="flex w-full items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50/60 px-4 py-3 text-left hover:bg-amber-50 transition-colors"
                      >
                        <div>
                          <span className="font-mono text-sm font-semibold">{r.reception_number}</span>
                          <span className="ml-2 text-xs text-muted-foreground">{r.supplier?.name || r.supplier_name_snapshot || '—'} • {r.quantity_total} {r.unit}</span>
                        </div>
                        <Button type="button" size="sm" className="h-9 rounded-xl text-xs" onClick={(e) => { e.stopPropagation(); handleStartQC(r); }}>
                          <Shield className="mr-1 h-3 w-3" />
                          Lancer QC
                        </Button>
                      </button>
                    ))}
                    {awaitingQc.length > 4 && (
                      <p className="text-center text-xs text-muted-foreground">+ {awaitingQc.length - 4} autres dans le registre</p>
                    )}
                  </div>
                )}

                {/* Lab pending results — RG-Q07 */}
                {labPendingInspections.length > 0 && (
                  <div className="space-y-2 pt-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">
                      Résultats labo en attente ({labPendingInspections.length})
                    </p>
                    {labPendingInspections.slice(0, 5).map((insp) => {
                      const rec = receptions.find((r) => r.id === insp.reception_id);
                      if (!rec) return null;
                      return (
                        <div
                          key={insp.id}
                          className="flex w-full items-center justify-between gap-3 rounded-2xl border border-sky-200 bg-sky-50/60 px-4 py-3"
                        >
                          <div className="min-w-0">
                            <span className="font-mono text-sm font-semibold">{rec.reception_number}</span>
                            <span className="ml-2 text-xs text-muted-foreground">
                              {rec.supplier?.name || rec.supplier_name_snapshot || '—'} • {(insp.lab_analyses ?? []).join(', ')}
                            </span>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-9 rounded-xl text-xs border-sky-300 text-sky-700 hover:bg-sky-50 shrink-0"
                            onClick={() => {
                              setSelectedReception(rec);
                              setSelectedInspection(insp as QCInspection);
                              setLabDialogOpen(true);
                            }}
                          >
                            <FlaskConical className="mr-1 h-3 w-3" />
                            Saisir résultats
                          </Button>
                        </div>
                      );
                    })}
                    {labPendingInspections.length > 5 && (
                      <p className="text-center text-xs text-muted-foreground">
                        + {labPendingInspections.length - 5} autres en attente
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Tab: Registre ───────────────────────────────────────────── */}
          <TabsContent value="registry" className="mt-5">
            <Card className="surface-card rounded-[24px]">
              <CardHeader className="border-b border-border/50 pb-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="section-kicker">Historique et recherche</p>
                    <CardTitle className="mt-1 text-xl">Registre réception</CardTitle>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-2xl"
                      onClick={() => printDailyReceptionReport(receptions)}
                    >
                      <Printer className="mr-2 h-4 w-4" />
                      Rapport J
                    </Button>
                    <Button type="button" onClick={() => setWizardOpen(true)} className="rounded-2xl">
                      <Plus className="mr-2 h-4 w-4" />
                      {t('receptions.new')}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pt-5">
                {/* Search + filters */}
                <div className="flex flex-col gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder={t('common.search')}
                      value={search}
                      onChange={(e) => updateSearch(e.target.value)}
                      className="h-11 rounded-2xl border-border/80 bg-background/85 pl-10"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {[
                      { value: 'active', label: 'Actives' },
                      { value: 'today', label: "Aujourd'hui" },
                      { value: 'all', label: t('common.all') },
                      { value: 'EN_ATTENTE_QC', label: t('receptions.toProcess') },
                      { value: 'EN_QC', label: t('receptions.inQC') },
                      { value: 'BLOQUE', label: t('receptions.blocked') },
                    ].map((filter) => (
                      <Button
                        key={filter.value}
                        type="button"
                        variant={statusFilter === filter.value ? 'secondary' : 'ghost'}
                        size="sm"
                        className="h-9 rounded-2xl text-xs"
                        onClick={() => updateStatusFilter(filter.value)}
                      >
                        {filter.label}
                      </Button>
                    ))}
                    <DateRangeFilter dateRange={dateRange} onDateRangeChange={setDateRange} />
                    {(dateRange?.from || statusFilter !== 'active' || search) && (
                      <span className="ml-auto text-xs text-muted-foreground">{filteredReceptions.length} résultat(s)</span>
                    )}
                  </div>
                </div>

                {/* Status legend */}
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { status: 'BROUILLON',    label: 'Brouillon — à compléter' },
                    { status: 'EN_ATTENTE_QC', label: 'En attente QC' },
                    { status: 'EN_QC',         label: 'Contrôle en cours' },
                    { status: 'LIBERE',        label: 'Libéré — conforme' },
                    { status: 'BLOQUE',        label: 'Bloqué — décision requise' },
                    { status: 'REJETE',        label: 'Rejeté' },
                  ].map(({ status, label }) => (
                    <span key={status} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <span className={cn('inline-block h-2.5 w-2.5 rounded-full', receptionStatusColors[status as keyof typeof receptionStatusColors])} />
                      {label}
                    </span>
                  ))}
                </div>

                {/* List */}
                <div className="space-y-2">
                  {isError ? (
                    <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700">
                      Erreur de chargement des réceptions. Vérifiez votre connexion et rechargez la page.
                    </div>
                  ) : isLoading ? (
                    <div className="py-8 text-center text-sm text-muted-foreground">{t('common.loading')}</div>
                  ) : filteredReceptions.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                      {t('common.noResults')}
                    </div>
                  ) : (
                    filteredReceptions.map((reception) => {
                      const ageHours = (Date.now() - new Date(reception.created_at).getTime()) / (1000 * 60 * 60);
                      const isPendingQc = ['EN_ATTENTE_QC', 'EN_QC'].includes(reception.status);
                      const isCriticalDelay = isPendingQc && ageHours >= 12;
                      const isDelayed = isPendingQc && ageHours >= 4;
                      return (
                        <div
                          key={reception.id}
                          className="group surface-card cursor-pointer rounded-[20px] p-3.5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover"
                          onClick={() => handleOpenDetail(reception)}
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex items-start gap-3">
                              <div className={cn('mt-1 h-12 w-1 shrink-0 rounded-full', receptionStatusColors[reception.status])} />
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="font-mono text-sm font-semibold">{reception.reception_number}</span>
                                  <Badge variant="outline" className="text-[10px] px-1.5">{reception.reception_type}</Badge>
                                  {reception.variety && (
                                    <Badge className="bg-secondary text-secondary-foreground hover:bg-secondary text-[10px] px-1.5">{reception.variety}</Badge>
                                  )}
                                </div>
                                <p className="mt-0.5 text-sm font-medium">
                                  {reception.supplier?.name || reception.supplier_name_snapshot || 'Fournisseur non renseigné'} • {reception.quantity_total} {reception.unit}
                                </p>
                                <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                                  <span>BL: {reception.delivery_note_number || '-'}</span>
                                  <span>{format(new Date(reception.created_at), 'dd/MM HH:mm', { locale: getLocale() })}</span>
                                  {reception.storage_zone_code && <span>Zone {reception.storage_zone_code}</span>}
                                  {reception.arrival_temperature_c != null && <span>Temp. {reception.arrival_temperature_c}°C</span>}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 sm:flex-col sm:items-end">
                              <Badge className={cn('text-xs', receptionStatusColors[reception.status])}>
                                {receptionStatusLabels[reception.status]}
                              </Badge>
                              {(() => {
                                const p2 = lotStages.get(reception.id);
                                if (!p2) return null;
                                const STAGE_STYLE: Record<string, string> = {
                                  fumigation:  'bg-orange-100 text-orange-700 border-orange-300',
                                  nettoyage:   'bg-blue-100 text-blue-700 border-blue-300',
                                  hydratation: 'bg-cyan-100 text-cyan-700 border-cyan-300',
                                  triage:      'bg-violet-100 text-violet-700 border-violet-300',
                                  completed:   'bg-green-100 text-green-700 border-green-300',
                                };
                                return (
                                  <Badge variant="outline" className={cn('text-[10px] px-1.5 border', STAGE_STYLE[p2.stage] ?? 'bg-gray-100 text-gray-600')}>
                                    {p2.label}
                                  </Badge>
                                );
                              })()}
                              {isDelayed && (
                                <Badge className={cn('text-[10px] px-1.5', isCriticalDelay ? 'bg-red-600 text-white' : 'bg-amber-500 text-white')}>
                                  <Clock3 className="mr-0.5 h-2.5 w-2.5" />
                                  {Math.round(ageHours)}h
                                </Badge>
                              )}
                              {reception.status === 'EN_ATTENTE_QC' && (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-9 rounded-xl bg-white text-xs"
                                  onClick={(e) => { e.stopPropagation(); handleStartQC(reception); }}
                                >
                                  <Shield className="mr-1 h-3 w-3" />
                                  QC
                                </Button>
                              )}
                              {reception.status === 'EN_QC' && (
                                <Button
                                  type="button"
                                  size="sm"
                                  className="h-9 rounded-xl bg-sky-600 hover:bg-sky-700 text-xs"
                                  onClick={(e) => { e.stopPropagation(); handleStartQC(reception); }}
                                >
                                  <Shield className="mr-1 h-3 w-3" />
                                  {t('common.continueQC')}
                                </Button>
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
          </TabsContent>

          {/* ── Tab: Bons de Réception Achat ─────────────────────────────── */}
          <TabsContent value="bra" className="mt-5">
            <BonReceptionAchatDashboard />
          </TabsContent>

          {/* ── Tab: Bons d'Expédition ───────────────────────────────────── */}
          <TabsContent value="bde" className="mt-5">
            <BonExpeditionDashboard />
          </TabsContent>
        </Tabs>
      )}

      {activeView === 'tablet' && <ReceptionTabletOperatorScreen />}
      {activeView === 'alerts' && <AlertsPanel />}

      {/* ── Dialogs ───────────────────────────────────────────────────────── */}
      {canManageReception && (
        <ReceptionWizard
          open={wizardOpen}
          onOpenChange={setWizardOpen}
          suppliers={suppliers}
          materials={materials}
          prefillPurchaseOrderId={prefillPurchaseOrderId}
        />
      )}

      {canUseQcScan && (
        <QrScannerDialog
          open={scannerOpen}
          onOpenChange={setScannerOpen}
          onDetected={(value) => { void handleScanLot(value); }}
        />
      )}

      {selectedReception && (
        <>
          <ReceptionDetailV2 open={detailOpen} onOpenChange={setDetailOpen} receptionId={selectedReception.id} />
          <QCInspectionDialog open={qcDialogOpen} onOpenChange={setQcDialogOpen} reception={selectedReception} />
          {selectedInspection && (
            <LabResultsDialog
              open={labDialogOpen}
              onOpenChange={setLabDialogOpen}
              inspection={selectedInspection}
              reception={selectedReception}
            />
          )}
        </>
      )}

      <InboundNoticeDialog open={noticeOpen} onOpenChange={setNoticeOpen} suppliers={suppliers} />
    </div>
  );
};
