import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Factory,
  PackageCheck,
  QrCode,
  Ship,
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
    quarantinedLots,
    storedLots,
    activeAlertsCount,
    phase2Active = 0,
    phase2Waiting = 0,
    validatedPFLots = 0,
    activePackagingOrders = 0,
    pendingShipments = 0,
  } = metrics;

  // ── Page header ────────────────────────────────────────────────────────────
  const primaryActionTab = (accessibleTabs.includes("receptions") ? "receptions" : accessibleTabs[0] ?? "home") as AppTab;
  const PrimaryActionIcon = APP_TAB_META[primaryActionTab]?.icon;

  // ── Action queue — uniquement ce qui demande une action maintenant ──────────
  const qcQueue = waitingQcReceptions + inQcReceptions;
  const plural = (n: number) => (n > 1 ? "s" : "");
  const queueItems = [
    {
      count: activeAlertsCount,
      title: `${activeAlertsCount} alerte${plural(activeAlertsCount)} active${plural(activeAlertsCount)}`,
      description: "Des alertes demandent une décision.",
      badge: "Urgent",
      badgeClassName: "bg-red-600 text-white",
      ctaLabel: "Alertes",
      tab: "alerts",
    },
    {
      count: qcQueue,
      title: `${qcQueue} réception${plural(qcQueue)} à contrôler`,
      description: waitingQcReceptions > 0 && inQcReceptions > 0
        ? `${waitingQcReceptions} en attente QC, ${inQcReceptions} inspection${plural(inQcReceptions)} à reprendre.`
        : inQcReceptions > 0
          ? "Des inspections QC commencées attendent d'être terminées."
          : "Des arrivages attendent le contrôle qualité entrant.",
      badge: "À traiter",
      badgeClassName: "bg-amber-500 text-white",
      ctaLabel: "Réceptions",
      tab: "receptions",
    },
    {
      count: draftReceptions,
      title: `${draftReceptions} réception${plural(draftReceptions)} en brouillon`,
      description: "Des saisies de réception n'ont pas été finalisées.",
      badge: "À finaliser",
      badgeClassName: "bg-slate-600 text-white",
      ctaLabel: "Réceptions",
      tab: "receptions",
    },
    {
      count: quarantinedLots,
      title: `${quarantinedLots} lot${plural(quarantinedLots)} en quarantaine`,
      description: "Des lots bloqués attendent une décision qualité (libérer ou rejeter).",
      badge: "Vigilance",
      badgeClassName: "bg-orange-500 text-white",
      ctaLabel: "Stock",
      tab: "storage",
    },
    {
      count: phase2Waiting,
      title: `${phase2Waiting} lot${plural(phase2Waiting)} en attente de traitement`,
      description: "Des lots libérés attendent fumigation, nettoyage, hydratation ou triage.",
      badge: "En attente",
      badgeClassName: "bg-violet-600 text-white",
      ctaLabel: "Production",
      tab: "production",
    },
    {
      count: validatedPFLots,
      title: `${validatedPFLots} lot${plural(validatedPFLots)} PF prêt${plural(validatedPFLots)} à conditionner`,
      description: "Des produits finis validés attendent un ordre de conditionnement.",
      badge: "Prêt",
      badgeClassName: "bg-sky-600 text-white",
      ctaLabel: "Conditionnement",
      tab: "packaging",
    },
    {
      count: pendingShipments,
      title: `${pendingShipments} expédition${plural(pendingShipments)} à préparer`,
      description: "Des préparations d'expédition sont planifiées.",
      badge: "Logistique",
      badgeClassName: "bg-cyan-600 text-white",
      ctaLabel: "Expédition",
      tab: "logistics",
    },
  ].filter((item) => item.count > 0 && accessibleTabs.includes(item.tab as AppTab));

  // ── Quick access — ordre du flux physique, compteurs réels ─────────────────
  const quickLinks = [
    { id: "receptions", label: "Réception & QC",  icon: Truck,          accent: "text-amber-600",   bg: "bg-amber-50 border-amber-200",     count: pendingReceptions },
    { id: "storage",    label: "Stock",            icon: Warehouse,       accent: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200", count: storedLots },
    { id: "production", label: "Production",       icon: Factory,         accent: "text-violet-600",  bg: "bg-violet-50 border-violet-200",   count: phase2Active + inProgressOrders },
    { id: "packaging",  label: "Conditionnement",  icon: PackageCheck,    accent: "text-sky-600",     bg: "bg-sky-50 border-sky-200",         count: activePackagingOrders },
    { id: "logistics",  label: "Expédition",       icon: Ship,            accent: "text-cyan-700",    bg: "bg-cyan-50 border-cyan-200",       count: pendingShipments },
    { id: "scan",       label: "Scan lot",         icon: QrCode,          accent: "text-slate-600",   bg: "bg-slate-50 border-slate-200",     count: null },
    { id: "quality",    label: "Qualité & CAPA",   icon: ClipboardCheck,  accent: "text-stone-600",   bg: "bg-stone-50 border-stone-200",     count: null },
    { id: "alerts",     label: "Alertes",          icon: AlertTriangle,   accent: activeAlertsCount > 0 ? "text-red-600" : "text-emerald-600", bg: activeAlertsCount > 0 ? "bg-red-50 border-red-200" : "bg-emerald-50 border-emerald-200", count: activeAlertsCount || null },
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
