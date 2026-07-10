import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Activity,
  BarChart3,
  Bell,
  Building2,
  CheckCircle,
  ChevronDown,
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

const STORAGE_SUBTABS = new Set([
  "stock-dashboard", "stock-lots", "stock-products", "stock-movements",
]);

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
  const roleLabel   = primaryRole ? ROLE_CONFIG[primaryRole]?.label : undefined;

  const sections: NavSection[] = [
    {
      key: "operations",
      label: "Opérations",
      items: [
        { id: "home",       title: t("nav.home"),       icon: Home },
        { id: "live",       title: "Centre de Commande", icon: Activity },
        { id: "scan",       title: "Scan & Traçabilité", icon: QrCode },
        { id: "receptions", title: t("nav.receptions"), icon: ClipboardList },
        { id: "production", title: t("nav.production"), icon: Factory },
        { id: "alerts",     title: t("nav.alerts"),     icon: Bell, badge: activeAlertsCount },
      ],
    },
    {
      key: "quality",
      label: "Qualité & Stock",
      items: [
        { id: "batches",   title: "Lots Qualité",      icon: Scale },
        { id: "storage",   title: "Entrepôt & Stock",  icon: Warehouse },
        { id: "packaging", title: "Conditionnement",   icon: PackageCheck },
        { id: "quality",   title: "Qualité & CAPA",    icon: CheckCircle },
      ],
    },
    {
      key: "gestion",
      label: "Gestion",
      items: [
        { id: "suppliers", title: t("nav.suppliers"),         icon: Building2 },
        { id: "materials", title: t("nav.materials"),         icon: Package },
        { id: "purchasing",title: t("nav.purchasing"),        icon: ShoppingCart },
        { id: "logistics", title: t("nav.logistics"),         icon: Truck },
        { id: "hr",        title: "Ressources Humaines",      icon: Users },
      ],
    },
    {
      key: "pilotage",
      label: "Pilotage",
      items: [
        { id: "analytics",      title: t("nav.analytics"), icon: BarChart3 },
        { id: "sage-operations",title: "SAGE Hub",          icon: Landmark },
      ],
    },
  ];

  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    const active = TAB_SECTION[activeTab] ?? "operations";
    return {
      operations: active === "operations",
      quality:    active === "quality",
      gestion:    active === "gestion",
      pilotage:   active === "pilotage",
    };
  });

  useEffect(() => {
    const section = TAB_SECTION[activeTab];
    if (section) setOpenSections((p) => ({ ...p, [section]: true }));
  }, [activeTab]);

  const toggleSection = (key: string) =>
    setOpenSections((p) => ({ ...p, [key]: !p[key] }));

  const renderNavItem = (item: NavItem) => {
    const isActive =
      activeTab === item.id ||
      (item.id === "storage" && STORAGE_SUBTABS.has(activeTab));
    const isAlerts = item.id === "alerts";

    return (
      <SidebarMenuItem key={item.id}>
        <SidebarMenuButton
          onClick={() => onTabChange(item.id)}
          isActive={isActive}
          tooltip={item.title}
          className={cn(
            "group/item relative h-11 gap-3 rounded-xl px-2.5 text-[13.5px] font-medium transition-all duration-200",
            isActive
              ? "bg-white/12 text-white"
              : "text-white/65 hover:bg-white/7 hover:text-white",
          )}
        >
          {/* Glowing left indicator */}
          {isActive && (
            <span
              className="absolute start-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-e-full bg-emerald-400 group-data-[collapsible=icon]:hidden"
              style={{ boxShadow: "0 0 10px 2px rgba(52,211,153,0.55)" }}
            />
          )}

          {/* Icon container */}
          <span
            className={cn(
              "flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-xl border transition-all duration-200",
              isActive
                ? "border-emerald-500/30 bg-emerald-500/16 text-emerald-300"
                : cn(
                    "border-white/7 text-white/60",
                    "group-hover/item:border-white/14 group-hover/item:bg-white/8 group-hover/item:text-white",
                  ),
              isAlerts && hasAlerts && !isActive && "border-amber-400/25 text-amber-300/90",
            )}
            style={
              isActive
                ? { boxShadow: "0 0 12px -3px rgba(52,211,153,0.3)" }
                : undefined
            }
          >
            <item.icon className="h-[17px] w-[17px] transition-transform duration-200 group-hover/item:scale-110" />
          </span>

          <span className="truncate group-data-[collapsible=icon]:hidden">{item.title}</span>

          {typeof item.badge === "number" && item.badge > 0 && (
            <Badge
              variant="destructive"
              className="ml-auto shrink-0 rounded-full px-1.5 py-0 text-[11px] leading-4 group-data-[collapsible=icon]:hidden"
            >
              {item.badge}
            </Badge>
          )}
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  return (
    <Sidebar
      collapsible="icon"
      className="border-e border-white/6"
    >
      {/* ── Brand header ── */}
      <SidebarHeader className="px-3 pb-4 pt-5">
        <div className="flex items-center gap-3 px-1">
          {/* Logo */}
          <div
            className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-500/30 bg-white/92 p-1.5"
            style={{ boxShadow: "0 0 20px -4px rgba(52,211,153,0.45)" }}
          >
            <BrandLogo
              className="h-full w-full"
              imgClassName="h-full w-full object-contain"
              alt={companyName}
            />
          </div>

          {/* Name */}
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.24em] text-emerald-400/70">
              {companyShortName}
            </p>
            <p className="truncate text-[14px] font-semibold leading-snug text-white/92">
              {companyName}
            </p>
          </div>
        </div>
      </SidebarHeader>

      {/* Divider */}
      <div className="mx-3 mb-1 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      {/* ── Navigation ── */}
      <SidebarContent className="px-2 py-2">
        {sections.map((section) => {
          const isOpen = openSections[section.key];
          return (
            <SidebarGroup key={section.key} className="mb-0.5 p-0 last:mb-0">
              {/* Section label */}
              <button
                type="button"
                onClick={() => toggleSection(section.key)}
                className="group-data-[collapsible=icon]:hidden mb-0.5 flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 transition-colors hover:bg-white/4"
              >
                <span className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-white/45">
                  {section.label}
                </span>
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 text-white/40 transition-transform duration-200",
                    !isOpen && "-rotate-90",
                  )}
                />
              </button>

              {/* Items */}
              <div
                className={cn(
                  "overflow-hidden transition-all duration-250 ease-out",
                  isOpen
                    ? "max-h-[500px] opacity-100"
                    : "max-h-0 opacity-0 group-data-[collapsible=icon]:max-h-[500px] group-data-[collapsible=icon]:opacity-100",
                )}
              >
                <SidebarGroupContent>
                  <SidebarMenu className="gap-px">
                    {section.items.map(renderNavItem)}
                  </SidebarMenu>
                </SidebarGroupContent>
              </div>
            </SidebarGroup>
          );
        })}

        {/* Settings — admin only */}
        {isAdmin && (
          <>
            <div className="mx-1 my-2 h-px bg-gradient-to-r from-transparent via-white/8 to-transparent" />
            <SidebarMenu className="gap-px">
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => onTabChange("settings")}
                  isActive={activeTab === "settings"}
                  tooltip="Paramètres"
                  className={cn(
                    "group/item h-11 gap-3 rounded-xl px-2.5 text-[13.5px] font-medium transition-all duration-200",
                    activeTab === "settings"
                      ? "bg-white/12 text-white"
                      : "text-white/65 hover:bg-white/7 hover:text-white",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-[34px] w-[34px] items-center justify-center rounded-xl border transition-all duration-200",
                      activeTab === "settings"
                        ? "border-emerald-500/30 bg-emerald-500/16 text-emerald-300"
                        : "border-white/7 text-white/60 group-hover/item:border-white/14 group-hover/item:bg-white/8 group-hover/item:text-white",
                    )}
                  >
                    <Settings className="h-[17px] w-[17px] transition-transform duration-200 group-hover/item:scale-110" />
                  </span>
                  <span className="group-data-[collapsible=icon]:hidden">Paramètres</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </>
        )}
      </SidebarContent>

      {/* Divider */}
      <div className="mx-3 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      {/* ── Footer ── */}
      <SidebarFooter className="px-3 py-3">
        {/* Alert pill */}
        {hasAlerts && (
          <div className="mb-2 flex items-center gap-2.5 rounded-xl border border-amber-400/20 bg-amber-400/8 px-3 py-2 group-data-[collapsible=icon]:hidden">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping-slow absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-55" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-400" />
            </span>
            <p className="text-xs font-semibold text-amber-300/85">
              {activeAlertsCount} alerte{activeAlertsCount > 1 ? "s" : ""} active{activeAlertsCount > 1 ? "s" : ""}
            </p>
          </div>
        )}

        {/* User card */}
        <div
          className="flex items-center gap-2.5 rounded-xl border border-white/8 px-2.5 py-2.5 transition-colors hover:bg-white/5"
          style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.03) 100%)" }}
        >
          <Avatar
            className="h-8 w-8 shrink-0 border border-white/16"
            style={{ boxShadow: "0 0 12px -3px rgba(52,211,153,0.25)" }}
          >
            <AvatarImage src={profile?.avatar_url || undefined} alt={identityLabel} />
            <AvatarFallback className="bg-emerald-700/60 text-xs font-bold text-white">
              {userInitials}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
            <p className="truncate text-[12.5px] font-semibold leading-tight text-white/86">
              {identityLabel}
            </p>
            {roleLabel && (
              <p className="truncate text-[11px] leading-tight text-white/32">
                {roleLabel}
              </p>
            )}
          </div>

          {user && (
            <button
              onClick={signOut}
              title="Se déconnecter"
              className="shrink-0 rounded-lg p-1.5 text-white/28 transition-all duration-150 hover:bg-red-500/15 hover:text-red-400 group-data-[collapsible=icon]:hidden"
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
