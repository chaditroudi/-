import { cn } from '@/lib/utils';

interface LotReferenceProps {
  value?: string | null;
  /** Prefer the human reception/lot code over raw Mongo ids. */
  fallback?: string;
  className?: string;
  dir?: 'ltr' | 'rtl' | 'auto';
}

/** Lot / reception codes stay LTR for scan/QR readability even in Arabic UI. */
export function LotReference({
  value,
  fallback = 'Lot sans numéro',
  className,
  dir = 'ltr',
}: LotReferenceProps) {
  const label = value?.trim() || fallback;
  const isRawId = Boolean(value && /^[a-f0-9]{24}$/i.test(value));

  return (
    <span
      dir={dir}
      title={isRawId ? 'Identifiant technique — le numéro métier n’est pas encore disponible' : undefined}
      className={cn(
        'font-mono text-sm',
        isRawId || !value ? 'text-muted-foreground' : 'text-foreground',
        className,
      )}
    >
      {isRawId ? value!.slice(-8).toUpperCase() : label}
    </span>
  );
}
