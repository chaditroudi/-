import { ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';

/** One figure for a supervisor or owner. It always says where it comes from; an unknown value is never zero. */
export function ManagerKpi({ label, value, unit, digits = 0, source, period, onOpen, tone = 'default', className }: {
  label: string;
  /** null or undefined = not measured. */
  value: number | null | undefined;
  unit?: string;
  digits?: number;
  source: string;
  period?: string;
  onOpen?: () => void;
  tone?: 'default' | 'attention';
  className?: string;
}) {
  const { t } = useTranslation();
  const measured = typeof value === 'number' && Number.isFinite(value);
  const body = (
    <>
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className={cn('mt-2 font-display font-semibold tabular-nums', measured ? 'text-4xl' : 'text-xl text-muted-foreground')}>
        {measured ? formatNumber(value, digits) : t('task.notMeasured')}
        {measured && unit && <span className="ms-1.5 text-base font-medium text-muted-foreground">{unit}</span>}
      </p>
      <p className="mt-2 text-xs text-muted-foreground">{t('task.source')}: {source}{period ? ` · ${period}` : ''}</p>
    </>
  );
  const classes = cn('relative block w-full rounded-2xl border bg-card p-5 text-start shadow-sm',
    tone === 'attention' && measured && value > 0 && 'border-sand-foreground/30 bg-sand/40', className);
  if (!onOpen) return <div className={classes}>{body}</div>;
  return (
    <button type="button" onClick={onOpen} className={cn(classes, 'transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring')}>
      {body}
      <ChevronRight className="absolute end-4 top-5 h-5 w-5 text-muted-foreground" aria-hidden />
    </button>
  );
}
