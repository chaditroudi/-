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
  title?: string;
  description?: string;
  stats?: ModuleHeroStat[];
  primaryAction?: ModuleHeroAction;
  secondaryAction?: ModuleHeroAction;
  className?: string;
}

export const ModuleHero = ({
  kicker,
  title,
  description,
  stats,
  primaryAction,
  secondaryAction,
  className,
}: ModuleHeroProps) => {
  if (!kicker && !title && !description && !primaryAction && !secondaryAction && !stats?.length) return null;
  return (
    <section className={cn("flex flex-col gap-3 rounded-lg border bg-card p-4 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0 space-y-1">
        {kicker && <p className="text-xs font-medium text-muted-foreground">{kicker}</p>}
        {title && <h2 className="font-display text-xl font-semibold leading-tight">{title}</h2>}
        {description && <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>}
        {stats && stats.length > 0 && (
          <dl className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-sm">
            {stats.map((stat) => (
              <div key={stat.label} className="flex gap-1.5">
                <dt className="text-muted-foreground">{stat.label}</dt>
                <dd className="font-semibold tabular-nums">{stat.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
      {(primaryAction || secondaryAction) && (
        <div className="flex flex-wrap gap-2">
          {secondaryAction && (
            <Button variant={secondaryAction.variant ?? "outline"} onClick={secondaryAction.onClick} className="min-h-11 gap-1.5">
              {secondaryAction.icon}
              {secondaryAction.label}
            </Button>
          )}
          {primaryAction && (
            <Button variant={primaryAction.variant ?? "default"} onClick={primaryAction.onClick} className="min-h-11 gap-1.5">
              {primaryAction.icon}
              {primaryAction.label}
            </Button>
          )}
        </div>
      )}
    </section>
  );
};
