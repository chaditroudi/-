// Prints the role x screen x action matrix from the client contract, which is generated from the server's route table.
// Run: npx vite-node scripts/docs/role-matrix.ts > docs/audits/generated-role-matrix.md
import { ROLE_CONFIG, type ActorRole } from '../../src/types/roles';

const ALL_ROLES = Object.keys(ROLE_CONFIG) as ActorRole[];
import { getAccessibleTabs, getShellDensity, getRoleWorkspaceProfile } from '../../src/lib/roleAccess';
import { canWrite, ACTION_ACCESS, TAB_REQUIRES, READ_ACCESS } from '../../src/lib/apiAccess';

const TABS = ['home', 'live', 'scan', 'alerts', 'receptions', 'storage', 'production', 'packaging', 'logistics', 'quality', 'suppliers', 'materials', 'purchasing', 'customers', 'export', 'maintenance', 'hr', 'analytics', 'sage-operations', 'settings'] as const;
const out: string[] = [];
out.push('| Role | Shell | Lands on | ' + TABS.join(' | ') + ' |');
out.push('|---|---|---|' + TABS.map(() => '---').join('|') + '|');
for (const role of ALL_ROLES) {
  const tabs = new Set<string>(getAccessibleTabs([role]));
  const profile = getRoleWorkspaceProfile([role]);
  out.push(`| \`${role}\` | ${getShellDensity([role])} | ${profile.defaultTab} | ` + TABS.map((t) => (tabs.has(t) ? '●' : '')).join(' | ') + ' |');
}
out.push('', '### Write actions by role', '', '| Action | Server route | Roles allowed |', '|---|---|---|');
for (const [action, route] of Object.entries(ACTION_ACCESS)) {
  const roles = ALL_ROLES.filter((r) => canWrite([r], action as keyof typeof ACTION_ACCESS));
  out.push(`| ${action} | \`${route}\` | ${roles.map((r) => `\`${r}\``).join(', ') || '—'} |`);
}
out.push('', '### What each screen needs to open', '', '| Tab | Read resource | Server route |', '|---|---|---|');
for (const [tab, resource] of Object.entries(TAB_REQUIRES)) {
  out.push(`| ${tab} | ${resource} | \`${READ_ACCESS[resource as keyof typeof READ_ACCESS].route}\` |`);
}
console.log(out.join('\n'));
