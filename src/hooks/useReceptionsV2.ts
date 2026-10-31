import { useEffect } from 'react';
import { failureMessage } from '@/lib/apiErrors';
import { ApiRequestError } from '@/lib/axiosClient';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getSseConnection } from '@/lib/sseClient';
import { receptionsExtApi, type CreateReceptionUnitInput, type MoveReceptionLotToStorageInput, type StartQcInspectionInput, type SubmitQcDecisionInput } from '@/lib/api/receptions';
import { ReceptionV2, ReceptionType, QCDecisionType, ReceptionHeaderStatus, receptionStatusLabels } from '@/types/reception';
import { checkLotStorageAllowed } from '@/lib/phase1RuleEngine';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  fetchReceptions,
  getReceptionStatusFromDecision,
  receptionPatched,
  receptionUpserted,
  selectAllReceptions,
  selectReceptionsError,
  selectReceptionsErrorStatus,
  selectReceptionsInitialized,
  selectReceptionsStatus,
  selectReceptionStats as selectReceptionStatsFromStore,
} from '@/store/slices/receptionsSlice';
import {
  useListReceptionsQuery,
  useGetReceptionQuery,
  useCreateReceptionMutation,
  useUpdateReceptionStatusMutation,
  useCancelReceptionMutation,
  useListReceptionLotsQuery,
  useCreateReceptionLotMutation,
  useChangeLotQualityStatusMutation,
  useListReceptionUnitsQuery,
  useCreateReceptionUnitMutation,
  useMoveLotToStorageMutation,
  useListQcChecklistsQuery,
  useListQcInspectionsQuery,
  useStartQcInspectionMutation,
  useSubmitQcDecisionMutation,
  useListReceptionAlertsQuery,
  useAcknowledgeReceptionAlertMutation,
  useResolveReceptionAlertMutation,
  useGetCalibrationStatusQuery,
  useListRawStorageOverdueQuery,
  receptionsApi as receptionsRtkApi,
} from '@/store/api/receptionsApi';
import { stockApi } from '@/store/api/stockApi';

type QueryOptions = { enabled?: boolean };


export const useReceptionsV2 = (options?: QueryOptions) => {
  const dispatch = useAppDispatch();
  const enabled = options?.enabled ?? true;
  const data = useAppSelector(selectAllReceptions);
  const status = useAppSelector(selectReceptionsStatus);
  const errorMessage = useAppSelector(selectReceptionsError);
  const errorStatus = useAppSelector(selectReceptionsErrorStatus);
  const initialized = useAppSelector(selectReceptionsInitialized);

  useEffect(() => {
    if (!enabled) return;
    if (!initialized && status === 'idle') void dispatch(fetchReceptions());
  }, [dispatch, enabled, initialized, status]);

  useEffect(() => {
    if (!enabled) return;
    const sse = getSseConnection();
    return sse.subscribe((msg) => {
      if (msg.eventName === 'db_change' && msg.payload.resource === 'receptions') {
        void dispatch(fetchReceptions());
      }
    });
  }, [dispatch, enabled]);

  return {
    data,
    isLoading: enabled && (!initialized || status === 'loading'),
    isFetching: status === 'loading',
    isError: Boolean(errorMessage),
    error: errorMessage ? new ApiRequestError({ message: errorMessage, status: errorStatus }) : null,
    refetch: () => dispatch(fetchReceptions()).unwrap(),
  };
};

// ── Single reception ───────────────────────────────────────────────────────────

export const useReceptionV2Detail = (id: string) => {
  return useGetReceptionQuery(id, { skip: !id });
};

// ── Lot barcode scan lookup (standalone async fn) ──────────────────────────────

export const findReceptionLotByScan = async (scanValue: string) => {
  const { receptionsApi: libApi } = await import('@/lib/api/receptions');
  const normalizedValue = scanValue.trim();
  if (!normalizedValue) return null;
  return libApi.lookupLot(normalizedValue);
};

// ── Create reception V2 ────────────────────────────────────────────────────────

