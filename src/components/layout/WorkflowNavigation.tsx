import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  BarChart3,
  Boxes,
  Building2,
  ClipboardCheck,
  Factory,
  Grid2x2,
  Home,
  Package,
  ShieldCheck,
  ShoppingCart,
  Truck,
  Warehouse,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { ADMIN_ROLES, MANAGER_ROLES, ROLE_CONFIG, type ActorRole } from "@/types/roles";
import type { AppTab } from "@/lib/roleAccess";
import { APP_TAB_META } from "@/lib/appTabs";

interface WorkflowNavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  roles: ActorRole[];
  profileName?: string | null;
  workspaceLabel: string;
  interfaceLabel: string;
  primaryTabs: AppTab[];
  quickTabs: AppTab[];
  metrics: {
    activeAlertsCount: number;
    pendingReceptions: number;
    qualityQueueCount: number;
    inProgressOrders: number;
    storedLots: number;
  };
}

interface WorkflowCardConfig {
  id: AppTab;
  title: string;
  description: string;
  helper: string;
  metric: string;
  icon: typeof Truck;
  accent: string;
}

const unique = <T,>(items: T[]) => Array.from(new Set(items));

const getUserMode = (roles: ActorRole[]) => {
  if (roles.some((role) => ADMIN_ROLES.includes(role) || MANAGER_ROLES.includes(role))) {
    return "employeur";
  }

  return "assistant";
};

const getPrimaryRole = (roles: ActorRole[]) => roles[0];

