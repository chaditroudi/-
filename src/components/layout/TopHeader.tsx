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
    <header className="sticky top-0 z-40 flex min-h-12 flex-wrap items-center gap-2 border-b border-border/60 bg-background/95 px-3 py-1.5 backdrop-blur-sm sm:min-h-14 sm:flex-nowrap sm:px-4 sm:py-0 lg:px-5">

      {/* Sidebar toggle — h-9 w-9 for ≥44px touch area with p-0.5 */}
      <SidebarTrigger className="h-9 w-9 shrink-0 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground" />

      <Separator orientation="vertical" className="hidden h-5 bg-border/60 sm:block" />

      <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-card/60 px-2 py-1.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-background p-1.5">
          <BrandLogo className="h-full w-full" imgClassName="h-full w-full object-contain" alt={companyName} />
        </div>
        <div className="min-w-0 hidden md:block">
          <p className="text-[11px] font-semibold leading-tight text-foreground">{companyShortName}</p>
          <p className="max-w-[140px] truncate text-[10px] text-muted-foreground">{companyName}</p>
        </div>
      </div>

      {/* Page title + section breadcrumb */}
      <div className="order-3 flex min-w-0 basis-full items-center gap-2 pb-1 sm:order-none sm:basis-auto sm:pb-0">
        <div className="min-w-0">
          {sectionLabel && (
            <p className="hidden truncate text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/50 sm:block">
              {sectionLabel}
            </p>
          )}
          <h2 className="truncate text-[15px] font-semibold leading-tight text-foreground">
            {pageTitle}
          </h2>
          {pageSubtitle && !sectionLabel && (
            <p className="hidden truncate text-[12px] text-muted-foreground/70 sm:block">
              {pageSubtitle}
            </p>
          )}
        </div>

        {/* Role badge — desktop only */}
        {roleLabel && (
          <span className="hidden shrink-0 items-center gap-1 rounded-full border border-border/70 bg-card px-2 py-0.5 text-[11px] font-semibold text-muted-foreground lg:inline-flex">
            <ShieldCheck className="h-3 w-3 text-primary" />
            {roleLabel}
          </span>
        )}
      </div>

      {/* Right actions */}
      <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-1.5">

        {/* Date badge */}
        <span className="hidden items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold text-secondary-foreground sm:inline-flex">
          <CalendarDays className="h-3 w-3" />
          {todayLabel}
        </span>

        <Separator orientation="vertical" className="mx-1 h-5 bg-border/50 sm:block hidden" />

        {/* Audit log — admin only */}
        {isAdmin && (
          <Dialog open={auditOpen} onOpenChange={setAuditOpen}>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <History className="h-4 w-4" />
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
          className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <RefreshCw
            className={cn(
              "h-4 w-4 transition-transform duration-500",
              isRefreshing && "animate-spin",
            )}
          />
        </Button>

        <Separator orientation="vertical" className="mx-1 hidden h-5 bg-border/50 sm:block" />

        {/* Auth zone */}
        {!authLoading && (
          <>
            {!user ? (
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate("/auth")}
                  className="h-8 px-2 text-muted-foreground hover:text-foreground sm:px-3"
                >
                  <LogIn className="h-4 w-4 sm:me-1.5" />
                  <span className="hidden sm:inline text-[13px]">{t("auth.connection")}</span>
                </Button>
                <Button
                  size="sm"
                  onClick={() => navigate("/dashboard")}
                  className="h-8 px-2 sm:px-3"
                >
                  <Users className="h-4 w-4 sm:me-1.5" />
                  <span className="hidden sm:inline text-[13px]">{t("auth.employeeSpace")}</span>
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                {/* Avatar + name — desktop */}
                <div className="hidden items-center gap-2 lg:flex">
                  <Avatar className="h-8 w-8 border border-border/70">
                    <AvatarImage src={profile?.avatar_url || undefined} alt={identityLabel} />
                    <AvatarFallback className="bg-primary text-[11px] font-semibold text-primary-foreground">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="max-w-[80px] truncate text-[13px] font-semibold leading-tight text-foreground xl:max-w-[130px]">
                      {identityLabel}
                    </p>
                    {roleLabel && (
                      <p className="flex max-w-[80px] items-center gap-1 truncate text-[11px] text-muted-foreground xl:max-w-[130px]">
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
                  className="h-8 px-2 text-muted-foreground hover:text-destructive sm:px-3"
                >
                  <LogOut className="h-4 w-4 sm:me-1.5" />
                  <span className="hidden sm:inline text-[13px]">{t("auth.logout")}</span>
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </header>
  );
};
