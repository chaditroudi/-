import type { ReactNode } from 'react';
import { ArrowRight, Ban, CheckCircle2, Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type TaskStatus = 'ready' | 'waiting' | 'blocked' | 'done';

export interface TaskCardProps {
  title: string;
  description?: string;
  /** Short facts shown as chips: station, reception number, lot. Real values only. */
  meta?: string[];
  status?: TaskStatus;
  /** Shown instead of the generic status wording when the real state is more precise (e.g. "En cours"). */
  statusLabel?: string;
  /** Why the task cannot start, in plain words. Shown instead of the action when blocked. */
  blockedReason?: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: ReactNode;
  /** `hero` is the one big "next task" card on a worker's home. */
  variant?: 'hero' | 'default';
  className?: string;
}

const STATUS_ICON = { ready: ArrowRight, waiting: Clock, blocked: Ban, done: CheckCircle2 } as const;

export function TaskCard({
  title, description, meta = [], status = 'ready', statusLabel, blockedReason, actionLabel, onAction, icon, variant = 'default', className,
}: TaskCardProps) {
  const { t } = useTranslation();
  const hero = variant === 'hero';
  const StatusIcon = STATUS_ICON[status];
  const canAct = status !== 'blocked' && status !== 'done' && Boolean(onAction && actionLabel);

  return (
    <article
      className={cn(
        'relative flex flex-col gap-4 overflow-hidden rounded-2xl border p-5 sm:p-6',
        hero ? 'border-transparent bg-gradient-to-br from-primary-strong to-primary text-primary-foreground shadow-lg' : 'bg-card shadow-sm',
        className,
      )}
    >
      {hero && <span aria-hidden className="pointer-events-none absolute -end-16 -top-20 h-64 w-64 rounded-full border-[28px] border-white/5" />}
      <div className="flex items-start gap-3">
        {icon && (
          <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl [&_svg]:h-5 [&_svg]:w-5',
            hero ? 'bg-white/12 text-white' : 'bg-accent text-accent-foreground')}>{icon}</span>
        )}
        <div className="min-w-0 flex-1">
          <p className={cn('mb-1 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold',
            hero ? 'bg-white/12 text-white' : status === 'blocked' ? 'bg-red-50 text-red-700' : status === 'waiting' ? 'bg-sand text-sand-foreground' : 'bg-accent text-accent-foreground')}>
            <StatusIcon className="h-3.5 w-3.5" aria-hidden />
            {statusLabel ?? t(`task.status.${status}`)}
          </p>
          <h3 className={cn('font-display font-semibold leading-tight', hero ? 'text-2xl text-primary-foreground sm:text-[1.75rem]' : 'text-lg text-foreground')}>{title}</h3>
          {description && <p className={cn('mt-1 text-sm sm:text-base', hero ? 'text-white/85' : 'text-muted-foreground')}>{description}</p>}
        </div>
      </div>

      {meta.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label={t('task.details')}>
          {meta.map((item) => (
            <li key={item} className={cn('rounded-lg border px-2.5 py-1 font-mono text-sm', hero ? 'border-white/25 text-white' : 'text-foreground')}>{item}</li>
          ))}
        </ul>
      )}

      {status === 'blocked' && blockedReason && (
        <p role="note" className={cn('rounded-lg px-3 py-2 text-sm', hero ? 'bg-white/10 text-white' : 'bg-red-50 text-red-800')}>{blockedReason}</p>
      )}

      {canAct && (
        <div className="flex justify-end">
          <Button size="xl" variant={hero ? 'outline' : 'default'} onClick={onAction}
            className={cn('w-full sm:w-auto', hero && 'border-transparent bg-white text-primary-strong hover:bg-white/90 hover:text-primary-strong')}>
            {actionLabel}
            <ArrowRight aria-hidden />
          </Button>
        </div>
      )}
    </article>
  );
}
