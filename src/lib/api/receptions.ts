import { apiRequest } from '@/integrations/mongodb/client';
import type {
  CheckResult,
  CheckSeverity,
  QCDecisionType,
  QCInspection,
  QCChecklist,
  QCChecklistItem,
  ReceptionAlert,
  ReceptionLot,
  ReceptionUnit,
  ReceptionV2,
} from '@/types/reception';

type ApiEnvelope<T> = {
  data: T;
};

type LookupReceptionLot = ReceptionLot & {
  reception?: ReceptionV2 | null;
};

export type CreateReceptionUnitInput = {
  reception_lot_id: string;
  unit_type: 'PALETTE' | 'CAISSE' | 'VRAC' | 'PL' | 'GC' | 'PLOX' | 'LAMME';
  quantity: number;
  unit: string;
  gross_weight?: number;
  net_weight?: number;
};

export type MoveReceptionLotToStorageInput = {
  lotId: string;
  targetZone: string;
  position?: string;
  notes?: string;
  performedBy: string;
};

export type MoveReceptionLotToStorageResponse = {
  movement: Record<string, unknown>;
  lot: ReceptionLot;
  auditLog: Record<string, unknown>;
};

export type RawStorageOverdueReception = {
  id: string;
  reception_number: string;
  actual_arrival_date: string;
  storage_zone_code: string | null;
  quantity_total: number;
  unit: string;
  status: string;
};

export type StartQcInspectionInput = {
  reception_id: string;
  reception_lot_id?: string;
  checklist_id?: string;
  inspector_name: string;
  sampling_method?: string;
  nb_samples?: number;
};

export type SubmitQcDecisionInput = {
  inspectionId: string;
  decision: QCDecisionType;
  comment?: string;
  qualitySummary?: {
    score: number;
    grade: 'EXTRA' | 'CATEGORIE_I' | 'CATEGORIE_II' | 'REJETE';
    automaticRejectReasons?: string[];
  };
  labSampleRequired?: boolean;
  labAnalyses?: string[];
  labStorageLocation?: string;
  secondaryInspectorName?: string;
  recommendedDecision?: QCDecisionType;
  overrideJustification?: string;
  nonconformityCodes?: string[];
  checkResults: Array<{
    checklist_item_id?: string;
    check_code: string;
    check_name: string;
    category?: string;
    severity: CheckSeverity;
    result: CheckResult;
    note?: string;
    measured_value?: string;
    expected_value?: string;
  }>;
};

// ── New API helpers for receptions-ext and material-receptions endpoints ─────

