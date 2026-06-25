import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { ModuleHero } from "@/components/layout/ModuleHero";
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

interface WorkflowCardProps {
  title: string;
  description: string;
  metric: string;
  helper: string;
  icon: React.ElementType;
  accent: string;
  ctaLabel: string;
  onClick: () => void;
}

interface QueueItemProps {
  title: string;
  description: string;
  badge: string;
  badgeClassName: string;
  ctaLabel: string;
  onClick: () => void;
}

interface OverviewTileProps {
  title: string;
  value: number;
  helper: string;
  icon: React.ElementType;
  tone: string;
  onClick: () => void;
}

const WorkflowCard = ({
  title,
  description,
  metric,
  helper,
  icon: Icon,
  accent,
  ctaLabel,
  onClick,
}: WorkflowCardProps) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex h-full min-h-[132px] w-full flex-col justify-between rounded-2xl border border-border/75 bg-white/92 p-4 text-left shadow-sm",
        "transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-card-hover active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border shadow-sm",
                accent,
              )}
            >
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-base font-semibold text-foreground">{title}</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">{helper}</p>
            </div>
          </div>
          <Badge variant="secondary" className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold">
            {metric}
          </Badge>
        </div>

        <p className="line-clamp-2 text-sm leading-6 text-muted-foreground">{description}</p>
      </div>

      <div className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary">
        {ctaLabel}
        <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
      </div>
    </button>
  );
};

const QueueItem = ({
  title,
  description,
  badge,
  badgeClassName,
  ctaLabel,
  onClick,
}: QueueItemProps) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full flex-col items-start gap-3 rounded-2xl border border-border/70 bg-background/80 p-4 text-left transition-colors duration-200 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex-row sm:justify-between"
    >
      <div className="space-y-2">
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
};

