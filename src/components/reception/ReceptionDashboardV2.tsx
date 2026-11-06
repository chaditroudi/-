import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DataState } from '@/components/shared/DataState';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { DateRange } from 'react-day-picker';
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Clock3,
  FileText,
  History,
  ListChecks,
  Loader2,
  Plus,
  Printer,
  QrCode,
  Search,
  Trash2,
  Truck,
} from 'lucide-react';

import { BonReceptionAchatDashboard } from '@/components/bon-reception-achat/BonReceptionAchatDashboard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuthContext } from '@/contexts/AuthContext';
import { useTodayPendingNotices } from '@/hooks/useInboundNotices';
import { useReceptionAlerts } from '@/hooks/useReceptionsV2';
import { useSuppliers } from '@/hooks/useSuppliers';
import { listLocalDrafts, type LocalIntakeDraft } from '@/lib/offline/draftStore';
import { listOutbox, subscribeOutbox, type OutboxItem } from '@/lib/offline/outbox';
import { getDraftWaitingFor } from '@/lib/receptionIntake';
import { getReceptionPermissions } from '@/lib/receptionWorkflow';
import { canPerformAction } from '@/lib/roleAccess';
import { cn } from '@/lib/utils';
import {
  useAbandonReceptionDraftMutation,
  useListReceptionDraftsQuery,
  useSearchReceptionsQuery,
  type ReceptionDraftRow,
} from '@/store/api/receptionsApi';
import { ReceptionV2, receptionStatusColors, receptionStatusLabels } from '@/types/reception';

import { LotReference } from '@/components/shared/LotReference';
import { QuantityDisplay } from '@/components/shared/QuantityDisplay';
import { AlertsPanel } from './AlertsPanel';
import { DateRangeFilter } from './DateRangeFilter';
import { InboundNoticeDialog } from './InboundNoticeDialog';
import { ReceptionIntakeFlow } from './intake/ReceptionIntakeFlow';
import { printDailyReceptionReport } from './printDailyReceptionReport';
import { ReceptionDetailV2, type ReceptionWorkspaceSection } from './ReceptionDetailV2';
import { ReceptionQcQueue } from './ReceptionQcQueue';

type SubTab = 'today' | 'pending' | 'registry' | 'qc' | 'bra' | 'alerts';

const VALID_SUB_TABS: SubTab[] = ['today', 'pending', 'registry', 'qc', 'bra', 'alerts'];
const ACTIVE_STATUSES = 'BROUILLON,EN_ATTENTE_QC,EN_QC,BLOQUE';
const HISTORY_PAGE_SIZE = 25;
const SEARCH_DELAY_MS = 300;

interface WorkspaceTarget {
  id: string;
  section?: ReceptionWorkspaceSection;
  autoStartQc?: boolean;
}

interface IntakeTarget {
  draftId?: string | null;
  prefillPurchaseOrderId?: string;
}

const ss = {
  get: (key: string, fallback: string) => { try { return sessionStorage.getItem(key) ?? fallback; } catch { return fallback; } },
  set: (key: string, v: string) => { try { sessionStorage.setItem(key, v); } catch { /* sessionStorage unavailable */ } },
};

const startOfToday = () => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
};

const EmptyState = ({ children }: { children: React.ReactNode }) => (
  <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">{children}</div>
);

const ListError = () => (
  <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700">
    Impossible de charger les réceptions. Vérifiez la connexion puis réessayez.
  </div>
);

const Loading = () => (
  <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
    <Loader2 className="h-4 w-4 animate-spin" />
    Chargement…
  </div>
);

const ReceptionListHead = () => (
  <div className="hidden gap-x-3 bg-muted/70 px-3 py-1.5 font-display text-[13px] font-semibold text-foreground/80 lg:grid lg:grid-cols-[10.5rem_minmax(0,1.4fr)_7rem_6.5rem_minmax(0,1fr)_6.5rem_9rem]">
    <span>Réception</span>
    <span>Fournisseur</span>
    <span>Variété</span>
    <span className="text-right">Poids</span>
    <span>Bon de livraison</span>
    <span>Arrivée</span>
    <span className="text-right">Statut</span>
  </div>
);

