import { toast } from 'sonner';
import { ROYAL_PALM_STORAGE_ZONES } from '@/lib/royalPalmPhase1';
import type { Batch, BatchStatus, QualityGrade, NonConformity, BatchMovement, Alert, NonConformityAction, AlertSeverity, StorageZone } from '@/types/batch';
import {
  useListStorageZonesQuery,
  useCreateStorageZoneMutation,
  useUpdateStorageZoneMutation,
  useListBatchesQuery,
  useGetBatchQuery,
  useCreateBatchMutation,
  useUpdateBatchMutation,
  useListQualityInspectionsQuery,
  useCreateQualityInspectionMutation,
  useListNonConformitiesQuery,
  useCreateNonConformityMutation,
  useListMovementsQuery,
  useCreateMovementMutation,
  useListAlertsQuery,
  useAcknowledgeAlertMutation,
  useResolveAlertMutation,
  batchesApi as batchesRtkApi,
} from '@/store/api/batchesApi';

type QueryOptions = { enabled?: boolean };

// ── Storage Zones ─────────────────────────────────────────────────────────────

export const useStorageZones = () => {
  const result = useListStorageZonesQuery();
  return {
    ...result,
    data: result.data?.filter((z) => (z as any).is_active !== false),
  };
};

export const useCreateStorageZone = () => {
  const [create, state] = useCreateStorageZoneMutation();
  return {
    mutateAsync: async (zone: {
      code: string;
      name: string;
      zone_type: 'cold_room' | 'ventilated' | 'quarantine' | 'processing';
      capacity_kg: number;
      temperature_min?: number | null;
      temperature_max?: number | null;
      humidity_min?: number | null;
      humidity_max?: number | null;
      notes?: string | null;
    }) => {
      const data = await create({ ...zone, current_load_kg: 0, is_active: true }).unwrap();
      toast.success('Zone de stockage créée');
      return data;
    },
    isPending: state.isLoading,
    isError: !!state.error,
  };
};

export const useUpdateStorageZone = () => {
  const [update, state] = useUpdateStorageZoneMutation();
  return {
    mutateAsync: async (payload: { id: string } & Record<string, unknown>) => {
      const data = await update(payload).unwrap();
      toast.success('Zone de stockage mise à jour');
      return data;
    },
    isPending: state.isLoading,
    isError: !!state.error,
  };
};

export const useDeleteStorageZone = () => {
  const [update, state] = useUpdateStorageZoneMutation();
  return {
    mutateAsync: async (id: string) => {
      const data = await update({ id, is_active: false }).unwrap();
      toast.success('Zone de stockage supprimée');
      return data;
    },
    isPending: state.isLoading,
  };
};

export const useSeedRoyalPalmStorageZones = () => {
  const [createZone, state] = useCreateStorageZoneMutation();
  const { data: existingZones = [] } = useListStorageZonesQuery();

  return {
    mutateAsync: async () => {
      const existingCodes = new Set(existingZones.filter((z) => (z as any).is_active).map((z) => z.code));
      const missing = ROYAL_PALM_STORAGE_ZONES.filter((z) => !existingCodes.has(z.code));
      if (missing.length === 0) {
        toast.success('Le plan Royal Palm est déjà initialisé');
        return { inserted: 0 };
      }
      await Promise.all(missing.map((z) => createZone({ ...z, current_load_kg: 0, is_active: true }).unwrap()));
      toast.success(`${missing.length} zone(s) Royal Palm initialisée(s)`);
      return { inserted: missing.length };
    },
    isPending: state.isLoading,
  };
};

// ── Batches ───────────────────────────────────────────────────────────────────

export const useBatches = (options?: QueryOptions) => {
  return useListBatchesQuery(undefined, { skip: !(options?.enabled ?? true) });
};

export const useBatch = (batchId: string) => {
  const batch = useGetBatchQuery(batchId, { skip: !batchId });
  const inspections = useListQualityInspectionsQuery(batchId, { skip: !batchId });
  return {
    ...batch,
    data: batch.data ? { ...batch.data, inspections: inspections.data ?? [] } : undefined,
    isLoading: batch.isLoading || inspections.isLoading,
  };
};

export const useCreateBatch = () => {
  const [createBatch, state] = useCreateBatchMutation();
  const [createMovement] = useCreateMovementMutation();

  return {
    mutateAsync: async (batch: {
      supplier_id?: string;
      material_id?: string;
      origin_region?: string;
      origin_farm?: string;
      harvest_date?: string;
      initial_weight_kg: number;
      notes?: string;
      created_by?: string;
    }) => {
      const data = await createBatch({
        batch_number: 'LOT-TEMP-' + Date.now(),
        supplier_id: batch.supplier_id ?? null,
        material_id: batch.material_id ?? null,
        origin_region: batch.origin_region ?? null,
        origin_farm: batch.origin_farm ?? null,
        harvest_date: batch.harvest_date ?? null,
        initial_weight_kg: batch.initial_weight_kg,
        current_weight_kg: batch.initial_weight_kg,
        notes: batch.notes ?? null,
        created_by: batch.created_by ?? null,
      }).unwrap();

      createMovement({
        batch_id: (data as any).id,
        movement_type: 'CREATION',
        to_status: 'pending_inspection',
        quantity_kg: batch.initial_weight_kg,
        performed_by: batch.created_by ?? null,
      }).catch(() => null);

      toast.success('Lot créé avec succès');
      return data;
    },
    isPending: state.isLoading,
    isError: !!state.error,
  };
};

