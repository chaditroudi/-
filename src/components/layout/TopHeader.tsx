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
    <header className="sticky top-0 z-40 flex min-h-12 flex-wrap items-center gap-2 border-b border-border/50 bg-background/96 px-3 py-1.5 backdrop-blur-md shadow-[0_1px_0_0_hsl(var(--border)/0.6),0_4px_20px_-4px_hsl(var(--foreground)/0.07)] sm:min-h-[52px] sm:flex-nowrap sm:px-4 sm:py-0 lg:px-5">

      {/* Sidebar toggle */}
      <SidebarTrigger className="h-8 w-8 shrink-0 rounded-lg text-muted-foreground/70 transition-all duration-150 hover:bg-muted hover:text-foreground" />

      <Separator orientation="vertical" className="hidden h-4 bg-border/50 sm:block" />

      {/* Brand pill */}
      <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-card/70 px-2 py-1.5 shadow-sm backdrop-blur-sm">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-primary/15 bg-background p-1 shadow-[0_0_10px_-2px_hsl(var(--primary)/0.25)]">
          <BrandLogo
            className="h-full w-full"
            imgClassName="h-full w-full object-contain"
            alt={companyName}
          />
        </div>
        <div className="min-w-0 hidden md:block">
          <p className="text-[11px] font-bold leading-tight text-foreground">{companyShortName}</p>
          <p className="max-w-[130px] truncate text-[10px] text-muted-foreground/70">{companyName}</p>
        </div>
      </div>

      {/* Page title + breadcrumb */}
      <div className="order-3 flex min-w-0 basis-full items-center gap-2.5 pb-1 sm:order-none sm:basis-auto sm:pb-0">
        <div className="min-w-0">
          {sectionLabel && (
            <p className="hidden truncate text-[9.5px] font-bold uppercase tracking-[0.2em] text-muted-foreground/45 sm:block">
              {sectionLabel}
            </p>
          )}
          <h2 className="truncate text-[14px] font-semibold leading-tight text-foreground/90 sm:text-[15px]">
            {pageTitle}
          </h2>
          {pageSubtitle && !sectionLabel && (
            <p className="hidden truncate text-[11px] text-muted-foreground/60 sm:block">
              {pageSubtitle}
            </p>
          )}
        </div>

        {/* Role badge */}
        {roleLabel && (
          <span className="hidden shrink-0 items-center gap-1.5 rounded-full border border-primary/20 bg-primary/8 px-2.5 py-0.5 text-[11px] font-semibold text-primary/80 lg:inline-flex">
            <ShieldCheck className="h-3 w-3" />
            {roleLabel}
          </span>
        )}
      </div>

      {/* Right actions */}
      <div className="ml-auto flex shrink-0 items-center gap-1.5">

        {/* Date chip */}
        <span className="hidden items-center gap-1.5 rounded-full border border-primary/15 bg-primary/7 px-2.5 py-1 text-[11px] font-semibold text-primary/75 sm:inline-flex">
          <CalendarDays className="h-3 w-3" />
          {todayLabel}
        </span>

        <Separator orientation="vertical" className="mx-0.5 h-4 bg-border/40 hidden sm:block" />

        {/* Utility actions grouped in a pill */}
        <div className="flex items-center gap-0.5 rounded-xl border border-border/50 bg-muted/40 p-0.5">
          {/* Audit log — admin only */}
          {isAdmin && (
            <Dialog open={auditOpen} onOpenChange={setAuditOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-lg text-muted-foreground/70 hover:bg-background hover:text-foreground hover:shadow-sm"
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

          {/* Refresh */}
          <Button
            variant="ghost"
            size="icon"
            onClick={async () => {
              setIsRefreshing(true);
              await onRefresh();
              setTimeout(() => setIsRefreshing(false), 600);
            }}
            className="h-7 w-7 rounded-lg text-muted-foreground/70 hover:bg-background hover:text-foreground hover:shadow-sm"
          >
            <RefreshCw
              className={cn(
                "h-3.5 w-3.5 transition-transform duration-500",
                isRefreshing && "animate-spin",
              )}
            />
          </Button>
        </div>

        <Separator orientation="vertical" className="mx-0.5 hidden h-4 bg-border/40 sm:block" />

        {/* Auth zone */}
        {!authLoading && (
          <>
            {!user ? (
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate("/auth")}
                  className="h-8 px-2 text-muted-foreground/80 hover:text-foreground sm:px-3"
                >
                  <LogIn className="h-3.5 w-3.5 sm:me-1.5" />
                  <span className="hidden sm:inline text-[12px]">{t("auth.connection")}</span>
                </Button>
                <Button
                  size="sm"
                  onClick={() => navigate("/dashboard")}
                  className="h-8 px-2 text-[12px] sm:px-3"
                >
                  <Users className="h-3.5 w-3.5 sm:me-1.5" />
                  <span className="hidden sm:inline">{t("auth.employeeSpace")}</span>
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                {/* Avatar + name — desktop */}
                <div className="hidden items-center gap-2 lg:flex">
                  <Avatar className="h-7 w-7 border border-border/70 shadow-sm">
                    <AvatarImage src={profile?.avatar_url || undefined} alt={identityLabel} />
                    <AvatarFallback className="bg-primary text-[10px] font-bold text-primary-foreground">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="max-w-[80px] truncate text-[12.5px] font-semibold leading-tight text-foreground xl:max-w-[130px]">
                      {identityLabel}
                    </p>
                    {roleLabel && (
                      <p className="flex max-w-[80px] items-center gap-1 truncate text-[10px] text-muted-foreground/70 xl:max-w-[130px]">
                        <BriefcaseBusiness className="h-3 w-3 shrink-0" />
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
                  className="h-8 rounded-lg px-2 text-muted-foreground/70 transition-all hover:bg-destructive/8 hover:text-destructive sm:px-3"
                >
                  <LogOut className="h-3.5 w-3.5 sm:me-1.5" />
                  <span className="hidden sm:inline text-[12px]">{t("auth.logout")}</span>
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </header>
  );
};
