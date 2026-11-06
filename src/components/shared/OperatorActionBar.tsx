import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export interface OperatorAction {
  id: string;
  label: string;
  onClick: () => void;
  variant?: 'default' | 'secondary' | 'outline' | 'destructive';
  disabled?: boolean;
  loading?: boolean;
  icon?: ReactNode;
}

interface OperatorActionBarProps {
  primary: OperatorAction;
  secondary?: OperatorAction;
  helper?: ReactNode;
  className?: string;
  /** Sticky bar for tablet/phone intake and QC confirmation. */
  sticky?: boolean;
}

/**
 * One obvious next step for factory workers.
 * Primary is always full-width on phone; secondary stays quiet.
 */
export function OperatorActionBar({
  primary,
  secondary,
  helper,
  className,
  sticky = true,
}: OperatorActionBarProps) {
  return (
    <div
      className={cn(
        'border-t bg-card px-3 py-3',
        sticky && 'above-dock sticky z-30 pb-[env(safe-area-inset-bottom)]',
        className,
      )}
    >
      {helper && <p className="mb-2 text-sm text-muted-foreground">{helper}</p>}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {secondary && (
          <Button
            type="button"
            variant={secondary.variant ?? 'outline'}
            disabled={secondary.disabled || secondary.loading}
            onClick={secondary.onClick}
            className="min-h-12 w-full sm:w-auto"
          >
            {secondary.icon}
            {secondary.label}
          </Button>
        )}
        <Button
          type="button"
          variant={primary.variant ?? 'default'}
          disabled={primary.disabled || primary.loading}
          onClick={primary.onClick}
          className="min-h-12 w-full gap-2 text-base font-semibold sm:min-w-[12rem]"
        >
          {primary.icon}
          {primary.loading ? 'Enregistrement…' : primary.label}
        </Button>
      </div>
    </div>
  );
}
