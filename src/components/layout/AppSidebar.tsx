import { useState } from "react";
import { useTranslation } from "react-i18next";
import { isRTL } from "@/i18n/languages";
import {
  Activity,
  BarChart3,
  Bell,
  Building2,
  CheckCircle,
  ClipboardList,
  Contact,
  Factory,
  Home,
  KeyRound,
  Landmark,
  LogOut,
  Package,
  PackageCheck,
  QrCode,
  Scale,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Truck,
  Users,
  Warehouse,
  Wrench,
} from "lucide-react";
import { BrandLogo } from "@/components/branding/BrandLogo";
import { cn } from "@/lib/utils";
import { useAuthContext } from "@/contexts/AuthContext";
import { ChangePasswordForm } from "@/components/auth/ChangePasswordForm";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useBranding } from "@/hooks/useBranding";
import { ROLE_CONFIG } from "@/types/roles";
import { getReceptionPermissions } from "@/lib/receptionWorkflow";
import { getShellDensity } from "@/lib/roleAccess";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";

interface AppSidebarProps {
  activeTab: string;
  onTabChange: (tab: string, options?: { view?: string }) => void;
  /** Sub-screen of the active tab, so Contrôle qualité can light up on its own. */
  activeView?: string;
  /** Null while unknown: no badge is better than a false zero. */
  activeAlertsCount: number | null;
  /** Only show tabs the employee can open — critical for simple UX. */
  accessibleTabs?: string[];
}

type NavItem = { id: string; title: string; icon: typeof Home; badge?: number };

const STORAGE_SUBTABS = new Set(["stock-dashboard", "stock-lots", "stock-products", "stock-movements"]);

/** The path a lot takes through the plant, in physical order. */
const FILIERE: NavItem[] = [
  { id: "receptions", title: "Réception", icon: ClipboardList },
  { id: "qc", title: "Contrôle qualité", icon: ShieldCheck },
  { id: "storage", title: "Stock", icon: Warehouse },
  { id: "production", title: "Production", icon: Factory },
  { id: "packaging", title: "Conditionnement", icon: PackageCheck },
  { id: "logistics", title: "Expédition", icon: Truck },
];

const isItemActive = (item: NavItem, activeTab: string, activeView?: string, canInspect = false) => {
  const inQc = canInspect && activeTab === "receptions" && activeView === "qc";
  if (item.id === "qc") return inQc;
  if (item.id === "receptions") return activeTab === "receptions" && !inQc;
  return activeTab === item.id || (item.id === "storage" && STORAGE_SUBTABS.has(activeTab));
};

const ITEM_CLASS =
  "h-9 gap-2.5 rounded-md px-2.5 text-sm font-medium text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground " +
  "data-[active=true]:bg-sidebar-accent data-[active=true]:font-semibold data-[active=true]:text-sidebar-accent-foreground pointer-coarse:h-11";

const GroupLabel = ({ children }: { children: string }) => (
  <p className="px-2.5 pb-1 pt-3 text-xs font-medium text-sidebar-foreground/55 group-data-[collapsible=icon]:hidden">
    {children}
  </p>
);

