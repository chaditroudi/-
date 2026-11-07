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
  /** Stable id of the label (`productionNav.item.<key>`): the same view reads "En cours" for an operator, its stage name for a supervisor. */
  labelKey: string;
  stage?: boolean;
}

export interface ProductionNavGroup {
  id: 'post' | 'work' | 'stages' | 'follow';
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
      { view: 'today', label: 'À faire', labelKey: 'todo' },
      { view: stage, label: 'En cours', labelKey: 'inProgress', stage: true },
      { view: 'done', label: 'Terminé', labelKey: 'done', stage: true },
    ];
    const items = base.filter((item) => stagesEnabled || !item.stage);
    return items.length ? [{ id: 'post', label: 'Poste', items }] : [];
  }

  const all: ProductionNavGroup[] = [
    {
      id: 'work',
      label: 'Travail',
      items: [
        { view: 'today', label: 'À faire', labelKey: 'todo' },
        { view: 'orders', label: 'Ordres de fabrication', labelKey: 'orders' },
        { view: 'pipeline', label: 'Lots à lancer', labelKey: 'pipeline', stage: true },
        { view: 'done', label: 'Terminé', labelKey: 'done', stage: true },
      ],
    },
    {
      id: 'stages',
      label: 'Étapes',
      items: [
        { view: 'fumigation', label: 'Fumigation', labelKey: 'fumigation', stage: true },
        { view: 'nettoyage', label: 'Nettoyage', labelKey: 'nettoyage', stage: true },
        { view: 'hydratation', label: 'Hydratation', labelKey: 'hydratation', stage: true },
        { view: 'triage', label: 'Triage', labelKey: 'triage', stage: true },
      ],
    },
    {
      id: 'follow',
      label: 'Suivi',
      items: [
        { view: 'alertes', label: 'Alertes', labelKey: 'alertes', stage: true },
        { view: 'flux', label: 'Lignes F1 à F8', labelKey: 'flux' },
        { view: 'balance', label: 'Bilan matière', labelKey: 'balance' },
        { view: 'haccp', label: 'Plan HACCP', labelKey: 'haccp' },
        { view: 'kpi', label: 'Indicateurs', labelKey: 'kpi' },
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
