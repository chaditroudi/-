import { useEffect, useMemo, useState } from "react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { APP_TAB_META } from "@/lib/appTabs";
import type { AppTab } from "@/lib/roleAccess";
import type { AppNavigateFn } from "@/lib/appNavigate";
import { QrCode, ArrowRightLeft, ShoppingCart, Truck } from "lucide-react";

interface CommandMenuProps {
  accessibleTabs: AppTab[];
  onNavigate: AppNavigateFn;
}

type QuickAction = {
  id: string;
  label: string;
  icon: typeof QrCode;
  tab: AppTab;
  run: (nav: AppNavigateFn) => void;
};

// High-frequency shop-floor jobs, phrased as tasks ("what am I trying to do")
// rather than modules. Each is gated by tab access below.
const QUICK_ACTIONS: QuickAction[] = [
  { id: "scan",   label: "Scanner un lot",     icon: QrCode,         tab: "scan",       run: (nav) => nav("scan") },
  { id: "move",   label: "Déplacer un lot",    icon: ArrowRightLeft, tab: "storage",    run: (nav) => nav("storage") },
  { id: "buy",    label: "Demander un achat",  icon: ShoppingCart,   tab: "purchasing", run: (nav) => nav("purchasing") },
  { id: "recept", label: "Nouvelle réception", icon: Truck,          tab: "receptions", run: (nav) => nav("receptions") },
];

/**
 * Global command palette (⌘K / Ctrl+K) — jump to any accessible screen or start
 * a high-frequency job without hunting the sidebar. Navigation only; it never
 * exposes a destination the current role cannot already open.
 */
export function CommandMenu({ accessibleTabs, onNavigate }: CommandMenuProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const navItems = useMemo(
    () =>
      accessibleTabs
        .filter((tab) => APP_TAB_META[tab])
        .map((tab) => ({ tab, meta: APP_TAB_META[tab] })),
    [accessibleTabs],
  );

  const quickItems = useMemo(
    () => QUICK_ACTIONS.filter((a) => accessibleTabs.includes(a.tab)),
    [accessibleTabs],
  );

  const go = (fn: () => void) => {
    setOpen(false);
    fn();
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Rechercher un écran ou une action…" />
      <CommandList>
        <CommandEmpty>Aucun résultat.</CommandEmpty>

        {quickItems.length > 0 && (
          <>
            <CommandGroup heading="Actions rapides">
              {quickItems.map((a) => {
                const Icon = a.icon;
                return (
                  <CommandItem
                    key={a.id}
                    value={`action ${a.label}`}
                    onSelect={() => go(() => a.run(onNavigate))}
                  >
                    <Icon className="mr-2 h-4 w-4 text-muted-foreground" />
                    {a.label}
                  </CommandItem>
                );
              })}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        <CommandGroup heading="Naviguer">
          {navItems.map(({ tab, meta }) => {
            const Icon = meta.icon;
            return (
              <CommandItem
                key={tab}
                value={`nav ${meta.label} ${meta.shortLabel}`}
                onSelect={() => go(() => onNavigate(tab))}
              >
                <Icon className="mr-2 h-4 w-4 text-muted-foreground" />
                {meta.label}
              </CommandItem>
            );
          })}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