export const useCreateReceptionV2 = () => {
  const dispatch = useAppDispatch();
  const [createMutation, state] = useCreateReceptionMutation();

  return {
    mutateAsync: async (reception: {
      supplier_id: string;
      reception_type: ReceptionType;
      product_id?: string;
      material_id?: string;
      quantity_total: number;
      unit?: string;
      packaging_type?: string;
      delivery_note_number?: string;
      delivery_note_photos?: string[];
      vehicle_number?: string;
      driver_name?: string;
      remarks?: string;
      gross_weight_kg?: number;
      tare_weight_kg?: number;
      declared_weight_kg?: number;
      weight_gap_percent?: number | null;
      crate_count?: number;
      average_weight_per_crate?: number | null;
      variety?: string;
      maturity_stage?: string;
      harvest_method?: string;
      bio_declared?: boolean;
      arrival_temperature_c?: number;
      departure_time?: string;
      transport_condition?: string;
      quick_visual_state?: string;
      storage_zone_code?: string;
      transport_duration_hours?: number | null;
      phase1_alerts?: string[];
      created_by?: string;
    }) => {
      const data = await createMutation({
        reception_number: 'REC-TEMP-' + Date.now(),
        supplier_id: reception.supplier_id,
        reception_type: reception.reception_type,
        product_id: reception.product_id ?? null,
        material_id: reception.material_id ?? null,
        quantity_total: reception.quantity_total,
        unit: (reception.unit ?? '').trim() || null,
        packaging_type: reception.packaging_type ?? null,
        delivery_note_number: reception.delivery_note_number ?? null,
        delivery_note_photos: reception.delivery_note_photos ?? null,
        vehicle_number: reception.vehicle_number ?? null,
        driver_name: reception.driver_name ?? null,
        remarks: reception.remarks ?? null,
        gross_weight_kg: reception.gross_weight_kg ?? null,
        tare_weight_kg: reception.tare_weight_kg ?? null,
        declared_weight_kg: reception.declared_weight_kg ?? null,
        weight_gap_percent: reception.weight_gap_percent ?? null,
        crate_count: reception.crate_count ?? null,
        average_weight_per_crate: reception.average_weight_per_crate ?? null,
        variety: reception.variety ?? null,
        maturity_stage: reception.maturity_stage ?? null,
        harvest_method: reception.harvest_method ?? null,
        bio_declared: reception.bio_declared ?? false,
        arrival_temperature_c: reception.arrival_temperature_c ?? null,
        departure_time: reception.departure_time ?? null,
        transport_condition: reception.transport_condition ?? null,
        quick_visual_state: reception.quick_visual_state ?? null,
        storage_zone_code: reception.storage_zone_code ?? null,
        transport_duration_hours: reception.transport_duration_hours ?? null,
        phase1_alerts: reception.phase1_alerts ?? null,
        created_by: reception.created_by ?? null,
        status: 'BROUILLON',
      }).unwrap();
      dispatch(receptionUpserted(data as ReceptionV2));
      void dispatch(fetchReceptions());
      toast.success('Réception créée en mode brouillon');
      return data;
    },
    isPending: state.isLoading,
    isError: !!state.error,
    error: state.error,
  };
};

// ── Update reception status ────────────────────────────────────────────────────

export const useUpdateReceptionV2Status = () => {
  const dispatch = useAppDispatch();
  const [updateStatus, state] = useUpdateReceptionStatusMutation();

  return {
    mutateAsync: async (payload: {
      id: string;
      status: ReceptionHeaderStatus;
      validated_by?: string;
      cancellation_reason?: string;
    }) => {
      const data = await updateStatus(payload).unwrap();
      dispatch(receptionUpserted(data as ReceptionV2));
      toast.success(`Statut mis à jour : ${receptionStatusLabels[(data as ReceptionV2).status] ?? (data as ReceptionV2).status}`);
      return data;
    },
    mutate: (payload: { id: string; status: ReceptionHeaderStatus; validated_by?: string; cancellation_reason?: string }) => {
      void updateStatus(payload).unwrap()
        .then((data) => {
          dispatch(receptionUpserted(data as ReceptionV2));
          toast.success(`Statut mis à jour: ${(data as any).status}`);
        })
        .catch((err) => toast.error(err instanceof Error ? err.message : 'Erreur lors de la mise à jour'));
    },
    isPending: state.isLoading,
    isError: !!state.error,
  };
};

