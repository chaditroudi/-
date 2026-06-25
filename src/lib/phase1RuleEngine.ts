/**
 * Royal Palm Phase 1 — Business Rule Engine
 * Pure async functions called from mutation onSuccess / submit handlers.
 * All data access goes through the NestJS REST API via apiRequest().
 */

import { apiRequest } from '@/integrations/mongodb/client';
import { notificationsApi } from '@/lib/api/notifications';

// ─── RG-F01: CIN / Matricule fiscal uniqueness ─────────────────────────────

export interface CinCheckResult {
  duplicate: boolean;
  existingCode?: string;
  existingName?: string;
}

export const checkCinUniqueness = async (
  fiscalIdentifier: string,
  excludeId?: string,
): Promise<CinCheckResult> => {
  const trimmed = fiscalIdentifier.trim();
  if (!trimmed) return { duplicate: false };

  // GET /api/suppliers returns all suppliers; filter client-side
  const response = await apiRequest<{ data: Array<{ id: string; code: string; name: string; fiscal_identifier?: string }> }>('/suppliers');
  const suppliers = response.data ?? [];
  const match = suppliers.find(
    (s) => s.fiscal_identifier === trimmed && s.id !== excludeId,
  );

  if (!match) return { duplicate: false };
  return { duplicate: true, existingCode: match.code, existingName: match.name };
};

// ─── RG-F03: Auto-block supplier when rejection rate exceeds 20 % ──────────

