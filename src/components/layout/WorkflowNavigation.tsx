import { useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Grid2x2, KeyRound, LogOut, ShieldCheck, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ChangePasswordForm } from "@/components/auth/ChangePasswordForm";
import { cn } from "@/lib/utils";
import type { AppTab } from "@/lib/roleAccess";
import type { AppNavigateOptions } from "@/lib/appNavigate";
import { APP_TAB_META } from "@/lib/appTabs";

interface WorkflowNavigationProps {
  activeTab: string;
  activeView?: string;
  onTabChange: (tab: AppTab, options?: AppNavigateOptions) => void;
  primaryTabs: AppTab[];
  quickTabs: AppTab[];
  /** Every tab this role may open (already filtered by the server contract). */
  accessibleTabs: AppTab[];
  /** The station where this person does their daily work, if any. */
  workTab?: AppTab | null;
  /** Inspectors get a direct "Contrôle qualité" entry. */
  canInspect?: boolean;
  /** Floor workers have no sidebar: the dock shows at every width and holds their account actions. */
  floor?: boolean;
  account?: { name: string; role?: string; onSignOut: () => void };
  metrics: {
    activeAlertsCount: number | null;
    pendingReceptions: number | null;
    qualityQueueCount: number | null;
    inProgressOrders: number | null;
    storedLots: number | null;
  };
}

const unique = <T,>(items: T[]) => Array.from(new Set(items));

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

type DockItem = { key: string; tab: AppTab; options?: AppNavigateOptions; label: string; icon: LucideIcon };

/** The worker dock: home, my station, scanner, alerts, and everything else behind "Plus".
 * Floor workers see it at every width instead of a sidebar; everyone else sees it below 768 px. */
