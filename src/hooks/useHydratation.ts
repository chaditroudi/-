import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { phase2Api } from '@/lib/api/phase2';
import {
  HydrationCycle,
  HydrationCycleStatus,
  HydrationChamber,
  HydrationProgram,
  HydrationConformity,
  HydrationNonConformityAction,
  Phase2LotRef,
  suggestHydrationProgram,
  HYDRATION_PROGRAM_CONFIG,
} from '@/types/phase2';

const QK = {
  cycles: ['hydration-cycles'] as const,
  cycle: (id: string) => ['hydration-cycle', id] as const,
};


export function useHydrationCycles(statusFilter?: HydrationCycleStatus[], options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: [...QK.cycles, statusFilter],
    queryFn: () => phase2Api.listHydrationCycles(statusFilter),
    refetchInterval: 3 * 60_000,
    enabled: options?.enabled ?? true,
  });
}

export function useHydrationCycle(id: string | null) {
  return useQuery({
    queryKey: QK.cycle(id ?? ''),
    queryFn: () => (id ? phase2Api.getHydrationCycle(id) : null),
    enabled: !!id,
    refetchInterval: 30_000,
  });
}
//*************************////////////////////////////*****************************

type CreateHydrationInput = {
  chamber: HydrationChamber;
  lot_refs: Phase2LotRef[];
  humidity_in_percent: number | null;
  program_override?: HydrationProgram;
  program_override_reason?: string;
  operator_name: string;
  created_by: string;
};

//*************************////////////////////////////*****************************


export function useCreateHydrationCycle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateHydrationInput) => phase2Api.createHydrationCycle(input),
    onSuccess: (cycle) => {
      const prog = HYDRATION_PROGRAM_CONFIG[cycle.program_applied];
      toast.success(`Cycle ${cycle.cycle_number} démarré — Programme: ${prog.label}`);
      qc.invalidateQueries({ queryKey: QK.cycles });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}
//*************************////////////////////////////*****************************


type ExitHumidityInput = {
  id: string;
  humidity_out_1: number;
  humidity_out_2: number;
  humidity_out_3: number;
  inspector_name: string;
};
//*************************////////////////////////////*****************************

export function useRecordExitHumidity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: ExitHumidityInput) => phase2Api.recordHydrationExit(id, input),
    onSuccess: ({ avg, conformity }, { id }) => {
      const label = conformity === 'VERT' ? 'Conforme' : conformity === 'JAUNE' ? 'Attention' : 'Non conforme';
      toast.success(`Humidité sortie: ${avg}% — ${label}`);
      qc.invalidateQueries({ queryKey: QK.cycle(id) });
      qc.invalidateQueries({ queryKey: QK.cycles });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}
//*************************////////////////////////////*****************************



type CloseHydrationInput = {
  id: string;
  non_conformity_action?: HydrationNonConformityAction;
};

export function useCloseHydrationCycle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: CloseHydrationInput) => phase2Api.closeHydrationCycle(id, input),
    onSuccess: (_, { id }) => {
      toast.success('Cycle hydratation/séchage clôturé');
      qc.invalidateQueries({ queryKey: QK.cycle(id) });
      qc.invalidateQueries({ queryKey: QK.cycles });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}

//*************************////////////////////////////*****************************

export function useUpdateHydrationSensors() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      sensors,
    }: {
      id: string;
      sensors: {
        temperature_t1_c?: number;
        temperature_t2_c?: number;
        air_humidity_percent?: number;
        steam_injected_kg?: number;
        energy_kwh?: number;
      };
    }) => phase2Api.updateHydrationSensors(id, sensors),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: QK.cycle(id) });
    },
  });
}


export function useHydrationKpis() {
  return useQuery({
    queryKey: ['hydration-kpis'],
    queryFn: () => phase2Api.getHydrationKpis(),
    refetchInterval: 5 * 60 * 1000,
  });
}

export { suggestHydrationProgram, HYDRATION_PROGRAM_CONFIG };
