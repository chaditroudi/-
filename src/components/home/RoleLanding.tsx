import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getRoleWorkspaceProfile, type AppTab } from '@/lib/roleAccess';
import { getDailyAction } from '@/lib/roleLanding';
import type { AppNavigateFn } from '@/lib/appNavigate';
import { ROLE_CONFIG, type ActorRole } from '@/types/roles';


export function RoleLanding({ roles, tabs, onNavigate }: { roles: ActorRole[]; tabs: AppTab[]; onNavigate: AppNavigateFn }) {
  if (!roles.length) return null;
  const profile = getRoleWorkspaceProfile(roles);
  const action = getDailyAction(roles, tabs);
  return <section aria-label="Votre poste" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4">
    <div className="min-w-0">
      <p className="text-sm text-muted-foreground">{roles.map(role => ROLE_CONFIG[role]?.label).filter(Boolean).join(' · ')}</p>
      <h2 className="font-display text-xl font-semibold">{profile.workspaceLabel}</h2>
      <p className="text-sm text-muted-foreground">Vos postes, le travail en attente et les prochaines actions autorisées.</p>
    </div>
    {action && <Button className="max-w-full whitespace-normal text-start" onClick={() => onNavigate(action.tab, action.options)}>
      {action.label}<ArrowRight aria-hidden className="ms-2 h-4 w-4 shrink-0" />
    </Button>}
  </section>;
}
