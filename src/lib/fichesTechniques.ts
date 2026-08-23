/**
 * Fiches techniques A→Z — aide opératoire par étape du fil d'or.
 * Contenu court, actionnable, pour employés atelier (pas un manuel qualité).
 */

import type { AppTab } from '@/lib/roleAccess';
import {
  LOT_JOURNEY_STAGE_LABELS,
  type LotJourneyStage,
} from '@/lib/lotJourney';

export type FicheId =
  | 'FT-01-RECEPTION'
  | 'FT-02-PESEE'
  | 'FT-03-QC'
  | 'FT-04-FROID'
  | 'FT-05-FUMIGATION'
  | 'FT-06-TRIAGE'
  | 'FT-07-CONDITIONNEMENT'
  | 'FT-08-EXPEDITION'
  | 'FT-BRA'
  | 'FT-BDE';

export type FicheTechnique = {
  id: FicheId;
  /** Linked golden-thread stage (docs BRA/BDE may omit). */
  stage?: LotJourneyStage;
  code: string;
  title: string;
  poste: string;
  durationMin: number;
  purpose: string;
  tools: string[];
  steps: string[];
  criticalLimits: { label: string; value: string }[];
  ifBlocked: string;
  documents: string[];
  navigate: {
    tab: AppTab;
    view?: string;
    module?: string;
    focus?: string;
    action?: string;
  };
};

