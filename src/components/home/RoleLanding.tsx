import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getRoleWorkspaceProfile, getShellDensity, type AppTab } from '@/lib/roleAccess';
import { getDailyAction } from '@/lib/roleLanding';
import type { AppNavigateFn } from '@/lib/appNavigate';
import { ROLE_CONFIG, type ActorRole } from '@/types/roles';


export function RoleLanding({ roles, tabs, onNavigate }: { roles: ActorRole[]; tabs: AppTab[]; onNavigate: AppNavigateFn }) {
  if (!roles.length) return null;
  const profile = getRoleWorkspaceProfile(roles);
  const action = getDailyAction(roles, tabs);
  const floor = getShellDensity(roles) === 'floor';
  return (
    <section
      aria-label="Votre poste"
      className="flex flex-col gap-3 rounded-lg border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="min-w-0">
        <p className="text-sm text-muted-foreground">
          {roles.map((role) => ROLE_CONFIG[role]?.label).filter(Boolean).join(' · ')}
        </p>
        <h2 className="font-display text-xl font-semibold">{profile.workspaceLabel}</h2>
        <p className="text-sm text-muted-foreground">
          {floor
            ? 'Une seule action pour commencer. Le menu ne montre que votre poste.'
            : 'Une action principale pour démarrer. Le reste attend dans la file du jour.'}
        </p>
      </div>
      {action && (
        <Button
          size="lg"
          className="min-h-12 w-full gap-2 whitespace-normal text-start text-base font-semibold sm:w-auto sm:min-w-[14rem]"
          onClick={() => onNavigate(action.tab, action.options)}
        >
          {action.label}
          <ArrowRight aria-hidden className="ms-auto h-5 w-5 shrink-0 sm:ms-2" />
        </Button>
      )}
    </section>
  );
}
