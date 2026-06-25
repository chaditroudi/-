import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Activity,
  BarChart3,
  Bell,
  Building2,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Factory,
  Home,
  Landmark,
  LogOut,
  Package,
  PackageCheck,
  QrCode,
  Scale,
  Settings,
  ShoppingCart,
  Truck,
  Users,
  Warehouse,
} from "lucide-react";
import { BrandLogo } from "@/components/branding/BrandLogo";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useAuthContext } from "@/contexts/AuthContext";
import { useBranding } from "@/hooks/useBranding";
import { ROLE_CONFIG } from "@/types/roles";
import {
  Sidebar,
  SidebarContent,
  SidebarSeparator,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  SidebarRail,
} from "@/components/ui/sidebar";

interface AppSidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  activeAlertsCount: number;
}

type NavItem = { id: string; title: string; icon: typeof Home; badge?: number };
type NavSection = { key: string; label: string; items: NavItem[] };

// Maps each tab to its sidebar section key for auto-expand on external navigation
const TAB_SECTION: Record<string, string> = {
  home: "operations", live: "operations", scan: "operations",
  receptions: "operations", production: "operations", alerts: "operations",
  batches: "quality", storage: "quality", packaging: "quality", quality: "quality",
  "stock-dashboard": "quality", "stock-lots": "quality",
  "stock-products": "quality", "stock-movements": "quality",
  suppliers: "gestion", materials: "gestion", purchasing: "gestion",
  logistics: "gestion", hr: "gestion",
  analytics: "pilotage", "sage-operations": "pilotage",
};

// stock-* sub-tabs are handled by the single "storage" nav item
const STORAGE_SUBTABS = new Set(["stock-dashboard", "stock-lots", "stock-products", "stock-movements"]);

