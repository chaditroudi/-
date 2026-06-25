import { createApi } from '@reduxjs/toolkit/query/react';
import { axiosBaseQuery } from '@/lib/axiosBaseQuery';
import type {
  ReceptionV2,
  ReceptionLot,
  ReceptionUnit,
  QCInspection,
  QCChecklist,
  ReceptionAlert,
} from '@/types/reception';
import type { MoveReceptionLotToStorageInput, MoveReceptionLotToStorageResponse, StartQcInspectionInput, SubmitQcDecisionInput } from '@/lib/api/receptions';

type Envelope<T> = { data: T };

export const receptionsApi = createApi({
  reducerPath: 'receptionsApi',
  baseQuery: axiosBaseQuery,
  tagTypes: [
    'Reception',
    'ReceptionLot',
    'ReceptionUnit',
    'QcInspection',
    'QcChecklist',
    'ReceptionAlert',
    'ReceptionAudit',
    'StockMovement',
    'LiberedLot',
  ],
  endpoints: (b) => ({

    // ── Receptions ─────────────────────────────────────────────────────────────

    listReceptions: b.query<ReceptionV2[], void>({
      query: () => ({ url: '/receptions' }),
      transformResponse: (r: Envelope<ReceptionV2[]>) => r.data ?? [],
      providesTags: ['Reception'],
    }),

    getReception: b.query<ReceptionV2, string>({
      query: (id) => ({ url: `/receptions/${id}` }),
      transformResponse: (r: Envelope<ReceptionV2>) => r.data,
      providesTags: (_r, _e, id) => [{ type: 'Reception', id }],
    }),

    createReception: b.mutation<ReceptionV2, Record<string, unknown>>({
      query: (body) => ({ url: '/receptions-v2', method: 'POST', data: body }),
      transformResponse: (r: Envelope<ReceptionV2>) => r.data,
      invalidatesTags: ['Reception'],
    }),

    updateReception: b.mutation<ReceptionV2, { id: string } & Record<string, unknown>>({
      query: ({ id, ...body }) => ({ url: `/receptions-v2/${id}`, method: 'PATCH', data: body }),
      transformResponse: (r: Envelope<ReceptionV2>) => r.data,
      invalidatesTags: (_r, _e, arg) => ['Reception', { type: 'Reception', id: arg.id }],
    }),

    updateReceptionStatus: b.mutation<ReceptionV2, { id: string; status: string; validated_by?: string; cancellation_reason?: string }>({
      query: ({ id, ...body }) => ({ url: `/receptions-v2/${id}/status`, method: 'PATCH', data: body }),
      transformResponse: (r: Envelope<ReceptionV2>) => r.data,
      invalidatesTags: (_r, _e, arg) => [
        'Reception',
        { type: 'Reception', id: arg.id },
        'ReceptionAlert',
        'LiberedLot',
      ],
    }),

    // ── Reception Lots ─────────────────────────────────────────────────────────

    listReceptionLots: b.query<ReceptionLot[], string>({
      query: (receptionId) => ({ url: `/receptions/${receptionId}/lots` }),
      transformResponse: (r: Envelope<ReceptionLot[]>) => r.data ?? [],
      providesTags: (_r, _e, id) => [{ type: 'ReceptionLot', id }],
    }),

    createReceptionLot: b.mutation<ReceptionLot, { receptionId: string } & Record<string, unknown>>({
      query: ({ receptionId, ...body }) => ({ url: '/reception-lots', method: 'POST', data: { reception_id: receptionId, ...body } }),
      transformResponse: (r: Envelope<ReceptionLot>) => r.data,
      invalidatesTags: (_r, _e, arg) => [{ type: 'ReceptionLot', id: arg.receptionId }, 'Reception'],
    }),

    updateReceptionLot: b.mutation<ReceptionLot, { lotId: string; receptionId: string } & Record<string, unknown>>({
      query: ({ lotId, receptionId: _rid, ...body }) => ({ url: `/reception-lots/${lotId}`, method: 'PATCH', data: body }),
      transformResponse: (r: Envelope<ReceptionLot>) => r.data,
      invalidatesTags: (_r, _e, arg) => [{ type: 'ReceptionLot', id: arg.receptionId }],
    }),

    moveLotToStorage: b.mutation<MoveReceptionLotToStorageResponse, MoveReceptionLotToStorageInput>({
      query: ({ lotId, ...body }) => ({ url: `/reception-lots/${lotId}/storage-moves`, method: 'POST', data: body }),
      invalidatesTags: (_r, _e, arg) => [
        { type: 'ReceptionLot', id: arg.lotId },
        'LiberedLot',
        'StockMovement',
        'ReceptionAudit',
      ],
    }),

    // ── Reception Units ────────────────────────────────────────────────────────

    listReceptionUnits: b.query<ReceptionUnit[], string>({
      query: (lotId) => ({ url: `/reception-lots/${lotId}/units` }),
      transformResponse: (r: Envelope<ReceptionUnit[]>) => r.data ?? [],
      providesTags: (_r, _e, id) => [{ type: 'ReceptionUnit', id }],
    }),

    createReceptionUnit: b.mutation<ReceptionUnit, { lotId: string } & Record<string, unknown>>({
      query: ({ lotId, ...body }) => ({ url: `/reception-lots/${lotId}/units`, method: 'POST', data: body }),
      transformResponse: (r: Envelope<ReceptionUnit>) => r.data,
      invalidatesTags: (_r, _e, arg) => [{ type: 'ReceptionUnit', id: arg.lotId }],
    }),

    // ── QC Checklists ──────────────────────────────────────────────────────────

    listQcChecklists: b.query<QCChecklist[], string | undefined>({
      query: (receptionType) => ({
        url: '/qc-checklists',
        params: receptionType ? { receptionType } : undefined,
      }),
      transformResponse: (r: Envelope<QCChecklist[]>) => r.data ?? [],
      providesTags: ['QcChecklist'],
    }),

    // ── QC Inspections ─────────────────────────────────────────────────────────

    listQcInspections: b.query<QCInspection[], string>({
      query: (receptionId) => ({ url: `/receptions/${receptionId}/qc-inspections` }),
      transformResponse: (r: Envelope<QCInspection[]>) => r.data ?? [],
      providesTags: (_r, _e, id) => [{ type: 'QcInspection', id }],
    }),

    startQcInspection: b.mutation<QCInspection, StartQcInspectionInput>({
      query: (body) => ({ url: '/qc/start', method: 'POST', data: body }),
      transformResponse: (r: Envelope<QCInspection>) => r.data,
      invalidatesTags: (_r, _e, arg) => [
        { type: 'QcInspection', id: arg.reception_id },
        { type: 'Reception', id: arg.reception_id },
      ],
    }),

    submitQcDecision: b.mutation<QCInspection, SubmitQcDecisionInput>({
      query: ({ inspectionId, ...body }) => ({
        url: '/qc/submit',
        method: 'POST',
        data: { inspection_id: inspectionId, ...body },
      }),
      transformResponse: (r: Envelope<QCInspection>) => r.data,
      invalidatesTags: (result) => [
        { type: 'QcInspection', id: result?.reception_id },
        { type: 'Reception', id: result?.reception_id },
        { type: 'ReceptionLot', id: result?.reception_id },
        'ReceptionAlert',
        'LiberedLot',
      ],
    }),

    // ── Reception Alerts ───────────────────────────────────────────────────────

    listReceptionAlerts: b.query<ReceptionAlert[], void>({
      query: () => ({ url: '/reception-alerts' }),
      transformResponse: (r: Envelope<ReceptionAlert[]>) => r.data ?? [],
      providesTags: ['ReceptionAlert'],
    }),

    acknowledgeReceptionAlert: b.mutation<ReceptionAlert, { alertId: string; actorName: string }>({
      query: ({ alertId, actorName }) => ({
        url: `/reception-alerts/${alertId}/acknowledge`,
        method: 'PATCH',
        data: { actorName },
      }),
      invalidatesTags: ['ReceptionAlert'],
    }),

    resolveReceptionAlert: b.mutation<ReceptionAlert, { alertId: string; actorName: string }>({
      query: ({ alertId, actorName }) => ({
        url: `/reception-alerts/${alertId}/resolve`,
        method: 'PATCH',
        data: { actorName },
      }),
      invalidatesTags: ['ReceptionAlert'],
    }),

    // ── Raw storage overdue (RG-S10) ──────────────────────────────────────────

    listRawStorageOverdue: b.query<unknown[], void>({
      query: () => ({ url: '/receptions/raw-storage-overdue' }),
      transformResponse: (r: any) => r.data ?? [],
      providesTags: ['Reception'],
      keepUnusedDataFor: 60,
    }),

    // ── QC Calibration status ──────────────────────────────────────────────────

    getCalibrationStatus: b.query<{ calibrated: boolean; lastCalibrationAt?: string | null; message?: string }, void>({
      query: () => ({ url: '/qc/calibration-status' }),
      transformResponse: (r: any) => r.data ?? r,
      keepUnusedDataFor: 300,
    }),

    // ── Audit log ──────────────────────────────────────────────────────────────

    listReceptionAudit: b.query<unknown[], string>({
      query: (receptionId) => ({ url: `/receptions/${receptionId}/audit-logs` }),
      transformResponse: (r: Envelope<unknown[]>) => r.data ?? [],
      providesTags: (_r, _e, id) => [{ type: 'ReceptionAudit', id }],
    }),

    // ── Stock movements for a lot ──────────────────────────────────────────────

    listReceptionStockMovements: b.query<unknown[], string>({
      query: (receptionId) => ({ url: `/receptions/${receptionId}/stock-movements` }),
      transformResponse: (r: Envelope<unknown[]>) => r.data ?? [],
      providesTags: (_r, _e, id) => [{ type: 'StockMovement', id }],
    }),
  }),
});

export const {
  useListReceptionsQuery,
  useGetReceptionQuery,
  useCreateReceptionMutation,
  useUpdateReceptionMutation,
  useUpdateReceptionStatusMutation,
  useListReceptionLotsQuery,
  useCreateReceptionLotMutation,
  useUpdateReceptionLotMutation,
  useMoveLotToStorageMutation,
  useListReceptionUnitsQuery,
  useCreateReceptionUnitMutation,
  useListQcChecklistsQuery,
  useListQcInspectionsQuery,
  useStartQcInspectionMutation,
  useSubmitQcDecisionMutation,
  useListReceptionAlertsQuery,
  useAcknowledgeReceptionAlertMutation,
  useResolveReceptionAlertMutation,
  useListReceptionAuditQuery,
  useListReceptionStockMovementsQuery,
  useListRawStorageOverdueQuery,
  useGetCalibrationStatusQuery,
} = receptionsApi;
