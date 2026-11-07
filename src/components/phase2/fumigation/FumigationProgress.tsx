import { useTranslation } from 'react-i18next';
import type { FumigationCycleStatus } from '@/types/phase2';
import { cn } from '@/lib/utils';

/** The fixed order a cycle goes through before it is signed. */
export const FUMIGATION_STEPS: FumigationCycleStatus[] = ['PREPARATION', 'CHARGEMENT', 'EN_COURS', 'VENTILATION', 'VALIDATION'];

/** Five segments: done, current, to come. Same order everywhere a cycle is shown. */
export function FumigationProgress({ status }: { status: FumigationCycleStatus }) {
  const { t } = useTranslation();
  const current = FUMIGATION_STEPS.indexOf(status);
  const finished = status === 'TERMINE';
  return (
    <ol className="grid grid-cols-5 gap-1" aria-label={t('fumigation.progressLabel')}>
      {FUMIGATION_STEPS.map((step, index) => {
        const done = finished || (current >= 0 && index < current);
        const now = index === current;
        return (
          <li key={step} aria-current={now ? 'step' : undefined} className="space-y-1">
            <span className={cn('block h-1.5 rounded-full', done ? 'bg-primary' : now ? 'bg-warning' : 'bg-border')} />
            <span className={cn('hidden truncate text-xs sm:block', now ? 'font-semibold text-foreground' : 'text-muted-foreground')}>
              {t(`fumigation.status.${step}`)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