// ── Lots ───────────────────────────────────────────────────────────────────────

export const useReceptionLots = (receptionId: string) => {
  return useListReceptionLotsQuery(receptionId, { skip: !receptionId });
};

export const useCreateReceptionLot = () => {
  const [createLot, state] = useCreateReceptionLotMutation();

  return {
    mutateAsync: async (lot: {
      reception_id: string;
      lot_supplier: string;
      quantity: number;
      unit: string;
      origin_country?: string;
      origin_region?: string;
      origin_farm?: string;
      harvest_date?: string;
      expiry_date?: string;
      maturity_stage?: string;
      article_ref?: string;
      infestation_rate?: number;
      variety?: string;
      supplier_code?: string | null;
    }) => {
      if (!lot.reception_id) throw new Error('reception_id is required to create a lot');
      const data = await createLot({
        receptionId: lot.reception_id,
        lot_supplier: lot.lot_supplier,
        quantity: lot.quantity,
        unit: lot.unit || 'kg',
        origin_country: lot.origin_country ?? 'Tunisie',
        origin_region: lot.origin_region ?? null,
        origin_farm: lot.origin_farm ?? null,
        harvest_date: lot.harvest_date ?? null,
        expiry_date: lot.expiry_date ?? null,
        maturity_stage: lot.maturity_stage ?? null,
        article_ref: lot.article_ref ?? null,
        infestation_rate: lot.infestation_rate ?? null,
        variety: lot.variety ?? null,
        supplier_code: lot.supplier_code ?? null,
      }).unwrap();
      toast.success('Lot ajouté');
      return data;
    },
    isPending: state.isLoading,
    isError: !!state.error,
  };
};

/** RTK Query rejects with the server message as a plain string. */
export const receptionErrorMessage = (error: unknown, fallback: string) =>
  failureMessage(error, fallback);

/**
 * Post-QC lot status change. The server checks the QC decision, the signature
 * PIN for a release, and keeps stock, purchase order and reception in step.
 */
const useLotQualityStatus = (action: 'RELEASE' | 'QUARANTINE') => {
  const dispatch = useAppDispatch();
  const [changeStatus, state] = useChangeLotQualityStatusMutation();

  return {
    mutateAsync: async ({
      receptionId,
      lotId,
      reason,
      pin,
      checkResults,
    }: {
      receptionId: string;
      lotId: string;
      reason?: string | null;
      pin?: string | null;
      checkResults?: Array<{ checklist_item_id: string; check_code: string; result: string }>;
    }) => {
      try {
        const data = await changeStatus({ receptionId, lotId, action, checkResults, reason: reason || null, pin: pin || null }).unwrap();
        dispatch(receptionUpserted(data.reception));
        dispatch(stockApi.util.invalidateTags(['StockLot', 'StockSummary']));
        const lot = data.lots.find((row) => row.id === lotId);
        const label = lot?.lot_internal || lot?.lot_supplier || lotId;
        if (action === 'RELEASE') toast.success(`Lot ${label} libéré`);
        else toast.warning(`Lot ${label} mis en quarantaine`);
        return data;
      } catch (error) {
        toast.error(receptionErrorMessage(error, 'Changement de statut qualité refusé'));
        throw error;
      }
    },
    isPending: state.isLoading,
    isError: !!state.error,
  };
};

export const useQuarantineReceptionLot = () => useLotQualityStatus('QUARANTINE');
export const useReleaseReceptionLot = () => useLotQualityStatus('RELEASE');

export const useCancelReception = () => {
  const dispatch = useAppDispatch();
  const [cancel, state] = useCancelReceptionMutation();

  return {
    mutateAsync: async ({ id, reason }: { id: string; reason: string }) => {
      try {
        const data = await cancel({ id, reason }).unwrap();
        dispatch(receptionUpserted(data.reception));
        dispatch(stockApi.util.invalidateTags(['StockLot', 'StockSummary']));
        toast.warning(`Réception ${data.reception.reception_number} annulée — stock retiré`);
        return data;
      } catch (error) {
        toast.error(receptionErrorMessage(error, "Annulation impossible"));
        throw error;
      }
    },
    isPending: state.isLoading,
  };
};

