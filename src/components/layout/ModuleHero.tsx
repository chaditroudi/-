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
  description?: string;
  stats?: ModuleHeroStat[];
  primaryAction?: ModuleHeroAction;
  secondaryAction?: ModuleHeroAction;
  className?: string;
}

export const ModuleHero = ({
  kicker,
  title,
  primaryAction,
  secondaryAction,
  className,
  // description and stats are accepted but no longer rendered —
  // they added visual noise without helping users act faster.
}: ModuleHeroProps) => {
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-3 border-b border-border/50 pb-4", className)}>
      <div className="min-w-0">
        {kicker && (
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">
            {kicker}
          </p>
        )}
        <h1 className="mt-0.5 text-xl font-semibold leading-tight text-foreground">{title}</h1>
      </div>

      {(primaryAction || secondaryAction) && (
        <div className="flex shrink-0 items-center gap-2">
          {secondaryAction && (
            <Button
              variant={secondaryAction.variant ?? "outline"}
              onClick={secondaryAction.onClick}
              className="h-9 gap-1.5 rounded-xl"
            >
              {secondaryAction.icon}
              {secondaryAction.label}
            </Button>
          )}
          {primaryAction && (
            <Button
              variant={primaryAction.variant ?? "default"}
              onClick={primaryAction.onClick}
              className="h-9 gap-1.5 rounded-xl"
            >
              {primaryAction.icon}
              {primaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
};
