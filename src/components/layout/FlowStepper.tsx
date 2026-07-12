import { useEffect, useRef } from "react";
import {
  Truck,
  Warehouse,
  Factory,
  PackageCheck,
  Ship,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AppTab } from "@/lib/roleAccess";

/**
 * Chaîne physique du flux usine. Chaque étape regroupe les onglets qui la
 * composent — l'étape est active dès que l'onglet courant lui appartient.
 */
interface FlowStep {
  key: string;
  label: string;
  hint: string;
  icon: LucideIcon;
  /** Onglet ouvert au clic sur l'étape */
  targetTab: AppTab;
  /** Tous les onglets appartenant à cette étape */
  tabs: AppTab[];
}

const FLOW_STEPS: FlowStep[] = [
  {
    key: "reception",
    label: "Réception & QC",
    hint: "Pesée, lots d'entrée, contrôle qualité entrant, documents fournisseur",
    icon: Truck,
    targetTab: "receptions",
    tabs: ["receptions"],
  },
  {
    key: "stockage",
    label: "Stockage",
    hint: "Zones, lots entrepôt et mouvements",
    icon: Warehouse,
    targetTab: "storage",
    tabs: ["storage", "stock-dashboard", "stock-lots", "stock-products", "stock-movements"],
  },
  {
    key: "production",
    label: "Production",
    hint: "Fumigation, nettoyage, triage et ordres de fabrication",
    icon: Factory,
    targetTab: "production",
    tabs: ["production"],
  },
  {
    key: "conditionnement",
    label: "Conditionnement",
    hint: "BOM, étiquettes et palettes",
    icon: PackageCheck,
    targetTab: "packaging",
    tabs: ["packaging"],
  },
  {
    key: "expedition",
    label: "Expédition",
    hint: "Logistique, contrats export et COA",
    icon: Ship,
    targetTab: "logistics",
    tabs: ["logistics", "export"],
  },
];

interface FlowStepperProps {
  activeTab: AppTab;
  accessibleTabs: AppTab[];
  onNavigate: (tab: AppTab) => void;
}

/**
 * Fil d'Ariane du flux usine — affiché sur tous les onglets appartenant au
 * flux physique. Montre où l'utilisateur se trouve dans la chaîne
 * Réception → Expédition, et permet de sauter à l'étape précédente/suivante.
 */
export function FlowStepper({ activeTab, accessibleTabs, onNavigate }: FlowStepperProps) {
  const currentIdx = FLOW_STEPS.findIndex((s) => s.tabs.includes(activeTab));
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (currentIdx < 0) return;
    const child = scrollerRef.current?.children[currentIdx] as HTMLElement | undefined;
    child?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [currentIdx]);

  // Onglet hors flux physique (accueil, RH, paramètres…) → rien à afficher.
  if (currentIdx < 0) return null;

  const nextStep = FLOW_STEPS.slice(currentIdx + 1).find((s) => accessibleTabs.includes(s.targetTab));

  return (
    <nav
      aria-label="Flux usine"
      className="flex items-center gap-3 rounded-2xl border border-border/50 bg-card/70 px-2.5 py-2 backdrop-blur-sm"
    >
      <div
        ref={scrollerRef}
        className="flex flex-1 items-center gap-0.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {FLOW_STEPS.map((step, i) => {
          const isCurrent = i === currentIdx;
          const isDone = i < currentIdx;
          const isAllowed = accessibleTabs.includes(step.targetTab);

          return (
            <div key={step.key} className="flex shrink-0 items-center">
              {i > 0 && (
                <ChevronRight
                  className={cn(
                    "mx-0.5 h-3.5 w-3.5 shrink-0",
                    isDone || isCurrent ? "text-primary/45" : "text-border",
                  )}
                />
              )}
              <button
                type="button"
                disabled={!isAllowed}
                onClick={() => !isCurrent && isAllowed && onNavigate(step.targetTab)}
                title={step.hint}
                aria-current={isCurrent ? "step" : undefined}
                className={cn(
                  "flex min-h-[40px] items-center gap-2 rounded-xl border px-2.5 py-1.5 text-sm font-medium transition-colors",
                  isCurrent
                    ? "border-primary/35 bg-primary/10 text-primary shadow-sm"
                    : isDone
                      ? "border-transparent text-foreground/70 hover:border-primary/20 hover:bg-primary/5"
                      : "border-transparent text-muted-foreground/60 hover:border-border hover:bg-muted/40 hover:text-foreground",
                  !isAllowed && "cursor-not-allowed opacity-40 hover:border-transparent hover:bg-transparent",
                )}
              >
                <span
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                    isCurrent
                      ? "bg-primary text-primary-foreground"
                      : isDone
                        ? "bg-primary/15 text-primary"
                        : "bg-muted text-muted-foreground/70",
                  )}
                >
                  {i + 1}
                </span>
                <step.icon className="h-4 w-4 shrink-0" />
                <span className={cn("whitespace-nowrap", !isCurrent && "hidden sm:inline")}>
                  {step.label}
                </span>
              </button>
            </div>
          );
        })}
      </div>

      {nextStep && (
        <button
          type="button"
          onClick={() => onNavigate(nextStep.targetTab)}
          className="hidden shrink-0 items-center gap-1.5 rounded-xl border border-border/60 bg-background px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:border-primary/30 hover:text-primary lg:flex"
        >
          Étape suivante : {nextStep.label}
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      )}
    </nav>
  );
}