export const FICHES_TECHNIQUES: FicheTechnique[] = [
  {
    id: 'FT-01-RECEPTION',
    stage: 'SUPPLIER_INTAKE',
    code: 'FT-01',
    title: 'Réception fournisseur',
    poste: 'Quai / Réception',
    durationMin: 15,
    purpose: 'Enregistrer l’arrivée camion et démarrer le lot Deglet Nour sur le fil d’or.',
    tools: ['Tablette / PC réception', 'Bon de livraison fournisseur', 'BRA (si besoin)', 'Scanner QR'],
    steps: [
      'Vérifier identité camion + fournisseur + bon de livraison.',
      'Créer la réception (ou rouvrir le brouillon) dans Réception.',
      'Saisir variété, origine, quantité annoncée, N° camion.',
      'Photographier / joindre le bon papier si disponible.',
      'Lancer la file QC / pesée — ne pas stocker avant pesée + QC.',
    ],
    criticalLimits: [
      { label: 'Identité lot', value: 'Fournisseur + camion + date obligatoires' },
      { label: 'Traçabilité', value: 'Pas de mélange de fournisseurs sur un même lot' },
      { label: 'BRA', value: 'Imprimer après pesée nette si exigé fournisseur' },
    ],
    ifBlocked: 'Camion / documents incomplets → appeler Chef de réception. Ne pas créer de lot fantôme.',
    documents: ['Bon de livraison', 'BRA (Bon de Réception Achat)'],
    navigate: { tab: 'receptions' },
  },
  {
    id: 'FT-02-PESEE',
    stage: 'WEIGHED',
    code: 'FT-02',
    title: 'Pesée bascule',
    poste: 'Bascule / Réception',
    durationMin: 10,
    purpose: 'Verrouiller le poids net d’entrée — base de tout le bilan matière.',
    tools: ['Bascule', 'Écran réception', 'Tickets tare / brut'],
    steps: [
      'Peser le camion brut (ou caisses) selon procédure site.',
      'Saisir tare / brut / net dans la réception.',
      'Contrôler écart vs quantité annoncée (> tolérance → noter alerte).',
      'Valider la pesée pour passer le lot à “Pesé”.',
      'Préparer l’échantillon QC (voir FT-03).',
    ],
    criticalLimits: [
      { label: 'Unité', value: 'kg net — toujours poids net usine' },
      { label: 'Écart', value: 'Signaler si écart > 2 % vs BL (règle site)' },
      { label: 'Double saisie', value: 'Interdit de modifier un net validé sans chef' },
    ],
    ifBlocked: 'Bascule en panne → Maintenance + pesée manuelle autorisée seulement par chef de quai.',
    documents: ['Ticket bascule', 'BRA (poids)'],
    navigate: { tab: 'receptions' },
  },
  {
    id: 'FT-03-QC',
    stage: 'QC_DECIDED',
    code: 'FT-03',
    title: 'Contrôle qualité entrant',
    poste: 'QC Réception',
    durationMin: 20,
    purpose: 'Décider libération, quarantaine ou rejet avant mise en froid.',
    tools: ['Kit échantillonnage', 'Fiche QC', 'Balance labo', 'Tablette QC'],
    steps: [
      'Prélever l’échantillon représentatif (min. selon tonnage — guidance réception).',
      'Contrôler humidité, défauts, corps étrangers, aspect.',
      'Saisir le résultat QC et le grade provisoire.',
      'Décider : Libéré / Quarantaine / Rejeté.',
      'Si libéré → orienter vers froid. Si bloqué → alerter Qualité.',
    ],
    criticalLimits: [
      { label: 'Échantillon', value: '≥ 2 kg jusqu’à 1 t · ≥ 5 kg au-delà de 5 t' },
      { label: 'Libération', value: 'Interdit de stocker “libéré” sans décision QC' },
      { label: 'Rejet', value: 'Isoler physiquement + tracer le motif' },
    ],
    ifBlocked: 'Doute qualité → Responsable Qualité. Ne pas “passer en douce” en froid.',
    documents: ['Fiche QC entrant', 'Photo défauts si rejet'],
    navigate: { tab: 'receptions' },
  },
  {
    id: 'FT-04-FROID',
    stage: 'COLD_STORE',
    code: 'FT-04',
    title: 'Mise en froid',
    poste: 'Magasin / Stock',
    durationMin: 15,
    purpose: 'Protéger la chaîne du froid et localiser le lot (zone + emplacement).',
    tools: ['Scanner', 'Étiquettes lot', 'Tableau zones froides'],
    steps: [
      'Vérifier que le lot est libéré QC (sinon quarantaine dédiée).',
      'Choisir zone froide compatible (température / capacité).',
      'Enregistrer le mouvement vers la zone dans Stock.',
      'Étiqueter palettes / caisses avec N° lot visible.',
      'Attester température de zone si demandé par le contrôle.',
    ],
    criticalLimits: [
      { label: 'Température', value: 'Respecter consigne zone (ex. 0–5 °C — règle site)' },
      { label: 'FIFO', value: 'Ne pas bloquer les lots plus anciens accessibles' },
      { label: 'Quarantaine', value: 'Zone séparée, jamais mélangée au stock libéré' },
    ],
    ifBlocked: 'Chambre pleine ou hors tolérance → Chef magasin + Maintenance froid.',
    documents: ['Bon de mouvement', 'Relevé température'],
    navigate: { tab: 'storage' },
  },
  {
    id: 'FT-05-FUMIGATION',
    stage: 'FUMIGATION_CCP',
    code: 'FT-05',
    title: 'Fumigation CCP',
    poste: 'Phase 2 · Fumigation',
    durationMin: 45,
    purpose: 'Exécuter le CCP fumigation avec preuves capteurs et double signature.',
    tools: ['Chambre fumigation', 'Capteurs CCP', 'Écran Phase 2', 'EPI'],
    steps: [
      'Sélectionner le lot dans Fumigation (Phase 2).',
      'Vérifier étanchéité chambre + EPI équipe.',
      'Lancer le cycle et surveiller les capteurs (temps / concentration).',
      'Obtenir la double signature (opérateur + responsable).',
      'Clôturer le CCP — le lot ne passe au triage que si CCP OK.',
    ],
    criticalLimits: [
      { label: 'CCP', value: 'Pas de skip — preuve capteur obligatoire' },
      { label: 'Signatures', value: '2 signatures distinctes avant clôture' },
      { label: 'Échec cycle', value: 'Rejouer / alerter — ne pas “forcer” triage' },
    ],
    ifBlocked: 'Capteur HS ou signature manquante → Responsable Production + Qualité.',
    documents: ['Preuve CCP', 'Journal fumigation'],
    navigate: { tab: 'production', view: 'phase2', module: 'fumigation' },
  },
  {
    id: 'FT-06-TRIAGE',
    stage: 'TRIAGE',
    code: 'FT-06',
    title: 'Triage & grades',
    poste: 'Phase 2 · Triage',
    durationMin: 60,
    purpose: 'Séparer les grades, clôturer le bilan matière et préparer le règlement.',
    tools: ['Ligne triage', 'Balances grades', 'Écran triage', 'Bacs grades'],
    steps: [
      'Ouvrir la session triage sur le lot parent.',
      'Saisir les sorties par grade (poids nets).',
      'Contrôler le bilan matière (entrées ≈ sorties + pertes).',
      'Clôturer la session — déclenche coûts / règlement grades.',
      'Orienter chaque grade vers conditionnement ou stock PF semi.',
    ],
    criticalLimits: [
      { label: 'Bilan', value: 'Écart masse hors tolérance → investiguer avant clôture' },
      { label: 'Grades', value: 'Un poids = un grade tracé (pas de “divers” flou)' },
      { label: 'Clôture', value: 'Irréversible — vérifier 2 fois' },
    ],
    ifBlocked: 'Écart bilan → Chef triage. Ne pas clôturer pour “avancer”.',
    documents: ['Bilan triage', 'Règlement grades (Achats)'],
    navigate: { tab: 'production', view: 'phase2', module: 'triage' },
  },
  {
    id: 'FT-07-CONDITIONNEMENT',
    stage: 'PACKED',
    code: 'FT-07',
    title: 'Conditionnement',
    poste: 'Ligne conditionnement',
    durationMin: 40,
    purpose: 'Conditionner le grade, sceller palettes et créer le stock PF traçable.',
    tools: ['Ordre de conditionnement', 'Ligne packing', 'Étiquettes PF', 'Scanner'],
    steps: [
      'Créer / ouvrir l’ordre de conditionnement sur le grade.',
      'Respecter format client (barquette, carton, poids net).',
      'Scanner / lier les lots d’entrée consommés.',
      'Clôturer l’ordre et générer palettes PF.',
      'Étiqueter et mettre en stock PF prêt à expédier.',
    ],
    criticalLimits: [
      { label: 'Masse', value: 'Consommation ≤ disponible grade' },
      { label: 'Étiquette', value: 'N° lot PF lisible + lien parent' },
      { label: 'Client', value: 'Format packing = commande export' },
    ],
    ifBlocked: 'Manque matière ou format inconnu → Planning packing + Commercial export.',
    documents: ['OF conditionnement', 'Étiquettes palette'],
    navigate: { tab: 'packaging' },
  },
  {
    id: 'FT-08-EXPEDITION',
    stage: 'SHIPPED',
    code: 'FT-08',
    title: 'Expédition',
    poste: 'Logistique / Quai départ',
    durationMin: 25,
    purpose: 'Charger le PF, imprimer le BDE et clôturer le fil d’or.',
    tools: ['BDE', 'Dossier export', 'Scanner palettes', 'Camion'],
    steps: [
      'Vérifier commande export + conformité docs (phyto, COA si requis).',
      'Préparer l’expédition et scanner les palettes PF.',
      'Créer / valider le Bon d’Expédition (BDE).',
      'Imprimer BDE pour transporteur + garder copie usine.',
      'Marquer expédié — passport client disponible.',
    ],
    criticalLimits: [
      { label: 'Lots', value: 'Chaque ligne expedition liée à un lot PF' },
      { label: 'BDE', value: 'Imprimé et validé avant départ camion' },
      { label: 'Rappel', value: 'Généalogie complète sinon blocage conformité' },
    ],
    ifBlocked: 'Doc export manquant → Responsable Logistique / Export. Pas de départ “à blanc”.',
    documents: ['BDE', 'CMR / packing list', 'Passport lot'],
    navigate: { tab: 'logistics', view: 'bde' },
  },
  {
    id: 'FT-BRA',
    code: 'FT-BRA',
    title: 'Bon de Réception Achat (BRA)',
    poste: 'Réception · Documents',
    durationMin: 8,
    purpose: 'Créer et imprimer le bon d’entrée fournisseur (preuve d’achat / quai).',
    tools: ['Écran Documents BRA', 'Imprimante', 'Données pesée'],
    steps: [
      'Ouvrir Documents → Bon BRA (ou Parcours → Créer BRA).',
      'Renseigner fournisseur, date, camion, lots / poids.',
      'Contrôler totaux nets vs bascule.',
      'Valider le bon.',
      'Imprimer et remettre / classer selon procédure site.',
    ],
    criticalLimits: [
      { label: 'Statut', value: 'Brouillon ≠ preuve — valider avant remise' },
      { label: 'Poids', value: 'Aligné sur pesée réception' },
    ],
    ifBlocked: 'Données pesée manquantes → finir FT-02 avant d’imprimer.',
    documents: ['BRA'],
    navigate: { tab: 'receptions', view: 'bra', action: 'new' },
  },
  {
    id: 'FT-BDE',
    code: 'FT-BDE',
    title: 'Bon d’Expédition (BDE)',
    poste: 'Logistique · Documents',
    durationMin: 8,
    purpose: 'Créer et imprimer le bon de sortie usine pour le transporteur.',
    tools: ['Écran Documents BDE', 'Imprimante', 'Réf. commande export'],
    steps: [
      'Ouvrir Documents → Bon BDE (ou Parcours → Créer BDE).',
      'Renseigner destination, camion, lignes / lots PF.',
      'Lier la commande export si applicable.',
      'Valider le bon.',
      'Imprimer avant départ — copie transporteur + usine.',
    ],
    criticalLimits: [
      { label: 'Départ', value: 'Pas de camion sans BDE validé' },
      { label: 'Lots', value: 'Référencer les lots PF scannés' },
    ],
    ifBlocked: 'Packing incomplet → finir FT-07. Export → Responsable Logistique.',
    documents: ['BDE'],
    navigate: { tab: 'logistics', view: 'bde', action: 'new' },
  },
];