export const useUpdateBatchStatus = () => {
  const [updateBatch, state] = useUpdateBatchMutation();
  const [updateZone] = useUpdateStorageZoneMutation();
  const [createMovement] = useCreateMovementMutation();
  const { data: zones = [] } = useListStorageZonesQuery();

  return {
    mutateAsync: async ({
      id,
      status,
      storage_zone_id,
      quality_grade,
      performed_by,
    }: {
      id: string;
      status: BatchStatus;
      storage_zone_id?: string;
      quality_grade?: QualityGrade;
      performed_by?: string;
    }) => {
      const updatePayload: Record<string, unknown> = { status };
      if (storage_zone_id) updatePayload.storage_zone_id = storage_zone_id;
      if (quality_grade) updatePayload.quality_grade = quality_grade;

      const data = await updateBatch({ id, ...updatePayload }).unwrap() as any;

      createMovement({
        batch_id: id,
        movement_type: 'STATUS_CHANGE',
        from_zone_id: data?.storage_zone_id ?? null,
        to_zone_id: storage_zone_id ?? null,
        from_status: data?.status ?? null,
        to_status: status,
        quantity_kg: data?.current_weight_kg ?? null,
        performed_by: performed_by ?? null,
      }).catch(() => null);

      if (storage_zone_id) {
        const prevZoneId = data?.storage_zone_id;
        if (prevZoneId && prevZoneId !== storage_zone_id) {
          const oldZone = zones.find((z) => z.id === prevZoneId);
          if (oldZone) {
            updateZone({
              id: prevZoneId,
              current_load_kg: Math.max(0, (oldZone.current_load_kg ?? 0) - (data?.current_weight_kg ?? 0)),
            }).catch(() => null);
          }
        }
        const newZone = zones.find((z) => z.id === storage_zone_id);
        if (newZone) {
          updateZone({
            id: storage_zone_id,
            current_load_kg: (newZone.current_load_kg ?? 0) + (data?.current_weight_kg ?? 0),
          }).catch(() => null);
        }
      }

      toast.success('Statut mis à jour');
      return data;
    },
    isPending: state.isLoading,
    isError: !!state.error,
  };
};

// ── Quality Inspections ───────────────────────────────────────────────────────

export const useCreateInspection = () => {
  const [createInspection, state] = useCreateQualityInspectionMutation();
  const [updateBatch] = useUpdateBatchMutation();
  const [createAlert] = useAcknowledgeAlertMutation(); // placeholder — see below

  // Use lib api for alert creation (no dedicated RTK mutation exposed)
  const createAlertViaApi = async (payload: Record<string, unknown>) => {
    const { batchesApi: libApi } = await import('@/lib/api/batches');
    return libApi.createAlert(payload).catch(() => null);
  };

  return {
    mutateAsync: async (inspection: {
      batch_id: string;
      weight_measured_kg?: number;
      weight_expected_kg?: number;
      visual_appearance?: string;
      color_uniformity?: boolean;
      size_uniformity?: boolean;
      mold_detected?: boolean;
      mold_percentage?: number;
      pest_detected?: boolean;
      pest_type?: string;
      humidity_measured?: number;
      temperature_measured?: number;
      inspector_name: string;
      notes?: string;
    }) => {
      const weight_variance =
        inspection.weight_expected_kg && inspection.weight_measured_kg
          ? ((inspection.weight_measured_kg - inspection.weight_expected_kg) / inspection.weight_expected_kg) * 100
          : null;
      const weight_passed = weight_variance !== null ? Math.abs(weight_variance) <= 5 : null;
      const visual_passed = !!(inspection.color_uniformity && inspection.size_uniformity);
      const contamination_passed = !inspection.mold_detected && !inspection.pest_detected;
      const humidity_passed =
        inspection.humidity_measured !== undefined
          ? inspection.humidity_measured >= 14 && inspection.humidity_measured <= 18
          : null;
      const overall_passed =
        weight_passed !== false && visual_passed !== false && contamination_passed && humidity_passed !== false;

      let recommended_grade: QualityGrade = 'rejected';
      if (overall_passed) {
        if (!inspection.mold_detected && !inspection.pest_detected && inspection.humidity_measured && inspection.humidity_measured >= 14 && inspection.humidity_measured <= 16) {
          recommended_grade = 'premium';
        } else if (humidity_passed) {
          recommended_grade = 'standard';
        } else {
          recommended_grade = 'economy';
        }
      }

      const data = await createInspection({
        inspection_number: 'INS-TEMP-' + Date.now(),
        batch_id: inspection.batch_id,
        weight_measured_kg: inspection.weight_measured_kg ?? null,
        weight_expected_kg: inspection.weight_expected_kg ?? null,
        weight_variance_percent: weight_variance,
        weight_passed,
        visual_appearance: inspection.visual_appearance ?? null,
        color_uniformity: inspection.color_uniformity ?? null,
        size_uniformity: inspection.size_uniformity ?? null,
        visual_passed,
        mold_detected: inspection.mold_detected ?? null,
        mold_percentage: inspection.mold_percentage ?? null,
        pest_detected: inspection.pest_detected ?? null,
        pest_type: inspection.pest_type ?? null,
        contamination_passed,
        humidity_measured: inspection.humidity_measured ?? null,
        humidity_passed,
        temperature_measured: inspection.temperature_measured ?? null,
        overall_passed,
        recommended_grade,
        recommended_action: overall_passed ? 'STORE' : 'QUARANTINE',
        inspector_name: inspection.inspector_name,
        notes: inspection.notes ?? null,
      }).unwrap() as any;

      const newStatus: BatchStatus = overall_passed ? 'accepted' : 'quarantine';
      updateBatch({ id: inspection.batch_id, status: newStatus, quality_grade: recommended_grade }).catch(() => null);

      if (!overall_passed) {
        createAlertViaApi({
          alert_type: 'INSPECTION_FAILED',
          title: 'Inspection échouée',
          message: `Le lot a échoué l'inspection qualité. Raison: ${!contamination_passed ? 'Contamination détectée' : !humidity_passed ? 'Humidité hors limites' : 'Qualité visuelle insuffisante'}`,
          severity: !contamination_passed ? 'critical' : 'warning',
          batch_id: inspection.batch_id,
          inspection_id: data.id,
        });
      }

      toast.success('Inspection enregistrée');
      return data;
    },
    isPending: state.isLoading,
    isError: !!state.error,
  };
};

