import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ROLE_CONFIG, type ActorRole } from '@/types/roles';
import { getAccessibleTabs } from '@/lib/roleAccess';
import { RoleLanding } from './RoleLanding';
import { getDailyAction } from '@/lib/roleLanding';

describe('daily role actions', () => {
  it.each(Object.keys(ROLE_CONFIG) as ActorRole[])('keeps the primary action inside %s’s authorized workspace', role => {
    const tabs = getAccessibleTabs([role]);
    const action = getDailyAction([role], tabs);
    if (action) expect(tabs).toContain(action.tab);
  });
  it('takes an inspector directly to the existing QC queue', () => {
    const navigate = vi.fn();
    render(<RoleLanding roles={['inspecteur_qualite']} tabs={getAccessibleTabs(['inspecteur_qualite'])} onNavigate={navigate} />);
    fireEvent.click(screen.getByRole('button', { name: 'Contrôler un lot' }));
    expect(navigate).toHaveBeenCalledWith('receptions', { view: 'qc' });
  });
  it('opens the real reception intake and never offers it to an inspector', () => {
    expect(getDailyAction(['operateur_reception'], getAccessibleTabs(['operateur_reception']))).toMatchObject({ label: 'Nouvelle réception', options: { view: 'new' } });
    expect(getDailyAction(['inspecteur_qualite'], getAccessibleTabs(['inspecteur_qualite']))?.label).not.toBe('Nouvelle réception');
  });
  it('never offers restricted stock to the production manager', () => {
    expect(getDailyAction(['responsable_production'], getAccessibleTabs(['responsable_production']))?.tab).toBe('production');
  });
  it.each([
    ['responsable_maintenance', 'maintenance'], ['technicien_maintenance', 'maintenance'],
    ['responsable_logistique', 'logistics'], ['technico_commercial', 'export'],
  ] as const)('prioritizes %s’s daily work over secondary modules', (role, tab) => {
    expect(getDailyAction([role], getAccessibleTabs([role]))?.tab).toBe(tab);
  });
});