export const FICHE_BY_ID: Record<FicheId, FicheTechnique> = Object.fromEntries(
  FICHES_TECHNIQUES.map((f) => [f.id, f]),
) as Record<FicheId, FicheTechnique>;

const STAGE_TO_FICHE: Record<LotJourneyStage, FicheId> = {
  SUPPLIER_INTAKE: 'FT-01-RECEPTION',
  WEIGHED: 'FT-02-PESEE',
  QC_DECIDED: 'FT-03-QC',
  COLD_STORE: 'FT-04-FROID',
  FUMIGATION_CCP: 'FT-05-FUMIGATION',
  TRIAGE: 'FT-06-TRIAGE',
  PACKED: 'FT-07-CONDITIONNEMENT',
  SHIPPED: 'FT-08-EXPEDITION',
};

export function getFicheForStage(stage: LotJourneyStage | string | null | undefined): FicheTechnique | null {
  if (!stage || !(stage in STAGE_TO_FICHE)) return null;
  return FICHE_BY_ID[STAGE_TO_FICHE[stage as LotJourneyStage]];
}

export function getFicheById(id: string | null | undefined): FicheTechnique | null {
  if (!id || !(id in FICHE_BY_ID)) return null;
  return FICHE_BY_ID[id as FicheId];
}

/** Fiches visible for a set of app tabs (employee facilitation). */
export function listFichesForTabs(accessibleTabs: AppTab[]): FicheTechnique[] {
  return FICHES_TECHNIQUES.filter((f) => accessibleTabs.includes(f.navigate.tab));
}

