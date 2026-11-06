import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DataState } from '@/components/shared/DataState';
import { useTranslation } from 'react-i18next';
import { DateRange } from 'react-day-picker';
import {
  AlertTriangle,
  Bell,
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuthContext } from '@/contexts/AuthContext';
import { useTodayPendingNotices } from '@/hooks/useInboundNotices';
import { useReceptionAlerts } from '@/hooks/useReceptionsV2';
import { useSuppliers } from '@/hooks/useSuppliers';
import { formatDateTime, formatTime } from '@/lib/format';
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
  <div className="rounded-2xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">{children}</div>
);

const ListError = () => {
  const { t } = useTranslation();
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700" role="alert">
      {t('receptionList.loadError')}
    </div>
  );
};

const Loading = () => {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground" role="status">
      <Loader2 className="h-4 w-4 animate-spin" />
      {t('receptionList.loading')}
    </div>
  );
};

const ReceptionListHead = () => {
  const { t } = useTranslation();
  return (
    <div className="hidden gap-x-3 bg-secondary px-4 py-2 font-display text-[13px] font-semibold text-foreground/80 lg:grid lg:grid-cols-[10.5rem_minmax(0,1.4fr)_7rem_6.5rem_minmax(0,1fr)_6.5rem_9rem]">
      <span>{t('receptionList.head.reception')}</span>
      <span>{t('receptionList.head.supplier')}</span>
      <span>{t('receptionList.head.variety')}</span>
      <span className="text-end">{t('receptionList.head.weight')}</span>
      <span>{t('receptionList.head.deliveryNote')}</span>
      <span>{t('receptionList.head.arrival')}</span>
      <span className="text-end">{t('receptionList.head.status')}</span>
    </div>
  );
};

const KNOWN_STEPS = ['BROUILLON', 'EN_ATTENTE_QC', 'EN_QC', 'BLOQUE', 'LIBERE', 'REJETE', 'ANNULE'];
const useStatusText = () => {
  const { t } = useTranslation();
  return {
    next: (status: ReceptionV2['status']) => t(`receptionList.next.${KNOWN_STEPS.includes(status) ? status : 'default'}`),
    label: (status: ReceptionV2['status']) => t(`receptionStatus.${status}`, { defaultValue: receptionStatusLabels[status] }),
  };
};

const TodayTask = ({ reception, onOpen }: { reception: ReceptionV2; onOpen: (reception: ReceptionV2) => void }) => {
  const { t } = useTranslation();
  const status = useStatusText();
  return (
    <button
      type="button"
      onClick={() => onOpen(reception)}
      className="flex w-full flex-col gap-3 rounded-2xl border bg-card p-4 text-start shadow-sm transition-colors hover:border-primary/40 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold">
            {reception.supplier?.name || reception.supplier_name_snapshot || t('receptionList.noSupplier')}
          </p>
          <p className="font-mono text-sm text-muted-foreground" dir="ltr">{reception.reception_number || t('receptionList.noNumber')}</p>
        </div>
        <Badge className={cn('shrink-0 text-xs', receptionStatusColors[reception.status])}>{status.label(reception.status)}</Badge>
      </div>
      <p className="text-sm text-foreground">{status.next(reception.status)}</p>
      <div className="flex items-end justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {reception.variety || t('receptionList.noVariety')}
          {` · ${t('receptionList.bl')} `}
          {reception.delivery_note_number || '—'}
          {' · '}
          {formatTime(reception.created_at)}
        </p>
        <p className="text-2xl font-semibold tabular-nums" dir="ltr">
          <QuantityDisplay value={reception.quantity_total} unit={reception.unit || 'kg'} />
        </p>
      </div>
    </button>
  );
};