// ── Non-conformities ──────────────────────────────────────────────────────────

export const useNonConformities = () => {
  return useListNonConformitiesQuery();
};

export const useCreateNonConformity = () => {
  const [createNC, state] = useCreateNonConformityMutation();
  const [updateBatch] = useUpdateBatchMutation();

  const createAlertViaApi = async (payload: Record<string, unknown>) => {
    const { batchesApi: libApi } = await import('@/lib/api/batches');
    return libApi.createAlert(payload).catch(() => null);
  };

  return {
    mutateAsync: async (nc: {
      batch_id: string;
      inspection_id?: string;
      reason: string;
      description?: string;
      severity: AlertSeverity;
      action_taken: NonConformityAction;
      created_by?: string;
      original_grade?: QualityGrade;
      new_grade?: QualityGrade;
    }) => {
      const data = await createNC({
        nc_number: 'NC-TEMP-' + Date.now(),
        batch_id: nc.batch_id,
        inspection_id: nc.inspection_id ?? null,
        reason: nc.reason,
        description: nc.description ?? null,
        severity: nc.severity,
        action_taken: nc.action_taken,
        created_by: nc.created_by ?? null,
        original_grade: nc.original_grade ?? null,
        new_grade: nc.new_grade ?? null,
      }).unwrap() as any;

      const statusMap: Record<NonConformityAction, BatchStatus> = {
        return_to_supplier: 'returned_to_supplier',
        destruction: 'destroyed',
        reclassification: 'reclassified',
        quarantine: 'quarantine',
      };
      updateBatch({ id: nc.batch_id, status: statusMap[nc.action_taken], quality_grade: nc.new_grade ?? null }).catch(() => null);

      createAlertViaApi({
        alert_type: 'NON_CONFORMITY',
        title: `Non-conformité: ${nc.reason}`,
        message: nc.description || `Action: ${nc.action_taken}`,
        severity: nc.severity,
        batch_id: nc.batch_id,
        non_conformity_id: data.id,
      });

      toast.success('Non-conformité enregistrée');
      return data;
    },
    isPending: state.isLoading,
    isError: !!state.error,
  };
};

// ── Alerts ────────────────────────────────────────────────────────────────────

export const useAlerts = (options?: QueryOptions) => {
  return useListAlertsQuery(undefined, {
    skip: !(options?.enabled ?? true),
    pollingInterval: 2 * 60_000,
  });
};

export const useAcknowledgeAlert = () => {
  const [acknowledge, state] = useAcknowledgeAlertMutation();
  return {
    mutateAsync: async (payload: { id: string; acknowledged_by?: string }) => {
      const data = await acknowledge(payload).unwrap();
      toast.success('Alerte prise en compte');
      return data;
    },
    isPending: state.isLoading,
  };
};

export const useResolveAlert = () => {
  const [resolve, state] = useResolveAlertMutation();
  return {
    mutateAsync: async (payload: { id: string; resolved_by?: string }) => {
      const data = await resolve(payload).unwrap();
      toast.success('Alerte résolue');
      return data;
    },
    isPending: state.isLoading,
  };
};

// ── Batch Movements History ───────────────────────────────────────────────────

export const useBatchMovements = (batchId: string) => {
  return useListMovementsQuery(batchId, { skip: !batchId });
};
