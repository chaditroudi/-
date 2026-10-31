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

export const ModuleHero = ({ primaryAction, secondaryAction, className }: ModuleHeroProps) => {
  if (!primaryAction && !secondaryAction) return null;
  return (
    <div className={cn("flex flex-wrap items-center justify-end gap-2", className)}>
      {secondaryAction && (
        <Button variant={secondaryAction.variant ?? "outline"} onClick={secondaryAction.onClick} className="gap-1.5">
          {secondaryAction.icon}
          {secondaryAction.label}
        </Button>
      )}
      {primaryAction && (
        <Button variant={primaryAction.variant ?? "default"} onClick={primaryAction.onClick} className="gap-1.5">
          {primaryAction.icon}
          {primaryAction.label}
        </Button>
      )}
    </div>
  );
};