const ReceptionRow = ({ reception, onOpen }: { reception: ReceptionV2; onOpen: (reception: ReceptionV2) => void }) => {
  const { t } = useTranslation();
  const status = useStatusText();
  return (
    <button
      type="button"
      onClick={() => onOpen(reception)}
      className="grid min-h-14 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 px-4 py-2.5 text-start hover:bg-accent/40 lg:grid-cols-[10.5rem_minmax(0,1.4fr)_7rem_6.5rem_minmax(0,1fr)_6.5rem_9rem]"
    >
      <LotReference value={reception.reception_number} fallback={t('receptionList.noReceptionNumber')} />
      <Badge className={cn('justify-self-end text-xs lg:order-last', receptionStatusColors[reception.status])}>
        {status.label(reception.status)}
      </Badge>
      <span className="truncate text-sm">{reception.supplier?.name || reception.supplier_name_snapshot || t('receptionList.noSupplier')}</span>
      <span className="truncate text-sm text-muted-foreground lg:text-foreground">{reception.variety || '—'}</span>
      <span className="text-sm lg:text-end" dir="ltr">
        <QuantityDisplay value={reception.quantity_total} unit={reception.unit || 'kg'} />
      </span>
      <span className="truncate text-xs text-muted-foreground lg:text-sm">
        <span className="lg:hidden">{t('receptionList.bl')} </span>{reception.delivery_note_number || '—'}{reception.purchase_order_number ? ` · ${reception.purchase_order_number}` : ''}
      </span>
      <span className="text-xs text-muted-foreground lg:text-sm">{formatDateTime(reception.created_at)}</span>
    </button>
  );
};

const HistoryPage = ({ params, isLast, onMore, onOpen, onRows }: {
  params: Record<string, string | number | undefined>;
  isLast: boolean;
  onMore: (before: string) => void;
  onOpen: (reception: ReceptionV2) => void;
  onRows?: (count: number) => void;
}) => {
  const { t } = useTranslation();
  const { data, isLoading, isError } = useSearchReceptionsQuery(params);
  useEffect(() => { if (data) onRows?.(data.rows.length); }, [data, onRows]);
  if (isError) return <ListError />;
  if (isLoading || !data) return <Loading />;
  return (
    <>
      {data.rows.map((reception) => <ReceptionRow key={reception.id} reception={reception} onOpen={onOpen} />)}
      {isLast && data.nextBefore && (
        <div className="p-3">
          <Button type="button" variant="outline" className="w-full" onClick={() => onMore(data.nextBefore!)}>
            {t('receptionList.more')}
          </Button>
        </div>
      )}
    </>
  );
};