const nextReceptionStep = (status: ReceptionV2['status']) => {
  switch (status) {
    case 'BROUILLON': return 'Saisie non confirmée. Reprenez-la avant qu’un lot existe.';
    case 'EN_ATTENTE_QC': return 'En quarantaine. Le contrôle qualité n’a pas commencé.';
    case 'EN_QC': return 'Contrôle commencé. La décision n’est pas encore enregistrée.';
    case 'BLOQUE': return 'Lot bloqué. Ouvrez la réception pour voir le motif.';
    case 'LIBERE': return 'Lot libéré. Le rangement se fait dans le détail.';
    case 'REJETE': return 'Lot rejeté. Il ne part pas en production.';
    case 'ANNULE': return 'Réception annulée.';
    default: return 'Ouvrir la réception.';
  }
};

const TodayTask = ({ reception, onOpen }: { reception: ReceptionV2; onOpen: (reception: ReceptionV2) => void }) => (
  <button
    type="button"
    onClick={() => onOpen(reception)}
    className="flex w-full flex-col gap-3 border-b bg-card p-4 text-left last:border-b-0 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex-row sm:items-center"
  >
    <div className="min-w-0 flex-1">
      <p className="truncate text-base font-semibold">
        {reception.supplier?.name || reception.supplier_name_snapshot || 'Fournisseur non renseigné'}
      </p>
      <p className="mt-0.5 font-mono text-sm text-muted-foreground">{reception.reception_number || 'Sans numéro'}</p>
      <p className="mt-2 text-sm text-foreground">{nextReceptionStep(reception.status)}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {reception.variety || 'Variété non renseignée'}
        {' · BL '}
        {reception.delivery_note_number || '—'}
        {' · '}
        {format(new Date(reception.created_at), 'HH:mm', { locale: fr })}
      </p>
    </div>
    <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end">
      <p className="text-2xl font-semibold tabular-nums">
        <QuantityDisplay value={reception.quantity_total} unit={reception.unit || 'kg'} />
      </p>
      <Badge className={cn('text-xs', receptionStatusColors[reception.status])}>
        {receptionStatusLabels[reception.status]}
      </Badge>
    </div>
  </button>
);

const ReceptionRow = ({ reception, onOpen }: { reception: ReceptionV2; onOpen: (reception: ReceptionV2) => void }) => (
  <button
    type="button"
    onClick={() => onOpen(reception)}
    className="grid min-h-12 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 px-3 py-2 text-left hover:bg-muted/60 lg:grid-cols-[10.5rem_minmax(0,1.4fr)_7rem_6.5rem_minmax(0,1fr)_6.5rem_9rem]"
  >
    <LotReference value={reception.reception_number} fallback="Réception sans numéro" />
    <Badge className={cn('justify-self-end text-xs lg:order-last', receptionStatusColors[reception.status])}>
      {receptionStatusLabels[reception.status]}
    </Badge>
    <span className="truncate text-sm">{reception.supplier?.name || reception.supplier_name_snapshot || 'Fournisseur non renseigné'}</span>
    <span className="truncate text-sm text-muted-foreground lg:text-foreground">{reception.variety || '—'}</span>
    <span className="text-sm lg:text-right">
      <QuantityDisplay value={reception.quantity_total} unit={reception.unit || 'kg'} />
    </span>
    <span className="truncate text-xs text-muted-foreground lg:text-sm">
      <span className="lg:hidden">BL </span>{reception.delivery_note_number || '—'}{reception.purchase_order_number ? ` · ${reception.purchase_order_number}` : ''}
    </span>
    <span className="text-xs text-muted-foreground lg:text-sm">{format(new Date(reception.created_at), 'dd/MM HH:mm', { locale: fr })}</span>
  </button>
);

const HistoryPage = ({ params, isLast, onMore, onOpen, onRows }: {
  params: Record<string, string | number | undefined>;
  isLast: boolean;
  onMore: (before: string) => void;
  onOpen: (reception: ReceptionV2) => void;
  onRows?: (count: number) => void;
}) => {
  const { data, isLoading, isError } = useSearchReceptionsQuery(params);
  useEffect(() => { if (data) onRows?.(data.rows.length); }, [data, onRows]);
  if (isError) return <ListError />;
  if (isLoading || !data) return <Loading />;
  return (
    <>
      {data.rows.map((reception) => <ReceptionRow key={reception.id} reception={reception} onOpen={onOpen} />)}
      {isLast && data.nextBefore && (
        <Button type="button" variant="outline" className="w-full" onClick={() => onMore(data.nextBefore!)}>
          Afficher les suivantes
        </Button>
      )}
    </>
  );
};