// ── Units ──────────────────────────────────────────────────────────────────────

export const useReceptionUnits = (lotId: string) => {
  return useListReceptionUnitsQuery(lotId, { skip: !lotId });
};

export const useCreateReceptionUnit = () => {
  const [createUnit, state] = useCreateReceptionUnitMutation();

  return {
    mutateAsync: async (unit: CreateReceptionUnitInput) => {
      const data = await createUnit({ lotId: unit.reception_lot_id, ...unit }).unwrap();
      toast.success('Unité logistique ajoutée');
      return data;
    },
    isPending: state.isLoading,
    isError: !!state.error,
  };
};

export const useMarkReceptionUnitPrinted = () => {
  return {
    mutateAsync: async (unitId: string) => {
      const { receptionsApi: libApi } = await import('@/lib/api/receptions');
      return libApi.markUnitPrinted(unitId);
    },
    isPending: false,
  };
};


export const useMoveReceptionLotToStorage = () => {
  const dispatch = useAppDispatch();
  const [moveLot, state] = useMoveLotToStorageMutation();

  return {
    mutateAsync: async (payload: MoveReceptionLotToStorageInput & {
      _lotStockStatus?: string;
      _receptionStatus?: string;
    }) => {
      if (payload._lotStockStatus !== undefined && payload._receptionStatus !== undefined) {
        const guard = checkLotStorageAllowed({
          lotStockStatus: payload._lotStockStatus,
          receptionStatus: payload._receptionStatus,
          targetZoneCode: payload.targetZone,
        });
        if (!guard.allowed) throw new Error(guard.reason || 'Déplacement refusé par la règle RG-R07');
      }
      const { _lotStockStatus: _ls, _receptionStatus: _rs, ...cleanPayload } = payload;
      try {
        const result = await moveLot(cleanPayload).unwrap();
        dispatch(stockApi.util.invalidateTags(['StockLot', 'StockSummary']));
        toast.success('Lot déplacé en stock');
        return result;
      } catch (error) {
        // The server records the signed-in user and enforces QC/scan rules; show its reason.
        toast.error(receptionErrorMessage(error, 'Erreur lors du déplacement en stock'));
        throw error;
      }
    },
    isPending: state.isLoading,
    isError: !!state.error,
  };
};

// ── QC Checklists ──────────────────────────────────────────────────────────────

export const useQCChecklists = (receptionType?: string) => {
  return useListQcChecklistsQuery(receptionType, { skip: false });
};

/** The one published checklist for a reception type, and whether there is none to work from. */
export const useQcChecklist = (receptionType?: string | null) => {
  const { data: checklists = [], isLoading: listLoading } = useListQcChecklistsQuery(receptionType ?? '', { skip: !receptionType });
  const checklist = receptionType ? checklists[0] ?? null : null;
  const { data: items = [], isLoading: itemsLoading } = useQCChecklistItems(checklist?.id ?? '');
  const isLoading = listLoading || itemsLoading;
  return { checklist, items, isLoading, unavailable: Boolean(receptionType) && !isLoading && items.length === 0 };
};

export const useQCChecklistItems = (checklistId: string) => {
  return useQuery({
    queryKey: ['qc-checklist-items', checklistId],
    queryFn: async () => {
      const { receptionsApi: libApi } = await import('@/lib/api/receptions');
      return libApi.listQcChecklistItems(checklistId);
    },
    enabled: !!checklistId,
  });
};

// ── QC Inspections ─────────────────────────────────────────────────────────────

export const useQCInspections = (receptionId: string) => {
  return useListQcInspectionsQuery(receptionId, { skip: !receptionId });
};

export const useLabPendingInspections = () => {
  return useQuery({
    queryKey: ['lab-pending-inspections'],
    queryFn: () => receptionsExtApi.listLabPendingInspections(),
    staleTime: 60_000,
  });
};

export const useCreateQCInspection = () => {
  const dispatch = useAppDispatch();
  const [startInspection, state] = useStartQcInspectionMutation();

  return {
    mutateAsync: async (inspection: StartQcInspectionInput) => {
      const data = await startInspection(inspection).unwrap();
      dispatch(receptionPatched({
        id: data.reception_id,
        changes: { status: 'EN_QC', updated_at: new Date().toISOString() },
      }));
      toast.success('Inspection QC démarrée');
      return data;
    },
    isPending: state.isLoading,
    isError: !!state.error,
  };
};

