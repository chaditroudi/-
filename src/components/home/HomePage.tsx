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
import { RoleLanding } from './RoleLanding';
import type { ActorRole } from '@/types/roles';

interface HomePageProps {
  roles?: ActorRole[];
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

/** Accueil atelier — one urgent signal, lot hub, four posts. Nothing else. */
export const HomePage = ({ onNavigate, accessibleTabs, canInspect, metrics, roles = [] }: HomePageProps) => {
  const { data: settings } = useSiteSettings();
  const {
    qualityLots,
    storedLots,
    coverage,
  } = metrics;

  // An unknown figure offers no task; it never counts as zero to do.
  const activeAlertsCount = metrics.activeAlertsCount ?? 0;
  const quarantinedLots = metrics.quarantinedLots ?? 0;
  const phase2Active = metrics.phase2Active ?? 0;
  const phase2Waiting = metrics.phase2Waiting ?? 0;
  const activePackagingOrders = metrics.activePackagingOrders ?? 0;
  const pendingShipments = metrics.pendingShipments ?? 0;
  const inProgressOrders = metrics.inProgressOrders ?? 0;
  const qcQueue = qualityLots ?? 0;

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
        count: canInspect ? qcQueue : 0,
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
  }, [accessibleTabs, activeAlertsCount, canInspect, qcQueue, quarantinedLots, phase2Waiting, pendingShipments]);

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
      <RoleLanding roles={roles} tabs={accessibleTabs} onNavigate={onNavigate} />
      <div className="flex flex-wrap items-center justify-between gap-2">
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

      {coverage.unavailable.length > 0 && (
        <div role="status" className="flex items-start gap-2 rounded-lg border border-amber-300 bg-card px-3 py-2 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden />
          <span>
            <span className="font-medium">Impossible de vérifier : {coverage.unavailable.join(", ")}.</span>{" "}
            <span className="text-muted-foreground">Ce qui suit peut être incomplet.</span>
          </span>
        </div>
      )}

      {tasks.length > 0 ? (
        <div className="space-y-1.5">
          <p className="px-1 text-xs font-semibold text-muted-foreground">
            À faire aujourd&apos;hui
          </p>
          {tasks.map((task) => (
            <button
              key={task.tab}
              type="button"
              onClick={() => onNavigate(task.tab, task.options)}
              className="flex min-h-12 w-full items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3 text-left transition-colors hover:bg-accent/40 active:scale-[0.99]"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <Badge className={task.badgeClassName}>{task.badge}</Badge>
                <span className="truncate text-sm font-semibold">{task.title}</span>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
          ))}
        </div>
      ) : coverage.loading ? (
        <p role="status" className="px-1 text-sm text-muted-foreground">Vérification du travail en cours…</p>
      ) : coverage.unavailable.length === 0 ? (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          Rien d&apos;urgent sur vos postes.
        </div>
      ) : null}

      <LotJourneyHub onNavigate={onNavigate} accessibleTabs={accessibleTabs} compact />

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {posts.map((post) => (
          <button
            key={post.id}
            type="button"
            onClick={() => onNavigate(post.id)}
            className={cn(
              "flex min-h-[4.5rem] flex-col items-start gap-1 rounded-lg border px-3 py-3 text-left transition-colors active:scale-[0.98]",
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
