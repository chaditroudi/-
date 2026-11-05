import { useState } from "react";
import { createPortal } from "react-dom";
import { Grid2x2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { AppTab } from "@/lib/roleAccess";
import { APP_TAB_META } from "@/lib/appTabs";

interface WorkflowNavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
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

/** Phone bottom bar + overflow sheet. Desktop/tablet use the Filière sidebar. */
export function WorkflowNavigation({
  activeTab,
  onTabChange,
  primaryTabs,
  quickTabs,
  metrics,
}: WorkflowNavigationProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const allTabs = unique<AppTab>([...primaryTabs, ...quickTabs, "home"]);
  const activeAppTab = activeTab as AppTab;
  const mobileTabs = unique<AppTab>([
    ...primaryTabs.slice(0, 3),
    ...(allTabs.includes("scan") ? (["scan"] as AppTab[]) : []),
    ...(quickTabs.length > 0 ? quickTabs : (["home"] as AppTab[])),
  ]).slice(0, 4);
  const isOverflowActive = !mobileTabs.includes(activeAppTab);

  const handleTabChange = (tab: AppTab) => {
    onTabChange(tab);
    setMobileMenuOpen(false);
  };

  return (
    <>
      {createPortal(
        <div className="fixed inset-x-0 bottom-0 z-[9999] border-t bg-card pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-1.5 md:hidden">
          <div className="mx-auto flex max-w-[1800px] items-stretch justify-between gap-0.5 px-2 sm:px-4">
            {mobileTabs.map((tab) => {
              const meta = APP_TAB_META[tab];
              const isActive = activeTab === tab;
              const hasBadge = tab === "alerts" && (metrics.activeAlertsCount ?? 0) > 0;

              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => handleTabChange(tab)}
                  className={cn(
                    "relative flex min-h-12 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-lg px-1 py-2.5 text-center",
                    "transition-colors active:scale-95",
                    isActive ? "text-primary" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {isActive && (
                    <span className="absolute inset-x-1 inset-y-0.5 rounded-lg bg-primary/10" />
                  )}
                  <span className="relative">
                    <meta.icon className={cn("h-5 w-5", isActive && "scale-110")} />
                    {hasBadge && (
                      <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-xs font-bold text-white">
                        {(metrics.activeAlertsCount ?? 0) > 9 ? "9+" : metrics.activeAlertsCount}
                      </span>
                    )}
                  </span>
                  <span className={cn(
                    "truncate text-xs font-semibold",
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
                "relative flex min-h-12 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-lg px-1 py-2.5 text-center",
                "transition-colors active:scale-95",
                isOverflowActive ? "text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {isOverflowActive && (
                <span className="absolute inset-x-1 inset-y-0.5 rounded-lg bg-primary/10" />
              )}
              <Grid2x2 className={cn("h-5 w-5", isOverflowActive && "scale-110")} />
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
        <SheetContent side="bottom" className="max-h-[calc(100dvh-60px)] rounded-t-lg px-4 pb-8 pt-8 sm:px-6 md:hidden">
          <SheetHeader className="text-start">
            <SheetTitle>Navigation rapide</SheetTitle>
            <SheetDescription>
              Choisissez un module adapté à votre usage mobile et tablette.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 grid grid-cols-2 gap-2 sm:gap-3">
            {allTabs.map((tab) => {
              const meta = APP_TAB_META[tab];
              const isActive = activeTab === tab;

              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => handleTabChange(tab)}
                  className={cn(
                    "flex min-h-14 items-start gap-3 rounded-lg border bg-card px-4 py-4 text-left",
                    "transition-colors active:scale-[0.98]",
                    isActive
                      ? "border-primary bg-primary/5"
                      : "hover:border-primary/20 hover:bg-muted/40",
                  )}
                >
                  <div
                    className={cn(
                      "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg",
                      isActive ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground",
                    )}
                  >
                    <meta.icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold text-foreground">{meta.label}</p>
                      {tab === "alerts" && (metrics.activeAlertsCount ?? 0) > 0 && (
                        <Badge variant="destructive" className="rounded-full px-1.5 text-xs">
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