export function AppSidebar({ activeTab, onTabChange, activeView, activeAlertsCount, accessibleTabs }: AppSidebarProps) {
  const { user, profile, roles, signOut, isAdmin } = useAuthContext();
  const [passwordOpen, setPasswordOpen] = useState(false);
  const { companyName } = useBranding();
  const { i18n } = useTranslation();

  const canSee = (id: string) =>
    id === "home" || Boolean(accessibleTabs?.includes(id));

  const identityLabel = profile?.full_name || user?.email || "Utilisateur";
  const primaryRole = roles?.[0];
  const roleLabel = primaryRole ? ROLE_CONFIG[primaryRole]?.label : undefined;
  const density = getShellDensity(roles);

  const today = [
    { id: "home", title: "Accueil", icon: Home },
    { id: "scan", title: "Scanner", icon: QrCode },
    { id: "alerts", title: "Alertes", icon: Bell, badge: activeAlertsCount },
    ...(density === "floor" ? [] : [{ id: "live", title: "En direct", icon: Activity }]),
  ].filter((item) => canSee(item.id));

  const canInspect = getReceptionPermissions(roles).canRunQc;
  const filiereAll = FILIERE.filter((item) => (item.id === "qc" ? canInspect && canSee("receptions") : canSee(item.id)));
  // Floor workers see only their station, not the whole plant chain.
  const filiere = density === "floor" ? filiereAll.slice(0, 1) : filiereAll;

  const openItem = (item: NavItem) => {
    if (item.id === "qc") onTabChange("receptions", { view: "qc" });
    else if (item.id === "receptions" && canInspect) onTabChange("receptions", { view: "today" });
    else onTabChange(item.id);
  };

  const office = [
    { id: "quality", title: "Qualité", icon: CheckCircle },
    { id: "suppliers", title: "Fournisseurs", icon: Building2 },
    { id: "purchasing", title: "Achats", icon: ShoppingCart },
    { id: "materials", title: "Articles", icon: Package },
    { id: "customers", title: "Clients", icon: Contact },
    { id: "export", title: "Export", icon: Scale },
    { id: "maintenance", title: "Maintenance", icon: Wrench },
    { id: "hr", title: "Ressources humaines", icon: Users },
  ].filter((item) => canSee(item.id));

  const direction = [
    { id: "analytics", title: "Indicateurs", icon: BarChart3 },
    { id: "sage-operations", title: "Cockpit usine", icon: Landmark },
  ].filter((item) => canSee(item.id));

  const renderItem = (item: NavItem) => (
    <SidebarMenuItem key={item.id}>
      <SidebarMenuButton
        onClick={() => openItem(item)}
        isActive={isItemActive(item, activeTab, activeView, canInspect)}
        tooltip={item.title}
        className={ITEM_CLASS}
      >
        <item.icon className="h-[18px] w-[18px] shrink-0" />
        <span className="truncate">{item.title}</span>
        {typeof item.badge === "number" && item.badge > 0 && (
          <span className="ms-auto rounded-sm bg-red-500 px-1.5 text-xs font-semibold text-white group-data-[collapsible=icon]:hidden">
            {item.badge}
          </span>
        )}
      </SidebarMenuButton>
    </SidebarMenuItem>
  );

  // The thread of light: lit from intake down to the step on screen.
  const activeStep = filiere.findIndex((item) => isItemActive(item, activeTab, activeView, canInspect));
  const litShare = activeStep < 0 ? 0 : ((activeStep + 0.5) / filiere.length) * 100;

  return (
    <Sidebar collapsible="icon" side={isRTL(i18n.language) ? "right" : "left"} className="border-e-0">
      <SidebarHeader className="px-2.5 pb-1 pt-3">
        <div className="flex items-center gap-2.5 px-0.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white p-1">
            <BrandLogo className="h-full w-full" imgClassName="h-full w-full object-contain" alt={companyName} />
          </div>
          <p className="truncate font-display text-base font-semibold text-sidebar-foreground group-data-[collapsible=icon]:hidden">
            {companyName}
          </p>
        </div>
      </SidebarHeader>

      <SidebarContent className="gap-0 px-1.5 pb-2">
        {today.length > 0 && (
          <SidebarGroup className="p-0">
            <GroupLabel>Aujourd'hui</GroupLabel>
            <SidebarMenu className="gap-px">{today.map(renderItem)}</SidebarMenu>
          </SidebarGroup>
        )}

        {filiere.length > 0 && (
          <SidebarGroup className="p-0">
            <GroupLabel>Filière</GroupLabel>
            <div className="relative">
              <span
                aria-hidden
                className="absolute bottom-[18px] start-[18px] top-[18px] z-10 w-px bg-sidebar-foreground/25 group-data-[collapsible=icon]:start-[19px]"
              />
              <span
                aria-hidden
                data-testid="filiere-thread"
                className="absolute start-[17.5px] top-0 z-10 w-0.5 bg-[hsl(var(--sidebar-primary))] group-data-[collapsible=icon]:start-[18.5px]"
                style={{ height: `${litShare}%`, opacity: activeStep < 0 ? 0 : 1 }}
              />
              <SidebarMenu className="relative z-20 gap-px [&_svg]:rounded-sm [&_svg]:bg-sidebar [&_[data-active=true]_svg]:bg-sidebar-accent [&_[data-active=true]_svg]:text-[hsl(var(--sidebar-primary))]">
                {filiere.map(renderItem)}
              </SidebarMenu>
            </div>
          </SidebarGroup>
        )}

        {density !== "floor" && office.length > 0 && (
          <SidebarGroup className="p-0">
            <GroupLabel>Bureau</GroupLabel>
            <SidebarMenu className="gap-px">{office.map(renderItem)}</SidebarMenu>
          </SidebarGroup>
        )}

        {density === "direction" && direction.length > 0 && (
          <SidebarGroup className="p-0">
            <GroupLabel>Direction</GroupLabel>
            <SidebarMenu className="gap-px">{direction.map(renderItem)}</SidebarMenu>
          </SidebarGroup>
        )}

        {isAdmin && density === "direction" && (
          <SidebarGroup className="p-0 pt-3">
            <SidebarMenu>{renderItem({ id: "settings", title: "Paramètres", icon: Settings })}</SidebarMenu>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border px-2.5 py-2">
        <div className="flex items-center gap-1 group-data-[collapsible=icon]:hidden">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-sidebar-foreground">{identityLabel}</p>
            {roleLabel && <p className="truncate text-xs text-sidebar-foreground/65">{roleLabel}</p>}
          </div>
          {user && (
            <>
              <button
                type="button"
                onClick={() => setPasswordOpen(true)}
                title="Changer mon mot de passe"
                aria-label="Changer mon mot de passe"
                className="rounded-md p-2 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              >
                <KeyRound className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={signOut}
                title="Se déconnecter"
                aria-label="Se déconnecter"
                className="rounded-md p-2 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </SidebarFooter>

      <SidebarRail />

      <Dialog open={passwordOpen} onOpenChange={setPasswordOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Changer mon mot de passe</DialogTitle>
            <DialogDescription>Vos autres appareils seront déconnectés.</DialogDescription>
          </DialogHeader>
          <ChangePasswordForm onDone={() => setPasswordOpen(false)} />
        </DialogContent>
      </Dialog>
    </Sidebar>
  );
}
