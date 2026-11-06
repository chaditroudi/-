import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  Factory,
  PackageCheck,
  QrCode,
  ShieldCheck,
  Ship,
  Truck,
  Warehouse,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LotJourneyHub } from "./LotJourneyHub";
import type { AppNavigateFn, AppNavigateOptions } from "@/lib/appNavigate";
import { getRoleWorkspaceProfile, getShellDensity, type AppTab } from "@/lib/roleAccess";
import { getDailyAction } from "@/lib/roleLanding";
import { canWrite } from "@/lib/apiAccess";
import { useSiteSettings } from "@/hooks/useSettings";
import { ROLE_CONFIG, type ActorRole } from '@/types/roles';
import { ManagerKpi, StationChips, TaskCard, type Station } from "@/components/shared/task";

interface HomePageProps {
  roles?: ActorRole[];
  /** Full name of the signed-in person, for the greeting. */
  userName?: string | null;
  onNavigate: AppNavigateFn;
  accessibleTabs: AppTab[];
  /** Reception staff see the queue's size on their post, but the work is not theirs. */
  canInspect: boolean;
  metrics: {
    draftReceptions: number | null;
    waitingQcReceptions: number | null;
    inQcReceptions: number | null;
    releasedReceptions: number | null;
    pendingReceptions: number | null;
    inProgressOrders: number | null;
    qualityLots: number | null;
    quarantinedLots: number | null;
    storedLots: number | null;
    activeAlertsCount: number | null;
    phase2Active?: number | null;
    phase2Waiting?: number | null;
    validatedPFLots?: number | null;
    activePackagingOrders?: number | null;
    pendingShipments?: number | null;
    coverage: { loading: boolean; unavailable: string[] };
  };
}

type TaskKey = "alerts" | "qc" | "drafts" | "quarantine" | "workshop" | "shipments" | "packaging";
interface QueueTask { key: TaskKey; count: number; tab: AppTab; options?: AppNavigateOptions; icon: LucideIcon; tone: string }

const STATION_ICONS: Partial<Record<AppTab, LucideIcon>> = {
  receptions: Truck, storage: Warehouse, production: Factory, packaging: PackageCheck, logistics: Ship,
  maintenance: Wrench, quality: ClipboardList, scan: QrCode,
};

/** Home is the worker's day: who I am, my stations, the next real task, the rest of the queue.
 * Every count is real; an unknown count offers no task and never reads as zero. */
