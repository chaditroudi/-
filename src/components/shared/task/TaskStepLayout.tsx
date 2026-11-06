import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

export type StepState = 'done' | 'current' | 'todo' | 'blocked';
export interface TaskStep { id: string; label: string; state: StepState }

/** A task done in steps. Progress comes from the caller's real state, never from a static caption.
 * `actions` sits in a bar that stays visible at the bottom on tablets and phones. */
export function TaskStepLayout({ eyebrow, title, description, steps, onStepSelect, children, actions, aside, className }: {
  eyebrow?: ReactNode;
  title: string;
  description?: string;
  steps?: TaskStep[];
  /** Lets a person go back to a finished step. Unfinished steps are not jumpable. */
  onStepSelect?: (id: string) => void;
  children: ReactNode;
  actions?: ReactNode;
  /** Side panel on wide screens (what is missing, who decides); stacks below the form elsewhere. */
  aside?: ReactNode;
  className?: string;
}) {
  const { t } = useTranslation();
  const currentIndex = steps ? Math.max(0, steps.findIndex((s) => s.state === 'current')) : 0;

  return (
    <section className={cn('mx-auto flex w-full max-w-5xl flex-col gap-4', className)}>
      {steps && steps.length > 1 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">
            {t('task.stepOf', { current: currentIndex + 1, total: steps.length })} · {steps[currentIndex]?.label}
          </p>
          <ol className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
            {steps.map((step) => {
              const jumpable = step.state === 'done' && onStepSelect;
              return (
                <li key={step.id}>
                  <button
                    type="button"
                    disabled={!jumpable}
                    onClick={() => jumpable && onStepSelect(step.id)}
                    aria-current={step.state === 'current' ? 'step' : undefined}
                    className="group flex w-full flex-col gap-1.5 text-start disabled:cursor-default"
                  >
                    <span className={cn('h-1.5 w-full rounded-full',
                      step.state === 'done' && 'bg-primary', step.state === 'current' && 'bg-primary/60',
                      step.state === 'todo' && 'bg-border', step.state === 'blocked' && 'bg-red-400')} />
                    <span className={cn('hidden truncate text-xs sm:block',
                      step.state === 'current' ? 'font-semibold text-foreground' : 'text-muted-foreground',
                      jumpable && 'group-hover:text-primary group-hover:underline')}>{step.label}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      <div className={cn('grid gap-4', aside && 'lg:grid-cols-[minmax(0,1fr)_20rem]')}>
        <div className="rounded-2xl border bg-card shadow-sm">
          <header className="space-y-1 border-b px-4 py-4 sm:px-6">
            {eyebrow && <div className="text-sm font-semibold text-primary">{eyebrow}</div>}
            <h2 className="font-display text-2xl font-semibold leading-tight">{title}</h2>
            {description && <p className="text-sm text-muted-foreground sm:text-base">{description}</p>}
          </header>
          <div className="space-y-5 px-4 py-5 sm:px-6">{children}</div>
          {actions && (
            <div className="sticky bottom-0 z-20 rounded-b-2xl border-t bg-card/95 px-4 py-3 backdrop-blur pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
              {actions}
            </div>
          )}
        </div>
        {aside && <aside className="space-y-4">{aside}</aside>}
      </div>
    </section>
  );
}
