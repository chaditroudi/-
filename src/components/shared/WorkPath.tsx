import { Check } from 'lucide-react';

import { cn } from '@/lib/utils';

export type WorkStepState = 'done' | 'current' | 'blocked' | 'upcoming';

export type WorkStep = {
  label: string;
  state: WorkStepState;
};

/** Shows the employee's real position in a process. Callers must pass states from domain data. */
export function WorkPath({
  label = 'Parcours',
  steps,
  now,
}: {
  label?: string;
  steps: WorkStep[];
  now?: string;
}) {
  return (
    <section aria-label={label} className="rounded-lg border bg-card px-3 py-3">
      <ol className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4 sm:gap-y-2">
        {steps.map((step, index) => (
          <li key={`${step.label}-${index}`} className="flex items-center gap-2 text-sm">
            <span
              className={cn(
                'flex h-7 min-w-7 items-center justify-center rounded-full px-1 text-xs font-semibold',
                step.state === 'done' && 'bg-primary text-primary-foreground',
                step.state === 'current' && 'bg-primary text-primary-foreground',
                step.state === 'blocked' && 'bg-destructive/15 text-destructive',
                step.state === 'upcoming' && 'bg-muted text-muted-foreground',
              )}
            >
              {step.state === 'done' ? <Check className="h-3.5 w-3.5" aria-hidden /> : index + 1}
            </span>
            <span
              className={cn(
                step.state === 'current' && 'font-semibold text-foreground',
                step.state === 'blocked' && 'font-medium text-destructive',
                step.state === 'upcoming' && 'text-muted-foreground',
              )}
            >
              {step.label}
            </span>
          </li>
        ))}
      </ol>
      {now ? <p className="mt-2 text-sm text-foreground">{now}</p> : null}
    </section>
  );
}
