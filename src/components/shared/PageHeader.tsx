import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  /** Prefer leaving the real page title in TopHeader; use this for in-module section context only. */
  title?: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}

/** Compact module toolbar under the shell title — not a second competing page title. */
export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  if (!title && !description && !actions) return null;

  return (
    <div className={cn('flex flex-wrap items-end justify-between gap-3', className)}>
      {(title || description) && (
        <div className="min-w-0 space-y-0.5">
          {title && <h2 className="font-display text-lg font-semibold leading-tight">{title}</h2>}
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
      )}
      {actions && <div className="flex flex-wrap items-center justify-end gap-2">{actions}</div>}
    </div>
  );
}
