import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { phase2Api } from '@/lib/api/phase2';
import {
  CleaningCycle,
  CleaningCycleStatus,
  CleaningProgram,
  WasteCategory,
  CLEANING_PROGRAM_CONFIG,
} from '@/types/phase2';

const QK = {
  cycles: ['cleaning-cycles'] as const,
  cycle: (id: string) => ['cleaning-cycle', id] as const,
};

// ─── Reads ─────────────────────────────────────────────────────────────────

export function useCleaningCycles(statusFilter?: CleaningCycleStatus[], options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: [...QK.cycles, statusFilter],
    queryFn: () => phase2Api.listCleaningCycles(statusFilter),
    refetchInterval: 3 * 60_000,
    enabled: options?.enabled ?? true,
  });
}

export function useCleaningCycle(id: string | null) {
  return useQuery({
    queryKey: QK.cycle(id ?? ''),
    queryFn: () => (id ? phase2Api.getCleaningCycle(id) : null),
    enabled: !!id,
  });
}

// ─── Create ────────────────────────────────────────────────────────────────

type CreateCleaningInput = {
  reception_id: string;
  lot_number: string;
  variety: string | null;
  program: CleaningProgram;
  program_forced_reason?: string;
  operator_name: string;
  created_by: string;
};

export function useCreateCleaningCycle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCleaningInput) => phase2Api.createCleaningCycle(input),
    onSuccess: (cycle) => {
      toast.success(`Cycle nettoyage ${cycle.cycle_number} démarré`);
      qc.invalidateQueries({ queryKey: QK.cycles });
    },
    onError: (err: Error) => {
      toast.error(`Erreur création cycle: ${err.message}`);
    },
  });
}

// ─── Close cycle ───────────────────────────────────────────────────────────

type CloseCleaningInput = {
  id: string;
  weight_in_kg: number;
  weight_out_kg: number;
  waste_weight_kg: number;
  waste_category: WasteCategory;
  water_volume_liters?: number;
  water_recycled_percent?: number;
  water_temperature_c?: number;
  turbidity_ntu?: number;
  ph_water?: number;
};

export function useCloseCleaningCycle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: CloseCleaningInput) => phase2Api.closeCleaningCycle(id, input),
    onSuccess: ({ yield_percent }, { id }) => {
      const yieldLabel = yield_percent != null ? ` — rendement ${yield_percent}%` : '';
      toast.success(`Cycle nettoyage clôturé${yieldLabel}`);
      qc.invalidateQueries({ queryKey: QK.cycle(id) });
      qc.invalidateQueries({ queryKey: QK.cycles });
    },
    onError: (err: Error) => {
      toast.error(`Clôture échouée: ${err.message}`);
    },
  });
}

// ─── Update (general) ──────────────────────────────────────────────────────

export function useUpdateCleaningCycle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string;
      patch: Partial<Omit<CleaningCycle, 'id' | 'cycle_number' | 'created_at'>>;
    }) => phase2Api.updateCleaningCycle(id, patch),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: QK.cycle(id) });
      qc.invalidateQueries({ queryKey: QK.cycles });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}

// ─── KPIs ───────────────────────────────────────────────────────────────────

export function useCleaningKpis() {
  return useQuery({
    queryKey: ['cleaning-kpis'],
    queryFn: () => phase2Api.getCleaningKpis(),
    refetchInterval: 5 * 60 * 1000,
  });
}

export { CLEANING_PROGRAM_CONFIG };
