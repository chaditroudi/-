import type { ActorRole } from '@/types/roles';
import { getRoleWorkspaceProfile, type AppTab } from './roleAccess';
import type { AppNavigateOptions } from './appNavigate';
import { canWrite } from './apiAccess';

export const getDailyAction = (roles: ActorRole[], tabs: AppTab[]): { label: string; tab: AppTab; options?: AppNavigateOptions } | null => {
  if (roles.includes('administrateur_systeme') && tabs.includes('settings')) return { label: 'Gérer les utilisateurs', tab: 'settings', options: { view: 'users' } };
  if (roles.some(role => role === 'directeur_general' || role === 'directeur_usine') && tabs.includes('live')) return { label: 'Voir l’activité de l’usine', tab: 'live' };
  if (canWrite(roles, 'receptionQc') && tabs.includes('receptions')) return { label: 'Contrôler un lot', tab: 'receptions', options: { view: 'qc' } };
  if (canWrite(roles, 'receptionCreate') && tabs.includes('receptions')) return { label: 'Nouvelle réception', tab: 'receptions', options: { view: 'new' } };
  const tasks: Array<[AppTab, string]> = [
    ['storage', 'Ouvrir le stock et les mouvements'],
    ['production', 'Ouvrir le travail en cours'], ['packaging', 'Ouvrir le conditionnement'],
    ['quality', 'Consulter les dossiers qualité'], ['purchasing', 'Ouvrir les demandes d’achat'],
    ['maintenance', 'Voir les interventions'], ['logistics', 'Voir les expéditions'],
    ['export', 'Ouvrir les commandes export'], ['customers', 'Consulter les clients'],
    ['suppliers', 'Consulter les fournisseurs'], ['hr', 'Ouvrir les ressources humaines'],
  ];
  const primary = getRoleWorkspaceProfile(roles).primaryTabs;
  const next = primary.filter(tab => tabs.includes(tab)).map(tab => tasks.find(([target]) => target === tab)).find(Boolean)
    ?? tasks.find(([tab]) => tabs.includes(tab));
  return next ? { tab: next[0], label: next[1] } : null;
};
