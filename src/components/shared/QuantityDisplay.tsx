import { cn } from '@/lib/utils';

interface QuantityDisplayProps {
  value: number | null | undefined;
  unit?: string;
  digits?: number;
  className?: string;
  /** When true, unknown values render as an honest em dash instead of inventing zero. */
  unavailableLabel?: string;
}

/** Factory-floor quantity: tabular, unit visible, never a fake zero. */
export function QuantityDisplay({
  value,
  unit = 'kg',
  digits = 0,
  className,
  unavailableLabel = '—',
}: QuantityDisplayProps) {
  if (value == null || Number.isNaN(value)) {
    return (
      <span className={cn('tabular-nums text-muted-foreground', className)}>
        {unavailableLabel}
        {unit ? ` ${unit}` : ''}
      </span>
    );
  }

  const formatted = new Intl.NumberFormat('fr-TN', {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  }).format(value);

  return (
    <span className={cn('tabular-nums font-semibold', className)}>
      {formatted}
      {unit ? <span className="ms-1 font-medium text-muted-foreground">{unit}</span> : null}
    </span>
  );
}