const getWorkflowCards = (roles: ActorRole[], metrics: WorkflowNavigationProps["metrics"]) => {
  const primaryRole = getPrimaryRole(roles);
  const department = primaryRole ? ROLE_CONFIG[primaryRole]?.department : "";

  const byDepartment: Record<string, WorkflowCardConfig[]> = {
    "Réception": [
      {
        id: "receptions",
        title: "Lots Réception",
        description: "Saisir un arrivage, peser et créer les lots d'entrée sans passer par plusieurs écrans.",
        helper: "Lots d'entrée dock",
        metric: `${metrics.pendingReceptions} à traiter`,
        icon: Truck,
        accent: "border-amber-200 bg-amber-50 text-amber-700",
      },
      {
        id: "batches",
        title: "Lots Qualité",
        description: "Retrouver rapidement les lots post-réception en attente d'inspection ou de décision.",
        helper: "File qualité terrain",
        metric: `${metrics.qualityQueueCount} à vérifier`,
        icon: ClipboardCheck,
        accent: "border-sky-200 bg-sky-50 text-sky-700",
      },
      {
        id: "storage",
        title: "Stock",
        description: "Contrôler les zones, suivre les lots sensibles et éviter les blocages après réception.",
        helper: "Vue entrepôt simple",
        metric: `${metrics.storedLots} lots suivis`,
        icon: Warehouse,
        accent: "border-emerald-200 bg-emerald-50 text-emerald-700",
      },
      {
        id: "alerts",
        title: "Alertes",
        description: "Voir immédiatement ce qui demande une action ou une validation.",
        helper: "Surveiller les urgences",
        metric: metrics.activeAlertsCount > 0 ? `${metrics.activeAlertsCount} actives` : "Aucune critique",
        icon: AlertTriangle,
        accent: metrics.activeAlertsCount > 0
          ? "border-red-200 bg-red-50 text-red-700"
          : "border-emerald-200 bg-emerald-50 text-emerald-700",
      },
    ],
    "Qualité": [
      {
        id: "batches",
        title: "Lots Qualité",
        description: "Ouvrir la file des lots post-réception en inspection, en attente de grade ou bloqués.",
        helper: "Grades et décisions QC",
        metric: `${metrics.qualityQueueCount} à vérifier`,
        icon: ClipboardCheck,
        accent: "border-sky-200 bg-sky-50 text-sky-700",
      },
      {
        id: "receptions",
        title: "Lots Réception",
        description: "Revenir aux lots d'entrée qui attendent une validation qualité ou une reprise de contrôle.",
        helper: "Lots dock en attente QC",
        metric: `${metrics.pendingReceptions} en cours`,
        icon: Truck,
        accent: "border-amber-200 bg-amber-50 text-amber-700",
      },
      {
        id: "alerts",
        title: "Alertes",
        description: "Traiter les non-conformités et les points critiques au bon moment.",
        helper: "Risques et blocages",
        metric: metrics.activeAlertsCount > 0 ? `${metrics.activeAlertsCount} actives` : "Suivi stable",
        icon: AlertTriangle,
        accent: "border-red-200 bg-red-50 text-red-700",
      },
      {
        id: "storage",
        title: "Stock",
        description: "Suivre les quarantaines et les zones qui impactent les décisions qualité.",
        helper: "Quarantaines visibles",
        metric: `${metrics.storedLots} lots suivis`,
        icon: Warehouse,
        accent: "border-emerald-200 bg-emerald-50 text-emerald-700",
      },
    ],
    "Production": [
      {
        id: "production",
        title: "Production",
        description: "Accéder aux ordres du jour et aux étapes de fabrication sans détour.",
        helper: "Exécution atelier",
        metric: `${metrics.inProgressOrders} ordres en cours`,
        icon: Factory,
        accent: "border-violet-200 bg-violet-50 text-violet-700",
      },
      {
        id: "storage",
        title: "Stock",
        description: "Vérifier rapidement la disponibilité des lots et les zones de stockage liées à la production.",
        helper: "Matière disponible",
        metric: `${metrics.storedLots} lots suivis`,
        icon: Warehouse,
        accent: "border-emerald-200 bg-emerald-50 text-emerald-700",
      },
      {
        id: "alerts",
        title: "Alertes",
        description: "Voir les points qui ralentissent la ligne avant qu'ils ne deviennent critiques.",
        helper: "Blocages du jour",
        metric: metrics.activeAlertsCount > 0 ? `${metrics.activeAlertsCount} actives` : "Aucune critique",
        icon: AlertTriangle,
        accent: "border-red-200 bg-red-50 text-red-700",
      },
      {
        id: "batches",
        title: "Lots Qualité",
        description: "Retrouver les lots qualité sensibles à suivre pendant la transformation et le contrôle terrain.",
        helper: "Lots QC en cours",
        metric: `${metrics.qualityQueueCount} lots sensibles`,
        icon: Boxes,
        accent: "border-slate-200 bg-slate-50 text-slate-700",
      },
    ],
    "Magasin": [
      {
        id: "storage",
        title: "Stock",
        description: "Ouvrir directement la vue des zones et de la charge sans manipulations inutiles.",
        helper: "Occupation et zones",
        metric: `${metrics.storedLots} lots suivis`,
        icon: Warehouse,
        accent: "border-emerald-200 bg-emerald-50 text-emerald-700",
      },
      {
        id: "stock-lots",
        title: "Lots Entrepôt",
        description: "Retrouver les lots libérés et stockés, en transit ou à isoler depuis une vue simple.",
        helper: "Lots entrepôt validés",
        metric: `${metrics.storedLots} stockés`,
        icon: Boxes,
        accent: "border-slate-200 bg-slate-50 text-slate-700",
      },
      {
        id: "stock-products",
        title: "Produits",
        description: "Consulter les produits associés au stock sans passer par un menu technique.",
        helper: "Référentiel accessible",
        metric: "Catalogue",
        icon: Package,
        accent: "border-stone-200 bg-stone-50 text-stone-700",
      },
      {
        id: "alerts",
        title: "Alertes",
        description: "Voir les écarts et les points urgents qui impactent le magasin.",
        helper: "Vigilance quotidienne",
        metric: metrics.activeAlertsCount > 0 ? `${metrics.activeAlertsCount} actives` : "Suivi stable",
        icon: AlertTriangle,
        accent: "border-red-200 bg-red-50 text-red-700",
      },
    ],
    "Logistique": [
      {
        id: "logistics",
        title: "Expédition",
        description: "Préparer les sorties et la coordination logistique depuis un seul point d'entrée.",
        helper: "Documents et flux",
        metric: `${metrics.storedLots} lots disponibles`,
        icon: Package,
        accent: "border-orange-200 bg-orange-50 text-orange-700",
      },
      {
        id: "storage",
        title: "Stock",
        description: "Vérifier rapidement les stocks et les zones avant expédition.",
        helper: "Disponibilité immédiate",
        metric: `${metrics.storedLots} suivis`,
        icon: Warehouse,
        accent: "border-emerald-200 bg-emerald-50 text-emerald-700",
      },
      {
        id: "alerts",
        title: "Alertes",
        description: "Voir les retards et urgences qui menacent les départs.",
        helper: "Priorités de sortie",
        metric: metrics.activeAlertsCount > 0 ? `${metrics.activeAlertsCount} actives` : "Suivi stable",
        icon: AlertTriangle,
        accent: "border-red-200 bg-red-50 text-red-700",
      },
      {
        id: "analytics",
        title: "Rapports",
        description: "Consulter les indicateurs logistiques quand vous avez besoin d'une vue d'ensemble.",
        helper: "Lecture manageriale",
        metric: "Synthèse",
        icon: BarChart3,
        accent: "border-slate-200 bg-slate-50 text-slate-700",
      },
    ],
    "Achats": [
      {
        id: "purchasing",
        title: "Achats",
        description: "Retrouver les demandes et commandes sans traverser plusieurs rubriques.",
        helper: "Commandes et suivis",
        metric: "Accès direct",
        icon: ShoppingCart,
        accent: "border-stone-200 bg-stone-50 text-stone-700",
      },
      {
        id: "suppliers",
        title: "Fournisseurs",
        description: "Accéder aux partenaires, contrats et historique de relation.",
        helper: "Référentiel fournisseur",
        metric: "Portefeuille",
        icon: Truck,
        accent: "border-amber-200 bg-amber-50 text-amber-700",
      },
      {
        id: "materials",
        title: "Matières",
        description: "Consulter les matières et paramètres utiles aux approvisionnements.",
        helper: "Référentiel matière",
        metric: "Catalogue",
        icon: Package,
        accent: "border-emerald-200 bg-emerald-50 text-emerald-700",
      },
      {
        id: "alerts",
        title: "Alertes",
        description: "Voir les risques qui demandent une décision achat ou fournisseur.",
        helper: "Suivi des urgences",
        metric: metrics.activeAlertsCount > 0 ? `${metrics.activeAlertsCount} actives` : "Suivi stable",
        icon: AlertTriangle,
        accent: "border-red-200 bg-red-50 text-red-700",
      },
    ],
  };

  if (department && byDepartment[department]) {
    return byDepartment[department];
  }

  return [
    {
      id: "home",
      title: "Accueil",
      description: "Revenir aux priorités du jour et aux actions à démarrer maintenant.",
      helper: "Point de départ",
      metric: "Vue d'ensemble",
      icon: Home,
      accent: "border-slate-200 bg-white text-slate-700",
    },
    {
      id: "receptions",
      title: "Réception",
      description: "Entrées matière, pesée et contrôle entrant accessibles en un clic.",
      helper: "Réceptions du jour",
      metric: `${metrics.pendingReceptions} à traiter`,
      icon: Truck,
      accent: "border-amber-200 bg-amber-50 text-amber-700",
    },
    {
      id: "production",
      title: "Production",
      description: "Ordres en cours et supervision atelier pour les profils encadrants.",
      helper: "Pilotage atelier",
      metric: `${metrics.inProgressOrders} actifs`,
      icon: Factory,
      accent: "border-violet-200 bg-violet-50 text-violet-700",
    },
    {
      id: "analytics",
      title: "Rapports",
      description: "Synthèse de pilotage pour suivre l'activité sans charger l'expérience terrain.",
      helper: "Lecture manageriale",
      metric: metrics.activeAlertsCount > 0 ? `${metrics.activeAlertsCount} alertes` : "Suivi stable",
      icon: BarChart3,
      accent: "border-slate-200 bg-slate-50 text-slate-700",
    },
  ];
};

