import { type ActorRole } from '@/types/roles';
import {
  receptionStatusLabels,
  stockStatusLabels,
  type ReceptionHeaderStatus,
  type ReceptionLot,
  type ReceptionV2,
  type StockLotStatus,
} from '@/types/reception';

import { canWrite } from './apiAccess';

export interface ReceptionPermissions {
  canRegister: boolean;
  canRunQc: boolean;
  canCancel: boolean;
  canMoveStock: boolean;
}

export const getReceptionPermissions = (roles: ActorRole[]): ReceptionPermissions => {
  return {
    canRegister: canWrite(roles, 'receptionCreate'),
    canRunQc: canWrite(roles, 'receptionQc'),
    canCancel: canWrite(roles, 'receptionCancel'),
    canMoveStock: canWrite(roles, 'storageMove'),
  };
};

export type ReceptionNextAction = 'submit_draft' | 'start_qc' | 'resume_qc' | 'reinspect' | 'assign_storage';

/** Stable id of a next step, so screens can show it in the reader's language (`receptionNext.<key>`). */
export type ReceptionNextStepKey = 'draftSubmit' | 'draftWaiting' | 'qcStart' | 'qcWaiting' | 'qcResume' | 'qcInProgress'
  | 'quarantineAction' | 'quarantineWaiting' | 'storeAction' | 'storeWaiting' | 'done' | 'rejected' | 'cancelled';

export interface ReceptionNextStep {
  key: ReceptionNextStepKey;
  /** Number the title counts, when it counts something (lots to put away). */
  count?: number;
  tone: 'action' | 'waiting' | 'done' | 'closed';
  title: string;
  description: string;
  action: ReceptionNextAction | null;
  actionLabel: string | null;
}

const lotsToPlace = (lots: ReceptionLot[]) =>
  lots.filter((lot) => lot.stock_status === 'STOCK_LIBERE' && !lot.storage_zone_code).length;

/**
 * What the reception needs next, and whether the signed-in user can do it.
 * When the user cannot, the step names who must act instead of showing a button.
 */
export const getReceptionNextStep = (
  reception: Pick<ReceptionV2, 'status' | 'qc_decision'>,
  lots: ReceptionLot[],
  permissions: ReceptionPermissions,
): ReceptionNextStep => {
  switch (reception.status) {
    case 'BROUILLON':
      return permissions.canRegister
        ? {
            key: 'draftSubmit',

            tone: 'action',
            title: 'Brouillon à soumettre',
            description: 'Vérifiez le fournisseur et les lots, puis envoyez la réception au contrôle qualité.',
            action: 'submit_draft',
            actionLabel: 'Soumettre au contrôle',
          }
        : {
            key: 'draftWaiting',

            tone: 'waiting',
            title: 'Brouillon en cours de saisie',
            description: "L'équipe réception doit compléter et soumettre ce brouillon.",
            action: null,
            actionLabel: null,
          };
    case 'EN_ATTENTE_QC':
      return permissions.canRunQc
        ? {
            key: 'qcStart',

            tone: 'action',
            title: 'Contrôle qualité à lancer',
            description: 'Les lots sont en quarantaine en attendant votre inspection.',
            action: 'start_qc',
            actionLabel: 'Lancer le contrôle QC',
          }
        : {
            key: 'qcWaiting',

            tone: 'waiting',
            title: 'En attente du contrôle qualité',
            description: 'Les lots restent en quarantaine jusqu’à la décision du service qualité.',
            action: null,
            actionLabel: null,
          };
    case 'EN_QC':
      return permissions.canRunQc
        ? {
            key: 'qcResume',

            tone: 'action',
            title: 'Inspection en cours',
            description: 'Reprenez l’inspection pour saisir les mesures et signer la décision.',
            action: 'resume_qc',
            actionLabel: 'Reprendre le contrôle',
          }
        : {
            key: 'qcInProgress',

            tone: 'waiting',
            title: 'Inspection qualité en cours',
            description: 'Le service qualité est en train d’inspecter cette livraison.',
            action: null,
            actionLabel: null,
          };
    case 'BLOQUE':
      return permissions.canRunQc
        ? {
            key: 'quarantineAction',

            tone: 'action',
            title: 'Lots en quarantaine',
            description: 'Ré-inspectez la livraison, ou libérez les lots conformes un par un dans la section Lots.',
            action: 'reinspect',
            actionLabel: 'Ré-inspecter',
          }
        : {
            key: 'quarantineWaiting',

            tone: 'waiting',
            title: 'Bloquée en quarantaine',
            description: 'Une décision du service qualité est nécessaire avant toute utilisation.',
            action: null,
            actionLabel: null,
          };
    case 'LIBERE': {
      const pending = lotsToPlace(lots);
      if (pending > 0) {
        return permissions.canMoveStock
          ? {
              key: 'storeAction',

              count: pending,

              tone: 'action',
              title: `${pending} lot(s) libéré(s) à ranger`,
              description: 'Affectez les lots libérés à une chambre froide pour les rendre localisables en stock.',
              action: 'assign_storage',
              actionLabel: 'Affecter au stock',
            }
          : {
              key: 'storeWaiting',

              count: pending,

              tone: 'waiting',
              title: `${pending} lot(s) libéré(s) à ranger`,
              description: 'Le magasin doit affecter ces lots à une chambre froide.',
              action: null,
              actionLabel: null,
            };
      }
      return {
        key: 'done',

        tone: 'done',
        title: 'Réception terminée',
        description: 'Lots libérés et rangés : disponibles pour la production.',
        action: null,
        actionLabel: null,
      };
    }
    case 'REJETE':
      return {
        key: 'rejected',

        tone: 'closed',
        title: 'Livraison rejetée',
        description: 'Les lots sont exclus du stock. Les documents de réclamation sont dans la section Documents.',
        action: null,
        actionLabel: null,
      };
    case 'ANNULE':
    default:
      return {
        key: 'cancelled',

        tone: 'closed',
        title: 'Réception annulée',
        description: 'Le stock et le bon de commande ont été corrigés ; l’historique est conservé.',
        action: null,
        actionLabel: null,
      };
  }
};

