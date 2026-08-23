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

  const urgent = useMemo(() => {
    const items = [
      {
        count: activeAlertsCount,
        title: `${activeAlertsCount} alerte${activeAlertsCount > 1 ? "s" : ""}`,
        tab: "alerts" as const,
        badge: "Urgent",
        badgeClassName: "bg-red-600 text-white",
      },
      {
        count: qcQueue,
        title: `${qcQueue} QC à faire`,
        tab: "receptions" as const,
        badge: "QC",
        badgeClassName: "bg-amber-500 text-white",
      },
      {
        count: quarantinedLots,
        title: `${quarantinedLots} quarantaine`,
        tab: "storage" as const,
        badge: "Stock",
        badgeClassName: "bg-orange-500 text-white",
      },
      {
        count: pendingShipments,
        title: `${pendingShipments} expédition${pendingShipments > 1 ? "s" : ""}`,
        tab: "logistics" as const,
        badge: "Sortie",
        badgeClassName: "bg-cyan-700 text-white",
      },
    ].filter((i) => i.count > 0 && accessibleTabs.includes(i.tab));
    return items[0] ?? null;
  }, [accessibleTabs, activeAlertsCount, qcQueue, quarantinedLots, pendingShipments]);

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

      {urgent ? (
        <button
          type="button"
          onClick={() => onNavigate(urgent.tab)}
          className="flex w-full items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-left"
        >
          <div className="flex min-w-0 items-center gap-2">
            <Badge className={urgent.badgeClassName}>{urgent.badge}</Badge>
            <span className="truncate text-sm font-semibold">{urgent.title}</span>
          </div>
          <ArrowRight className="h-4 w-4 shrink-0 text-amber-900" />
        </button>
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
