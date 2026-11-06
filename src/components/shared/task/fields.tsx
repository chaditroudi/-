import { forwardRef, useId, type ReactNode } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

/** A titled group of related fields. When complete it can collapse to a one-line summary. */
export function FieldGroup({ title, description, complete, summary, children, className }: {
  title: string;
  description?: string;
  complete?: boolean;
  /** Shown beside the title once the group is complete, e.g. "Net 1 180 kg". */
  summary?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const id = useId();
  return (
    <fieldset aria-labelledby={id} className={cn('space-y-3 rounded-xl border bg-secondary/60 p-4', className)}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <legend id={id} className="flex items-center gap-2 font-display text-lg font-semibold">
          {complete && <CheckCircle2 className="h-5 w-5 text-primary" aria-hidden />}
          {title}
        </legend>
        {summary && <span className="ms-auto text-sm font-medium text-muted-foreground">{summary}</span>}
      </div>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
      {children}
    </fieldset>
  );
}

/** A number typed on a tablet: big, decimal keypad, unit beside the value, error in words. */
export const NumericField = forwardRef<HTMLInputElement, {
  label: string;
  value: string;
  onChange: (value: string) => void;
  unit?: string;
  required?: boolean;
  hint?: string;
  error?: string;
  size?: 'default' | 'measure';
  disabled?: boolean;
  id?: string;
  min?: number;
  max?: number;
}>(({ label, value, onChange, unit, required, hint, error, size = 'default', disabled, id, min, max }, ref) => {
  const generated = useId();
  const inputId = id ?? generated;
  const describedBy = [hint && `${inputId}-hint`, error && `${inputId}-error`].filter(Boolean).join(' ') || undefined;
  return (
    <div className="space-y-1.5">
      <label htmlFor={inputId} className="text-sm font-medium">
        {label}{required && <span className="text-red-700" aria-hidden> *</span>}
      </label>
      <div className={cn('flex items-center rounded-md border border-input bg-card focus-within:ring-2 focus-within:ring-ring',
        error && 'border-red-500', disabled && 'opacity-60')}>
        <input
          ref={ref}
          id={inputId}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          dir="ltr"
          value={value}
          disabled={disabled}
          required={required}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          aria-valuemin={min}
          aria-valuemax={max}
          onChange={(event) => onChange(event.target.value.replace(',', '.'))}
          className={cn('min-w-0 flex-1 bg-transparent px-3 tabular-nums outline-none',
            size === 'measure' ? 'h-16 text-3xl font-semibold' : 'h-11 text-lg')}
        />
        {unit && <span className={cn('pe-3 font-medium text-muted-foreground', size === 'measure' ? 'text-xl' : 'text-base')}>{unit}</span>}
      </div>
      {hint && !error && <p id={`${inputId}-hint`} className="text-sm text-muted-foreground">{hint}</p>}
      {error && <p id={`${inputId}-error`} className="text-sm font-medium text-red-700">{error}</p>}
    </div>
  );
});
NumericField.displayName = 'NumericField';

/** What will be saved, read back before confirming. Values come from the form, never examples. */
export function ReviewList({ items, className }: {
  items: Array<{ label: string; value: ReactNode; wide?: boolean; emphasis?: boolean }>;
  className?: string;
}) {
  const { t } = useTranslation();
  return (
    <dl className={cn('grid gap-3 sm:grid-cols-2', className)}>
      {items.map((item) => (
        <div key={item.label} className={cn('rounded-xl border bg-secondary/60 px-4 py-3', item.wide && 'sm:col-span-2')}>
          <dt className="text-sm text-muted-foreground">{item.label}</dt>
          <dd className={cn('mt-0.5 font-semibold', item.emphasis ? 'text-2xl tabular-nums' : 'text-base')}>
            {item.value === undefined || item.value === null || item.value === '' ? <span className="font-normal text-muted-foreground">{t('task.notProvided')}</span> : item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