export interface ReceptionAuditLog {
  id?: string;
  entity_type?: string;
  action?: string;
  performed_by?: string;
  performed_by_name?: string | null;
  created_at?: string;
  previous_state?: Record<string, unknown> | null;
  new_state?: Record<string, unknown> | null;
}

const AUDIT_ACTION_LABELS: Record<string, string> = {
  CANCELLED: 'Réception annulée',
  CORRECTED: 'Réception corrigée',
  RECEPTION_CONFIRMED: 'Réception confirmée',
  STATUS_CHANGE: 'Changement de statut',
  STOCK_MOVE: 'Lot rangé en stock',
  LOT_RELEASED: 'Lot libéré',
  RELEASE: 'Lot libéré',
  LOT_QUARANTINED: 'Lot mis en quarantaine',
  QUARANTINE: 'Lot mis en quarantaine',
  LAB_RETROACTIVE_BLOCK: 'Blocage après résultats laboratoire',
  LABEL_PRINTED: 'Étiquette GS1 imprimée',
  WEIGHING_GROSS: 'Pesée brute du lot',
  WEIGHING_TARE: 'Pesée tare du lot',
  INSERT: 'Création',
  UPDATE: 'Modification',
};

const statusLabel = (value: unknown) => {
  const key = String(value ?? '');
  return receptionStatusLabels[key as ReceptionHeaderStatus] ?? stockStatusLabels[key as StockLotStatus] ?? key;
};

/** Operator-readable line for one audit entry: what happened, and the facts that matter. */
export const describeReceptionAuditEvent = (log: ReceptionAuditLog) => {
  const action = String(log.action || '');
  const next = log.new_state ?? {};
  const previous = log.previous_state ?? {};
  const details: string[] = [];

  if (next.status != null) {
    details.push(previous.status != null ? `${statusLabel(previous.status)} → ${statusLabel(next.status)}` : statusLabel(next.status));
  }
  if (next.stock_status != null && action !== 'STOCK_MOVE') details.push(statusLabel(next.stock_status));
  if (next.zone) details.push(`Zone ${String(next.zone)}${next.position ? ` · ${String(next.position)}` : ''}`);
  if (next.weight_kg != null) details.push(`${String(next.weight_kg)} kg`);
  if (next.net_kg != null) details.push(`Net ${String(next.net_kg)} kg`);
  if (action === 'CORRECTED') {
    for (const [field, value] of Object.entries(previous)) {
      details.push(`${field} : ${String(value ?? '—')} → ${String(next[field] ?? '—')}`);
    }
  }
  const reason = next.reason ?? next.quarantine_reason ?? next.cancellation_reason;
  if (reason) details.push(`Motif : ${String(reason)}`);

  return {
    label: AUDIT_ACTION_LABELS[action] ?? (action || '—'),
    target: log.entity_type === 'LOT' ? 'Lot' : 'Réception',
    detail: details.join(' · '),
    actor: log.performed_by_name || (log.performed_by === 'system' ? 'Système' : null),
  };
};