const HistorySection = ({ onOpen, onDailyReport }: { onOpen: (reception: ReceptionV2) => void; onDailyReport: () => void }) => {
  const [search, setSearch] = useState(() => ss.get('rdv2-search', ''));
  const [term, setTerm] = useState(search);
  const [status, setStatus] = useState('');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [cursors, setCursors] = useState<Array<string | undefined>>([undefined]);
  const [firstPageCount, setFirstPageCount] = useState<number | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => { setTerm(search); ss.set('rdv2-search', search); }, SEARCH_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [search]);
  useEffect(() => { setCursors([undefined]); setFirstPageCount(null); }, [term, status, dateRange]);

  const base = useMemo(() => ({
    q: term || undefined,
    status: status || undefined,
    from: dateRange?.from?.toISOString(),
    to: dateRange?.to ? new Date(dateRange.to.getTime() + 24 * 60 * 60 * 1000 - 1).toISOString() : undefined,
    limit: HISTORY_PAGE_SIZE,
  }), [dateRange, status, term]);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          aria-label="Rechercher une réception"
          placeholder="N° réception, fournisseur, BL, lot, véhicule, commande"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="h-12 pl-10"
        />
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {[
          { value: '', label: 'Toutes' },
          { value: 'EN_ATTENTE_QC,EN_QC', label: 'En contrôle' },
          { value: 'LIBERE', label: 'Libérées' },
          { value: 'BLOQUE', label: 'Bloquées' },
          { value: 'REJETE', label: 'Rejetées' },
          { value: 'ANNULE', label: 'Annulées' },
        ].map((filter) => (
          <Button
            key={filter.label}
            type="button"
            size="sm"
            variant={status === filter.value ? 'secondary' : 'ghost'}
            onClick={() => setStatus(filter.value)}
          >
            {filter.label}
          </Button>
        ))}
        <DateRangeFilter dateRange={dateRange} onDateRangeChange={setDateRange} />
        <Button type="button" size="sm" variant="outline" className="ml-auto gap-1.5" onClick={onDailyReport}>
          <Printer className="h-4 w-4" />
          Rapport du jour
        </Button>
      </div>
      <div className="divide-y overflow-hidden rounded-lg border bg-card">
        <ReceptionListHead />
        {cursors.map((before, index) => (
          <HistoryPage
            key={before ?? 'first'}
            params={{ ...base, before }}
            isLast={index === cursors.length - 1}
            onMore={(next) => setCursors((current) => [...current, next])}
            onOpen={onOpen}
            onRows={index === 0 ? setFirstPageCount : undefined}
          />
        ))}
        {firstPageCount === 0 && <EmptyState>Aucune réception ne correspond à cette recherche.</EmptyState>}
      </div>
    </div>
  );
};

