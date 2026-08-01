import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronDown,
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
import { LotJourneyHub } from "./LotJourneyHub";
import type { AppNavigateFn } from "@/lib/appNavigate";
import type { AppTab } from "@/lib/roleAccess";

const UI_MODE_KEY = "rp-home-ui-mode";

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

  const [uiMode, setUiMode] = useState<"simple" | "full">(() => {
    try {
      return localStorage.getItem(UI_MODE_KEY) === "full" ? "full" : "simple";
    } catch {
      return "simple";
    }
  });
  const [toolsOpen, setToolsOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(UI_MODE_KEY, uiMode);
    } catch {
      /* ignore */
    }
  }, [uiMode]);

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

  const topUrgent = queueItems[0];

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

  const showFull = uiMode === "full";

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Que faire maintenant ?
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Un lot, une prochaine action, les documents utiles. Le reste est optionnel.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl border bg-muted/40 p-1">
            <button
              type="button"
              onClick={() => setUiMode("simple")}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                uiMode === "simple" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground",
              )}
            >
              Simple
            </button>
            <button
              type="button"
              onClick={() => setUiMode("full")}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                uiMode === "full" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground",
              )}
            >
              Complet
            </button>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => onNavigate("home", { view: "fiches" })}
          >
            <BookOpen className="h-3.5 w-3.5" />
            Fiches A→Z
          </Button>
        </div>
      </div>

      {/* One urgent strip — not a wall of queues */}
      {topUrgent && (
        <button
          type="button"
          onClick={() => onNavigate(topUrgent.tab)}
          className="flex w-full items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-left transition-colors hover:bg-amber-100"
        >
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={topUrgent.badgeClassName}>{topUrgent.badge}</Badge>
              <p className="truncate text-sm font-semibold">{topUrgent.title}</p>
            </div>
            {!showFull && (
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{topUrgent.description}</p>
            )}
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-amber-900">
            {topUrgent.ctaLabel}
            <ArrowRight className="h-4 w-4" />
          </span>
        </button>
      )}

      {!topUrgent && (
        <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          Rien d&apos;urgent pour votre profil — suivez un lot ci-dessous.
        </div>
      )}

      <LotJourneyHub onNavigate={onNavigate} accessibleTabs={accessibleTabs} compact={!showFull} />

      {/* Secondary — collapsed in Simple mode */}
      {showFull ? (
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">
              Modules métier
            </p>
            <FactoryFlowPipeline
              metrics={{
                pendingReceptions,
                waitingQcReceptions,
                inQcReceptions,
                storedLots,
                quarantinedLots,
                phase2Active,
                phase2Waiting,
                activePackagingOrders,
                validatedPFLots,
                pendingShipments,
              }}
              accessibleTabs={accessibleTabs}
              onNavigate={onNavigate}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <Card className="surface-card rounded-[28px]">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  File d&apos;attente complète
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5">
                {queueItems.length > 0 ? (
                  queueItems.map((item) => (
                    <QueueItem
                      key={`${item.tab}-${item.title}`}
                      title={item.title}
                      description={item.description}
                      badge={item.badge}
                      badgeClassName={item.badgeClassName}
                      ctaLabel={item.ctaLabel}
                      onClick={() => onNavigate(item.tab)}
                    />
                  ))
                ) : (
                  <div className="flex items-center gap-2.5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    Tout est à jour.
                  </div>
                )}
              </CardContent>
            </Card>

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
      ) : (
        <div className="rounded-2xl border border-dashed border-border/80">
          <button
            type="button"
            onClick={() => setToolsOpen((o) => !o)}
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
          >
            <div>
              <p className="text-sm font-semibold">Modules & outils</p>
              <p className="text-xs text-muted-foreground">
                Pipeline, file d&apos;attente, accès rapide — seulement si besoin
              </p>
            </div>
            <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", toolsOpen && "rotate-180")} />
          </button>
          {toolsOpen && (
            <div className="space-y-4 border-t px-4 py-4">
              <FactoryFlowPipeline
                metrics={{
                  pendingReceptions,
                  waitingQcReceptions,
                  inQcReceptions,
                  storedLots,
                  quarantinedLots,
                  phase2Active,
                  phase2Waiting,
                  activePackagingOrders,
                  validatedPFLots,
                  pendingShipments,
                }}
                accessibleTabs={accessibleTabs}
                onNavigate={onNavigate}
              />
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {quickLinks.slice(0, 8).map((link) => (
                  <button
                    key={link.id}
                    type="button"
                    onClick={() => onNavigate(link.id)}
                    className={cn(
                      "flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm font-medium",
                      link.bg,
                    )}
                  >
                    <link.icon className={cn("h-4 w-4 shrink-0", link.accent)} />
                    <span className="truncate">{link.label}</span>
                  </button>
                ))}
              </div>
              {queueItems.length > 1 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Autres actions en attente</p>
                  {queueItems.slice(1, 4).map((item) => (
                    <QueueItem
                      key={`${item.tab}-${item.title}`}
                      title={item.title}
                      description={item.description}
                      badge={item.badge}
                      badgeClassName={item.badgeClassName}
                      ctaLabel={item.ctaLabel}
                      onClick={() => onNavigate(item.tab)}
                    />
                  ))}
                </div>
              )}
              <Button type="button" variant="outline" size="sm" onClick={() => setUiMode("full")}>
                Passer en vue complète
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
