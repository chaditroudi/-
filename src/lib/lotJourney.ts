/**
 * Lot Journey — maps golden-thread stages to operator next actions and tabs.
 * Keeps A→Z mental model independent of department silos.
 */

import type { AppTab } from '@/lib/roleAccess';

export const LOT_JOURNEY_STAGES = [
  'SUPPLIER_INTAKE',
  'WEIGHED',
  'QC_DECIDED',
  'COLD_STORE',
  'FUMIGATION_CCP',
  'TRIAGE',
  'PACKED',
  'SHIPPED',
] as const;

export type LotJourneyStage = (typeof LOT_JOURNEY_STAGES)[number];

export type JourneyNavigateHint = {
  tab: AppTab;
  /** Production sub-tab: phase2 | overview | flux | orders */
  view?: string;
  /** Phase2 module: fumigation | triage | nettoyage | hydratation | pipeline */
  module?: string;
  /** Purchasing sub focus */
  focus?: string;
};

export const LOT_JOURNEY_STAGE_LABELS: Record<LotJourneyStage, string> = {
  SUPPLIER_INTAKE: 'Réception',
  WEIGHED: 'Pesée',
  QC_DECIDED: 'QC',
  COLD_STORE: 'Froid',
  FUMIGATION_CCP: 'Fumigation',
  TRIAGE: 'Triage',
  PACKED: 'Conditionnement',
  SHIPPED: 'Expédition',
};

export type LotJourneyNextAction = {
  /** Stage the operator should work on next (first missing, or SHIPPED if complete). */
  nextStage: LotJourneyStage;
  title: string;
  description: string;
  ctaLabel: string;
  tab: AppTab;
  view?: string;
  module?: string;
  focus?: string;
  /** Optional secondary CTA (e.g. export margin after ship). */
  secondary?: {
    ctaLabel: string;
    tab: AppTab;
    view?: string;
    focus?: string;
  };
};

const NEXT_BY_COMPLETED_TIP: Record<LotJourneyStage, LotJourneyNextAction> = {
  SUPPLIER_INTAKE: {
    nextStage: 'WEIGHED',
    title: 'Peser le lot',
    description: 'Enregistrer la pesée bascule / poids net pour verrouiller l’entrée.',
    ctaLabel: 'Ouvrir réception',
    tab: 'receptions',
  },
  WEIGHED: {
    nextStage: 'QC_DECIDED',
    title: 'Contrôle qualité entrant',
    description: 'Décider grade / libération / rejet sur la réception.',
    ctaLabel: 'Ouvrir QC réception',
    tab: 'receptions',
  },
  QC_DECIDED: {
    nextStage: 'COLD_STORE',
    title: 'Mettre en froid',
    description: 'Déplacer le lot vers une zone froide et attester la chaîne du froid.',
    ctaLabel: 'Ouvrir stock',
    tab: 'storage',
  },
  COLD_STORE: {
    nextStage: 'FUMIGATION_CCP',
    title: 'Fumigation CCP',
    description: 'Lancer / valider le cycle de fumigation (capteurs + double signature).',
    ctaLabel: 'Ouvrir fumigation',
    tab: 'production',
    view: 'phase2',
    module: 'fumigation',
  },
  FUMIGATION_CCP: {
    nextStage: 'TRIAGE',
    title: 'Triage & grades',
    description: 'Clôturer le triage (bilan matière + coûts + règlement grades).',
    ctaLabel: 'Ouvrir triage',
    tab: 'production',
    view: 'phase2',
    module: 'triage',
  },
  TRIAGE: {
    nextStage: 'PACKED',
    title: 'Conditionnement',
    description: 'Créer / clôturer l’ordre de conditionnement et sceller les palettes.',
    ctaLabel: 'Ouvrir conditionnement',
    tab: 'packaging',
  },
  PACKED: {
    nextStage: 'SHIPPED',
    title: 'Expédition',
    description: 'Préparer le bon d’expédition et lier la commande export.',
    ctaLabel: 'Ouvrir logistique',
    tab: 'logistics',
    secondary: { ctaLabel: 'Voir export / marge', tab: 'export' },
  },
  SHIPPED: {
    nextStage: 'SHIPPED',
    title: 'Fil d’or complet',
    description: 'Lot expédié — consulter le passport client et la marge export.',
    ctaLabel: 'Ouvrir export',
    tab: 'export',
  },
};

/**
 * Derive next operator action from golden-thread progress.
 * Uses first missing stage; if complete, returns SHIPPED tip.
 */
export const resolveLotJourneyNextAction = (input: {
  stage?: string | null;
  completed?: string[];
  missing?: string[];
  rejected?: boolean;
  complete?: boolean;
}): LotJourneyNextAction => {
  if (input.rejected) {
    return {
      nextStage: 'SUPPLIER_INTAKE',
      title: 'Lot rejeté',
      description: 'Le parcours premium est interrompu — traiter la non-conformité qualité.',
      ctaLabel: 'Ouvrir qualité',
      tab: 'quality',
    };
  }

  if (input.complete) {
    return NEXT_BY_COMPLETED_TIP.SHIPPED;
  }

  const missing = (input.missing || []).filter((s): s is LotJourneyStage =>
    (LOT_JOURNEY_STAGES as readonly string[]).includes(s),
  );
  if (missing.length > 0) {
    const target = missing[0];
    const idx = LOT_JOURNEY_STAGES.indexOf(target);
    const previous = idx > 0 ? LOT_JOURNEY_STAGES[idx - 1] : 'SUPPLIER_INTAKE';
    if (idx === 0) {
      return {
        nextStage: 'SUPPLIER_INTAKE',
        title: 'Créer / finaliser la réception',
        description: 'Saisir l’arrivage fournisseur pour démarrer le fil d’or.',
        ctaLabel: 'Ouvrir réception',
        tab: 'receptions',
      };
    }
    return NEXT_BY_COMPLETED_TIP[previous];
  }

  const current = String(input.stage || '');
  if ((LOT_JOURNEY_STAGES as readonly string[]).includes(current)) {
    return NEXT_BY_COMPLETED_TIP[current as LotJourneyStage];
  }

  return {
    nextStage: 'SUPPLIER_INTAKE',
    title: 'Démarrer le parcours',
    description: 'Recherchez un lot ou créez une réception Deglet Nour.',
    ctaLabel: 'Ouvrir réception',
    tab: 'receptions',
  };
};

export const journeyStageStatus = (
  stage: LotJourneyStage,
  progress: { completed?: string[]; current?: string | null; rejected?: boolean },
): 'done' | 'current' | 'todo' | 'rejected' => {
  if (progress.rejected) return 'rejected';
  if ((progress.completed || []).includes(stage)) return 'done';
  if (progress.current === stage) return 'current';
  const firstOpen = LOT_JOURNEY_STAGES.find((s) => !(progress.completed || []).includes(s));
  if (firstOpen === stage) return 'current';
  return 'todo';
};

/** Roles that keep a portal-specific landing (not Parcours). */
export const PORTAL_ONLY_ROLES = new Set([
  'fournisseur_externe',
  'client_externe',
  'partenaire_client_export',
]);
