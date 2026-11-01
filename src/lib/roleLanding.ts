import type { ActorRole } from '@/types/roles';
import type { AppTab } from './roleAccess';
import type { AppNavigateOptions } from './appNavigate';
import { canWrite } from './apiAccess';

export const getDailyAction = (roles: ActorRole[], tabs: AppTab[]): { label: string; tab: AppTab; options?: AppNavigateOptions } | null => {
  if (roles.includes('administrateur_systeme') && tabs.includes('settings')) return { label: 'Gérer les utilisateurs', tab: 'settings', options: { view: 'users' } };
  if (roles.some(role => role === 'directeur_general' || role === 'directeur_usine') && tabs.includes('live')) return { label: 'Voir l’activité de l’usine', tab: 'live' };
  if (canWrite(roles, 'receptionQc') && tabs.includes('receptions')) return { label: 'Contrôler un lot', tab: 'receptions', options: { view: 'qc' } };
  if (canWrite(roles, 'receptionCreate') && tabs.includes('receptions')) return { label: 'Nouvelle réception', tab: 'receptions', options: { view: 'new' } };
  if (tabs.includes('storage')) return { label: 'Ouvrir le stock et les mouvements', tab: 'storage' };
  const tasks: Array<[AppTab, string]> = [
    ['production', 'Ouvrir le travail en cours'], ['packaging', 'Ouvrir le conditionnement'],
    ['quality', 'Consulter les dossiers qualité'], ['purchasing', 'Ouvrir les demandes d’achat'],
    ['maintenance', 'Voir les interventions'], ['logistics', 'Voir les expéditions'],
  ];
  const next = tasks.find(([tab]) => tabs.includes(tab));
  return next ? { tab: next[0], label: next[1] } : null;
};