export const triggerAutoBlockIfNeeded = async (
  supplierId: string,
  currentRejectionRate: number,
): Promise<boolean> => {
  if (currentRejectionRate <= 20) return false;

  // GET supplier first to check current status
  const response = await apiRequest<{ data: Array<{ id: string; supplier_status: string }> }>('/suppliers');
  const supplier = (response.data ?? []).find((s) => s.id === supplierId);
  if (!supplier || supplier.supplier_status !== 'active') return false;

  await apiRequest(`/suppliers/${encodeURIComponent(supplierId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ supplier_status: 'blocked', is_active: false }),
  });

  return true;
};

// ─── RG-Q09: Recalculate supplier quality_score after each QC decision ─────

const GRADE_POINTS: Record<string, number> = {
  EXTRA: 100,
  CATEGORIE_I: 80,
  CATEGORIE_II: 60,
  REJETE: 0,
};

export const recalculateAndSaveSupplierScore = async (
  supplierId: string,
): Promise<{ qualityScore: number; rejectionRate: number } | null> => {
  // Fetch lots for this supplier via /api/suppliers/:id/lots
  const response = await apiRequest<{ data: Array<{ qc_grade?: string | null; quantity_total?: number | null }> }>(
    `/suppliers/${encodeURIComponent(supplierId)}/lots`,
  );
  const rawLots = response.data ?? [];
  const lots = rawLots
    .filter((r) => r.qc_grade != null)
    .slice(0, 30);

  if (lots.length === 0) return null;

  const totalWeight = lots.reduce((sum, r) => sum + (Number(r.quantity_total) || 0), 0);
  const qualityScore =
    totalWeight > 0
      ? lots.reduce((sum, r) => sum + (GRADE_POINTS[r.qc_grade!] ?? 0) * (Number(r.quantity_total) || 0), 0) / totalWeight
      : lots.reduce((sum, r) => sum + (GRADE_POINTS[r.qc_grade!] ?? 0), 0) / lots.length;

  const rejectedCount = lots.filter((r) => r.qc_grade === 'REJETE').length;
  const rejectionRate = Math.round((rejectedCount / lots.length) * 1000) / 10;
  const rounded = Math.round(qualityScore * 10) / 10;

  await apiRequest(`/suppliers/${encodeURIComponent(supplierId)}`, {
    method: 'PATCH',
    body: JSON.stringify({
      quality_score: rounded,
      rejection_rate: rejectionRate,
      delivered_lots_count: lots.length,
    }),
  });

  return { qualityScore: rounded, rejectionRate };
};

// ─── Notification helper ────────────────────────────────────────────────────

export const createSystemNotification = async (params: {
  notification_type: string;
  category: string;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'error' | 'success';
  entity_type?: string;
  entity_id?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> => {
  await notificationsApi.createNotification({
    notificationType: params.notification_type,
    category: params.category,
    title: params.title,
    message: params.message,
    severity: params.severity,
    entityType: params.entity_type ?? null,
    entityId: params.entity_id ?? null,
    metadata: params.metadata ?? null,
  });
};

// ─── RG-Q03: Supplier rejection notification ────────────────────────────────

export const createRejectionNotification = async (params: {
  receptionNumber: string;
  supplierId: string;
  supplierName: string;
  receptionId: string;
  score: number;
  grade: string;
  autoRejectReasons: string[];
  variety?: string | null;
  weightKg?: number | null;
}): Promise<void> => {
  const reasons =
    params.autoRejectReasons.length > 0
      ? params.autoRejectReasons.join(', ')
      : `Score insuffisant (${params.score.toFixed(1)}/100 — seuil: 55)`;

  await createSystemNotification({
    notification_type: 'SUPPLIER_REJECTION',
    category: 'qualite',
    title: `Lot rejeté — ${params.receptionNumber}`,
    severity: 'error',
    message: [
      `Fournisseur: ${params.supplierName}.`,
      `Motif: ${reasons}.`,
      `Score: ${params.score.toFixed(1)}/100.`,
      params.variety ? `Variété: ${params.variety}.` : null,
      params.weightKg ? `Poids: ${params.weightKg} kg.` : null,
      `Reprise du lot par le fournisseur requise sous 48h.`,
    ].filter(Boolean).join(' '),
    entity_type: 'reception',
    entity_id: params.receptionId,
    metadata: {
      supplier_id: params.supplierId,
      reception_number: params.receptionNumber,
      score: params.score,
      grade: params.grade,
      auto_reject_reasons: params.autoRejectReasons,
    },
  });
};

// ─── RG-Q02: Inspection delay alert ────────────────────────────────────────

export const createInspectionDelayAlert = async (params: {
  receptionId: string;
  receptionNumber: string;
  delayHours: number;
}): Promise<void> => {
  const isDirection = params.delayHours > 12;

  await createSystemNotification({
    notification_type: 'INSPECTION_DELAY',
    category: 'qualite',
    title: `Inspection en retard — ${params.receptionNumber}`,
    severity: isDirection ? 'error' : 'warning',
    message: `Le lot ${params.receptionNumber} n'a pas été inspecté depuis ${params.delayHours.toFixed(0)}h. ${
      isDirection
        ? '⚠️ Alerte Direction — délai critique > 12h.'
        : 'Alerte Responsable Qualité — délai > 4h.'
    }`,
    entity_type: 'reception',
    entity_id: params.receptionId,
    metadata: { delay_hours: params.delayHours },
  });
};

// ─── RG-S10: Raw storage delay alert ───────────────────────────────────────

export const createRawStorageDelayAlert = async (params: {
  receptionId: string;
  receptionNumber: string;
  hoursInRawStorage: number;
  supplierName: string;
}): Promise<void> => {
  await createSystemNotification({
    notification_type: 'RAW_STORAGE_DELAY',
    category: 'stockage',
    title: `Lot en attente fumigation — ${params.receptionNumber}`,
    severity: 'warning',
    message: `Le lot ${params.receptionNumber} (${params.supplierName}) est en zone de stockage brut depuis ${params.hoursInRawStorage.toFixed(0)}h sans orientation vers la fumigation. RG-S10 — délai max: 48h.`,
    entity_type: 'reception',
    entity_id: params.receptionId,
    metadata: { hours_in_raw_storage: params.hoursInRawStorage },
  });
};

// ─── RG-S01: Bio/conventionnel zone segregation ─────────────────────────────

export type BioSegregationResult = { allowed: true } | { allowed: false; reason: string };

export const checkBioSegregationRGS01 = (params: {
  lotIsBio: boolean;
  zoneIsBioOnly: boolean | null | undefined;
  isQuarantineZone?: boolean;
}): BioSegregationResult => {
  if (params.isQuarantineZone) return { allowed: true };
  if (params.zoneIsBioOnly == null) return { allowed: true };

  if (params.lotIsBio && !params.zoneIsBioOnly)
    return { allowed: false, reason: 'RG-S01 — Lot déclaré BIO : stockage uniquement autorisé en zone BIO exclusive ou quarantaine.' };
  if (!params.lotIsBio && params.zoneIsBioOnly)
    return { allowed: false, reason: 'RG-S01 — Lot conventionnel : la zone BIO exclusive est réservée aux lots certifiés BIO.' };

  return { allowed: true };
};

// ─── RG-Q01: QC window ─────────────────────────────────────────────────────

export type QCWindowResult =
  | { status: 'ok' }
  | { status: 'warning'; hoursElapsed: number }
  | { status: 'overdue'; hoursElapsed: number };

export const checkQCWindowRGQ01 = (gateArrivalAt: string | null | undefined): QCWindowResult => {
  if (!gateArrivalAt) return { status: 'ok' };
  const hoursElapsed = (Date.now() - new Date(gateArrivalAt).getTime()) / 3_600_000;
  const rounded = Math.round(hoursElapsed * 10) / 10;
  if (hoursElapsed > 4) return { status: 'overdue', hoursElapsed: rounded };
  if (hoursElapsed > 3) return { status: 'warning', hoursElapsed: rounded };
  return { status: 'ok' };
};

// ─── RG-R04: Tare re-weighing ───────────────────────────────────────────────

export const requiresTareReweigh = (
  savedCrateCount: number | null | undefined,
  newCrateCount: number,
): boolean => {
  if (savedCrateCount == null) return false;
  return Math.abs(savedCrateCount - newCrateCount) > 0;
};

// ─── RG-R07: Blocked/rejected lot cannot be moved to storage ────────────────

export type StorageGuardResult = { allowed: true } | { allowed: false; reason: string };

export const checkLotStorageAllowed = (params: {
  lotStockStatus: string;
  receptionStatus: string;
  targetZoneCode: string;
}): StorageGuardResult => {
  const { lotStockStatus, receptionStatus, targetZoneCode } = params;
  const upper = targetZoneCode.toUpperCase();
  const isQuarantineZone =
    upper.includes('QUARAN') ||
    upper.includes('QZ') ||
    upper.startsWith('ZONE_QUARANTAINE') ||
    upper.startsWith('FU-') ||       // Module3 fumigation chambers = quarantine
    upper === 'ZONE_QUARANTAINE';

  if (isQuarantineZone) return { allowed: true };

  if (receptionStatus === 'REJETE' || lotStockStatus === 'STOCK_REJETE')
    return { allowed: false, reason: 'RG-R07 — Ce lot est rejeté. Il ne peut pas être affecté à une zone de stockage standard. Orientation vers destruction ou retour fournisseur.' };

  if (receptionStatus === 'BLOQUE' || lotStockStatus === 'EN_QUARANTAINE')
    return { allowed: false, reason: 'RG-R07 — Ce lot est bloqué / en quarantaine. Seule la zone QUARANTAINE est autorisée.' };

  return { allowed: true };
};

// ─── RG-Q07: Retroactive lab block ─────────────────────────────────────────

export const applyRetroactiveLabBlock = async (params: {
  receptionId: string;
  receptionNumber: string;
  supplierId: string;
  supplierName: string;
  labFindings: string;
}): Promise<boolean> => {
  // Fetch current reception status via REST
  const response = await apiRequest<{ data: Array<{ id: string; status: string }> }>('/receptions');
  const current = (response.data ?? []).find((r) => r.id === params.receptionId);

  if (!current || current.status === 'REJETE' || current.status === 'ANNULE') return false;

  // Update via PATCH /api/receptions-v2/:id
  await apiRequest(`/receptions-v2/${encodeURIComponent(params.receptionId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'BLOQUE', qc_decision: 'QUARANTAINE' }),
  });

  await createSystemNotification({
    notification_type: 'LAB_RETROACTIVE_BLOCK',
    category: 'qualite',
    title: `⚠️ Blocage rétroactif labo — ${params.receptionNumber}`,
    severity: 'error',
    message: `Résultats laboratoire non conformes pour ${params.receptionNumber} (${params.supplierName}). Lot bloqué immédiatement. Constatations: ${params.labFindings}. Action requise: isolement et traitement.`,
    entity_type: 'reception',
    entity_id: params.receptionId,
    metadata: { supplier_id: params.supplierId, lab_findings: params.labFindings },
  });

  return true;
};