export const HomePage = ({ onNavigate, accessibleTabs, canInspect, metrics, roles = [], userName }: HomePageProps) => {
  const { t } = useTranslation();
  const { data: settings } = useSiteSettings();
  const density = roles.length ? getShellDensity(roles) : "floor";
  const floor = density === "floor";
  const workspace = roles.length ? getRoleWorkspaceProfile(roles) : null;
  const dailyAction = roles.length ? getDailyAction(roles, accessibleTabs) : null;
  const { coverage } = metrics;
  const has = (tab: AppTab) => accessibleTabs.includes(tab);

  // Ranked most urgent first; each row jumps to the exact screen. Only known, positive counts become tasks.
  const tasks = useMemo<QueueTask[]>(() => {
    const items: Array<QueueTask | null> = [
      { key: "alerts", count: metrics.activeAlertsCount ?? 0, tab: "alerts", icon: AlertTriangle, tone: "bg-red-600 text-white" },
      canInspect ? { key: "qc", count: metrics.qualityLots ?? 0, tab: "receptions", options: { view: "qc" }, icon: ShieldCheck, tone: "bg-amber-600 text-white" } : null,
      canWrite(roles, "receptionCreate") ? { key: "drafts", count: metrics.draftReceptions ?? 0, tab: "receptions", options: { view: "pending" }, icon: Truck, tone: "bg-primary text-primary-foreground" } : null,
      { key: "quarantine", count: metrics.quarantinedLots ?? 0, tab: "storage", options: { focus: "quarantine" }, icon: Warehouse, tone: "bg-orange-600 text-white" },
      { key: "workshop", count: metrics.phase2Waiting ?? 0, tab: "production", options: { view: "phase2", module: "pipeline" }, icon: Factory, tone: "bg-violet-600 text-white" },
      { key: "packaging", count: floor ? metrics.activePackagingOrders ?? 0 : 0, tab: "packaging", icon: PackageCheck, tone: "bg-sky-700 text-white" },
      { key: "shipments", count: metrics.pendingShipments ?? 0, tab: "logistics", options: { view: "shipments" }, icon: Ship, tone: "bg-cyan-700 text-white" },
    ];
    return items.filter((item): item is QueueTask => !!item && item.count > 0 && accessibleTabs.includes(item.tab));
  }, [accessibleTabs, canInspect, floor, metrics, roles]);

  const stations = useMemo<Station[]>(() => {
    const ordered: AppTab[] = ["receptions", "storage", "production", "packaging", "logistics", "maintenance", "quality", "scan"];
    const counts: Partial<Record<AppTab, number | null | undefined>> = {
      receptions: metrics.qualityLots,
      storage: metrics.storedLots,
      production: [metrics.phase2Active, metrics.phase2Waiting, metrics.inProgressOrders].some((v) => v == null)
        ? undefined : (metrics.phase2Active ?? 0) + (metrics.phase2Waiting ?? 0) + (metrics.inProgressOrders ?? 0),
      packaging: metrics.activePackagingOrders,
      logistics: metrics.pendingShipments,
    };
    const list: Station[] = ordered.filter(has).map((tab) => ({
      id: tab, label: t(`nav.${tab}`, { defaultValue: STATION_LABELS[tab] }), icon: (() => { const Icon = STATION_ICONS[tab] ?? ClipboardList; return <Icon />; })(),
      count: counts[tab] ?? undefined,
    }));
    if (canInspect && has("receptions")) list.splice(1, 0, { id: "qc", label: t("dock.qc"), icon: <ShieldCheck />, count: metrics.qualityLots ?? undefined });
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessibleTabs, canInspect, metrics, t]);

  const openStation = (id: string) => (id === "qc" ? onNavigate("receptions", { view: "qc" }) : onNavigate(id as AppTab));
  const firstName = userName?.trim().split(/\s+/)[0];
  const plantLabel = [settings?.plant_name, settings?.site_code].filter(Boolean).join(" · ");
  const roleLabel = roles.map((role) => ROLE_CONFIG[role]?.label).filter(Boolean).join(" · ");
  const [next, ...rest] = tasks;
  const dailyLabel = dailyAction
    ? t(`worker.daily.${dailyAction.options?.view === "qc" ? "qc" : dailyAction.tab}`, { defaultValue: dailyAction.label })
    : null;

  type Kpi = { key: string; value: number | null | undefined; tab: AppTab; options?: AppNavigateOptions; attention?: boolean };
  const kpis = ([
    { key: "alerts", value: metrics.activeAlertsCount, tab: "alerts", attention: true },
    { key: "qc", value: metrics.qualityLots, tab: "receptions", options: { view: "qc" }, attention: true },
    { key: "quarantine", value: metrics.quarantinedLots, tab: "storage", options: { focus: "quarantine" }, attention: true },
    { key: "orders", value: metrics.inProgressOrders, tab: "production" },
    { key: "packaging", value: metrics.activePackagingOrders, tab: "packaging" },
    { key: "shipments", value: metrics.pendingShipments, tab: "logistics", options: { view: "shipments" } },
  ] satisfies Kpi[] as Kpi[]).filter((kpi) => has(kpi.tab) && kpi.value !== null && kpi.value !== undefined);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0 space-y-1">
          {(plantLabel || workspace) && (
            <p className="text-sm font-semibold text-primary">{[plantLabel, workspace?.workspaceLabel].filter(Boolean).join(" · ")}</p>
          )}
          <h2 className="font-display text-3xl font-semibold leading-tight sm:text-4xl">
            {firstName ? t("worker.greeting", { name: firstName }) : t("worker.greetingNoName")}
          </h2>
          <p className="text-muted-foreground">{floor ? t("worker.subtitleFloor") : t("worker.subtitleManager")}</p>
          {roleLabel && <p className="text-sm text-muted-foreground">{roleLabel}</p>}
        </div>
        <div className="flex gap-2">
          {has("alerts") && (
            <Button type="button" variant="outline" className="gap-1.5" onClick={() => onNavigate("alerts")}>
              <AlertTriangle className="h-4 w-4" aria-hidden />
              {t("worker.alerts")}
              {(metrics.activeAlertsCount ?? 0) > 0 && <Badge className="ms-1 bg-red-600 text-white">{metrics.activeAlertsCount}</Badge>}
            </Button>
          )}
          <Button type="button" variant="ghost" className="gap-1.5" onClick={() => onNavigate("home", { view: "fiches" })}>
            <BookOpen className="h-4 w-4" aria-hidden />
            {t("worker.fiches")}
          </Button>
        </div>
      </header>

      {stations.length > 1 && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground">{t("worker.stations")}</h3>
          <StationChips stations={stations} onSelect={openStation} label={t("worker.stations")} />
        </section>
      )}

      {coverage.unavailable.length > 0 && (
        <div role="status" className="flex items-start gap-2 rounded-xl border border-amber-300 bg-sand px-4 py-3 text-sm text-sand-foreground">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>
            <span className="font-medium">{t("worker.cannotCheck", { list: coverage.unavailable.join(", ") })}</span>{" "}
            <span>{t("worker.mayBeIncomplete")}</span>
          </span>
        </div>
      )}

      <section aria-label={t("worker.nextTask")} className="space-y-3">
        {next ? (
          <TaskCard
            variant={floor ? "hero" : "default"}
            status="ready"
            icon={<next.icon />}
            title={t(`worker.tasks.${next.key}`, { count: next.count })}
            description={t(`worker.taskHint.${next.key}`)}
            actionLabel={t("worker.open")}
            onAction={() => onNavigate(next.tab, next.options)}
          />
        ) : coverage.loading ? (
          <p role="status" className="rounded-2xl border bg-card px-5 py-6 text-muted-foreground">{t("worker.checking")}</p>
        ) : dailyAction ? (
          <TaskCard
            variant={floor ? "hero" : "default"}
            status="ready"
            icon={(() => { const Icon = STATION_ICONS[dailyAction.tab] ?? ArrowRight; return <Icon />; })()}
            title={dailyLabel ?? dailyAction.label}
            description={coverage.unavailable.length === 0 ? t("worker.nothingQueued") : undefined}
            actionLabel={t("worker.start")}
            onAction={() => onNavigate(dailyAction.tab, dailyAction.options)}
          />
        ) : null}

        {!next && !coverage.loading && coverage.unavailable.length === 0 && (
          <div role="status" className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-accent px-4 py-3 text-sm text-accent-foreground">
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
            {t("worker.nothingUrgent")}
          </div>
        )}
      </section>

      {rest.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground">{t("worker.todo")}</h3>
          <ul className="grid gap-2 sm:grid-cols-2">
            {rest.map((task) => (
              <li key={task.key}>
                <button
                  type="button"
                  onClick={() => onNavigate(task.tab, task.options)}
                  className="flex min-h-16 w-full items-center gap-3 rounded-xl border bg-card px-4 py-3 text-start shadow-sm transition-colors hover:border-primary/40 hover:bg-accent/50"
                >
                  <Badge className={cn("shrink-0", task.tone)}>{t(`worker.badge.${task.key}`)}</Badge>
                  <span className="min-w-0 flex-1 font-semibold">{t(`worker.tasks.${task.key}`, { count: task.count })}</span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!floor && kpis.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground">{t("worker.overview")}</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {kpis.map((kpi) => (
              <ManagerKpi
                key={kpi.key}
                label={t(`worker.kpi.${kpi.key}`)}
                value={kpi.value}
                source={t("worker.liveSource")}
                period={t("worker.now")}
                tone={kpi.attention ? "attention" : "default"}
                onOpen={() => onNavigate(kpi.tab, kpi.options)}
              />
            ))}
          </div>
        </section>
      )}

      <LotJourneyHub onNavigate={onNavigate} accessibleTabs={accessibleTabs} compact />

      {floor && (
        <section aria-label={t("worker.howTo.title")} className="rounded-2xl border bg-card p-5 shadow-sm">
          <h3 className="mb-3 font-display text-lg font-semibold">{t("worker.howTo.title")}</h3>
          <ol className="grid gap-3 sm:grid-cols-3">
            {(["step1", "step2", "step3"] as const).map((step, index) => (
              <li key={step} className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent font-semibold text-accent-foreground">{index + 1}</span>
                <span className="font-medium">{t(`worker.howTo.${step}`)}</span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
};

const STATION_LABELS: Partial<Record<AppTab, string>> = {
  receptions: "Réception", storage: "Stock", production: "Production", packaging: "Conditionnement",
  logistics: "Expédition", maintenance: "Maintenance", quality: "Qualité", scan: "Scan",
};