export type FicheOverride = {
  title?: string;
  purpose?: string;
  poste?: string;
  durationMin?: number;
  tools?: string[];
  steps?: string[];
  criticalLimits?: { label: string; value: string }[];
  ifBlocked?: string;
  documents?: string[];
};

export type FicheOverridesMap = Partial<Record<FicheId, FicheOverride>>;

export function mergeFicheWithOverride(
  base: FicheTechnique,
  override?: FicheOverride | null,
): FicheTechnique {
  if (!override) return base;
  return {
    ...base,
    title: override.title?.trim() || base.title,
    purpose: override.purpose?.trim() || base.purpose,
    poste: override.poste?.trim() || base.poste,
    durationMin:
      typeof override.durationMin === 'number' && override.durationMin > 0
        ? override.durationMin
        : base.durationMin,
    tools: override.tools?.length ? override.tools : base.tools,
    steps: override.steps?.length ? override.steps : base.steps,
    criticalLimits: override.criticalLimits?.length ? override.criticalLimits : base.criticalLimits,
    ifBlocked: override.ifBlocked?.trim() || base.ifBlocked,
    documents: override.documents?.length ? override.documents : base.documents,
  };
}

export function resolveFiches(overrides?: FicheOverridesMap | null): FicheTechnique[] {
  return FICHES_TECHNIQUES.map((f) => mergeFicheWithOverride(f, overrides?.[f.id]));
}

export function resolveFicheById(
  id: string | null | undefined,
  overrides?: FicheOverridesMap | null,
): FicheTechnique | null {
  const base = getFicheById(id);
  if (!base) return null;
  return mergeFicheWithOverride(base, overrides?.[base.id]);
}

export function resolveFicheForStage(
  stage: LotJourneyStage | string | null | undefined,
  overrides?: FicheOverridesMap | null,
): FicheTechnique | null {
  const base = getFicheForStage(stage);
  if (!base) return null;
  return mergeFicheWithOverride(base, overrides?.[base.id]);
}

export function listResolvedFichesForTabs(
  accessibleTabs: AppTab[],
  overrides?: FicheOverridesMap | null,
): FicheTechnique[] {
  return resolveFiches(overrides).filter((f) => accessibleTabs.includes(f.navigate.tab));
}

