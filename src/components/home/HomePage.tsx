import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ClipboardCheck,
  Factory,
  ShoppingCart,
  Truck,
  Warehouse,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { FactoryFlowPipeline } from "./FactoryFlowPipeline";
import type { AppTab } from "@/lib/roleAccess";
import { APP_TAB_META } from "@/lib/appTabs";

interface HomePageProps {
  onNavigate: (tab: string) => void;
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

interface QueueItemProps {
  title: string;
  description: string;
  badge: string;
  badgeClassName: string;
  ctaLabel: string;
  onClick: () => void;
}

const QueueItem = ({ title, description, badge, badgeClassName, ctaLabel, onClick }: QueueItemProps) => (
  <button
    type="button"
    onClick={onClick}
    className="flex w-full flex-col items-start gap-3 rounded-2xl border border-border/70 bg-background/80 p-4 text-left transition-colors duration-200 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex-row sm:justify-between"
  >
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-medium text-foreground">{title}</p>
        <Badge className={badgeClassName}>{badge}</Badge>
      </div>
      <p className="text-sm leading-6 text-muted-foreground">{description}</p>
    </div>
    <span className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-primary">
      {ctaLabel}
      <ArrowRight className="h-4 w-4" />
    </span>
  </button>
);

export const HomePage = ({ onNavigate, accessibleTabs, metrics }: HomePageProps) => {
  const {
    draftReceptions,
    waitingQcReceptions,
    inQcReceptions,
    pendingReceptions,
    inProgressOrders,
    qualityLots,
    quarantinedLots,
    storedLots,
    activeAlertsCount,
    phase2Active = 0,
    phase2Waiting = 0,
    validatedPFLots = 0,
    pendingShipments = 0,
  } = metrics;

  // ── Page header ────────────────────────────────────────────────────────────
  const primaryActionTab = (accessibleTabs.includes("receptions") ? "receptions" : accessibleTabs[0] ?? "home") as AppTab;
  const PrimaryActionIcon = APP_TAB_META[primaryActionTab]?.icon;

  // ── Action queue ───────────────────────────────────────────────────────────
  const queueItems = [
    {
      title: waitingQcReceptions > 0
        ? `${waitingQcReceptions} réception${waitingQcReceptions > 1 ? "s" : ""} en attente QC`
        : "Contrôle qualité",
      description: waitingQcReceptions > 0
        ? "Des arrivages attendent le contrôle qualité entrant."
        : "Aucun contrôle qualité en attente.",
      badge: waitingQcReceptions > 0 ? "À traiter" : "OK",
      badgeClassName: waitingQcReceptions > 0 ? "bg-amber-500 text-white" : "bg-emerald-600 text-white",
      ctaLabel: "Réceptions",
      tab: "receptions",
    },
    {
      title: quarantinedLots > 0
        ? `${quarantinedLots} lot${quarantinedLots > 1 ? "s" : ""} en quarantaine`
        : "Stock sous contrôle",
      description: quarantinedLots > 0
        ? "Des lots sensibles doivent être sécurisés avant expédition ou production."
        : "Aucune quarantaine majeure en cours.",
      badge: quarantinedLots > 0 ? "Vigilance" : "RAS",
      badgeClassName: quarantinedLots > 0 ? "bg-orange-500 text-white" : "bg-slate-600 text-white",
      ctaLabel: "Stock",
      tab: "storage",
    },
    {
      title: phase2Waiting > 0
        ? `${phase2Waiting} lot${phase2Waiting > 1 ? "s" : ""} en attente Phase 2`
        : inProgressOrders > 0
          ? `${inProgressOrders} ordre${inProgressOrders > 1 ? "s" : ""} en cours`
          : "Production",
      description: phase2Waiting > 0
        ? "Des lots attendent fumigation, nettoyage, hydratation ou triage."
        : inProgressOrders > 0
          ? "Des ordres de fabrication sont en cours."
          : "Aucun ordre actif pour le moment.",
      badge: phase2Waiting > 0 ? "En attente" : inProgressOrders > 0 ? "En cours" : "Calme",
      badgeClassName: phase2Waiting > 0
        ? "bg-violet-600 text-white"
        : inProgressOrders > 0 ? "bg-sky-600 text-white" : "bg-emerald-600 text-white",
      ctaLabel: "Production",
      tab: "production",
    },
    {
      title: activeAlertsCount > 0
        ? `${activeAlertsCount} alerte${activeAlertsCount > 1 ? "s" : ""} active${activeAlertsCount > 1 ? "s" : ""}`
        : "Aucune alerte critique",
      description: activeAlertsCount > 0
        ? "Des alertes demandent une décision."
        : "Aucune urgence signalée.",
      badge: activeAlertsCount > 0 ? "Urgent" : "Calme",
      badgeClassName: activeAlertsCount > 0 ? "bg-red-600 text-white" : "bg-emerald-600 text-white",
      ctaLabel: "Alertes",
      tab: "alerts",
    },
  ].filter((item) => accessibleTabs.includes(item.tab as AppTab));

  // ── Quick access ───────────────────────────────────────────────────────────
  const quickLinks = [
    { id: "receptions", label: "Réceptions", icon: Truck,          accent: "text-amber-600",   bg: "bg-amber-50 border-amber-200",   count: pendingReceptions },
    { id: "batches",    label: "Qualité",    icon: ClipboardCheck,  accent: "text-sky-600",     bg: "bg-sky-50 border-sky-200",       count: qualityLots },
    { id: "storage",    label: "Stock",      icon: Warehouse,        accent: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200", count: storedLots },
    { id: "production", label: "Production", icon: Factory,          accent: "text-violet-600",  bg: "bg-violet-50 border-violet-200", count: inProgressOrders },
    { id: "purchasing", label: "Achats",     icon: ShoppingCart,     accent: "text-stone-600",   bg: "bg-stone-50 border-stone-200",   count: null },
    { id: "analytics",  label: "Rapports",   icon: BarChart3,        accent: "text-slate-600",   bg: "bg-slate-50 border-slate-200",   count: null },
    { id: "alerts",     label: "Alertes",    icon: AlertTriangle,    accent: activeAlertsCount > 0 ? "text-red-600" : "text-emerald-600", bg: activeAlertsCount > 0 ? "bg-red-50 border-red-200" : "bg-emerald-50 border-emerald-200", count: activeAlertsCount || null },
  ].filter((l) => accessibleTabs.includes(l.id as AppTab));

  return (
    <div className="space-y-6">

      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 pb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">Accueil</p>
          <h1 className="mt-0.5 text-2xl font-semibold text-foreground">Priorités du jour</h1>
        </div>
        {PrimaryActionIcon && (
          <Button onClick={() => onNavigate(primaryActionTab)} className="gap-2 rounded-xl">
            <PrimaryActionIcon className="h-4 w-4" />
            {APP_TAB_META[primaryActionTab]?.label}
          </Button>
        )}
      </div>

      {/* ── Flow pipeline ───────────────────────────────────────────────────── */}
      <FactoryFlowPipeline
        metrics={{
          pendingReceptions,
          waitingQcReceptions,
          inQcReceptions,
          storedLots,
          quarantinedLots,
          phase2Active,
          phase2Waiting,
          activePackagingOrders: metrics.activePackagingOrders ?? 0,
          validatedPFLots,
          pendingShipments,
        }}
        accessibleTabs={accessibleTabs}
        onNavigate={onNavigate}
      />

      {/* ── Main content grid ────────────────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">

        {/* Action queue */}
        <Card className="surface-card rounded-[28px]">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              À faire maintenant
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {queueItems.length > 0 ? (
              queueItems.map((item) => (
                <QueueItem
                  key={item.tab}
                  title={item.title}
                  description={item.description}
                  badge={item.badge}
                  badgeClassName={item.badgeClassName}
                  ctaLabel={item.ctaLabel}
                  onClick={() => onNavigate(item.tab)}
                />
              ))
            ) : (
              <div className="rounded-2xl border border-border/70 bg-background/80 p-4 text-sm text-muted-foreground">
                Aucune action urgente pour votre profil.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick access */}
        <Card className="surface-card rounded-[28px]">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Accès rapide</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2">
              {quickLinks.map((link) => (
                <button
                  key={link.id}
                  type="button"
                  onClick={() => onNavigate(link.id)}
                  className={cn(
                    "flex min-h-[76px] flex-col gap-1.5 rounded-2xl border p-3.5 text-left transition-all hover:-translate-y-0.5 hover:shadow-sm active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    link.bg,
                  )}
                >
                  <div className="flex items-center justify-between">
                    <link.icon className={cn("h-5 w-5", link.accent)} />
                    {link.count !== null && link.count > 0 && (
                      <span className="text-lg font-semibold text-foreground">{link.count}</span>
                    )}
                  </div>
                  <p className="text-sm font-medium text-foreground">{link.label}</p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
};
