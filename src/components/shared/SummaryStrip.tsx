import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface SummaryStripItem {
  label: string;
  value: ReactNode;
  helper?: ReactNode;
  tone?: 'default' | 'good' | 'watch' | 'bad';
}

const COLUMNS: Record<number, string> = {
  2: 'sm:grid-cols-2',
  3: 'sm:grid-cols-3 max-sm:[&>*:last-child]:col-span-2',
  4: 'sm:grid-cols-4',
  5: 'md:grid-cols-5 max-md:[&>*:last-child]:col-span-2',
  6: 'sm:grid-cols-3 lg:grid-cols-6',
};

/** The figures of a screen, read as one line above its work list. */
export function SummaryStrip({ items, className }: { items: SummaryStripItem[]; className?: string }) {
  return (
    <dl className={cn('grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border', COLUMNS[items.length], className)}>
      {items.map((item) => (
        <div key={item.label} className="min-w-0 bg-card px-3 py-2">
          <dt className="text-xs text-muted-foreground">{item.label}</dt>
          <dd
            className={cn(
              'truncate font-display text-xl font-semibold',
              item.tone === 'good' && 'text-emerald-800',
              item.tone === 'watch' && 'text-amber-800',
              item.tone === 'bad' && 'text-red-700',
            )}
          >
            {item.value}
          </dd>
          {item.helper && <dd className="truncate text-xs text-muted-foreground">{item.helper}</dd>}
        </div>
      ))}
    </dl>
  );
}