export function ficheStageLabel(fiche: FicheTechnique): string {
  if (fiche.stage) return LOT_JOURNEY_STAGE_LABELS[fiche.stage];
  return fiche.poste;
}

const CHECKLIST_KEY = 'rp-fiche-checklist-v1';
const ACK_KEY = 'rp-fiche-ack-v1';

export type FicheChecklistState = Record<string, boolean[]>;

export type FicheShiftAck = {
  operator: string;
  shift: 'matin' | 'apres-midi' | 'nuit';
  at: string;
  applied: boolean;
};

export type FicheAckState = Record<string, FicheShiftAck>;

export function loadFicheChecklist(): FicheChecklistState {
  try {
    const raw = localStorage.getItem(CHECKLIST_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as FicheChecklistState;
  } catch {
    return {};
  }
}

export function saveFicheChecklist(state: FicheChecklistState): void {
  try {
    localStorage.setItem(CHECKLIST_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

export function loadFicheAcks(): FicheAckState {
  try {
    const raw = localStorage.getItem(ACK_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as FicheAckState;
  } catch {
    return {};
  }
}

export function saveFicheAck(ficheId: string, ack: FicheShiftAck): void {
  try {
    const all = loadFicheAcks();
    all[ficheId] = ack;
    localStorage.setItem(ACK_KEY, JSON.stringify(all));
  } catch {
    /* ignore */
  }
}

export function clearFicheAck(ficheId: string): void {
  try {
    const all = loadFicheAcks();
    delete all[ficheId];
    localStorage.setItem(ACK_KEY, JSON.stringify(all));
  } catch {
    /* ignore */
  }
}

/** True if ack is for today (local calendar day). */
export function isFicheAckCurrentShift(ack: FicheShiftAck | undefined | null): boolean {
  if (!ack?.applied || !ack.at) return false;
  try {
    return new Date(ack.at).toDateString() === new Date().toDateString();
  } catch {
    return false;
  }
}

export function printFicheTechnique(fiche: FicheTechnique): void {
  const steps = fiche.steps.map((s, i) => `<li>${i + 1}. ${escapeHtml(s)}</li>`).join('');
  const limits = fiche.criticalLimits
    .map((l) => `<tr><td>${escapeHtml(l.label)}</td><td>${escapeHtml(l.value)}</td></tr>`)
    .join('');
  const tools = fiche.tools.map((t) => `<li>${escapeHtml(t)}</li>`).join('');
  const docs = fiche.documents.map((d) => `<li>${escapeHtml(d)}</li>`).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${escapeHtml(fiche.code)} — ${escapeHtml(fiche.title)}</title>
<style>
  body{font-family:system-ui,Segoe UI,sans-serif;max-width:720px;margin:24px auto;color:#111;line-height:1.45}
  h1{font-size:22px;margin:0 0 4px} .meta{color:#555;font-size:13px;margin-bottom:16px}
  h2{font-size:14px;text-transform:uppercase;letter-spacing:.06em;color:#444;margin:20px 0 8px}
  ol,ul{padding-left:1.2rem} table{width:100%;border-collapse:collapse;font-size:13px}
  td,th{border:1px solid #ddd;padding:6px 8px;text-align:left}
  .box{border:1px solid #f59e0b;background:#fffbeb;padding:10px 12px;border-radius:8px;font-size:13px}
  @media print{body{margin:12px}}
</style></head><body>
  <p class="meta">${escapeHtml(fiche.code)} · ${escapeHtml(fiche.poste)} · ~${fiche.durationMin} min</p>
  <h1>${escapeHtml(fiche.title)}</h1>
  <p>${escapeHtml(fiche.purpose)}</p>
  <h2>Objectif</h2><p>${escapeHtml(fiche.purpose)}</p>
  <h2>Outils</h2><ul>${tools}</ul>
  <h2>Étapes</h2><ol>${steps}</ol>
  <h2>Limites critiques</h2><table><thead><tr><th>Point</th><th>Règle</th></tr></thead><tbody>${limits}</tbody></table>
  <h2>Documents</h2><ul>${docs}</ul>
  <h2>Si bloqué</h2><div class="box">${escapeHtml(fiche.ifBlocked)}</div>
  <p class="meta" style="margin-top:24px">MES Dattes — Fiche technique atelier · ${new Date().toLocaleDateString('fr-FR')}</p>
</body></html>`;

  const w = window.open('', '_blank', 'noopener,noreferrer,width=800,height=900');
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
  w.print();
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
