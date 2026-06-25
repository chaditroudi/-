import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { phase2Api } from '@/lib/api/phase2';
import {
  FUMIGATION_PROTOCOL_CONFIG,
  FumigationChamber,
  FumigationCycle,
  FumigationCycleStatus,
  FumigationProtocol,
  FumigationSensorReading,
  Phase2LotRef,
} from '@/types/phase2';

const QK = {
  cycles: ['fumigation-cycles'] as const,
  cycle: (id: string) => ['fumigation-cycle', id] as const,
  readings: (cycleId: string) => ['fumigation-readings', cycleId] as const,
};

export function useFumigationCycles(statusFilter?: FumigationCycleStatus[], options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: [...QK.cycles, statusFilter],
    queryFn: () => phase2Api.listFumigationCycles(statusFilter),
    refetchInterval: 3 * 60_000,
    enabled: options?.enabled ?? true,
  });
}

export function useFumigationCycle(id: string | null) {
  return useQuery({
    queryKey: QK.cycle(id ?? ''),
    queryFn: () => (id ? phase2Api.getFumigationCycle(id) : null),
    enabled: !!id,
    refetchInterval: 30_000,
  });
}

export function useFumigationSensorReadings(cycleId: string | null) {
  return useQuery({
    queryKey: QK.readings(cycleId ?? ''),
    queryFn: () => (cycleId ? phase2Api.listFumigationSensorReadings(cycleId) : []),
    enabled: !!cycleId,
    refetchInterval: 15_000,
  });
}

type CreateFumigationInput = {
  chamber: FumigationChamber;
  protocol: FumigationProtocol;
  lot_refs: Phase2LotRef[];
  total_weight_kg: number;
  fill_rate_percent: number;
  created_by: string;
};

export function useCreateFumigationCycle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateFumigationInput) => phase2Api.createFumigationCycle(input),
    onSuccess: (cycle) => {
      toast.success(`Cycle de fumigation ${cycle.cycle_number} créé`);
      qc.invalidateQueries({ queryKey: QK.cycles });
    },
    onError: (err: Error) => {
      toast.error(`Erreur création cycle: ${err.message}`);
    },
  });
}

type UpdateFumigationInput = {
  id: string;
  patch: Partial<Omit<FumigationCycle, 'id' | 'cycle_number' | 'created_at' | 'readings'>>;
};

export function useUpdateFumigationCycle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: UpdateFumigationInput) => phase2Api.updateFumigationCycle(id, patch),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: QK.cycle(id) });
      qc.invalidateQueries({ queryKey: QK.cycles });
    },
    onError: (err: Error) => {
      toast.error(`Mise à jour échouée: ${err.message}`);
    },
  });
}

export function useStartFumigationCycle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string }) => phase2Api.startFumigationCycle(id),
    onSuccess: (_, { id }) => {
      toast.success('Cycle démarré — CCP actif (T0 verrouillé)');
      qc.invalidateQueries({ queryKey: QK.cycle(id) });
      qc.invalidateQueries({ queryKey: QK.cycles });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}

type SignatureRole = 'operator' | 'quality';

export function useSignFumigationCycle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      role,
      signerName,
      signerId,
    }: {
      id: string;
      role: SignatureRole;
      signerName: string;
      signerId: string;
    }) => phase2Api.signFumigationCycle(id, { role, signerName, signerId }),
    onSuccess: (_, { id, role }) => {
      const label = role === 'operator' ? 'opérateur' : 'qualité';
      toast.success(`Signature ${label} enregistrée`);
      qc.invalidateQueries({ queryKey: QK.cycle(id) });
      qc.invalidateQueries({ queryKey: QK.cycles });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}

type SensorReadingInput = Omit<FumigationSensorReading, 'id'>;

export function useAddFumigationSensorReading() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reading: SensorReadingInput) => phase2Api.addFumigationSensorReading(reading),
    onSuccess: (_, { cycle_id }) => {
      qc.invalidateQueries({ queryKey: QK.readings(cycle_id) });
    },
    onError: (err: Error) => {
      toast.error(`Lecture capteur: ${err.message}`);
    },
  });
}

export function useFumigationKpis() {
  return useQuery({
    queryKey: ['fumigation-kpis'],
    queryFn: () => phase2Api.getFumigationKpis(),
    refetchInterval: 5 * 60 * 1000,
  });
}

export { FUMIGATION_PROTOCOL_CONFIG };
