import {
  BriefcaseBusiness,
  CalendarDays,
  History,
  LogIn,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { BrandLogo } from "@/components/branding/BrandLogo";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { NotificationCenter } from "@/components/notifications";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { AuditLogPanel } from "@/components/audit";
import { useAuthContext } from "@/contexts/AuthContext";
import { useBranding } from "@/hooks/useBranding";
import { cn } from "@/lib/utils";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { SidebarTrigger } from "@/components/ui/sidebar";

interface TopHeaderProps {
  onRefresh: () => void;
  pageTitle: string;
  pageSubtitle?: string;
  sectionLabel?: string;
  onHomeClick?: () => void;
  roleLabel?: string;
  workspaceLabel?: string;
  interfaceLabel?: string;
}

export const TopHeader = ({
  onRefresh,
  pageTitle,
  pageSubtitle,
  sectionLabel,
  roleLabel,
}: TopHeaderProps) => {
  const [auditOpen, setAuditOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const navigate = useNavigate();
  const { user, profile, isLoading: authLoading, signOut, isAdmin } = useAuthContext();
  const { companyName, companyShortName } = useBranding();
  const { t } = useTranslation();

  const todayLabel = new Intl.DateTimeFormat("fr-FR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  }).format(new Date());

  const identityLabel = profile?.full_name || user?.email || "Utilisateur";
  const userInitials =
    identityLabel
      .split(/[\s.@_-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "RP";

  return (
    <header
      className="sticky top-0 z-40 flex min-h-[52px] flex-wrap items-center gap-2 border-b border-border/60 bg-card/95 px-3 py-1.5 backdrop-blur-xl sm:flex-nowrap sm:px-4 sm:py-0 lg:px-5"
      style={{
        boxShadow: "0 1px 0 0 hsl(var(--border) / 0.7), 0 4px 24px -4px hsl(220 26% 10% / 0.07)",
      }}
    >
      {/* Sidebar toggle */}
      <SidebarTrigger className="h-8 w-8 shrink-0 rounded-lg text-muted-foreground/60 hover:bg-muted hover:text-foreground" />

      <Separator orientation="vertical" className="hidden h-4 bg-border/50 sm:block" />

      {/* Brand chip */}
      <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-background/80 px-2 py-1.5 backdrop-blur-sm shadow-xs">
        <div
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-primary/18 bg-card p-1"
          style={{ boxShadow: "0 0 10px -2px hsl(var(--primary) / 0.22)" }}
        >
          <BrandLogo
            className="h-full w-full"
            imgClassName="h-full w-full object-contain"
            alt={companyName}
          />
        </div>
        <div className="min-w-0 hidden md:block">
          <p className="text-[11px] font-bold leading-tight text-foreground/90">{companyShortName}</p>
          <p className="max-w-[130px] truncate text-[9.5px] font-medium text-muted-foreground/65">{companyName}</p>
        </div>
      </div>

      {/* Page title area */}
      <div className="order-3 flex min-w-0 basis-full items-center gap-2.5 pb-1.5 sm:order-none sm:basis-auto sm:pb-0">
        <div className="min-w-0">
          {sectionLabel && (
            <p className="hidden truncate text-[9.5px] font-bold uppercase tracking-[0.2em] text-muted-foreground/40 sm:block">
              {sectionLabel}
            </p>
          )}
          <h2 className="truncate text-[14.5px] font-semibold leading-tight tracking-[-0.015em] text-foreground sm:text-[15px]">
            {pageTitle}
          </h2>
          {pageSubtitle && !sectionLabel && (
            <p className="hidden truncate text-[11px] text-muted-foreground/55 sm:block">
              {pageSubtitle}
            </p>
          )}
        </div>

        {/* Role badge */}
        {roleLabel && (
          <span className="hidden shrink-0 items-center gap-1.5 rounded-full border border-primary/22 bg-primary/9 px-2.5 py-0.5 text-[10.5px] font-semibold text-primary/75 lg:inline-flex">
            <ShieldCheck className="h-3 w-3 shrink-0" />
            {roleLabel}
          </span>
        )}
      </div>

      {/* ── Right zone ── */}
      <div className="ml-auto flex shrink-0 items-center gap-1.5">

        {/* Date chip */}
        <span className="hidden items-center gap-1.5 rounded-full border border-primary/18 bg-primary/8 px-2.5 py-1 text-[10.5px] font-semibold text-primary/72 sm:inline-flex">
          <CalendarDays className="h-3 w-3 shrink-0" />
          {todayLabel}
        </span>

        <Separator orientation="vertical" className="hidden h-4 bg-border/45 sm:block" />

        {/* Utility action pill */}
        <div className="flex items-center gap-0.5 rounded-xl border border-border/55 bg-muted/50 p-0.5">
          {isAdmin && (
            <Dialog open={auditOpen} onOpenChange={setAuditOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  title={t("header.auditLog")}
                  className="h-7 w-7 rounded-[9px] text-muted-foreground/65 hover:bg-card hover:text-foreground hover:shadow-xs"
                >
                  <History className="h-3.5 w-3.5" />
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[85vh] max-w-4xl overflow-hidden">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <History className="h-5 w-5 text-primary" />
                    {t("header.auditLog")}
                  </DialogTitle>
                </DialogHeader>
                <div className="max-h-[calc(85vh-120px)] overflow-auto">
                  <AuditLogPanel />
                </div>
              </DialogContent>
            </Dialog>
          )}

          <LanguageSwitcher />
          <NotificationCenter />

          <Button
            variant="ghost"
            size="icon"
            onClick={async () => {
              setIsRefreshing(true);
              await onRefresh();
              setTimeout(() => setIsRefreshing(false), 600);
            }}
            title="Actualiser"
            className="h-7 w-7 rounded-[9px] text-muted-foreground/65 hover:bg-card hover:text-foreground hover:shadow-xs"
          >
            <RefreshCw
              className={cn(
                "h-3.5 w-3.5 transition-transform duration-500",
                isRefreshing && "animate-spin",
              )}
            />
          </Button>
        </div>

        <Separator orientation="vertical" className="hidden h-4 bg-border/45 sm:block" />

        {/* Auth zone */}
        {!authLoading && (
          <>
            {!user ? (
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate("/auth")}
                  className="h-8 rounded-lg px-2 text-[12px] text-muted-foreground/75 hover:text-foreground sm:px-3"
                >
                  <LogIn className="h-3.5 w-3.5 sm:me-1.5" />
                  <span className="hidden sm:inline">{t("auth.connection")}</span>
                </Button>
                <Button
                  size="sm"
                  onClick={() => navigate("/dashboard")}
                  className="h-8 rounded-lg px-2 text-[12px] sm:px-3"
                >
                  <Users className="h-3.5 w-3.5 sm:me-1.5" />
                  <span className="hidden sm:inline">{t("auth.employeeSpace")}</span>
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                {/* Avatar + name — desktop */}
                <div className="hidden items-center gap-2.5 lg:flex">
                  <Avatar className="h-7 w-7 border border-border/70 shadow-xs">
                    <AvatarImage src={profile?.avatar_url || undefined} alt={identityLabel} />
                    <AvatarFallback className="bg-primary text-[10px] font-bold text-primary-foreground">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="max-w-[90px] truncate text-[12.5px] font-semibold leading-tight text-foreground xl:max-w-[140px]">
                      {identityLabel}
                    </p>
                    {roleLabel && (
                      <p className="flex max-w-[90px] items-center gap-1 truncate text-[10px] text-muted-foreground/60 xl:max-w-[140px]">
                        <BriefcaseBusiness className="h-2.5 w-2.5 shrink-0" />
                        {roleLabel}
                      </p>
                    )}
                  </div>
                </div>

                {/* Logout */}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={signOut}
                  className="h-8 rounded-lg px-2 text-[12px] text-muted-foreground/65 hover:bg-destructive/8 hover:text-destructive sm:px-3"
                >
                  <LogOut className="h-3.5 w-3.5 sm:me-1.5" />
                  <span className="hidden sm:inline">{t("auth.logout")}</span>
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </header>
  );
};
