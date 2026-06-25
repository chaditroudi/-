import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ModuleHeroStat {
  label: string;
  value: string | number;
}

interface ModuleHeroAction {
  label: string;
  onClick?: () => void;
  icon?: ReactNode;
  variant?: "default" | "secondary" | "outline";
}

interface ModuleHeroProps {
  kicker?: string;
  title: string;
  description: string;
  stats?: ModuleHeroStat[];
  primaryAction?: ModuleHeroAction;
  secondaryAction?: ModuleHeroAction;
  className?: string;
}

export const ModuleHero = ({
  kicker,
  title,
  description,
  stats = [],
  primaryAction,
  secondaryAction,
  className,
}: ModuleHeroProps) => {
  return (
    <section className={cn("hero-panel mesh-overlay overflow-hidden rounded-[32px] px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8", className)}>
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl animate-slide-down" style={{ animationDelay: "0ms", animationFillMode: "both" }}>
          {kicker && (
            <p className="section-kicker text-white/60 animate-fade-in" style={{ animationDelay: "60ms", animationFillMode: "both" }}>
              {kicker}
            </p>
          )}
          <h1 className="mt-2 text-2xl font-semibold text-white sm:text-4xl">{title}</h1>
          <p className="mt-3 max-w-2xl text-sm text-white/75 sm:text-base leading-relaxed">{description}</p>
        </div>

        <div className="flex w-full flex-col items-stretch gap-3 animate-slide-up lg:w-auto lg:items-end" style={{ animationDelay: "80ms", animationFillMode: "both" }}>
          {(primaryAction || secondaryAction) && (
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap lg:justify-end">
              {secondaryAction && (
                <Button
                  variant={secondaryAction.variant || "secondary"}
                  onClick={secondaryAction.onClick}
                  className="h-11 w-full rounded-2xl border-white/10 bg-white/12 px-4 text-white transition-all duration-200 hover:bg-white/20 active:scale-95 sm:w-auto"
                >
                  {secondaryAction.icon}
                  {secondaryAction.label}
                </Button>
              )}
              {primaryAction && (
                <Button
                  variant={primaryAction.variant || "default"}
                  onClick={primaryAction.onClick}
                  className="h-12 w-full rounded-2xl bg-white px-5 text-emerald-950 shadow-xl transition-all duration-200 hover:bg-white/95 hover:shadow-2xl active:scale-95 sm:w-auto"
                >
                  {primaryAction.icon}
                  {primaryAction.label}
                </Button>
              )}
            </div>
          )}

          {stats.length > 0 && (
            <div className="grid w-full grid-cols-2 gap-3 stagger-fast sm:flex sm:flex-wrap lg:w-auto lg:justify-end">
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-white backdrop-blur-sm transition-all duration-200 hover:bg-white/15"
                >
                  <p className="text-[11px] uppercase tracking-[0.24em] text-white/60">{stat.label}</p>
                  <p className="mt-1 text-2xl font-semibold">{stat.value}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
