import { History, RefreshCw, Search } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
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
import { cn } from "@/lib/utils";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { AiGuide } from "@/components/ai-guide/AiGuide";
import { SidebarTrigger } from "@/components/ui/sidebar";

interface TopHeaderProps {
  onRefresh: () => void;
  pageTitle: string;
}

export const TopHeader = ({ onRefresh, pageTitle }: TopHeaderProps) => {
  const [auditOpen, setAuditOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { isAdmin } = useAuthContext();
  const { t } = useTranslation();

  const openSearch = () => window.dispatchEvent(new Event("open-command-menu"));

  return (
    <header className="sticky top-0 z-40 flex h-12 items-center gap-2 border-b bg-card px-2 pointer-coarse:h-14 sm:px-3">
      <SidebarTrigger className="h-9 w-9 shrink-0 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground" />

      <h1 className="min-w-0 flex-1 truncate font-display text-lg font-semibold">{pageTitle}</h1>

      <button
        type="button"
        onClick={openSearch}
        aria-label="Rechercher un écran ou un lot (Ctrl K)"
        className="hidden h-9 w-64 items-center gap-2 rounded-md border border-input bg-background px-2.5 text-sm text-muted-foreground hover:text-foreground md:flex"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="flex-1 truncate text-left">Rechercher</span>
        <kbd className="text-xs">Ctrl K</kbd>
      </button>
      <Button variant="ghost" size="icon" onClick={openSearch} aria-label="Rechercher" className="md:hidden">
        <Search className="h-5 w-5" />
      </Button>

      <div className="flex shrink-0 items-center">
        {isAdmin && (
          <Dialog open={auditOpen} onOpenChange={setAuditOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" title={t("header.auditLog")} aria-label={t("header.auditLog")} className="h-9 w-9 text-muted-foreground">
                <History className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[85vh] max-w-4xl overflow-hidden">
              <DialogHeader>
                <DialogTitle>{t("header.auditLog")}</DialogTitle>
              </DialogHeader>
              <div className="max-h-[calc(85vh-120px)] overflow-auto">
                <AuditLogPanel />
              </div>
            </DialogContent>
          </Dialog>
        )}
        <LanguageSwitcher />
        <AiGuide />
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
          aria-label="Actualiser"
          className="h-9 w-9 text-muted-foreground"
        >
          <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
        </Button>
      </div>
    </header>
  );
};