export function WorkflowNavigation({
  activeTab,
  activeView,
  onTabChange,
  primaryTabs,
  quickTabs,
  accessibleTabs,
  workTab,
  canInspect = false,
  floor = false,
  account,
  metrics,
}: WorkflowNavigationProps) {
  const { t } = useTranslation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const allTabs = unique<AppTab>([...primaryTabs, ...quickTabs, "home", ...accessibleTabs]).filter((tab) => accessibleTabs.includes(tab));
  const qcItem: DockItem | null = canInspect && accessibleTabs.includes("receptions")
    ? { key: "qc", tab: "receptions", options: { view: "qc" }, label: t("dock.qc"), icon: ShieldCheck }
    : null;
  // Labels from the translated nav keys; the French page title is the fallback.
  const tabLabel = (tab: AppTab) => t(`nav.${tab}`, { defaultValue: APP_TAB_META[tab].pageTitle });
  const tabItem = (tab: AppTab, label?: string): DockItem => ({ key: tab, tab, label: label ?? tabLabel(tab), icon: APP_TAB_META[tab].icon });

  // Fixed order so every worker finds the same place for the same thing.
  const work = workTab && accessibleTabs.includes(workTab) && workTab !== "home" ? workTab : primaryTabs.find((tab) => tab !== "home" && accessibleTabs.includes(tab));
  const dockItems: DockItem[] = [
    tabItem("home", t("dock.home")),
    ...(qcItem && workTab === "receptions" && canInspect ? [qcItem] : work ? [tabItem(work, t("dock.myWork", { station: tabLabel(work) }))] : []),
    ...(accessibleTabs.includes("scan") ? [tabItem("scan", t("dock.scan"))] : []),
    ...(accessibleTabs.includes("alerts") ? [tabItem("alerts", t("dock.alerts"))] : []),
  ].slice(0, 4);
  const isActive = (item: DockItem) => activeTab === item.tab && (item.key !== "qc" ? !(item.tab === "receptions" && activeView === "qc" && qcItem) : activeView === "qc");
  const isOverflowActive = !dockItems.some(isActive);

  const go = (tab: AppTab, options?: AppNavigateOptions) => {
    onTabChange(tab, options);
    setMobileMenuOpen(false);
  };

  return (
    <>
      {createPortal(
        <nav
          aria-label={t("dock.label")}
          className={cn(
            "fixed inset-x-0 bottom-0 z-[60] border-t bg-card/95 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-1.5 shadow-lg backdrop-blur",
            !floor && "md:hidden",
          )}
        >
          <div className="mx-auto flex max-w-2xl items-stretch justify-between gap-1 px-2 sm:px-4">
            {dockItems.map((item) => {
              const active = isActive(item);
              const hasBadge = item.tab === "alerts" && (metrics.activeAlertsCount ?? 0) > 0;
              return (
                <button
                  key={item.key}
                  type="button"
                  data-nav-item={item.key === "qc" ? "Contrôle qualité" : APP_TAB_META[item.tab].pageTitle}
                  aria-current={active ? "page" : undefined}
                  onClick={() => go(item.tab, item.options)}
                  className={cn(
                    "relative flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-center transition-colors",
                    active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                  )}
                >
                  <span className="relative">
                    <item.icon className="h-5 w-5" aria-hidden />
                    {hasBadge && (
                      <span className="absolute -end-2 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-xs font-bold text-white">
                        {(metrics.activeAlertsCount ?? 0) > 9 ? "9+" : metrics.activeAlertsCount}
                      </span>
                    )}
                  </span>
                  <span className="max-w-full truncate text-xs font-semibold">{item.label}</span>
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-expanded={mobileMenuOpen}
              className={cn(
                "relative flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-center transition-colors",
                isOverflowActive ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
            >
              <Grid2x2 className="h-5 w-5" aria-hidden />
              <span className="truncate text-xs font-semibold">{t("dock.more")}</span>
            </button>
          </div>
        </nav>,
        document.body,
      )}

      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="bottom" className="max-h-[calc(100dvh-60px)] overflow-y-auto rounded-t-2xl px-4 pb-8 pt-8 sm:px-6">
          <SheetHeader className="text-start">
            <SheetTitle>Navigation rapide</SheetTitle>
            <SheetDescription>
              Choisissez un module adapté à votre usage mobile et tablette.
            </SheetDescription>
          </SheetHeader>

          <div className="mx-auto mt-6 grid max-w-3xl grid-cols-1 gap-2 min-[420px]:grid-cols-2 sm:gap-3 md:grid-cols-3">
            {[...(qcItem ? [qcItem] : []), ...allTabs.map((tab) => tabItem(tab))].map((item) => {
              const meta = APP_TAB_META[item.tab];
              const active = isActive(item);
              return (
                <button
                  key={item.key}
                  type="button"
                  data-nav-item={item.key === "qc" ? "Contrôle qualité" : meta.pageTitle}
                  onClick={() => go(item.tab, item.options)}
                  className={cn(
                    "flex min-h-14 items-start gap-3 rounded-xl border bg-card px-4 py-4 text-start transition-colors",
                    active ? "border-primary bg-accent" : "hover:border-primary/30 hover:bg-secondary",
                  )}
                >
                  <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
                    active ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground")}>
                    <item.icon className="h-5 w-5" aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold text-foreground">{item.key === "qc" ? item.label : meta.label}</p>
                      {item.tab === "alerts" && (metrics.activeAlertsCount ?? 0) > 0 && (
                        <Badge variant="destructive" className="rounded-full px-1.5 text-xs">{metrics.activeAlertsCount}</Badge>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{item.key === "qc" ? getMetricForTab("quality", metrics) : getMetricForTab(item.tab, metrics)}</p>
                  </div>
                </button>
              );
            })}
          </div>

          {floor && account && (
            <section aria-label={t("dock.account")} className="mx-auto mt-6 flex max-w-3xl flex-wrap items-center gap-3 rounded-xl border bg-secondary px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{account.name}</p>
                {account.role && <p className="truncate text-xs text-muted-foreground">{account.role}</p>}
              </div>
              <button type="button" onClick={() => setPasswordOpen(true)}
                className="inline-flex min-h-11 items-center gap-2 rounded-lg border bg-card px-3 text-sm font-medium hover:bg-accent">
                <KeyRound className="h-4 w-4" aria-hidden />Changer mon mot de passe
              </button>
              <button type="button" onClick={account.onSignOut}
                className="inline-flex min-h-11 items-center gap-2 rounded-lg border bg-card px-3 text-sm font-medium hover:bg-accent">
                <LogOut className="h-4 w-4" aria-hidden />Se déconnecter
              </button>
            </section>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={passwordOpen} onOpenChange={setPasswordOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Changer mon mot de passe</DialogTitle>
            <DialogDescription>Vos autres appareils seront déconnectés.</DialogDescription>
          </DialogHeader>
          <ChangePasswordForm onDone={() => setPasswordOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}
