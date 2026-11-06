import type { ReactNode } from 'react';
import { AlertTriangle, CloudOff, History, Loader2, Lock } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useOnline } from '@/hooks/useOnline';
import { resolveDataCondition, type DataCondition } from '@/lib/dataCondition';
import { cn } from '@/lib/utils';

export type DataSource = {
  isLoading?: boolean;
  error?: unknown;
  /** Time of the last good answer, when known. */
  updatedAt?: number | string | null;
  refetch?: () => unknown;
};

interface DataStateProps {
  source: DataSource;
  /** The raw answer: undefined until one arrives. Never a defaulted `[]`. */
  data: unknown;
  /** What this data is, as it reads in a sentence: "les lots". */
  what: string;
  isEmpty?: boolean;
  empty?: ReactNode;
  compact?: boolean;
  className?: string;
  children: ReactNode;
}

const formatTime = (value: number | string) =>
  new Date(value).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

const Panel = ({ icon, title, detail, action, tone, compact, className }: {
  icon: ReactNode;
  title: string;
  detail?: string;
  action?: ReactNode;
  tone: 'neutral' | 'danger' | 'warning';
  compact?: boolean;
  className?: string;
}) => (
  <div
    role={tone === 'danger' ? 'alert' : 'status'}
    className={cn(
      'flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border bg-card px-3 text-sm',
      compact ? 'py-2' : 'py-3',
      tone === 'danger' && 'border-destructive/40',
      tone === 'warning' && 'border-warning/40',
      className,
    )}
  >
    <span className="shrink-0 text-muted-foreground">{icon}</span>
    <div className="min-w-0 flex-1 basis-48">
      <p className="font-medium text-foreground">{title}</p>
      {detail && <p className="text-muted-foreground">{detail}</p>}
    </div>
    {action}
  </div>
);

const Retry = ({ onClick }: { onClick: () => unknown }) => (
  <Button type="button" size="sm" variant="outline" onClick={() => void onClick()}>Réessayer</Button>
);

const ICON = 'h-[18px] w-[18px]';

const blocked = (condition: DataCondition, what: string): { icon: ReactNode; title: string; detail: string; tone: 'neutral' | 'danger' | 'warning' } | null => {
  if (condition === 'session' || condition === 'notFound') {
    return {
      icon: <Lock className={ICON} aria-hidden />,
      title: condition === 'session' ? 'Session expirée' : 'Élément introuvable',
      detail: condition === 'session' ? 'Reconnectez-vous pour poursuivre votre travail.' : `Le serveur ne trouve pas ${what}. Vérifiez le lien ou revenez à la liste.`,
      tone: 'neutral',
    };
  }
  if (condition === 'restricted') {
    return {
      icon: <Lock className={ICON} aria-hidden />,
      title: 'Accès réservé',
      detail: `Votre rôle ne couvre pas ${what}. Votre responsable peut demander cet accès.`,
      tone: 'neutral',
    };
  }
  if (condition === 'offline') {
    return {
      icon: <CloudOff className={ICON} aria-hidden />,
      title: 'Hors ligne',
      detail: `Connexion indisponible. Impossible d'afficher ${what} : réessayez une fois reconnecté.`,
      tone: 'warning',
    };
  }
  if (condition === 'error') {
    return {
      icon: <AlertTriangle className={cn(ICON, 'text-destructive')} aria-hidden />,
      title: 'Données indisponibles',
      detail: `Le serveur n'a pas pu fournir ${what}. Ce n'est pas une liste vide.`,
      tone: 'danger',
    };
  }
  return null;
};

/**
 * The one way a screen shows data it asked for. It answers what the data's condition is
 * before the screen says anything about the data: a refusal or a failure is never an
 * empty list, and old data always says it is old.
 */
export const DataState = ({ source, data, what, isEmpty, empty, compact, className, children }: DataStateProps) => {
  const online = useOnline();
  const condition = resolveDataCondition({ ...source, data, isEmpty, online });

  if (condition === 'loading') {
    return (
      <div role="status" className={cn('flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground', className)}>
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        Chargement : {what}…
      </div>
    );
  }

  const panel = blocked(condition, what);
  if (panel) {
    const canRetry = !['restricted', 'session', 'notFound'].includes(condition) && source.refetch;
    return <Panel {...panel} compact={compact} className={className} action={canRetry ? <Retry onClick={source.refetch!} /> : undefined} />;
  }

  if (condition === 'empty') {
    return <div className={cn('rounded-lg border border-dashed px-3 py-3 text-sm text-muted-foreground', className)}>{empty ?? `Aucun résultat pour ${what}.`}</div>;
  }

  if (condition === 'stale') {
    return (
      <div className="space-y-2">
        <Panel
          compact
          tone="warning"
          className={className}
          icon={<History className={ICON} aria-hidden />}
          title={online ? 'Mise à jour impossible' : 'Hors ligne'}
          detail={source.updatedAt ? `Données de ${formatTime(source.updatedAt)}, peut-être dépassées.` : 'Ces données sont peut-être dépassées.'}
          action={source.refetch ? <Retry onClick={source.refetch} /> : undefined}
        />
        {children}
      </div>
    );
  }

  return <>{children}</>;
};
