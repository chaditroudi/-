import type { ActorRole } from '@/types/roles';
import { canPerformAction } from '@/lib/roleAccess';
import type { ProductionView } from '@/components/production/views';

/** Stage views an operator may open for line work. */
export type ProductionStageView = 'fumigation' | 'nettoyage' | 'hydratation' | 'triage';

const OPERATOR_STAGE: Partial<Record<ActorRole, ProductionStageView>> = {
  operateur_fumigation: 'fumigation',
  operateur_nettoyage: 'nettoyage',
  operateur_triage_ia: 'triage',
};

export const isProductionSupervisor = (roles: ActorRole[]) =>
  canPerformAction(roles, 'production_supervision');

/** Primary stage for a pure operator; null when the role can see several stages. */
export const getOperatorProductionStage = (roles: ActorRole[]): ProductionStageView | null => {
  if (isProductionSupervisor(roles)) return null;
  for (const role of roles) {
    const stage = OPERATOR_STAGE[role];
    if (stage) return stage;
  }
  return null;
};

export interface ProductionNavItem {
  view: ProductionView;
  label: string;
  stage?: boolean;
}

export interface ProductionNavGroup {
  label: string;
  items: ProductionNavItem[];
}

/**
 * Operator: À faire / En cours (stage) / Terminé.
 * Supervisor: full atelier navigation.
 */
export const getProductionNavGroups = (
  roles: ActorRole[],
  stagesEnabled: boolean,
): ProductionNavGroup[] => {
  const stage = getOperatorProductionStage(roles);
  const supervisor = isProductionSupervisor(roles);

  if (stage && !supervisor) {
    const base: ProductionNavItem[] = [
      { view: 'today', label: 'À faire' },
      { view: stage, label: 'En cours', stage: true },
      { view: 'done', label: 'Terminé', stage: true },
    ];
    const items = base.filter((item) => stagesEnabled || !item.stage);
    return items.length ? [{ label: 'Poste', items }] : [];
  }

  const all: ProductionNavGroup[] = [
    {
      label: 'Travail',
      items: [
        { view: 'today', label: 'À faire' },
        { view: 'orders', label: 'Ordres de fabrication' },
        { view: 'pipeline', label: 'Lots à lancer', stage: true },
        { view: 'done', label: 'Terminé', stage: true },
      ],
    },
    {
      label: 'Étapes',
      items: [
        { view: 'fumigation', label: 'Fumigation', stage: true },
        { view: 'nettoyage', label: 'Nettoyage', stage: true },
        { view: 'hydratation', label: 'Hydratation', stage: true },
        { view: 'triage', label: 'Triage', stage: true },
      ],
    },
    {
      label: 'Suivi',
      items: [
        { view: 'alertes', label: 'Alertes', stage: true },
        { view: 'flux', label: 'Lignes F1 à F8' },
        { view: 'balance', label: 'Bilan matière' },
        { view: 'haccp', label: 'Plan HACCP' },
        { view: 'kpi', label: 'Indicateurs' },
      ],
    },
  ];

  return all
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => stagesEnabled || !item.stage),
    }))
    .filter((group) => group.items.length > 0);
};

export const isAllowedProductionView = (
  roles: ActorRole[],
  stagesEnabled: boolean,
  view: ProductionView,
) => {
  const allowed = new Set(
    getProductionNavGroups(roles, stagesEnabled).flatMap((group) => group.items.map((item) => item.view)),
  );
  return allowed.has(view);
};

export const defaultProductionView = (roles: ActorRole[], stagesEnabled: boolean): ProductionView => {
  const groups = getProductionNavGroups(roles, stagesEnabled);
  return groups[0]?.items[0]?.view ?? 'today';
};