export function AppSidebar({ activeTab, onTabChange, activeAlertsCount }: AppSidebarProps) {
  const { t } = useTranslation();
  const { user, profile, roles, signOut, isAdmin } = useAuthContext();
  const { companyName, companyShortName } = useBranding();

  const hasAlerts = activeAlertsCount > 0;
  const identityLabel = profile?.full_name || user?.email || "Utilisateur";
  const userInitials =
    identityLabel
      .split(/[\s.@_-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("") || "RP";
  const primaryRole = roles?.[0];
  const roleLabel = primaryRole ? ROLE_CONFIG[primaryRole]?.label : undefined;

  const sections: NavSection[] = [
    {
      key: "operations",
      label: "Opérations",
      items: [
        { id: "home", title: t("nav.home"), icon: Home },
        { id: "live", title: "Centre de Commande", icon: Activity },
        { id: "scan", title: "Scan & Traçabilité", icon: QrCode },
        { id: "receptions", title: t("nav.receptions"), icon: ClipboardList },
        { id: "production", title: t("nav.production"), icon: Factory },
        { id: "alerts", title: t("nav.alerts"), icon: Bell, badge: activeAlertsCount },
      ],
    },
    {
      key: "quality",
      label: "Qualité & Stock",
      items: [
        { id: "batches", title: "Lots Qualité", icon: Scale },
        { id: "storage", title: "Entrepôt & Stock", icon: Warehouse },
        { id: "packaging", title: "Conditionnement", icon: PackageCheck },
        { id: "quality", title: "Qualité & CAPA", icon: CheckCircle },
      ],
    },
    {
      key: "gestion",
      label: "Gestion",
      items: [
        { id: "suppliers", title: t("nav.suppliers"), icon: Building2 },
        { id: "materials", title: t("nav.materials"), icon: Package },
        { id: "purchasing", title: t("nav.purchasing"), icon: ShoppingCart },
        { id: "logistics", title: t("nav.logistics"), icon: Truck },
        { id: "hr", title: "Ressources Humaines", icon: Users },
      ],
    },
    {
      key: "pilotage",
      label: "Pilotage",
      items: [
        { id: "analytics", title: t("nav.analytics"), icon: BarChart3 },
        { id: "sage-operations", title: "SAGE Hub", icon: Landmark },
      ],
    },
  ];

  // Open the section containing the current tab by default; always open operations
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    const active = TAB_SECTION[activeTab] ?? "operations";
    return {
      operations: active === "operations",
      quality: active === "quality",
      gestion: active === "gestion",
      pilotage: active === "pilotage",
    };
  });

  // Auto-expand the correct section when navigating from mobile nav or URL
  useEffect(() => {
    const section = TAB_SECTION[activeTab];
    if (section) setOpenSections((p) => ({ ...p, [section]: true }));
  }, [activeTab]);

  const toggleSection = (key: string) =>
    setOpenSections((p) => ({ ...p, [key]: !p[key] }));

  const renderNavItem = (item: NavItem) => {
    // Highlight "storage" when any stock-* sub-tab is active
    const isActive =
      activeTab === item.id ||
      (item.id === "storage" && STORAGE_SUBTABS.has(activeTab));
    const isAlertsItem = item.id === "alerts";

    return (
      <SidebarMenuItem key={item.id}>
        <SidebarMenuButton
          onClick={() => onTabChange(item.id)}
          isActive={isActive}
          tooltip={item.title}
          className={cn(
            "group/item relative h-9 gap-2.5 rounded-xl px-2.5 text-[13px] font-medium transition-all duration-150",
            isActive
              ? "bg-white/12 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
              : "text-sidebar-foreground/62 hover:bg-white/6 hover:text-sidebar-foreground",
          )}
        >
          {isActive && (
            <span className="absolute start-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-e-full bg-emerald-400 group-data-[collapsible=icon]:hidden" />
          )}

          <span
            className={cn(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border transition-colors duration-150",
              isActive
                ? "border-white/12 bg-white/10 text-white"
                : "border-transparent bg-transparent text-sidebar-foreground/50",
              isAlertsItem && hasAlerts && !isActive && "text-amber-300",
            )}
          >
            <item.icon className="h-[15px] w-[15px]" />
          </span>

          <span className="truncate group-data-[collapsible=icon]:hidden">{item.title}</span>

          {typeof item.badge === "number" && item.badge > 0 && (
            <Badge
              variant="destructive"
              className="ml-auto shrink-0 rounded-full px-1.5 py-0 text-[10px] leading-4 group-data-[collapsible=icon]:hidden"
            >
              {item.badge}
            </Badge>
          )}
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  return (
    <Sidebar collapsible="icon" className="border-e border-sidebar-border/40 bg-sidebar">
      {/* Brand header */}
      <SidebarHeader className="px-3 py-4">
        <div className="flex items-center gap-3 px-1">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/12 bg-white/90 p-1.5">
            <BrandLogo className="h-full w-full" imgClassName="h-full w-full object-contain" alt={companyName} />
          </div>
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-sidebar-foreground/40">
              {companyShortName}
            </p>
            <p className="truncate text-[13px] font-semibold leading-snug text-sidebar-foreground/90">
              {companyName}
            </p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarSeparator className="mx-3 bg-sidebar-border/40" />

      {/* Nested / collapsible navigation */}
      <SidebarContent className="px-2 py-3">
        {sections.map((section) => {
          const isOpen = openSections[section.key];
          return (
            <SidebarGroup key={section.key} className="mb-1 p-0 last:mb-0">
              {/* Section toggle header — hidden when sidebar collapses to icons */}
              <button
                type="button"
                onClick={() => toggleSection(section.key)}
                className="group-data-[collapsible=icon]:hidden mb-0.5 flex w-full items-center justify-between rounded-lg px-3 py-1.5 transition-colors hover:bg-white/5"
              >
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-sidebar-foreground/35">
                  {section.label}
                </span>
                {isOpen
                  ? <ChevronDown className="h-3 w-3 text-sidebar-foreground/30" />
                  : <ChevronRight className="h-3 w-3 text-sidebar-foreground/30" />
                }
              </button>

              {/* Items: respect open state; always visible in icon-only mode */}
              <div
                className={cn(
                  "overflow-hidden transition-all duration-200",
                  isOpen
                    ? "max-h-[500px] opacity-100"
                    : "max-h-0 opacity-0 group-data-[collapsible=icon]:max-h-[500px] group-data-[collapsible=icon]:opacity-100",
                )}
              >
                <SidebarGroupContent>
                  <SidebarMenu className="gap-0.5">{section.items.map(renderNavItem)}</SidebarMenu>
                </SidebarGroupContent>
              </div>
            </SidebarGroup>
          );
        })}

        {/* Settings — admin only, always visible standalone */}
        {isAdmin && (
          <>
            <SidebarSeparator className="mx-1 my-2 bg-sidebar-border/30" />
            <SidebarMenu className="gap-0.5">
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => onTabChange("settings")}
                  isActive={activeTab === "settings"}
                  tooltip="Paramètres"
                  className={cn(
                    "h-9 gap-2.5 rounded-xl px-2.5 text-[13px] font-medium transition-all duration-150",
                    activeTab === "settings"
                      ? "bg-white/12 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
                      : "text-sidebar-foreground/62 hover:bg-white/6 hover:text-sidebar-foreground",
                  )}
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-transparent text-sidebar-foreground/50">
                    <Settings className="h-[15px] w-[15px]" />
                  </span>
                  <span className="group-data-[collapsible=icon]:hidden">Paramètres</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </>
        )}
      </SidebarContent>

      <SidebarSeparator className="mx-3 bg-sidebar-border/40" />

      {/* Footer: alert pill + user card */}
      <SidebarFooter className="px-3 py-3">
        {hasAlerts && (
          <div className="mb-2 flex items-center gap-2 rounded-xl border border-amber-400/20 bg-amber-400/8 px-3 py-2 group-data-[collapsible=icon]:hidden">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
            <p className="text-[11px] font-semibold text-amber-300">
              {activeAlertsCount} alerte{activeAlertsCount > 1 ? "s" : ""} active{activeAlertsCount > 1 ? "s" : ""}
            </p>
          </div>
        )}

        <div className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/5 px-2.5 py-2.5">
          <Avatar className="h-8 w-8 shrink-0 border border-white/15">
            <AvatarImage src={profile?.avatar_url || undefined} alt={identityLabel} />
            <AvatarFallback className="bg-emerald-600/60 text-[11px] font-bold text-white">
              {userInitials}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
            <p className="truncate text-[13px] font-semibold leading-tight text-sidebar-foreground/90">
              {identityLabel}
            </p>
            {roleLabel && (
              <p className="truncate text-[10px] leading-tight text-sidebar-foreground/40">
                {roleLabel}
              </p>
            )}
          </div>

          {user && (
            <button
              onClick={signOut}
              title="Se déconnecter"
              className="shrink-0 rounded-lg p-1 text-sidebar-foreground/35 transition-colors hover:bg-white/8 hover:text-red-400 group-data-[collapsible=icon]:hidden"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
