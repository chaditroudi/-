import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format } from 'date-fns';

import { packagingApi, type AvailablePackagingSublot, type CreatePackagingOrderInput, type CreatePackagingPaletteInput, type LabelTemplateInput, type PackagingBomInput, type PrivateLabelClientInput, type SealPackagingPaletteInput, type UpdatePackagingProgressInput } from '@/lib/api/packaging';
import {
  LabelStatus,
  PackagingBOMItem,
  LabelTemplate,
  PrivateLabelClient,
  PackagingOrder,
  PackagingOrderStatus,
  PackagingPalette,
  PackagingKpis,
} from '@/types/packaging';

export function usePackagingBOMs() {
  return useQuery({
    queryKey: ['packaging_bom'],
    queryFn: async () => packagingApi.listBoms(),
    staleTime: 60_000,
  });
}

export function useCreatePackagingBOM() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: PackagingBomInput) => packagingApi.createBom(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['packaging_bom'] });
      toast.success('Nomenclature créée');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdatePackagingBOM() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<PackagingBOMItem> & { id: string }) =>
      packagingApi.updateBom(id, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['packaging_bom'] });
      toast.success('Nomenclature mise à jour');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useToggleBOMActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) =>
      packagingApi.toggleBomActive(id, is_active),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['packaging_bom'] }),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useLabelTemplates(statusFilter?: LabelStatus) {
  return useQuery({
    queryKey: ['label_templates', statusFilter],
    queryFn: async () => packagingApi.listLabelTemplates(statusFilter),
    staleTime: 60_000,
  });
}

export function useCreateLabelTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: LabelTemplateInput) => packagingApi.createLabelTemplate(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['label_templates'] });
      toast.success("Modèle d'étiquette créé (statut: Brouillon)");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateLabelTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<LabelTemplate> & { id: string }) =>
      packagingApi.updateLabelTemplate(id, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['label_templates'] });
      toast.success('Modèle mis à jour');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useApproveLabelTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, approved_by }: { id: string; approved_by: string }) =>
      packagingApi.approveLabelTemplate(id, approved_by),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['label_templates'] });
      qc.invalidateQueries({ queryKey: ['packaging_bom'] });
      toast.success('Étiquette validée');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useArchiveLabelTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => packagingApi.archiveLabelTemplate(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['label_templates'] });
      toast.success('Étiquette archivée');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function usePrivateLabelClients() {
  return useQuery({
    queryKey: ['private_label_clients'],
    queryFn: async () => packagingApi.listPrivateLabelClients(),
    staleTime: 120_000,
  });
}

export function useCreatePrivateLabelClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: PrivateLabelClientInput) => packagingApi.createPrivateLabelClient(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['private_label_clients'] });
      toast.success('Client marque blanche créé');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useToggleClientActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) =>
      packagingApi.togglePrivateLabelClient(id, active),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['private_label_clients'] }),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useAvailableSublotsForPackaging() {
  return useQuery({
    queryKey: ['available_sublots_packaging'],
    queryFn: async () => packagingApi.listAvailableSublots(),
    staleTime: 30_000,
  });
}

export function usePackagingOrders(statusFilter?: PackagingOrderStatus, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['packaging_orders', statusFilter],
    queryFn: async () => packagingApi.listOrders(statusFilter),
    refetchInterval: 3 * 60_000,
    enabled: options?.enabled ?? true,
  });
}

