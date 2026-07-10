import { ArrowRight, ChevronRight, Sparkles, Truck, ShieldCheck, Warehouse, FlaskConical, Package2, BoxIcon, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AppTab } from "@/lib/roleAccess";

interface StepDef {
  id: string;
  tab: string;
  label: string;
  sublabel: string;
  icon: React.ElementType;
  count: number;
  countSuffix: string;
  flow: string;
  palette: {
    bg: string;
    border: string;
    icon: string;
    badge: string;
    text: string;
  };
}

interface Props {
  metrics: {
    pendingReceptions: number;
    waitingQcReceptions: number;
    inQcReceptions: number;
    storedLots: number;
    quarantinedLots: number;
    phase2Active: number;
    phase2Waiting: number;
    activePackagingOrders: number;
    validatedPFLots: number;
    pendingShipments: number;
  };
  accessibleTabs: AppTab[];
  onNavigate: (tab: string) => void;
}

export function FactoryFlowPipeline({ metrics, accessibleTabs, onNavigate }: Props) {
  const {
    pendingReceptions,
    waitingQcReceptions,
    inQcReceptions,
    storedLots,
    quarantinedLots,
    phase2Active,
    phase2Waiting,
    activePackagingOrders,
    validatedPFLots,
    pendingShipments,
  } = metrics;

  const steps: StepDef[] = [
    {
      id: "receptions",
      tab: "receptions",
      label: "Réception",
      sublabel: "Arrivage matière",
      icon: Truck,
      count: pendingReceptions,
      countSuffix: "en cours",
      flow: "Lot reçu →",
      palette: {
        bg: "bg-amber-50",
        border: "border-amber-200",
        icon: "text-amber-600 bg-amber-100",
        badge: pendingReceptions > 0 ? "bg-amber-500 text-white" : "bg-amber-100 text-amber-700",
        text: "text-amber-800",
      },
    },
    {
      id: "qc",
      tab: "receptions",
      label: "QC & Libération",
      sublabel: "Contrôle qualité",
      icon: ShieldCheck,
      count: waitingQcReceptions + inQcReceptions,
      countSuffix: "à valider",
      flow: "Lot libéré →",
      palette: {
        bg: "bg-sky-50",
        border: "border-sky-200",
        icon: "text-sky-600 bg-sky-100",
        badge: (waitingQcReceptions + inQcReceptions) > 0 ? "bg-sky-500 text-white" : "bg-sky-100 text-sky-700",
        text: "text-sky-800",
      },
    },
    {
      id: "storage",
      tab: "storage",
      label: "Stock matière",
      sublabel: "Lots MP stockés",
      icon: Warehouse,
      count: storedLots + quarantinedLots,
      countSuffix: "lots",
      flow: "Vers Phase 2 →",
      palette: {
        bg: "bg-emerald-50",
        border: "border-emerald-200",
        icon: "text-emerald-600 bg-emerald-100",
        badge: "bg-emerald-100 text-emerald-700",
        text: "text-emerald-800",
      },
    },
    {
      id: "phase2",
      tab: "production",
      label: "Phase 2",
      sublabel: "Fum. · Net. · Hyd. · Triage",
      icon: FlaskConical,
      count: phase2Active + phase2Waiting,
      countSuffix: "lots actifs",
      flow: "Sublot conditionné →",
      palette: {
        bg: "bg-violet-50",
        border: "border-violet-200",
        icon: "text-violet-600 bg-violet-100",
        badge: (phase2Active + phase2Waiting) > 0 ? "bg-violet-500 text-white" : "bg-violet-100 text-violet-700",
        text: "text-violet-800",
      },
    },
    {
      id: "packaging",
      tab: "packaging",
      label: "Conditionnement",
      sublabel: "OF & palettes",
      icon: Package2,
      count: activePackagingOrders,
      countSuffix: "ordres actifs",
      flow: "Palette scellée →",
      palette: {
        bg: "bg-orange-50",
        border: "border-orange-200",
        icon: "text-orange-600 bg-orange-100",
        badge: activePackagingOrders > 0 ? "bg-orange-500 text-white" : "bg-orange-100 text-orange-700",
        text: "text-orange-800",
      },
    },
    {
      id: "stock-pf",
      tab: "stock-lots",
      label: "Stock PF",
      sublabel: "Produits finis validés",
      icon: BoxIcon,
      count: validatedPFLots,
      countSuffix: "palettes",
      flow: "Vers expédition →",
      palette: {
        bg: "bg-teal-50",
        border: "border-teal-200",
        icon: "text-teal-600 bg-teal-100",
        badge: validatedPFLots > 0 ? "bg-teal-500 text-white" : "bg-teal-100 text-teal-700",
        text: "text-teal-800",
      },
    },
    {
      id: "logistics",
      tab: "logistics",
      label: "Expédition",
      sublabel: "Sorties & shipments",
      icon: Send,
      count: pendingShipments,
      countSuffix: "expéditions",
      flow: "",
      palette: {
        bg: "bg-blue-50",
        border: "border-blue-200",
        icon: "text-blue-600 bg-blue-100",
        badge: pendingShipments > 0 ? "bg-blue-500 text-white" : "bg-blue-100 text-blue-700",
        text: "text-blue-800",
      },
    },
  ];

  const visibleSteps = steps.filter((s) => accessibleTabs.includes(s.tab as AppTab));
  const totalFlowItems = visibleSteps.reduce((sum, step) => sum + step.count, 0);
  const highlightedStep = [...visibleSteps].sort((left, right) => right.count - left.count)[0];

  return (
    <section className="surface-card overflow-hidden rounded-[30px] border-border/70 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.98),rgba(248,244,236,0.92)_38%,rgba(255,255,255,0.94)_100%)]">
      <div className="flex flex-col gap-4 border-b border-border/50 px-4 py-4 sm:px-5 sm:py-5 lg:flex-row lg:items-end lg:justify-between lg:px-6">
        <div className="max-w-2xl space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            Flux de travail
          </div>
          <div>
            <h2 className="text-2xl text-foreground">Du champ à l'expédition, sans perdre le fil</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Une vue continue de la matière première jusqu'au produit fini. Chaque étape est cliquable et garde le même sens de lecture.
            </p>
          </div>
        </div>

        <div className="grid w-full gap-3 sm:grid-cols-2 lg:w-auto lg:min-w-[360px]">
          <div className="rounded-2xl border border-primary/10 bg-white/80 px-4 py-3 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Charge globale</p>
            <p className="mt-1 text-3xl font-semibold text-foreground">{totalFlowItems}</p>
            <p className="mt-1 text-xs text-muted-foreground">éléments visibles dans le flux actuellement</p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-white/70 px-4 py-3 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Point chaud</p>
            <p className="mt-1 text-base font-semibold text-foreground">{highlightedStep?.label ?? "Aucun"}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {highlightedStep ? `${highlightedStep.count} ${highlightedStep.countSuffix}` : "Le flux est calme"}
            </p>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto scroll-smooth px-2 py-4 [scrollbar-width:none] sm:px-3 sm:py-5 lg:px-4 [&::-webkit-scrollbar]:hidden">
        <div className="flex items-stretch gap-0" style={{ minWidth: 'max-content' }}>
          {visibleSteps.map((step, idx) => {
            const Icon = step.icon;
            const isLast = idx === visibleSteps.length - 1;

            return (
              <div key={step.id} className="flex items-center gap-0">
                <button
                  type="button"
                  onClick={() => onNavigate(step.tab)}
                  className={cn(
                    "group relative flex w-[148px] shrink-0 flex-col gap-3 overflow-hidden rounded-[20px] border px-3 py-3.5 text-left sm:w-[170px] sm:rounded-[24px] sm:px-4 sm:py-4",
                    "transition-all duration-200 hover:-translate-y-1 hover:shadow-card-hover active:scale-[0.985]",
                    "before:absolute before:inset-x-0 before:top-0 before:h-1 before:rounded-t-[24px] before:bg-current before:opacity-20",
                    step.palette.bg,
                    step.palette.border,
                    step.palette.text,
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", step.palette.icon)}>
                      <Icon className="h-4.5 w-4.5" />
                    </div>
                    <span className="rounded-full bg-white/70 px-2 py-1 text-[11px] font-mono text-muted-foreground shadow-sm">
                      Etape {idx + 1}
                    </span>
                  </div>

                  <div>
                    <p className="text-sm font-semibold leading-tight">{step.label}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{step.sublabel}</p>
                  </div>

                  <div className="space-y-2">
                    <div className={cn("inline-flex items-baseline gap-1 self-start rounded-full px-2.5 py-1 text-xs font-semibold", step.palette.badge)}>
                      <span className="text-sm font-bold">{step.count}</span>
                      <span className="font-normal opacity-80">{step.countSuffix}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                      <span>{step.flow || "Fin du flux"}</span>
                      <span className="inline-flex items-center gap-1 text-primary">
                        Ouvrir
                        <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
                      </span>
                    </div>
                  </div>
                </button>

                {!isLast && (
                  <div className="mx-0.5 flex w-8 shrink-0 flex-col items-center justify-center sm:mx-1 sm:w-14">
                    <div className="flex items-center gap-0.5 sm:gap-1">
                      <div className="h-px w-5 bg-gradient-to-r from-border via-primary/25 to-border sm:w-9" />
                      <ChevronRight className="h-3.5 w-3.5 text-primary/45 sm:h-4 sm:w-4" />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col items-start gap-2 border-t border-border/50 bg-muted/20 px-4 py-3 text-xs text-muted-foreground sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4 sm:gap-y-2 sm:px-5 lg:px-6">
        <span className="font-semibold text-foreground">Lecture rapide :</span>
        <span>
          Réception → QC → Stock matière → Phase 2 → Conditionnement → Stock PF → Expédition
        </span>
        <span className="rounded-full bg-white/70 px-3 py-1 text-[11px] font-medium shadow-sm sm:ml-auto">
          Cliquer sur une étape pour ouvrir le module associé
        </span>
      </div>
    </section>
  );
}