const OverviewTile = ({
  title,
  value,
  helper,
  icon: Icon,
  tone,
  onClick,
}: OverviewTileProps) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-2xl border p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        tone,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <Icon className="h-4 w-4 text-foreground/80" />
        <span className="text-2xl font-semibold text-foreground">{value}</span>
      </div>
      <p className="mt-3 text-sm font-medium text-foreground">{title}</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{helper}</p>
    </button>
  );
};

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

  const workflowCards = [
    {
      title: "Réception",
      description: "Lancer un arrivage, reprendre un brouillon ou traiter la file d'entrée.",
      metric: `${pendingReceptions}`,
      helper: `${draftReceptions} brouillons • ${waitingQcReceptions} en attente QC`,
      icon: Truck,
      accent: "border-amber-200 bg-amber-50 text-amber-700",
      ctaLabel: "Ouvrir",
      tab: "receptions",
    },
    {
      title: "Qualité",
      description: "Accéder aux lots et réceptions qui attendent une décision qualité.",
      metric: `${qualityLots}`,
      helper: `${inQcReceptions} déjà en contrôle`,
      icon: ClipboardCheck,
      accent: "border-sky-200 bg-sky-50 text-sky-700",
      ctaLabel: "Voir la file",
      tab: "batches",
    },
    {
      title: "Stock",
      description: "Vérifier les lots stockés et les zones sensibles avant blocage.",
      metric: `${storedLots}`,
      helper: `${quarantinedLots} quarantaines`,
      icon: Warehouse,
      accent: "border-emerald-200 bg-emerald-50 text-emerald-700",
      ctaLabel: "Ouvrir",
      tab: "storage",
    },
    {
      title: "Production",
      description: "Suivre les ordres en cours et les étapes qui demandent une action.",
      metric: `${inProgressOrders}`,
      helper: `${phase2Active + phase2Waiting} lots en Phase 2`,
      icon: Factory,
      accent: "border-violet-200 bg-violet-50 text-violet-700",
      ctaLabel: "Suivre",
      tab: "production",
    },
    {
      title: "Achats",
      description: "Retrouver les DA, BC et fournisseurs sans changer d'espace.",
      metric: "Direct",
      helper: "Commandes et approvisionnements",
      icon: ShoppingCart,
      accent: "border-stone-200 bg-stone-50 text-stone-700",
      ctaLabel: "Ouvrir",
      tab: "purchasing",
    },
    {
      title: "Rapports",
      description: "Consulter une vue synthétique quand vous avez besoin de recul.",
      metric: "Vue",
      helper: "Indicateurs et synthèse",
      icon: BarChart3,
      accent: "border-slate-200 bg-slate-50 text-slate-700",
      ctaLabel: "Consulter",
      tab: "analytics",
    },
    {
      title: "Alertes",
      description: "Voir rapidement ce qui bloque réellement l'activité aujourd'hui.",
      metric: `${activeAlertsCount}`,
      helper: activeAlertsCount > 0 ? "Urgences actives" : "Aucune critique",
      icon: AlertTriangle,
      accent: activeAlertsCount > 0
        ? "border-red-200 bg-red-50 text-red-700"
        : "border-emerald-200 bg-emerald-50 text-emerald-700",
      ctaLabel: "Traiter",
      tab: "alerts",
    },
  ];

  const queueItems = [
    {
      title: waitingQcReceptions > 0 ? `${waitingQcReceptions} réceptions attendent le contrôle qualité` : "Contrôle qualité du jour",
      description: waitingQcReceptions > 0
        ? "Ouvrir la réception pour traiter les arrivages qui attendent une décision."
        : "Aucune rétention critique en attente. Vous pouvez reprendre les contrôles terminés si besoin.",
      badge: waitingQcReceptions > 0 ? "À traiter" : "Stable",
      badgeClassName: waitingQcReceptions > 0 ? "bg-amber-500 text-white hover:bg-amber-500" : "bg-emerald-600 text-white hover:bg-emerald-600",
      ctaLabel: "Réception",
      tab: "receptions",
    },
    {
      title: quarantinedLots > 0 ? `${quarantinedLots} lots sont en quarantaine` : "Stock sous contrôle",
      description: quarantinedLots > 0
        ? "Accéder au stock pour sécuriser les lots sensibles avant qu'ils ne bloquent l'expédition ou la production."
        : "Le stock ne présente pas de quarantaine majeure pour le moment.",
      badge: quarantinedLots > 0 ? "Vigilance" : "RAS",
      badgeClassName: quarantinedLots > 0 ? "bg-orange-500 text-white hover:bg-orange-500" : "bg-slate-700 text-white hover:bg-slate-700",
      ctaLabel: "Stock",
      tab: "storage",
    },
    {
      title: phase2Waiting > 0
        ? `${phase2Waiting} lot(s) attendent la Phase 2`
        : inProgressOrders > 0
          ? `${inProgressOrders} ordre(s) de fabrication en cours`
          : "Production calme pour le moment",
      description: phase2Waiting > 0
        ? "Des lots validés attendent fumigation, nettoyage, hydratation ou triage."
        : inProgressOrders > 0
          ? "Ouvrir la production pour suivre l'avancement et les priorités de ligne."
          : "Aucun ordre en cours. Vous pouvez ouvrir la production pour planifier la suite.",
      badge: phase2Waiting > 0 ? "En attente" : inProgressOrders > 0 ? "En cours" : "Stable",
      badgeClassName: phase2Waiting > 0
        ? "bg-violet-600 text-white hover:bg-violet-600"
        : inProgressOrders > 0
          ? "bg-sky-600 text-white hover:bg-sky-600"
          : "bg-emerald-600 text-white hover:bg-emerald-600",
      ctaLabel: "Production",
      tab: "production",
    },
    {
      title: activeAlertsCount > 0 ? `${activeAlertsCount} alertes demandent une décision` : "Aucune alerte critique",
      description: activeAlertsCount > 0
        ? "Ouvrir le centre d'alertes pour confirmer les urgences et répartir les actions."
        : "Le système ne signale pas d'urgence immédiate.",
      badge: activeAlertsCount > 0 ? "Urgent" : "Calme",
      badgeClassName: activeAlertsCount > 0 ? "bg-red-600 text-white hover:bg-red-600" : "bg-emerald-600 text-white hover:bg-emerald-600",
      ctaLabel: "Alertes",
      tab: "alerts",
    },
  ];

  const visibleWorkflowCards = workflowCards.filter((card) => accessibleTabs.includes(card.tab as AppTab));
  const primaryWorkflowCards = visibleWorkflowCards.slice(0, 3);
  const visibleQueueItems = queueItems.filter((item) => accessibleTabs.includes(item.tab as AppTab)).slice(0, 3);
  const remainingWorkflowTabs = visibleWorkflowCards
    .slice(3)
    .map((card) => card.tab as AppTab);
  const visibleComplementaryTabs = accessibleTabs.filter(
    (tab) => tab !== "home" && !primaryWorkflowCards.some((card) => card.tab === tab) && !remainingWorkflowTabs.includes(tab),
  );
  const supportTabs = [...remainingWorkflowTabs, ...visibleComplementaryTabs];

  const overviewTiles = [
    {
      title: "QC à traiter",
      value: waitingQcReceptions + inQcReceptions,
      helper: "Réceptions à contrôler ou déjà en cours de contrôle.",
      icon: ClipboardCheck,
      tone: "border-sky-200 bg-sky-50/80",
      tab: "receptions",
    },
    {
      title: "Lots en quarantaine",
      value: quarantinedLots,
      helper: "Lots sensibles à sécuriser dans le stock.",
      icon: Warehouse,
      tone: "border-orange-200 bg-orange-50/80",
      tab: "storage",
    },
    {
      title: "Phase 2 active",
      value: phase2Active + phase2Waiting,
      helper: "Lots en attente ou en traitement de Phase 2.",
      icon: Factory,
      tone: "border-violet-200 bg-violet-50/80",
      tab: "production",
    },
    {
      title: "Expéditions",
      value: pendingShipments || validatedPFLots,
      helper: pendingShipments > 0
        ? "Expéditions à préparer ou finaliser."
        : "Palettes validées disponibles pour la suite logistique.",
      icon: CheckCircle2,
      tone: "border-emerald-200 bg-emerald-50/80",
      tab: pendingShipments > 0 ? "logistics" : "stock-lots",
    },
  ].filter((tile) => accessibleTabs.includes(tile.tab as AppTab));

  const primaryActionTab = (accessibleTabs.includes("receptions")
    ? "receptions"
    : primaryWorkflowCards[0]?.tab ?? "home") as AppTab;
  const secondaryActionTab = (accessibleTabs.includes("alerts")
    ? "alerts"
    : supportTabs[0] ?? "home") as AppTab;
  const PrimaryActionIcon = APP_TAB_META[primaryActionTab].icon;
  const SecondaryActionIcon = APP_TAB_META[secondaryActionTab].icon;

  return (
    <div className="space-y-6">
      <ModuleHero
        kicker="Accueil • Priorités du jour"
        title="Le flux de travail revient au centre"
        description="Retrouvez la lecture visuelle du parcours usine, avec un accueil plus propre: le flux d'abord, les actions utiles ensuite, et moins de bruit autour."
        primaryAction={{
          label: APP_TAB_META[primaryActionTab].label,
          onClick: () => onNavigate(primaryActionTab),
          icon: <PrimaryActionIcon className="h-4 w-4" />,
        }}
        secondaryAction={{
          label: APP_TAB_META[secondaryActionTab].label,
          onClick: () => onNavigate(secondaryActionTab),
          icon: <SecondaryActionIcon className="h-4 w-4" />,
          variant: "secondary",
        }}
        stats={[
          { label: "Réceptions", value: pendingReceptions },
          { label: "Phase 2", value: phase2Active + phase2Waiting },
          { label: "Qualité", value: qualityLots },
          { label: "Alertes", value: activeAlertsCount },
        ]}
      />

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

      <section className="space-y-3">
        <div className="flex flex-col gap-1">
          <p className="section-kicker">Raccourcis</p>
          <h2 className="text-2xl text-foreground">Les entrées les plus utiles autour du flux</h2>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            Trois raccourcis seulement pour garder l'écran respirable, pendant que le flux visuel reste votre repère principal.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {primaryWorkflowCards.map((card) => (
            <WorkflowCard
              key={card.title}
              title={card.title}
              description={card.description}
              metric={card.metric}
              helper={card.helper}
              icon={card.icon}
              accent={card.accent}
              ctaLabel={card.ctaLabel}
              onClick={() => onNavigate(card.tab)}
            />
          ))}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <Card className="surface-card rounded-[28px]">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-xl">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              À faire maintenant
            </CardTitle>
            <CardDescription>
              Des prochaines actions courtes et concrètes, alignées avec le flux affiché au-dessus.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {visibleQueueItems.length > 0 ? (
              visibleQueueItems.map((item) => (
                <QueueItem
                  key={item.title}
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
                Aucun point urgent à afficher pour votre profil actuellement.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="surface-card rounded-[28px]">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-xl">
              <ClipboardCheck className="h-5 w-5 text-primary" />
              Vue rapide
            </CardTitle>
            <CardDescription>
              Les chiffres utiles restent compacts, et les espaces secondaires sont rangés ici.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {overviewTiles.map((tile) => (
                <OverviewTile
                  key={tile.title}
                  title={tile.title}
                  value={tile.value}
                  helper={tile.helper}
                  icon={tile.icon}
                  tone={tile.tone}
                  onClick={() => onNavigate(tile.tab)}
                />
              ))}
            </div>

            {supportTabs.length > 0 && (
              <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
                <p className="text-sm font-medium text-foreground">Autres espaces</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Les vues secondaires restent disponibles ici, sans encombrer l'accueil.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {supportTabs.map((tab) => (
                    <Button
                      key={tab}
                      type="button"
                      variant="outline"
                      className="rounded-2xl"
                      onClick={() => onNavigate(tab)}
                    >
                      {APP_TAB_META[tab].label}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
