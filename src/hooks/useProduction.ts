import { useMemo } from 'react';
import { toast } from 'sonner';
import { receptionsApi as receptionsLibApi } from '@/lib/api/receptions';
import type { ReceptionV2, ReceptionLot } from '@/types/reception';
import type {
  ProductionOrder,
  ProductionStep,
  ProductionStepDefinition,
  ProductionOrderStatus,
  ProductionStepStatus,
  ProductionFluxCode,
  QualityCheck,
  LotAllocation,
  LiberedLot,
  ProductionOutputLot,
} from '@/types/production';
import {
  FLUX_CODE_LABELS,
  FLUX_CODE_COLORS,
  orderStatusLabels,
  orderStatusColors,
  stepStatusLabels,
} from '@/types/production';
import {
  useGetProductionConfigQuery,
  useListStepDefinitionsQuery,
  useListProductionOrdersQuery,
  useGetProductionOrderQuery,
  useCreateProductionOrderMutation,
  useUpdateProductionOrderMutation,
  useListProductionStepsQuery,
  useCreateProductionStepMutation,
  useUpdateProductionStepMutation,
  useListQualityChecksQuery,
  useCreateQualityCheckMutation,
  useListLiberedLotsQuery,
  useListLotAllocationsQuery,
  useCreateLotAllocationMutation,
  useDeleteLotAllocationMutation,
  useListOutputLotsQuery,
  useCreateOutputLotMutation,
  useCreateProductionAuditLogMutation,
} from '@/store/api/productionApi';

type QueryOptions = { enabled?: boolean };

export const useStepDefinitions = () => useListStepDefinitionsQuery();

export const useProductionConfig = () => {
  const { data, isLoading } = useGetProductionConfigQuery();

  const fluxCodeLabels = useMemo<Record<string, string>>(() => {
    if (!data?.flux_codes?.length) return FLUX_CODE_LABELS as Record<string, string>;
    return Object.fromEntries(data.flux_codes.map((f) => [f.code, f.label]));
  }, [data]);

  const fluxCodeColors = useMemo<Record<string, string>>(() => {
    if (!data?.flux_codes?.length) return FLUX_CODE_COLORS as Record<string, string>;
    return Object.fromEntries(data.flux_codes.map((f) => [f.code, f.color]));
  }, [data]);

  const fluxCodes = useMemo<Array<{ code: string; label: string; color: string }>>(() => {
    if (!data?.flux_codes?.length) {
      return (Object.keys(FLUX_CODE_LABELS) as Array<keyof typeof FLUX_CODE_LABELS>).map((code) => ({
        code,
        label: FLUX_CODE_LABELS[code],
        color: FLUX_CODE_COLORS[code],
      }));
    }
    return data.flux_codes.map((f) => ({ code: f.code, label: f.label, color: f.color }));
  }, [data]);

  const dynOrderStatusLabels = useMemo<Record<string, string>>(() => {
    if (!data?.order_statuses?.length) return orderStatusLabels as Record<string, string>;
    return Object.fromEntries(data.order_statuses.map((s) => [s.code, s.label]));
  }, [data]);

  const dynOrderStatusColors = useMemo<Record<string, string>>(() => {
    if (!data?.order_statuses?.length) return orderStatusColors as Record<string, string>;
    return Object.fromEntries(data.order_statuses.map((s) => [s.code, s.color]));
  }, [data]);

  const dynStepStatusLabels = useMemo<Record<string, string>>(() => {
    if (!data?.step_statuses?.length) return stepStatusLabels as Record<string, string>;
    return Object.fromEntries(data.step_statuses.map((s) => [s.code, s.label]));
  }, [data]);

  return {
    fluxCodeLabels,
    fluxCodeColors,
    fluxCodes,
    orderStatusLabels: dynOrderStatusLabels,
    orderStatusColors: dynOrderStatusColors,
    stepStatusLabels: dynStepStatusLabels,
    isLoading,
  };
};

export const useProductionOrders = (options?: QueryOptions) => {
  return useListProductionOrdersQuery(undefined, { skip: !(options?.enabled ?? true) });
};

export const useProductionOrder = (orderId: string) => {
  const order = useGetProductionOrderQuery(orderId, { skip: !orderId });
  const steps = useListProductionStepsQuery(orderId, { skip: !orderId });
  return {
    ...order,
    data: order.data ? { ...order.data, steps: steps.data ?? [] } : undefined,
    isLoading: order.isLoading || steps.isLoading,
  };
};

// ── Create production order ────────────────────────────────────────────────────

