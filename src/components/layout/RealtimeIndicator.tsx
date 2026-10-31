import { useSyncExternalStore } from 'react';

import { useOnline } from '@/hooks/useOnline';
import { describeRealtime, getRealtimeStatus, subscribeRealtimeStatus } from '@/lib/realtimeStatus';
import { cn } from '@/lib/utils';

/** The one place that says whether screens are being kept up to date. */
export const RealtimeIndicator = () => {
  const status = useSyncExternalStore(subscribeRealtimeStatus, getRealtimeStatus);
  const online = useOnline();
  const shown = describeRealtime(status, online);
  if (!shown) return null;

  return (
    <span role="status" data-testid="realtime-status" className="flex items-center gap-1.5 whitespace-nowrap px-2 text-xs font-medium text-muted-foreground">
      <span
        aria-hidden
        className={cn(
          'h-2 w-2 rounded-full',
          shown.tone === 'good' && 'bg-emerald-600',
          shown.tone === 'wait' && 'bg-amber-600',
          shown.tone === 'bad' && 'bg-red-600',
        )}
      />
      <span className="max-sm:sr-only">{shown.label}</span>
    </span>
  );
};