const PendingSection = ({ canManage, userId, activeReceptions, onOpen, onResume }: {
  canManage: boolean;
  userId: string | null;
  activeReceptions: ReceptionV2[];
  onOpen: (reception: ReceptionV2) => void;
  onResume: (draftId: string) => void;
}) => {
  const { data: serverDrafts = [], isLoading } = useListReceptionDraftsQuery();
  const [abandon] = useAbandonReceptionDraftMutation();
  const [localDrafts, setLocalDrafts] = useState<LocalIntakeDraft[]>([]);
  const [outbox, setOutbox] = useState<OutboxItem[]>([]);

  const refreshLocal = useCallback(() => {
    void listLocalDrafts().then(setLocalDrafts).catch(() => setLocalDrafts([]));
    void listOutbox().then(setOutbox).catch(() => setOutbox([]));
  }, []);
  useEffect(() => {
    refreshLocal();
    const unsubscribe = subscribeOutbox(refreshLocal);
    return () => { unsubscribe(); };
  }, [refreshLocal, serverDrafts]);

  const serverIds = useMemo(() => new Set(serverDrafts.map((draft) => draft.id)), [serverDrafts]);
  const deviceOnly = localDrafts.filter(
    (local) => !serverIds.has(local.draft.id) && (local.ownerUserId ?? userId) === userId && Boolean(local.draft.supplier_id),
  );
  const queueState = (id: string) => outbox.find((item) => item.payload.client_request_id === id);

  const DraftRow = ({ id, title, detail, note }: { id: string; title: string; detail: string; note?: string }) => (
    <div className="flex min-h-16 items-center gap-2 rounded-2xl border bg-card p-3">
      <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onResume(id)} disabled={!canManage}>
        <p className="truncate text-sm font-semibold">{title || 'Fournisseur à choisir'}</p>
        <p className="text-xs text-muted-foreground">{detail}</p>
        {note && <p className="text-xs font-medium text-amber-800">{note}</p>}
      </button>
      {canManage && <Button type="button" size="sm" onClick={() => onResume(id)}>Reprendre</Button>}
      {canManage && serverIds.has(id) && (
        <Button
          type="button"
          size="icon"
          variant="ghost"
          aria-label={`Abandonner le brouillon ${title}`}
          onClick={() => { if (window.confirm('Abandonner ce brouillon ? La saisie sera perdue.')) void abandon(id); }}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
    </div>
  );

  const describeServerDraft = (draft: ReceptionDraftRow) =>
    [draft.summary?.waitingFor, draft.summary?.deliveryNote && `BL ${draft.summary.deliveryNote}`, format(new Date(draft.updated_at), 'dd/MM HH:mm', { locale: fr })]
      .filter(Boolean).join(' · ');

  const hasDrafts = serverDrafts.length > 0 || deviceOnly.length > 0;

  return (
    <div className="space-y-5">
      <section className="space-y-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold"><Truck className="h-4 w-4 text-primary" />Livraisons en cours de saisie</h3>
        {isLoading ? <Loading /> : !hasDrafts ? <EmptyState>Aucune livraison en cours de saisie.</EmptyState> : (
          <>
            {serverDrafts.map((draft) => (
              <DraftRow key={draft.id} id={draft.id} title={draft.summary?.supplier ?? ''} detail={describeServerDraft(draft)} note={queueState(draft.id)?.lastError ?? undefined} />
            ))}
            {deviceOnly.map(({ draft, savedAt }) => {
              const queued = queueState(draft.id);
              return (
                <DraftRow
                  key={draft.id}
                  id={draft.id}
                  title={draft.supplier_label}
                  detail={`${getDraftWaitingFor(draft)} · ${format(new Date(savedAt), 'dd/MM HH:mm', { locale: fr })}`}
                  note={queued
                    ? queued.status === 'failed' ? `Refusée par le serveur : ${queued.lastError}` : 'En attente de synchronisation'
                    : 'Gardé sur cet appareil uniquement'}
                />
              );
            })}
          </>
        )}
      </section>
      <section className="space-y-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold"><ListChecks className="h-4 w-4 text-primary" />En attente du contrôle qualité</h3>
        {activeReceptions.length === 0
          ? <EmptyState>Aucune réception en attente du contrôle qualité.</EmptyState>
          : (
            <div className="divide-y overflow-hidden rounded-lg border bg-card">
              <ReceptionListHead />
              {activeReceptions.map((reception) => <ReceptionRow key={reception.id} reception={reception} onOpen={onOpen} />)}
            </div>
          )}
      </section>
    </div>
  );
};

export const ReceptionDashboardV2 = ({
  prefillPurchaseOrderId,
  initialView, onViewChange,
}: {
  onViewChange?: (view: string) => void;
  prefillPurchaseOrderId?: string;
  /** Deep-link: bra opens Bon de Réception Achat. */
  initialView?: string;
}) => {
  const { t, i18n } = useTranslation();
  const { roles, user } = useAuthContext();
  const permissions = useMemo(() => getReceptionPermissions(roles), [roles]);
  const canManageReception = useMemo(
    () => permissions.canRegister && (canPerformAction(roles, 'reception_data_entry') || canPerformAction(roles, 'reception_weighing')),
    [permissions.canRegister, roles],
  );
  // QC is offered only to the roles the server accepts for inspections (RG-Q12 keeps reception staff out).
  const canRunQc = permissions.canRunQc;
  const [subTab, setSubTab] = useState<SubTab>(() => {
    // Inspectors land on their queue; everyone else on the day's work.
    const roleDefault: SubTab = canRunQc && !canManageReception ? 'qc' : 'today';
    const saved = ss.get('rdv2-subtab', roleDefault);
    return VALID_SUB_TABS.includes(saved as SubTab) ? (saved as SubTab) : roleDefault;
  });
  const [workspace, setWorkspace] = useState<WorkspaceTarget | null>(null);
  const [intake, setIntake] = useState<IntakeTarget | null>(null);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const activeTabRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    activeTabRef.current?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }, [subTab, i18n.language]);

  const updateSubTab = useCallback((v: SubTab) => { setSubTab(v); ss.set('rdv2-subtab', v); onViewChange?.(v); }, [onViewChange]);

  useEffect(() => {
    if (prefillPurchaseOrderId) setIntake({ prefillPurchaseOrderId });
  }, [prefillPurchaseOrderId]);

  useEffect(() => {
    if (!initialView) return;
    if (initialView === 'new' && permissions.canRegister) {
      setIntake({});
      return;
    }
    const target = initialView === 'tablet' ? 'today' : initialView;
    if (VALID_SUB_TABS.includes(target as SubTab)) {
      setWorkspace(null);
      updateSubTab(target as SubTab);
    }
  }, [initialView, updateSubTab, permissions.canRegister]);

  const todayStart = useMemo(startOfToday, []);
  const todayQuery = useSearchReceptionsQuery({ from: todayStart, limit: 100 });
  const activeQuery = useSearchReceptionsQuery({ status: ACTIVE_STATUSES, limit: 100 });
  const { data: todayPage } = todayQuery;
  const { data: activePage } = activeQuery;
  const todaySource = { isLoading: todayQuery.isLoading, error: todayQuery.error, updatedAt: todayQuery.fulfilledTimeStamp, refetch: todayQuery.refetch };
  const activeSource = { isLoading: activeQuery.isLoading, error: activeQuery.error, updatedAt: activeQuery.fulfilledTimeStamp, refetch: activeQuery.refetch };
  const { data: drafts = [] } = useListReceptionDraftsQuery();
  const { data: alerts = [] } = useReceptionAlerts();
  const { data: suppliers = [] } = useSuppliers();
  const { data: todayNotices = [] } = useTodayPendingNotices();

  const todayRows = useMemo(() => todayPage?.rows ?? [], [todayPage]);
  const activeRows = useMemo(() => activePage?.rows ?? [], [activePage]);
  const awaitingQcCount = useMemo(() => activeRows.filter((r) => r.status === 'EN_ATTENTE_QC' || r.status === 'EN_QC').length, [activeRows]);
  const blockedCount = useMemo(() => activeRows.filter((r) => r.status === 'BLOQUE').length, [activeRows]);

  const openReception = useCallback((reception: ReceptionV2) => setWorkspace({ id: reception.id }), []);

  if (workspace) {
    return (
      <ReceptionDetailV2
        receptionId={workspace.id}
        initialSection={workspace.section}
        autoStartQc={workspace.autoStartQc}
        onBack={() => setWorkspace(null)}
      />
    );
  }

  if (intake) {
    return (
      <ReceptionIntakeFlow
        draftId={intake.draftId}
        prefillPurchaseOrderId={intake.prefillPurchaseOrderId}
        canRunQc={canRunQc}
        onClose={() => setIntake(null)}
        onOpenReception={(id, next) => {
          setIntake(null);
          setWorkspace({ id, autoStartQc: next === 'qc' });
        }}
      />
    );
  }

  const tabs: Array<{ value: SubTab; icon: typeof Clock3; label: string; badge: number | null; badgeClass?: string }> = [
    { value: 'today', icon: Clock3, label: "Réceptions du jour", badge: todayRows.length || null },
    { value: 'pending', icon: ListChecks, label: 'En attente', badge: (drafts.length + awaitingQcCount + blockedCount) || null, badgeClass: 'bg-amber-500 text-white' },
    { value: 'registry', icon: History, label: 'Historique', badge: null },
    ...(canRunQc ? [{ value: 'qc' as SubTab, icon: QrCode, label: 'Contrôle QC', badge: awaitingQcCount || null, badgeClass: 'bg-amber-500 text-white' }] : []),
    { value: 'bra', icon: FileText, label: 'Bons BRA', badge: null },
    { value: 'alerts', icon: AlertTriangle, label: 'Alertes', badge: alerts.length || null, badgeClass: 'bg-red-600 text-white' },
  ];

  return (
    <div className="space-y-4">
      {todayNotices.length > 0 && (
        <button
          type="button"
          onClick={() => setNoticeOpen(true)}
          className="flex w-full items-center gap-3 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-left text-sm text-sky-900 transition-colors hover:bg-sky-100"
        >
          <Bell className="h-4 w-4 shrink-0 text-sky-600" />
          <span>
            <span className="font-semibold">{todayNotices.length} {todayNotices.length > 1 ? 'camions annoncés' : 'camion annoncé'}</span>
            {' — '}
            {todayNotices.map((n) => `${n.vehicle_number} (${n.supplier_name ?? n.supplier_code ?? '-'})`).join(', ')}
          </span>
        </button>
      )}

      <Tabs dir={i18n.dir()} value={subTab} onValueChange={(v) => updateSubTab(v as SubTab)}>
        <div className="flex flex-wrap-reverse items-center gap-x-3 gap-y-2 border-b">
          <div className="min-w-0 flex-1 overflow-x-auto scrollbar-hide max-lg:basis-full">
          <TabsList className="flex h-auto min-w-max justify-start gap-1 rounded-none bg-transparent p-0 max-sm:grid max-sm:w-full max-sm:min-w-0 max-sm:grid-cols-3" aria-label="Sections de la réception">
            {tabs.map((tab) => {
              const active = subTab === tab.value;
              const short =
                tab.value === 'today' ? 'Aujourd’hui'
                  : tab.value === 'pending' ? 'Attente'
                    : tab.value === 'registry' ? 'Historique'
                      : tab.value === 'qc' ? 'QC'
                        : tab.value === 'bra' ? 'BRA'
                          : 'Alertes';
              return (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  ref={active ? activeTabRef : undefined}
                  className={cn(
                    'relative flex min-h-12 items-center justify-center gap-2 whitespace-nowrap rounded-none px-4 py-3 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring data-[state=active]:bg-transparent data-[state=active]:shadow-none max-sm:min-h-14 max-sm:flex-col max-sm:gap-1 max-sm:px-1.5 max-sm:py-2 max-sm:text-xs',
                    active ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <tab.icon className="h-4 w-4 shrink-0 max-sm:h-5 max-sm:w-5" />
                  <span className="max-sm:hidden">{tab.label}</span>
                  <span className="hidden max-sm:inline">{short}</span>
                  {tab.badge != null && (
                    <span className={cn('flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-bold leading-none text-primary-foreground', tab.badgeClass)}>
                      {tab.badge}
                    </span>
                  )}
                  {active && <span className="absolute bottom-0 inset-x-1 h-0.5 rounded-full bg-primary" />}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>
          <div className="ml-auto flex shrink-0 gap-2 pb-1.5 max-sm:w-full max-sm:pb-2">
          <Button type="button" variant="outline" className="min-h-11 gap-2 max-sm:flex-1" onClick={() => setNoticeOpen(true)}>
            <Bell className="h-4 w-4" />
            <span className="max-sm:hidden">Pré-annonces</span>
            <span className="sm:hidden">Annonces</span>
            {todayNotices.length > 0 ? ` (${todayNotices.length})` : ''}
          </Button>
          {canManageReception && (
            <Button type="button" className="min-h-11 gap-2 max-sm:flex-1 font-semibold" onClick={() => setIntake({})}>
              <Plus className="h-5 w-5" />
              {t('receptions.new')}
            </Button>
          )}
          </div>
        </div>

        <TabsContent value="today" className="mt-3 overflow-clip rounded-lg border bg-card">
          <DataState source={todaySource} data={todayPage} isEmpty={todayRows.length === 0} what="les réceptions du jour" className="m-2 mb-3" empty="Aucune réception aujourd'hui. La première action est Nouvelle réception.">
            {todayRows.map((reception) => <TodayTask key={reception.id} reception={reception} onOpen={openReception} />)}
          </DataState>
        </TabsContent>

        <TabsContent value="pending" className="mt-4">
          <DataState source={activeSource} data={activePage} isEmpty={false} what="les réceptions en attente">
            <PendingSection
              canManage={canManageReception}
              userId={user?.id ?? null}
              activeReceptions={activeRows}
              onOpen={openReception}
              onResume={(draftId) => setIntake({ draftId })}
            />
          </DataState>
        </TabsContent>

        <TabsContent value="registry" className="mt-4">
          <HistorySection onOpen={openReception} onDailyReport={() => printDailyReceptionReport(todayRows)} />
        </TabsContent>

        {canRunQc && (
          <TabsContent value="qc" className="mt-4">
            <DataState source={activeSource} data={activePage} isEmpty={false} what="la file de contrôle qualité">
              <ReceptionQcQueue receptions={activeRows} onOpenStorage={(id) => setWorkspace({ id, section: 'stock' })} />
            </DataState>
          </TabsContent>
        )}

        <TabsContent value="bra" className="mt-4">
          <BonReceptionAchatDashboard />
        </TabsContent>

        <TabsContent value="alerts" className="mt-4">
          <AlertsPanel />
        </TabsContent>
      </Tabs>

      <InboundNoticeDialog open={noticeOpen} onOpenChange={setNoticeOpen} suppliers={suppliers} />
    </div>
  );
};