const getMetricForTab = (tab: AppTab, metrics: WorkflowNavigationProps["metrics"]) => {
  switch (tab) {
    case "alerts":
      return metrics.activeAlertsCount > 0 ? `${metrics.activeAlertsCount} alertes` : "Stable";
    case "receptions":
      return `${metrics.pendingReceptions} à traiter`;
    case "batches":
      return `${metrics.qualityQueueCount} à vérifier`;
    case "production":
      return `${metrics.inProgressOrders} en cours`;
    case "storage":
    case "stock-dashboard":
    case "stock-lots":
      return `${metrics.storedLots} lots`;
    default:
      return "Accès direct";
  }
};

export function WorkflowNavigation({
  activeTab,
  onTabChange,
  roles,
  profileName,
  workspaceLabel,
  interfaceLabel,
  primaryTabs,
  quickTabs,
  metrics,
}: WorkflowNavigationProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const userMode = getUserMode(roles);
  const primaryRole = getPrimaryRole(roles);
  const roleLabel = primaryRole ? ROLE_CONFIG[primaryRole]?.label : "Utilisateur";
  const roleDepartment = primaryRole ? ROLE_CONFIG[primaryRole]?.department : "Opérations";
  const userInitials = profileName
    ? profileName.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("")
    : (roleLabel?.[0]?.toUpperCase() ?? "RP");
  const workflowCards = getWorkflowCards(roles, metrics).filter((card) => primaryTabs.includes(card.id));
  const allTabs = unique<AppTab>([...primaryTabs, ...quickTabs, "home"]);
  const activeAppTab = activeTab as AppTab;
  const mobileTabs = unique<AppTab>([
    ...primaryTabs.slice(0, 3),
    ...(quickTabs.length > 0 ? quickTabs : ["home" as AppTab]),
  ]).slice(0, 4);
  const isOverflowActive = !mobileTabs.includes(activeAppTab);

  const handleTabChange = (tab: AppTab) => {
    onTabChange(tab);
    setMobileMenuOpen(false);
  };

  // ── Tablet carousel state ────────────────────────────────────────
  const [touchStartX, setTouchStartX] = useState(0);
  const [touchStartY, setTouchStartY] = useState(0);
  const [tabletCardIndex, setTabletCardIndex] = useState(0);
  const tabletCarouselRef = useRef<HTMLDivElement>(null);

  // Sync carousel scroll when active tab changes (e.g. from sidebar or bottom nav)
  useEffect(() => {
    const idx = workflowCards.findIndex((c) => c.id === activeTab);
    if (idx >= 0) {
      setTabletCardIndex(idx);
      const child = tabletCarouselRef.current?.children[idx] as HTMLElement | undefined;
      child?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const handleTabletTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.touches[0].clientX);
    setTouchStartY(e.touches[0].clientY);
  };

  const handleTabletTouchEnd = (e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    const dy = Math.abs(e.changedTouches[0].clientY - touchStartY);
    // Ignore vertical scrolling or tiny horizontal nudges
    if (Math.abs(dx) < 42 || dy > Math.abs(dx)) return;
    const nextIdx = dx < 0
      ? Math.min(tabletCardIndex + 1, workflowCards.length - 1)
      : Math.max(tabletCardIndex - 1, 0);
    if (nextIdx !== tabletCardIndex) {
      setTabletCardIndex(nextIdx);
      handleTabChange(workflowCards[nextIdx].id);
    }
  };

  return (
    <>
      <section className="relative overflow-hidden border-b border-border/50 bg-background">
        {/* Subtle brand radial glow — top-right corner */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_100%_at_100%_0%,hsl(var(--primary)/0.055),transparent)]" />

        <div className="relative flex w-full flex-col px-4 sm:px-5 lg:px-6">

          {/* ── Identity + live-status bar ─────────────────────────── */}
          <div className="flex flex-wrap items-center justify-between gap-3 py-3 sm:flex-nowrap">

            {/* Left: avatar initials + name + role */}
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-[12px] font-bold text-primary ring-1 ring-primary/12 select-none">
                {userInitials}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate text-[13px] font-semibold leading-tight text-foreground">
                    {profileName?.split(" ")[0] ?? workspaceLabel}
                  </p>
                  <span className="hidden shrink-0 items-center gap-1 rounded-full border border-primary/20 bg-primary/7 px-2 py-0.5 text-[10px] font-semibold text-primary sm:inline-flex">
                    <ShieldCheck className="h-2.5 w-2.5" />
                    {userMode === "employeur" ? "Employeur" : "Assistant"}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-[11px] leading-tight text-muted-foreground/65">
                  {roleLabel}
                  {roleDepartment ? <span className="text-border/80"> · </span> : null}
                  {roleDepartment ? <span className="hidden sm:inline">{roleDepartment}</span> : null}
                </p>
              </div>
            </div>

            {/* Right: live metric pills */}
            <div className="flex w-full items-center gap-1.5 sm:w-auto sm:justify-end">
              {/* Alerts */}
              {metrics.activeAlertsCount > 0 && (
                <div className="flex items-center gap-1.5 rounded-full border border-red-200/80 bg-red-50 px-2.5 py-1.5">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
                  <span className="text-[11px] font-bold tabular-nums text-red-600">
                    {metrics.activeAlertsCount}
                  </span>
                  <AlertTriangle className="h-3 w-3 text-red-500" />
                </div>
              )}

              {/* Pending receptions */}
              {metrics.pendingReceptions > 0 && (
                <div className="hidden items-center gap-1.5 rounded-full border border-amber-200/80 bg-amber-50 px-2.5 py-1.5 sm:flex">
                  <span className="text-[11px] font-semibold tabular-nums text-amber-700">
                    {metrics.pendingReceptions}
                  </span>
                  <Truck className="h-3 w-3 text-amber-600" />
                </div>
              )}

              {/* In-progress orders */}
              {metrics.inProgressOrders > 0 && (
                <div className="hidden items-center gap-1.5 rounded-full border border-violet-200/80 bg-violet-50 px-2.5 py-1.5 md:flex">
                  <span className="text-[11px] font-semibold tabular-nums text-violet-700">
                    {metrics.inProgressOrders}
                  </span>
                  <Factory className="h-3 w-3 text-violet-600" />
                </div>
              )}
            </div>
          </div>

          {/* ── TABLET: swipeable gesture card carousel (md → lg) ──── */}
          <div className="hidden border-t border-border/30 py-3 md:block lg:hidden">
            {/* Row: section label + dot indicator */}
            <div className="mb-3 flex items-center justify-between gap-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                  Flux de travail
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground/55">
                  Glissez · Touchez pour naviguer
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                {workflowCards.map((card, i) => (
                  <button
                    key={card.id}
                    type="button"
                    onClick={() => {
                      setTabletCardIndex(i);
                      handleTabChange(card.id);
                    }}
                    aria-label={`Aller à ${card.title}`}
                    className={cn(
                      "rounded-full transition-all duration-300",
                      i === tabletCardIndex
                        ? "h-2 w-5 bg-primary"
                        : "h-2 w-2 bg-border/70 hover:bg-muted-foreground/40",
                    )}
                  />
                ))}
              </div>
            </div>

            {/* Card track */}
            <div
              ref={tabletCarouselRef}
              className="flex gap-3 overflow-x-auto scroll-smooth pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              onTouchStart={handleTabletTouchStart}
              onTouchEnd={handleTabletTouchEnd}
            >
              {workflowCards.map((card, i) => {
                const isActive = activeTab === card.id;
                return (
                  <button
                    key={card.id}
                    type="button"
                    onClick={() => {
                      setTabletCardIndex(i);
                      handleTabChange(card.id);
                    }}
                    className={cn(
                      "animate-fade-in w-[calc(50vw-20px)] min-w-[200px] max-w-[260px] shrink-0 rounded-2xl border p-4 text-left",
                      "transition-all duration-300 active:scale-[0.97]",
                      isActive
                        ? "border-primary/30 bg-gradient-to-br from-primary/6 to-transparent shadow-[0_12px_32px_-8px_hsl(var(--primary)/0.18)]"
                        : "border-border/60 bg-white/85 hover:border-primary/20 hover:bg-white hover:shadow-sm",
                    )}
                    style={{ animationDelay: `${i * 55}ms` }}
                  >
                    {/* Icon + metric */}
                    <div className="flex items-start justify-between gap-2">
                      <div
                        className={cn(
                          "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition-all duration-200",
                          card.accent,
                          isActive && "scale-110 shadow-sm",
                        )}
                      >
                        <card.icon className="h-5 w-5" />
                      </div>
                      <span
                        className={cn(
                          "rounded-full border px-2 py-0.5 text-[10px] font-semibold transition-colors",
                          isActive
                            ? card.accent
                            : "border-border/50 bg-muted/40 text-muted-foreground",
                        )}
                      >
                        {card.metric}
                      </span>
                    </div>

                    {/* Title + description */}
                    <div className="mt-3 space-y-1">
                      <div className="flex items-center gap-2">
                        <p
                          className={cn(
                            "text-[15px] font-semibold transition-colors",
                            isActive ? "text-primary" : "text-foreground",
                          )}
                        >
                          {card.title}
                        </p>
                        {isActive && (
                          <span className="relative flex h-2 w-2 shrink-0">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/50" />
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                          </span>
                        )}
                      </div>
                      <p className="line-clamp-2 text-[12px] leading-relaxed text-muted-foreground">
                        {card.description}
                      </p>
                    </div>

                    {/* Helper + CTA */}
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/50">
                        {card.helper}
                      </span>
                      <span
                        className={cn(
                          "text-[11px] font-semibold transition-colors",
                          isActive ? "text-primary" : "text-muted-foreground/40",
                        )}
                      >
                        {isActive ? "En cours →" : "Toucher →"}
                      </span>
                    </div>
                  </button>
                );
              })}
              {/* Trailing spacer so the last card isn't flush against the edge */}
              <div className="w-4 shrink-0" aria-hidden />
            </div>
          </div>

          {/* ── MOBILE: horizontal pill tabs (< md) ── */}
          <div className="border-t border-border/30 py-2.5 md:hidden">
            <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {primaryTabs.map((tab) => {
                const meta = APP_TAB_META[tab];
                const isActive = activeTab === tab;

                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => handleTabChange(tab)}
                    className={cn(
                      "flex min-h-[44px] min-w-fit shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors active:scale-[0.97]",
                      isActive
                        ? "border-primary bg-primary text-primary-foreground"
                        : "bg-white/75 text-foreground hover:border-primary/25 hover:bg-white",
                    )}
                  >
                    <meta.icon className="h-4 w-4" />
                    <span>{meta.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Bottom nav rendered via portal to document.body so position:fixed is
          always relative to the viewport — no ancestor CSS can trap it. */}
      {createPortal(
        <div className="fixed inset-x-0 bottom-0 z-[9999] border-t border-border/60 bg-background/96 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-1.5 shadow-[0_-8px_32px_-8px_rgba(15,23,42,0.12)] backdrop-blur-xl lg:hidden">
          <div className="mx-auto flex max-w-[1800px] items-stretch justify-between gap-0.5 px-2 sm:px-4">
            {mobileTabs.map((tab) => {
              const meta = APP_TAB_META[tab];
              const isActive = activeTab === tab;
              const hasBadge = tab === "alerts" && metrics.activeAlertsCount > 0;

              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => handleTabChange(tab)}
                  className={cn(
                    "relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-2xl px-1 py-2.5 text-center",
                    "transition-all duration-200 active:scale-95",
                    isActive ? "text-primary" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {isActive && (
                    <span className="absolute inset-x-1 inset-y-0.5 rounded-2xl bg-primary/10 animate-scale-in" />
                  )}
                  <span className="relative">
                    <meta.icon className={cn("h-5 w-5 transition-transform duration-200", isActive && "scale-110")} />
                    {hasBadge && (
                      <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white badge-pulse">
                        {metrics.activeAlertsCount > 9 ? "9+" : metrics.activeAlertsCount}
                      </span>
                    )}
                  </span>
                  <span className={cn(
                    "truncate text-[11px] font-semibold transition-all duration-200",
                    isActive ? "text-primary" : "text-muted-foreground",
                  )}>
                    {meta.shortLabel}
                  </span>
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className={cn(
                "relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-2xl px-1 py-2.5 text-center",
                "transition-all duration-200 active:scale-95",
                isOverflowActive ? "text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {isOverflowActive && (
                <span className="absolute inset-x-1 inset-y-0.5 rounded-2xl bg-primary/10 animate-scale-in" />
              )}
              <Grid2x2 className={cn("h-5 w-5 transition-transform duration-200", isOverflowActive && "scale-110")} />
              <span className={cn(
                "truncate text-[11px] font-semibold",
                isOverflowActive ? "text-primary" : "text-muted-foreground",
              )}>
                Plus
              </span>
            </button>
          </div>
        </div>,
        document.body,
      )}

      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="bottom" className="max-h-[calc(100dvh-60px)] rounded-t-[28px] px-4 pb-8 pt-8 sm:px-6 md:hidden">
          <SheetHeader className="text-left">
            <SheetTitle>Navigation rapide</SheetTitle>
            <SheetDescription>
              Choisissez un module adapte a votre usage mobile et tablette.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 grid grid-cols-2 gap-2 stagger-fast sm:gap-3">
            {allTabs.map((tab) => {
              const meta = APP_TAB_META[tab];
              const isActive = activeTab === tab;

              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => handleTabChange(tab)}
                  className={cn(
                    "flex items-start gap-3 rounded-3xl border bg-card px-4 py-4 text-left",
                    "transition-all duration-200 active:scale-[0.98]",
                    isActive
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "hover:border-primary/20 hover:bg-white hover:shadow-sm",
                  )}
                >
                  <div
                    className={cn(
                      "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition-all duration-200",
                      isActive ? "bg-primary text-primary-foreground shadow-md" : "bg-secondary text-secondary-foreground",
                    )}
                  >
                    <meta.icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold text-foreground">{meta.label}</p>
                      {tab === "alerts" && metrics.activeAlertsCount > 0 && (
                        <Badge variant="destructive" className="rounded-full px-1.5 text-[10px] badge-pulse">
                          {metrics.activeAlertsCount}
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{getMetricForTab(tab, metrics)}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