export const useCreateProductionOrder = () => {
  const [createOrder, orderState] = useCreateProductionOrderMutation();
  const [createStep] = useCreateProductionStepMutation();
  const [createAudit] = useCreateProductionAuditLogMutation();
  const { data: stepDefs = [] } = useListStepDefinitionsQuery();

  return {
    mutateAsync: async (order: {
      reception_id?: string;
      reception_number_snapshot?: string;
      supplier_name_snapshot?: string;
      product_name: string;
      flux_code?: ProductionFluxCode;
      target_quantity: number;
      unit: string;
      priority?: number;
      planned_start_date?: string;
      planned_end_date?: string;
      notes?: string;
      created_by?: string;
    }) => {
      const newOrder = await createOrder({
        order_number: 'OF-' + Date.now(),
        reception_id: order.reception_id ?? null,
        reception_number_snapshot: order.reception_number_snapshot ?? null,
        supplier_name_snapshot: order.supplier_name_snapshot ?? null,
        product_name: order.product_name,
        flux_code: order.flux_code ?? null,
        target_quantity: order.target_quantity,
        unit: order.unit,
        priority: order.priority ?? 1,
        planned_start_date: order.planned_start_date ?? null,
        planned_end_date: order.planned_end_date ?? null,
        notes: order.notes ?? null,
        created_by: order.created_by ?? null,
      }).unwrap() as any;

      const activeStepDefs = stepDefs.filter((d: any) => d.is_active !== false);
      await Promise.all(
        activeStepDefs.map((def: any) =>
          createStep({
            production_order_id: newOrder.id,
            step_definition_id: def.id,
            sequence_order: def.sequence_order,
            status: 'pending',
            input_quantity: order.target_quantity,
            output_quantity: null,
            waste_quantity: 0,
            operator_name: null,
            notes: null,
            started_at: null,
            completed_at: null,
          }).unwrap()
        )
      );

      createAudit({
        production_order_id: newOrder.id,
        action: 'CREATED',
        new_status: 'draft',
        performed_by: order.created_by ?? null,
        details: { order },
      }).catch(() => null);

      toast.success('Ordre de fabrication créé');
      return newOrder as ProductionOrder;
    },
    isPending: orderState.isLoading,
    isError: !!orderState.error,
  };
};

// ── Update production order status ────────────────────────────────────────────

export const useUpdateOrderStatus = () => {
  const [updateOrder, state] = useUpdateProductionOrderMutation();
  const [createAudit] = useCreateProductionAuditLogMutation();
  const { data: orders = [] } = useListProductionOrdersQuery();

  return {
    mutateAsync: async ({
      id,
      status,
      performed_by,
    }: {
      id: string;
      status: ProductionOrderStatus;
      performed_by?: string;
    }) => {
      const current = orders.find((o) => o.id === id) as any;

      if (status === 'in_progress' && current?.status !== 'in_progress') {
        const { productionApi: libApi } = await import('@/lib/api/production');
        const allocations = (await libApi.listAllocations(id)) as any[];
        if (allocations.length === 0) {
          throw new Error('RG-M5 — Aucun lot libéré alloué. Allouez au moins un lot MP avant de lancer la production.');
        }
      }

      const updateData: Record<string, unknown> = { status };
      if (status === 'in_progress' && current?.status !== 'in_progress') updateData.actual_start_date = new Date().toISOString();
      if (status === 'completed' || status === 'cancelled') updateData.actual_end_date = new Date().toISOString();

      const data = await updateOrder({ id, ...updateData }).unwrap() as any;

      createAudit({
        production_order_id: id,
        action: 'STATUS_CHANGED',
        old_status: current?.status ?? null,
        new_status: status,
        performed_by: performed_by ?? null,
      }).catch(() => null);

      toast.success('Statut mis à jour');
      return data as ProductionOrder;
    },
    isPending: state.isLoading,
    isError: !!state.error,
    error: state.error,
  };
};

// ── Update production step ────────────────────────────────────────────────────

export const useUpdateProductionStep = () => {
  const [updateStep, state] = useUpdateProductionStepMutation();

  return {
    mutateAsync: async ({
      id,
      status,
      operator_name,
      output_quantity,
      waste_quantity,
      notes,
    }: {
      id: string;
      status?: ProductionStepStatus;
      operator_name?: string;
      output_quantity?: number;
      waste_quantity?: number;
      notes?: string;
    }) => {
      const payload: Record<string, unknown> = {};
      if (status !== undefined) {
        payload.status = status;
        if (status === 'in_progress') payload.started_at = new Date().toISOString();
        if (['completed', 'failed', 'skipped'].includes(status)) payload.completed_at = new Date().toISOString();
      }
      if (operator_name !== undefined) payload.operator_name = operator_name;
      if (output_quantity !== undefined) payload.output_quantity = output_quantity;
      if (waste_quantity !== undefined) payload.waste_quantity = waste_quantity;
      if (notes !== undefined) payload.notes = notes;

      const data = await updateStep({ id, ...payload }).unwrap();
      toast.success('Étape mise à jour');
      return data as ProductionStep;
    },
    isPending: state.isLoading,
    isError: !!state.error,
  };
};

// ── Quality checks ────────────────────────────────────────────────────────────