const HistorySection = ({ onOpen, onDailyReport }: { onOpen: (reception: ReceptionV2) => void; onDailyReport: () => void }) => {
  const { t } = useTranslation();
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
        <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          aria-label={t('receptionList.search')}
          placeholder={t('receptionList.searchPlaceholder')}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="h-12 ps-10"
        />
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {[
          { value: '', label: t('receptionList.filter.all') },
          { value: 'EN_ATTENTE_QC,EN_QC', label: t('receptionList.filter.inQc') },
          { value: 'LIBERE', label: t('receptionList.filter.released') },
          { value: 'BLOQUE', label: t('receptionList.filter.blocked') },
          { value: 'REJETE', label: t('receptionList.filter.rejected') },
          { value: 'ANNULE', label: t('receptionList.filter.cancelled') },
        ].map((filter) => (
          <Button
            key={filter.value || 'all'}
            type="button"
            size="sm"
            aria-pressed={status === filter.value}
            variant={status === filter.value ? 'secondary' : 'ghost'}
            className={cn('rounded-full', status === filter.value && 'bg-accent text-accent-foreground')}
            onClick={() => setStatus(filter.value)}
          >
            {filter.label}
          </Button>
        ))}
        <DateRangeFilter dateRange={dateRange} onDateRangeChange={setDateRange} />
        <Button type="button" size="sm" variant="outline" className="ms-auto gap-1.5" onClick={onDailyReport}>
          <Printer className="h-4 w-4" />
          {t('receptionList.dailyReport')}
        </Button>
      </div>
      <div className="divide-y overflow-hidden rounded-2xl border bg-card shadow-sm">
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
        {firstPageCount === 0 && <EmptyState>{t('receptionList.noMatch')}</EmptyState>}
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
  const { t } = useTranslation();
  const { data: serverDrafts = [], isLoading } = useListReceptionDraftsQuery();
  const [abandon] = useAbandonReceptionDraftMutation();
  const [localDrafts, setLocalDrafts] = useState<LocalIntakeDraft[]>([]);
  const [outbox, setOutbox] = useState<OutboxItem[]>([]);
  const [abandoning, setAbandoning] = useState<{ id: string; title: string } | null>(null);

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
    <div className="flex min-h-16 items-center gap-2 rounded-2xl border bg-card p-3 shadow-sm">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent text-primary"><Truck className="h-5 w-5" aria-hidden /></span>
      <button type="button" className="min-w-0 flex-1 text-start" onClick={() => onResume(id)} disabled={!canManage}>
        <p className="truncate font-semibold">{title || t('receptionList.chooseSupplier')}</p>
        <p className="text-xs text-muted-foreground">{detail}</p>
        {note && <p className="text-xs font-medium text-sand-foreground">{note}</p>}
      </button>
      {canManage && <Button type="button" onClick={() => onResume(id)}>{t('receptionList.resume')}</Button>}
      {canManage && serverIds.has(id) && (
        <Button
          type="button"
          size="icon"
          variant="ghost"
          aria-label={t('receptionList.abandonDraft', { title })}
          onClick={() => setAbandoning({ id, title })}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
    </div>
  );

  const describeServerDraft = (draft: ReceptionDraftRow) =>
    [draft.summary?.waitingFor, draft.summary?.deliveryNote && `${t('receptionList.bl')} ${draft.summary.deliveryNote}`, formatDateTime(draft.updated_at)]
      .filter(Boolean).join(' · ');

  const hasDrafts = serverDrafts.length > 0 || deviceOnly.length > 0;

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h3 className="flex items-center gap-2 font-display text-lg font-semibold"><Truck className="h-4 w-4 text-primary" />{t('receptionList.draftsTitle')}</h3>
        {isLoading ? <Loading /> : !hasDrafts ? <EmptyState>{t('receptionList.noDrafts')}</EmptyState> : (
          <div className="grid gap-2 lg:grid-cols-2">
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
                  detail={`${getDraftWaitingFor(draft)} · ${formatDateTime(savedAt)}`}
                  note={queued
                    ? queued.status === 'failed' ? t('receptionList.refused', { error: queued.lastError }) : t('receptionList.syncWaiting')
                    : t('receptionList.deviceOnly')}
                />
              );
            })}
          </div>
        )}
      </section>
      <section className="space-y-2">
        <h3 className="flex items-center gap-2 font-display text-lg font-semibold"><ListChecks className="h-4 w-4 text-primary" />{t('receptionList.waitingQcTitle')}</h3>
        {activeReceptions.length === 0
          ? <EmptyState>{t('receptionList.noWaitingQc')}</EmptyState>
          : (
            <div className="divide-y overflow-hidden rounded-2xl border bg-card shadow-sm">
              <ReceptionListHead />
              {activeReceptions.map((reception) => <ReceptionRow key={reception.id} reception={reception} onOpen={onOpen} />)}
            </div>
          )}
      </section>

      <AlertDialog open={Boolean(abandoning)} onOpenChange={(open) => { if (!open) setAbandoning(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('receptionList.abandonDraftTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{abandoning?.title ? `${abandoning.title} — ` : ''}{t('receptionList.abandonDraftBody')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('receptionList.keepDraft')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (abandoning) void abandon(abandoning.id); setAbandoning(null); }}
            >
              {t('receptionList.abandonDraftConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

const Stat = ({ label, value, tone = 'default' }: { label: string; value: number | null; tone?: 'default' | 'attention' }) => (
  <div className={cn('rounded-xl border bg-card px-4 py-2.5 shadow-sm', tone === 'attention' && value && value > 0 && 'border-amber-300 bg-sand/60')}>
    <p className="text-xs font-medium text-muted-foreground">{label}</p>
    <p className="font-display text-2xl font-semibold tabular-nums">{value ?? '—'}</p>
  </div>
);

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

  const tabs: Array<{ value: SubTab; icon: typeof Clock3; key: string; badge: number | null; badgeClass?: string }> = [
    { value: 'today', icon: Clock3, key: 'today', badge: todayRows.length || null },
    { value: 'pending', icon: ListChecks, key: 'pending', badge: (drafts.length + awaitingQcCount + blockedCount) || null, badgeClass: 'bg-amber-600 text-white' },
    { value: 'registry', icon: History, key: 'registry', badge: null },
    ...(canRunQc ? [{ value: 'qc' as SubTab, icon: QrCode, key: 'qc', badge: awaitingQcCount || null, badgeClass: 'bg-amber-600 text-white' }] : []),
    { value: 'bra', icon: FileText, key: 'bra', badge: null },
    { value: 'alerts', icon: AlertTriangle, key: 'alerts', badge: alerts.length || null, badgeClass: 'bg-red-600 text-white' },
  ];
  // Known only once the lists have answered; an unknown count is never shown as zero.
  const known = (value: number) => (activePage ? value : null);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h2 className="font-display text-3xl font-semibold leading-tight">{t('receptionList.title')}</h2>
          <p className="text-muted-foreground">{t('receptionList.subtitle')}</p>
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <Button type="button" variant="outline" size="lg" className="gap-2 max-sm:flex-1" onClick={() => setNoticeOpen(true)}>
            <Bell className="h-4 w-4" />
            <span className="max-sm:hidden">{t('receptionList.preNotices')}</span>
            <span className="sm:hidden">{t('receptionList.preNoticesShort')}</span>
            {todayNotices.length > 0 ? ` (${todayNotices.length})` : ''}
          </Button>
          {canManageReception && (
            <Button type="button" size="xl" className="gap-2 font-semibold max-sm:flex-1" onClick={() => setIntake({})}>
              <Plus className="h-5 w-5" />
              {t('receptions.new')}
            </Button>
          )}
        </div>
      </header>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label={t('receptionList.stat.today')} value={todayPage ? todayRows.length : null} />
        <Stat label={t('receptionList.stat.drafts')} value={drafts.length} />
        <Stat label={t('receptionList.stat.waitingQc')} value={known(awaitingQcCount)} tone="attention" />
        <Stat label={t('receptionList.stat.blocked')} value={known(blockedCount)} tone="attention" />
      </div>

      {todayNotices.length > 0 && (
        <button
          type="button"
          onClick={() => setNoticeOpen(true)}
          className="flex w-full items-center gap-3 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-start text-sm text-sky-900 transition-colors hover:bg-sky-100"
        >
          <Bell className="h-4 w-4 shrink-0 text-sky-600" />
          <span>
            <span className="font-semibold">{t('receptionList.notices', { count: todayNotices.length })}</span>
            {' — '}
            {todayNotices.map((n) => `${n.vehicle_number} (${n.supplier_name ?? n.supplier_code ?? '-'})`).join(', ')}
          </span>
        </button>
      )}

      <Tabs dir={i18n.dir()} value={subTab} onValueChange={(v) => updateSubTab(v as SubTab)}>
        <div className="-mx-1 overflow-x-auto px-1 pb-1 scrollbar-hide">
          <TabsList className="flex h-auto min-w-max justify-start gap-1.5 rounded-2xl border bg-card p-1.5 shadow-sm max-sm:grid max-sm:w-full max-sm:min-w-0 max-sm:grid-cols-3" aria-label={t('receptionList.tabs.label')}>
            {tabs.map((tab) => {
              const active = subTab === tab.value;
              return (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  ref={active ? activeTabRef : undefined}
                  className={cn(
                    'relative flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring data-[state=active]:shadow-none max-sm:min-h-14 max-sm:flex-col max-sm:gap-1 max-sm:px-1.5 max-sm:text-xs',
                    active ? 'bg-accent text-accent-foreground data-[state=active]:bg-accent' : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
                  )}
                >
                  <tab.icon className="h-4 w-4 shrink-0 max-sm:h-5 max-sm:w-5" />
                  <span className="max-sm:hidden">{t(`receptionList.tabs.${tab.key}`)}</span>
                  <span className="hidden max-sm:inline">{t(`receptionList.tabs.${tab.key}Short`)}</span>
                  {tab.badge != null && (
                    <span className={cn('flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-bold leading-none text-primary-foreground', tab.badgeClass)}>
                      {tab.badge}
                    </span>
                  )}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>

        <TabsContent value="today" className="mt-3">
          <DataState source={todaySource} data={todayPage} isEmpty={todayRows.length === 0} what={t('receptionList.todayWhat')} empty={t('receptionList.todayEmpty')}>
            <div className="grid gap-3 md:grid-cols-2">
              {todayRows.map((reception) => <TodayTask key={reception.id} reception={reception} onOpen={openReception} />)}
            </div>
          </DataState>
        </TabsContent>

        <TabsContent value="pending" className="mt-4">
          <DataState source={activeSource} data={activePage} isEmpty={false} what={t('receptionList.pendingWhat')}>
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
            <DataState source={activeSource} data={activePage} isEmpty={false} what={t('receptionList.qcWhat')}>
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