export const receptionsExtApi = {
  // Simple V2 create (header only, no lot creation)
  createHeader: async (payload: Record<string, unknown>) => {
    const r = await apiRequest<{ data: ReceptionV2 }>('/receptions-v2', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return r.data;
  },

  update: async (id: string, payload: Record<string, unknown>) => {
    const r = await apiRequest<{ data: ReceptionV2 }>(`/receptions-v2/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    return r.data;
  },

  updateStatus: async (id: string, payload: { status: string; validated_by?: string; cancellation_reason?: string }) => {
    const r = await apiRequest<{ data: ReceptionV2 }>(`/receptions-v2/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    return r.data;
  },

  createLot: async (payload: Record<string, unknown>) => {
    const r = await apiRequest<{ data: ReceptionLot }>('/reception-lots', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return r.data;
  },

  listLabPendingInspections: async () => {
    const r = await apiRequest<{ data: unknown[] }>('/qc-inspections?lab_pending=true');
    return r.data ?? [];
  },

  updateQcInspection: async (id: string, payload: Record<string, unknown>) => {
    const r = await apiRequest<{ data: unknown }>(`/qc-inspections/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    return r.data;
  },
};

export const materialReceptionsApi = {
  list: async () => {
    const r = await apiRequest<{ data: unknown[] }>('/material-receptions');
    return r.data ?? [];
  },

  create: async (payload: Record<string, unknown>) => {
    const r = await apiRequest<{ data: unknown }>('/material-receptions', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return r.data;
  },

  updateStatus: async (id: string, payload: Record<string, unknown>) => {
    const r = await apiRequest<{ data: unknown }>(`/material-receptions/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    return r.data;
  },

  listAuditLogs: async (id: string) => {
    const r = await apiRequest<{ data: unknown[] }>(`/material-receptions/${encodeURIComponent(id)}/audit-logs`);
    return r.data ?? [];
  },

  createAuditLog: async (id: string, payload: Record<string, unknown>) => {
    const r = await apiRequest<{ data: unknown }>(`/material-receptions/${encodeURIComponent(id)}/audit-logs`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return r.data;
  },
};

// ─────────────────────────────────────────────────────────────────────────────

export const receptionsApi = {
  list: async () => {
    const response = await apiRequest<ApiEnvelope<ReceptionV2[]>>('/receptions');
    return response.data || [];
  },

  getById: async (receptionId: string) => {
    const response = await apiRequest<ApiEnvelope<ReceptionV2 | null>>(`/receptions/${encodeURIComponent(receptionId)}`);
    return response.data;
  },

  listLots: async (receptionId: string) => {
    const response = await apiRequest<ApiEnvelope<ReceptionLot[]>>(`/receptions/${encodeURIComponent(receptionId)}/lots`);
    return response.data || [];
  },

  listUnits: async (lotId: string) => {
    const response = await apiRequest<ApiEnvelope<ReceptionUnit[]>>(`/reception-lots/${encodeURIComponent(lotId)}/units`);
    return response.data || [];
  },

  listQcInspections: async (receptionId: string) => {
    const response = await apiRequest<ApiEnvelope<QCInspection[]>>(`/receptions/${encodeURIComponent(receptionId)}/qc-inspections`);
    return response.data || [];
  },

  listQcChecklists: async (receptionType?: string) => {
    const params = new URLSearchParams();
    if (receptionType) {
      params.set('receptionType', receptionType);
    }
    const suffix = params.toString() ? `?${params.toString()}` : '';
    const response = await apiRequest<ApiEnvelope<QCChecklist[]>>(`/qc-checklists${suffix}`);
    return response.data || [];
  },

  listQcChecklistItems: async (checklistId: string) => {
    const response = await apiRequest<ApiEnvelope<QCChecklistItem[]>>(`/qc-checklists/${encodeURIComponent(checklistId)}/items`);
    return response.data || [];
  },

  listAlerts: async () => {
    const response = await apiRequest<ApiEnvelope<ReceptionAlert[]>>('/reception-alerts');
    return response.data || [];
  },

  acknowledgeAlert: async (alertId: string, actorName: string) => {
    const response = await apiRequest<ApiEnvelope<ReceptionAlert>>(`/reception-alerts/${encodeURIComponent(alertId)}/acknowledge`, {
      method: 'PATCH',
      body: JSON.stringify({ actorName }),
    });
    return response.data;
  },

  resolveAlert: async (alertId: string, actorName: string) => {
    const response = await apiRequest<ApiEnvelope<ReceptionAlert>>(`/reception-alerts/${encodeURIComponent(alertId)}/resolve`, {
      method: 'PATCH',
      body: JSON.stringify({ actorName }),
    });
    return response.data;
  },

  getCalibrationStatus: async () => {
    const response = await apiRequest<ApiEnvelope<{ calibrated: boolean }>>('/qc/calibration-status');
    return response.data;
  },

  listRawStorageOverdueReceptions: async () => {
    const response = await apiRequest<ApiEnvelope<RawStorageOverdueReception[]>>('/receptions/raw-storage-overdue');
    return response.data || [];
  },

  lookupLot: async (scanValue: string) => {
    const params = new URLSearchParams({ scan: scanValue });
    const response = await apiRequest<ApiEnvelope<LookupReceptionLot | null>>(`/reception-lots/lookup?${params.toString()}`);
    return response.data;
  },

  createUnit: async (payload: CreateReceptionUnitInput) => {
    const response = await apiRequest<ApiEnvelope<ReceptionUnit>>(
      `/reception-lots/${encodeURIComponent(payload.reception_lot_id)}/units`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    );

    return response.data;
  },

  moveLotToStorage: async (payload: MoveReceptionLotToStorageInput) => {
    const response = await apiRequest<ApiEnvelope<MoveReceptionLotToStorageResponse>>(
      `/reception-lots/${encodeURIComponent(payload.lotId)}/storage-moves`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    );

    return response.data;
  },

  startQcInspection: async (payload: StartQcInspectionInput) => {
    const response = await apiRequest<ApiEnvelope<QCInspection>>('/qc/start', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    return response.data;
  },

  submitQcDecision: async (payload: SubmitQcDecisionInput) => {
    const response = await apiRequest<ApiEnvelope<QCInspection>>('/qc/submit', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    return response.data;
  },

  markUnitPrinted: async (unitId: string) => {
    const response = await apiRequest<ApiEnvelope<ReceptionUnit>>('/reception-units/mark-printed', {
      method: 'POST',
      body: JSON.stringify({ unitId }),
    });

    return response.data;
  },
};
