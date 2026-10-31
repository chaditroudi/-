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
    activeAlertsCount: number | null;
    pendingReceptions: number | null;
    qualityQueueCount: number | null;
    inProgressOrders: number | null;
    storedLots: number | null;
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

const getWorkflowCards = (roles: ActorRole[], metrics: WorkflowNavigationProps["metrics"]): WorkflowCardConfig[] => {
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
        id: "receptions",
        title: "Réception & QC",
        description: "Ouvrir la file des lots d'entrée en attente d'inspection, de grade ou de décision qualité.",
        helper: "File qualité terrain",
        metric: `${metrics.qualityQueueCount} à vérifier`,
        icon: ClipboardCheck,
        accent: "border-sky-200 bg-sky-50 text-sky-700",
      },
      {
        id: "quality",
        title: "Qualité & CAPA",
        description: "CAPA, journal d'audit et pilotage qualité transverse usine.",
        helper: "Qualité transverse",
        metric: "Accès direct",
        icon: ShieldCheck,
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
        id: "receptions",
        title: "Réception & QC",
        description: "Retrouver les lots d'entrée et les contrôles qualité à suivre pendant la transformation.",
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
      title: "Parcours lot",
      description: "Suivre un lot A→Z : étape actuelle, prochaine action, coût et passport.",
      helper: "Fil d'or",
      metric: "Vue parcours",
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
      if (metrics.activeAlertsCount === null) return "Accès direct";
      return metrics.activeAlertsCount > 0 ? `${metrics.activeAlertsCount} alertes` : "Aucune alerte";
    case "receptions":
      return metrics.pendingReceptions === null ? "Accès direct" : `${metrics.pendingReceptions} à traiter`;
    case "quality":
      return metrics.qualityQueueCount === null ? "Accès direct" : `${metrics.qualityQueueCount} à vérifier`;
    case "production":
      return metrics.inProgressOrders === null ? "Accès direct" : `${metrics.inProgressOrders} en cours`;
    case "storage":
    case "stock-dashboard":
    case "stock-lots":
      return metrics.storedLots === null ? "Accès direct" : `${metrics.storedLots} lots`;
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
      {/* Bottom nav rendered via portal to document.body so position:fixed is
          always relative to the viewport — no ancestor CSS can trap it. */}
      {createPortal(
        <div className="fixed inset-x-0 bottom-0 z-[9999] border-t bg-card pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-1.5 md:hidden">
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
                      <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-xs font-bold text-white badge-pulse">
                        {metrics.activeAlertsCount > 9 ? "9+" : metrics.activeAlertsCount}
                      </span>
                    )}
                  </span>
                  <span className={cn(
                    "truncate text-xs font-semibold transition-all duration-200",
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
                "truncate text-xs font-semibold",
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
                        <Badge variant="destructive" className="rounded-full px-1.5 text-xs badge-pulse">
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