export const useSubmitQCDecision = () => {
  const dispatch = useAppDispatch();
  const [submitDecision, state] = useSubmitQcDecisionMutation();

  return {
    mutateAsync: async (payload: SubmitQcDecisionInput & { overridePhoto?: string }) => {
      const { overridePhoto: _op, ...cleanPayload } = payload;
      const data = await submitDecision(cleanPayload).unwrap();
      dispatch(receptionPatched({
        id: data.reception_id,
        changes: {
          status: getReceptionStatusFromDecision(data.decision as QCDecisionType),
          qc_decision: data.decision as QCDecisionType,
          qc_closed_at: data.ended_at,
          updated_at: data.updated_at,
        },
      }));
      // Invalidate stock caches — they live in a separate RTK slice and won't
      // refresh otherwise after the QC decision syncs lots into stock_lots.
      dispatch(stockApi.util.invalidateTags(['StockLot', 'StockSummary']));
      const messages: Record<QCDecisionType, string> = {
        ACCEPTE: 'Réception ACCEPTÉE - Stock libéré',
        QUARANTAINE: 'Réception en QUARANTAINE',
        REJETE: 'Réception REJETÉE',
      };
      if (data.decision === 'ACCEPTE') toast.success(messages[data.decision as QCDecisionType]);
      else if (data.decision === 'QUARANTAINE') toast.warning(messages[data.decision as QCDecisionType]);
      else toast.error(messages[data.decision as QCDecisionType]);
      return data;
    },
    isPending: state.isLoading,
    isError: !!state.error,
  };
};

// ── Alerts ─────────────────────────────────────────────────────────────────────

export const useReceptionAlerts = (options?: QueryOptions) => {
  const dispatch = useAppDispatch();
  const enabled = options?.enabled ?? true;

  useEffect(() => {
    if (!enabled) return;
    const sse = getSseConnection();
    return sse.subscribe((msg) => {
      if (msg.eventName === 'db_change' && msg.payload.resource === 'receptions') {
        dispatch(receptionsRtkApi.util.invalidateTags(['ReceptionAlert']));
      }
    });
  }, [dispatch, enabled]);

  return useListReceptionAlertsQuery(undefined, {
    skip: !enabled,
    pollingInterval: 2 * 60_000,
  });
};

export const useAcknowledgeReceptionAlert = () => {
  const [acknowledge, state] = useAcknowledgeReceptionAlertMutation();
  return {
    mutateAsync: (args: { alertId: string; actorName: string }) => acknowledge(args).unwrap(),
    isPending: state.isLoading,
  };
};

export const useResolveReceptionAlert = () => {
  const [resolve, state] = useResolveReceptionAlertMutation();
  return {
    mutateAsync: (args: { alertId: string; actorName: string }) => resolve(args).unwrap(),
    isPending: state.isLoading,
  };
};

// ── Stats (Redux-backed) ───────────────────────────────────────────────────────

export const useReceptionStats = () => {
  const dispatch = useAppDispatch();
  const data = useAppSelector(selectReceptionStatsFromStore);
  const status = useAppSelector(selectReceptionsStatus);
  const errorMessage = useAppSelector(selectReceptionsError);
  const initialized = useAppSelector(selectReceptionsInitialized);

  useEffect(() => {
    if (!initialized && status === 'idle') void dispatch(fetchReceptions());
  }, [dispatch, initialized, status]);

  return {
    data,
    isLoading: !initialized || status === 'loading',
    isError: Boolean(errorMessage),
    error: errorMessage ? new Error(errorMessage) : null,
  };
};

// ── Raw storage overdue receptions (RG-S10) ───────────────────────────────────

export const useRawStorageOverdueReceptions = () => {
  return useListRawStorageOverdueQuery(undefined, { pollingInterval: 60_000 });
};

// ── QC Calibration status ──────────────────────────────────────────────────────

export const useCalibrationStatus = () => {
  return useGetCalibrationStatusQuery();
};