export function useCreatePackagingOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreatePackagingOrderInput) => {
      if (input.label_status !== 'VALIDE') {
        toast.warning("Attention: l'étiquette sélectionnée n'est pas encore validée. La validation sera requise avant démarrage.");
      }
      return packagingApi.createOrder(input);
    },
    onSuccess: (order) => {
      qc.invalidateQueries({ queryKey: ['packaging_orders'] });
      qc.invalidateQueries({ queryKey: ['available_sublots_packaging'] });
      qc.invalidateQueries({ queryKey: ['stock_lots'] });
      toast.success(`OF ${order.order_number} créé — ${order.target_units} unités cibles`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useStartPackagingOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, label_status }: { id: string; label_status: LabelStatus }) =>
      packagingApi.startOrder(id, label_status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['packaging_orders'] });
      toast.success('Ordre de conditionnement démarré');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdatePackagingProgress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdatePackagingProgressInput) =>
      packagingApi.updateProgress(input.id, {
        produced_units: input.produced_units,
        rejected_units: input.rejected_units,
        checkweigher_count: input.checkweigher_count,
        checkweigher_failures: input.checkweigher_failures,
        metal_detector_failures: input.metal_detector_failures,
        target_units: input.target_units,
        order_number: input.order_number,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['packaging_orders'] });
      toast.success('Avancement enregistré');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function usePauseResumePackagingOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, currentStatus }: { id: string; currentStatus: PackagingOrderStatus }) => {
      const result = await packagingApi.toggleRunState(id, currentStatus);
      return result.status;
    },
    onSuccess: (next) => {
      qc.invalidateQueries({ queryKey: ['packaging_orders'] });
      toast.success(next === 'PAUSE' ? 'Ordre mis en pause' : 'Ordre repris');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useClosePackagingOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      started_at,
      produced_units,
      target_units,
      order_number,
    }: {
      id: string;
      started_at: string;
      produced_units: number;
      target_units: number;
      order_number: string;
    }) =>
      packagingApi.closeOrder(id, {
        started_at,
        produced_units,
        target_units,
        order_number,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['packaging_orders'] });
      qc.invalidateQueries({ queryKey: ['packaging_kpis'] });
      toast.success('Ordre de conditionnement clôturé');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function usePackagingKpis(): { data: PackagingKpis | null } {
  const { data: orders = [] } = usePackagingOrders();
  const { data: palettes = [] } = useAllPackagingPalettes();

  const today = format(new Date(), 'yyyy-MM-dd');
  const active = orders.filter((o) => o.status === 'EN_COURS').length;
  const planned = orders.filter((o) => o.status === 'PLANIFIE').length;
  const todayDone = orders.filter((o) => o.status === 'TERMINE' && o.ended_at?.startsWith(today));
  const totalProduced = todayDone.reduce((sum, order) => sum + order.produced_units, 0);
  const palettesSealedToday = palettes.filter(
    (palette) => palette.status === 'SCELLE' && palette.sealed_at?.startsWith(today),
  ).length;

  const yieldRatios = todayDone
    .filter((order) => order.target_units > 0)
    .map((order) => order.produced_units / order.target_units);
  const avgYield = yieldRatios.length
    ? Math.round((yieldRatios.reduce((sum, ratio) => sum + ratio, 0) / yieldRatios.length) * 1000) / 10
    : null;

  return {
    data: {
      active_orders: active,
      planned_orders: planned,
      completed_today: todayDone.length,
      total_produced_today: totalProduced,
      palettes_sealed_today: palettesSealedToday,
      avg_yield_pct: avgYield,
    },
  };
}

export function usePackagingPalettes(orderId: string) {
  return useQuery({
    queryKey: ['packaging_palettes', orderId],
    queryFn: async () => packagingApi.listOrderPalettes(orderId),
    enabled: !!orderId,
    refetchInterval: 30_000,
  });
}

export function useAllPackagingPalettes() {
  return useQuery({
    queryKey: ['packaging_palettes_all'],
    queryFn: async () => packagingApi.listPalettes(),
    staleTime: 30_000,
  });
}

export function useCreatePackagingPalette() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreatePackagingPaletteInput) => packagingApi.createPalette(input),
    onSuccess: (palette) => {
      qc.invalidateQueries({ queryKey: ['packaging_palettes', palette.order_id] });
      qc.invalidateQueries({ queryKey: ['packaging_palettes_all'] });
      toast.success(`Palette ${palette.palette_number} créée`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useSealPalette() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SealPackagingPaletteInput) =>
      packagingApi.sealPalette(input.id, {
        order_id: input.order_id,
        palette_number: input.palette_number,
        seal_number: input.seal_number,
        sealed_by: input.sealed_by,
        serial_counter: input.serial_counter,
      }),
    onSuccess: ({ sscc, palette_number }) => {
      qc.invalidateQueries({ queryKey: ['packaging_palettes'] });
      qc.invalidateQueries({ queryKey: ['packaging_palettes_all'] });
      qc.invalidateQueries({ queryKey: ['stock_lots'] });
      toast.success(`Palette ${palette_number} scellée — SSCC: ${sscc}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export type {
  AvailablePackagingSublot,
  CreatePackagingOrderInput,
  CreatePackagingPaletteInput,
  LabelTemplateInput,
  PackagingBomInput,
  PrivateLabelClientInput,
  SealPackagingPaletteInput,
  UpdatePackagingProgressInput,
};
