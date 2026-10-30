import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Factory,
  PackageCheck,
  QrCode,
  Ship,
  Truck,
  Warehouse,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LotJourneyHub } from "./LotJourneyHub";
import type { AppNavigateFn } from "@/lib/appNavigate";
import type { AppTab } from "@/lib/roleAccess";
import { useSiteSettings } from "@/hooks/useSettings";

interface HomePageProps {
  onNavigate: AppNavigateFn;
  accessibleTabs: AppTab[];
  metrics: {
    draftReceptions: number;
    waitingQcReceptions: number;
    inQcReceptions: number;
    releasedReceptions: number;
    pendingReceptions: number;
    inProgressOrders: number;
    qualityLots: number;
    quarantinedLots: number;
    storedLots: number;
    activeAlertsCount: number;
    phase2Active?: number;
    phase2Waiting?: number;
    validatedPFLots?: number;
    activePackagingOrders?: number;
    pendingShipments?: number;
  };
}

/** Accueil atelier — one urgent signal, lot hub, four posts. Nothing else. */
export const HomePage = ({ onNavigate, accessibleTabs, metrics }: HomePageProps) => {
  const { data: settings } = useSiteSettings();
  const {
    waitingQcReceptions,
    inQcReceptions,
    quarantinedLots,
    storedLots,
    activeAlertsCount,
    phase2Active = 0,
    phase2Waiting = 0,
    activePackagingOrders = 0,
    pendingShipments = 0,
    inProgressOrders,
  } = metrics;

  const qcQueue = waitingQcReceptions + inQcReceptions;

  // "À faire aujourd'hui" — every pending item the role can act on, ranked most
  // urgent first, each row a one-tap jump to the exact screen. Was a single
  // top-urgent banner; now the full actionable queue.
  const tasks = useMemo(() => {
    return [
      {
        count: activeAlertsCount,
        title: `${activeAlertsCount} alerte${activeAlertsCount > 1 ? "s" : ""} à traiter`,
        tab: "alerts" as const,
        options: undefined,
        badge: "Urgent",
        badgeClassName: "bg-red-600 text-white",
      },
      {
        count: qcQueue,
        title: `${qcQueue} contrôle${qcQueue > 1 ? "s" : ""} QC à faire`,
        tab: "receptions" as const,
        options: { view: "qc" },
        badge: "QC",
        badgeClassName: "bg-amber-500 text-white",
      },
      {
        count: quarantinedLots,
        title: `${quarantinedLots} lot${quarantinedLots > 1 ? "s" : ""} en quarantaine`,
        tab: "storage" as const,
        options: { focus: "quarantine" },
        badge: "Stock",
        badgeClassName: "bg-orange-500 text-white",
      },
      {
        count: phase2Waiting,
        title: `${phase2Waiting} lot${phase2Waiting > 1 ? "s" : ""} en attente atelier`,
        tab: "production" as const,
        options: { view: "phase2", module: "pipeline" as const },
        badge: "Prod",
        badgeClassName: "bg-violet-600 text-white",
      },
      {
        count: pendingShipments,
        title: `${pendingShipments} expédition${pendingShipments > 1 ? "s" : ""} à préparer`,
        tab: "logistics" as const,
        options: { view: "shipments" },
        badge: "Sortie",
        badgeClassName: "bg-cyan-700 text-white",
      },
    ].filter((i) => i.count > 0 && accessibleTabs.includes(i.tab));
  }, [accessibleTabs, activeAlertsCount, qcQueue, quarantinedLots, phase2Waiting, pendingShipments]);

  const posts = [
    {
      id: "receptions",
      label: "Réception",
      icon: Truck,
      count: qcQueue || null,
      tone: "border-amber-200 bg-amber-50 text-amber-900",
    },
    {
      id: "storage",
      label: "Stock",
      icon: Warehouse,
      count: storedLots || null,
      tone: "border-emerald-200 bg-emerald-50 text-emerald-900",
    },
    {
      id: "production",
      label: "Production",
      icon: Factory,
      count: phase2Active + phase2Waiting + inProgressOrders || null,
      tone: "border-violet-200 bg-violet-50 text-violet-900",
    },
    {
      id: "packaging",
      label: "Condit.",
      icon: PackageCheck,
      count: activePackagingOrders || null,
      tone: "border-sky-200 bg-sky-50 text-sky-900",
    },
    {
      id: "logistics",
      label: "Expédition",
      icon: Ship,
      count: pendingShipments || null,
      tone: "border-cyan-200 bg-cyan-50 text-cyan-900",
    },
    {
      id: "scan",
      label: "Scan",
      icon: QrCode,
      count: null,
      tone: "border-slate-200 bg-slate-50 text-slate-800",
    },
  ].filter((p) => accessibleTabs.includes(p.id as AppTab));

  const plantLabel = [settings?.plant_name, settings?.site_code].filter(Boolean).join(" · ");

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {plantLabel || "Usine"}
          </p>
          <h1 className="text-xl font-semibold tracking-tight">Accueil atelier</h1>
        </div>
        <div className="flex gap-2">
          {accessibleTabs.includes("alerts") && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => onNavigate("alerts")}
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              Alertes
              {activeAlertsCount > 0 && (
                <Badge className="ml-1 bg-red-600 text-white">{activeAlertsCount}</Badge>
              )}
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-1.5"
            onClick={() => onNavigate("home", { view: "fiches" })}
          >
            <BookOpen className="h-3.5 w-3.5" />
            Fiches
          </Button>
        </div>
      </div>

      {tasks.length > 0 ? (
        <div className="space-y-1.5">
          <p className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            À faire aujourd&apos;hui
          </p>
          {tasks.map((task) => (
            <button
              key={task.tab}
              type="button"
              onClick={() => onNavigate(task.tab, task.options)}
              className="flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left transition-colors hover:bg-accent/40 active:scale-[0.99]"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <Badge className={task.badgeClassName}>{task.badge}</Badge>
                <span className="truncate text-sm font-semibold">{task.title}</span>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          Rien d&apos;urgent — suivez un lot.
        </div>
      )}

      <LotJourneyHub onNavigate={onNavigate} accessibleTabs={accessibleTabs} compact />

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {posts.map((post) => (
          <button
            key={post.id}
            type="button"
            onClick={() => onNavigate(post.id)}
            className={cn(
              "flex flex-col items-start gap-1 rounded-xl border px-3 py-3 text-left transition-colors active:scale-[0.98]",
              post.tone,
            )}
          >
            <div className="flex w-full items-center justify-between">
              <post.icon className="h-4 w-4" />
              {post.count != null && post.count > 0 && (
                <span className="text-sm font-bold tabular-nums">{post.count}</span>
              )}
            </div>
            <span className="text-xs font-semibold leading-tight">{post.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