export const useAddQualityCheck = () => {
  const [createCheck, state] = useCreateQualityCheckMutation();

  return {
    mutateAsync: async (check: {
      production_step_id: string;
      check_type: string;
      parameter_name: string;
      expected_value?: string;
      actual_value?: string;
      is_passed?: boolean;
      checked_by?: string;
      notes?: string;
    }) => {
      const data = await createCheck({
        production_step_id: check.production_step_id,
        check_type: check.check_type,
        parameter_name: check.parameter_name,
        expected_value: check.expected_value ?? null,
        actual_value: check.actual_value ?? null,
        is_passed: check.is_passed ?? null,
        checked_by: check.checked_by ?? null,
        notes: check.notes ?? null,
      }).unwrap();
      toast.success('Contrôle qualité enregistré');
      return data as QualityCheck;
    },
    isPending: state.isLoading,
    isError: !!state.error,
  };
};

export const useQualityChecks = (stepId: string) => {
  return useListQualityChecksQuery(stepId, { skip: !stepId });
};

// ── M5 Libered lots ───────────────────────────────────────────────────────────

export const useLiberedLots = () => {
  return useListLiberedLotsQuery(undefined, {
    // If the primary endpoint returns empty, the fallback is handled server-side.
    // Front-end fallback no longer needed since /api/receptions already queries receptions_v2.
  });
};

// ── Lot allocations ───────────────────────────────────────────────────────────

export const useOrderLotAllocations = (orderId: string) => {
  return useListLotAllocationsQuery(orderId, { skip: !orderId });
};

export const useAllocateLotToOrder = () => {
  const [createAllocation, state] = useCreateLotAllocationMutation();

  return {
    mutateAsync: async (input: {
      production_order_id: string;
      reception_lot_id: string;
      allocated_quantity: number;
      unit: string;
      allocated_by?: string;
      lot_snapshot: Pick<LiberedLot, 'lot_internal' | 'lot_supplier' | 'quantity' | 'bio_declared' | 'variety' | 'reception_number' | 'supplier_name'>;
    }) => {
      const data = await createAllocation({
        production_order_id: input.production_order_id,
        reception_lot_id: input.reception_lot_id,
        allocated_quantity: input.allocated_quantity,
        unit: input.unit,
        allocated_by: input.allocated_by ?? null,
        allocated_at: new Date().toISOString(),
        lot: input.lot_snapshot,
      }).unwrap();
      toast.success("Lot alloué à l'ordre de fabrication");
      return data as LotAllocation;
    },
    isPending: state.isLoading,
    isError: !!state.error,
  };
};

export const useRemoveLotAllocation = () => {
  const [deleteAllocation, state] = useDeleteLotAllocationMutation();

  return {
    mutateAsync: async (input: { allocationId: string; production_order_id: string }) => {
      await deleteAllocation(input).unwrap();
      toast.success('Allocation supprimée');
    },
    isPending: state.isLoading,
    isError: !!state.error,
  };
};

// ── Output lots ───────────────────────────────────────────────────────────────

export const useOutputLots = (orderId: string) => {
  return useListOutputLotsQuery(orderId, { skip: !orderId });
};

export const useRecordOutputLot = () => {
  const [createOutputLot, state] = useCreateOutputLotMutation();
  const { data: existingOutputLots } = useListOutputLotsQuery('', { skip: true });

  return {
    mutateAsync: async (input: {
      production_order_id: string;
      order_number: string;
      quantity: number;
      unit: string;
      variety: string | null;
      bio_declared: boolean | null;
      recorded_by: string | null;
      allocations: LotAllocation[];
    }) => {
      const { productionApi: libApi } = await import('@/lib/api/production');
      const existing = (await libApi.listOutputLots(input.production_order_id)) as any[];
      const seq = String(existing.length + 1).padStart(3, '0');
      const lot_pf_number = `PF-${input.order_number}-${seq}`;

      const parent_lots_snapshot = input.allocations.map((a) => ({
        reception_lot_id: a.reception_lot_id,
        lot_internal: (a.lot as any)?.lot_internal ?? null,
        lot_supplier: (a.lot as any)?.lot_supplier ?? '',
        reception_number: (a.lot as any)?.reception_number ?? null,
        supplier_name: (a.lot as any)?.supplier_name ?? null,
        allocated_quantity: a.allocated_quantity,
        unit: a.unit,
      }));

      const data = await createOutputLot({
        production_order_id: input.production_order_id,
        lot_pf_number,
        quantity: input.quantity,
        unit: input.unit,
        variety: input.variety,
        bio_declared: input.bio_declared,
        recorded_by: input.recorded_by,
        recorded_at: new Date().toISOString(),
        parent_lot_ids: input.allocations.map((a) => a.reception_lot_id),
        parent_lots_snapshot,
      }).unwrap() as any;

      toast.success(`Lot PF enregistré — ${data.lot_pf_number}`);
      return data as ProductionOutputLot;
    },
    isPending: state.isLoading,
    isError: !!state.error,
  };
};
