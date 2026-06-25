import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fluxProductionApi } from '@/lib/api/fluxProduction';
import { toast } from 'sonner';
import type { ProductionFluxCode } from '@/types/production';

export interface FluxRun {
  id: string;
  flux_code: NonNullable<ProductionFluxCode>;
  order_id: string | null;
  status: 'running' | 'paused' | 'completed' | 'cancelled';
  operator_name: string;
  input_weight_kg: number;
  output_weight_kg: number;
  waste_kg: number;
  ccp2_passed: boolean | null;
  notes: string | null;
  started_at: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

// ── List ──────────────────────────────────────────────────────────────────────

export interface FluxRunsFilter {
  flux_code?: NonNullable<ProductionFluxCode>;
  status?: string;
  since?: string;
  limit?: number;
  order_id?: string;
}

export function useFluxRuns(filter?: FluxRunsFilter) {
  return useQuery({
    queryKey: ['flux-runs', filter],
    queryFn: () => fluxProductionApi.listRuns(filter) as Promise<FluxRun[]>,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });
}

// ── All active runs (status=running) — used by summary banner ─────────────────

export function useActiveFluxRuns() {
  return useQuery({
    queryKey: ['flux-runs', { status: 'running' }],
    queryFn: () => fluxProductionApi.listRuns({ status: 'running' }) as Promise<FluxRun[]>,
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
  });
}

// ── Start (create) a run ──────────────────────────────────────────────────────

export function useStartFluxRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      flux_code: NonNullable<ProductionFluxCode>;
      operator_name: string;
      input_weight_kg: number;
      order_id?: string;
      notes?: string;
    }) => {
      const now = new Date().toISOString();
      return fluxProductionApi.createRun({
        flux_code: input.flux_code,
        order_id: input.order_id ?? null,
        status: 'running',
        operator_name: input.operator_name,
        input_weight_kg: input.input_weight_kg,
        output_weight_kg: 0,
        waste_kg: 0,
        ccp2_passed: null,
        notes: input.notes ?? null,
        started_at: now,
        completed_at: null,
        created_at: now,
        updated_at: now,
      }) as Promise<FluxRun>;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['flux-runs'] });
      toast.success('Production démarrée');
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Erreur démarrage'),
  });
}

// ── Complete a run ────────────────────────────────────────────────────────────

export function useCompleteFluxRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      output_weight_kg: number;
      waste_kg: number;
      ccp2_passed: boolean;
      notes?: string;
    }) => {
      return fluxProductionApi.updateRun(input.id, {
        status: 'completed',
        output_weight_kg: input.output_weight_kg,
        waste_kg: input.waste_kg,
        ccp2_passed: input.ccp2_passed,
        notes: input.notes ?? null,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }) as Promise<FluxRun>;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['flux-runs'] });
      toast.success('Production terminée et enregistrée');
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Erreur finalisation'),
  });
}

// ── Cancel a run ──────────────────────────────────────────────────────────────

export function useCancelFluxRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      return fluxProductionApi.updateRun(id, {
        status: 'cancelled',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }) as Promise<FluxRun>;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['flux-runs'] });
      toast.success('Production annulée');
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Erreur annulation'),
  });
}
