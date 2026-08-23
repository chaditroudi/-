import * as React from 'react';
import { cn } from '@/lib/utils';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

/**
 * DetailDrawer — the shared master-detail drawer primitive (UX Phase 0 · P0).
 *
 * A record's full detail slides in beside its list instead of navigating away,
 * so the operator keeps the list in context. Wraps the shadcn `Sheet` with a
 * consistent header (eyebrow / title / subtitle), a scrollable body, and a
 * pinned footer action bar. Presentation only — it owns no business logic.
 */

export interface DetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Small uppercase label above the title (e.g. record type). */
  eyebrow?: React.ReactNode;
  side?: 'right' | 'left';
  /** Tailwind width class for the panel; defaults to a comfortable reading width. */
  widthClassName?: string;
  /** Pinned action bar at the bottom. */
  footer?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

export function DetailDrawer({
  open,
  onOpenChange,
  title,
  subtitle,
  eyebrow,
  side = 'right',
  widthClassName = 'w-full sm:max-w-lg',
  footer,
  className,
  children,
}: DetailDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={side}
        className={cn('flex flex-col gap-0 p-0', widthClassName, className)}
      >
        <SheetHeader className="space-y-1 border-b border-border/60 px-6 py-4 text-left">
          {eyebrow && (
            <p className="section-kicker text-muted-foreground">{eyebrow}</p>
          )}
          <SheetTitle className="text-lg leading-tight">{title}</SheetTitle>
          {subtitle ? (
            <SheetDescription className="text-sm">{subtitle}</SheetDescription>
          ) : (
            // Keep the dialog described for assistive tech even without a subtitle.
            <SheetDescription className="sr-only">Détail</SheetDescription>
          )}
        </SheetHeader>

        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">{children}</div>

        {footer && (
          <SheetFooter className="border-t border-border/60 px-6 py-4">
            {footer}
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}

export interface DetailSectionProps {
  title?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

/** A titled block of detail rows. */
export function DetailSection({ title, className, children }: DetailSectionProps) {
  return (
    <section className={cn('space-y-3', className)}>
      {title && <h3 className="section-kicker text-muted-foreground">{title}</h3>}
      <div className="space-y-2.5">{children}</div>
    </section>
  );
}

export interface DetailFieldProps {
  label: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

/** A single label / value row inside a DetailSection. */
export function DetailField({ label, children, className }: DetailFieldProps) {
  return (
    <div className={cn('flex items-baseline justify-between gap-4', className)}>
      <dt className="shrink-0 text-sm text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right text-sm font-medium text-foreground">{children}</dd>
    </div>
  );
}

export default DetailDrawer;
