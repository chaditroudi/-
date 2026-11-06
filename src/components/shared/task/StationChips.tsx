import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface Station {
  id: string;
  label: string;
  icon: ReactNode;
  /** Items waiting at this station, when known. Undefined means unknown, never zero. */
  count?: number;
}

/** The stations a person may open, from their real role tabs. Scrolls sideways on a phone. */
export function StationChips({ stations, activeId, onSelect, label, className }: {
  stations: Station[];
  activeId?: string;
  onSelect: (id: string) => void;
  label: string;
  className?: string;
}) {
  if (stations.length === 0) return null;
  return (
    <nav aria-label={label} className={cn('-mx-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0', className)}>
      <ul className="flex gap-3">
        {stations.map((station) => {
          const active = station.id === activeId;
          return (
            <li key={station.id} className="shrink-0">
              <button
                type="button"
                onClick={() => onSelect(station.id)}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative flex h-[5.5rem] w-28 flex-col items-center justify-center gap-2 rounded-xl border bg-card px-2 text-center text-sm font-semibold shadow-sm transition-colors',
                  'hover:border-primary/40 hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  active && 'border-primary/50 bg-accent text-accent-foreground',
                )}
              >
                <span className="text-primary [&_svg]:h-6 [&_svg]:w-6" aria-hidden>{station.icon}</span>
                <span className="line-clamp-2 leading-tight">{station.label}</span>
                {station.count !== undefined && station.count > 0 && (
                  <span className="absolute end-1.5 top-1.5 min-w-6 rounded-full bg-primary px-1.5 text-xs font-semibold leading-6 text-primary-foreground">{station.count}</span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
