import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { phase2Api } from '@/lib/api/phase2';
import {
  TriageSession,
  TriageSessionStatus,
  TriageLine,
  TriageGrade,
  TriageSubLot,
  TriageQualityCheck,
  TapeSpeed,
  SUBLOT_SUFFIX,
  SUBLOT_DESTINATION,
} from '@/types/phase2';

const QK = {
  sessions: ['triage-sessions'] as const,
  session: (id: string) => ['triage-session', id] as const,
  qualityChecks: (sessionId: string) => ['triage-quality-checks', sessionId] as const,
  subLots: (sessionId: string) => ['triage-sublots', sessionId] as const,
};

// ─── Reads ─────────────────────────────────────────────────────────────────

export function useTriageSessions(statusFilter?: TriageSessionStatus[], options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: [...QK.sessions, statusFilter],
    queryFn: () => phase2Api.listTriageSessions(statusFilter),
    refetchInterval: 3 * 60_000,
    enabled: options?.enabled ?? true,
  });
}

export function useTriageSession(id: string | null) {
  return useQuery({
    queryKey: QK.session(id ?? ''),
    queryFn: () => (id ? phase2Api.getTriageSession(id) : null),
    enabled: !!id,
    refetchInterval: 15_000, // real-time weight updates
  });
}

export function useTriageQualityChecks(sessionId: string | null) {
  return useQuery({
    queryKey: QK.qualityChecks(sessionId ?? ''),
    queryFn: () => (sessionId ? phase2Api.listTriageQualityChecks(sessionId) : []),
    enabled: !!sessionId,
  });
}

export function useTriageSubLots(sessionId: string | null) {
  return useQuery({
    queryKey: QK.subLots(sessionId ?? ''),
    queryFn: () => (sessionId ? phase2Api.listTriageSublots(sessionId) : []),
    enabled: !!sessionId,
  });
}

// ─── Create session ─────────────────────────────────────────────────────────

type CreateTriageInput = {
  line: TriageLine;
  parent_reception_id: string;
  parent_lot_number: string;
  variety: string | null;
  parent_weight_kg: number;
  worker_count: number;
  worker_ids: string[];
  chef_ligne: string;
  tape_speed: TapeSpeed;
  created_by: string;
};

export function useCreateTriageSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTriageInput) => phase2Api.createTriageSession(input),
    onSuccess: (session) => {
      toast.success(`Session de triage ${session.session_number} démarrée — Ligne ${session.line}`);
      qc.invalidateQueries({ queryKey: QK.sessions });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}

// ─── Update grade weights (real-time, called frequently) ───────────────────

type UpdateWeightsInput = {
  id: string;
  weight_extra_kg: number;
  weight_cat1_kg: number;
  weight_cat2_kg: number;
  weight_reject_kg: number;
  started_at: string;
};

export function useUpdateTriageWeights() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateWeightsInput) => phase2Api.updateTriageWeights(input.id, input),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: QK.session(id) });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}

// ─── Add quality check ─────────────────────────────────────────────────────

type AddQualityCheckInput = {
  session_id: string;
  inspector_name: string;
  sample_weight_kg: number;
  extra_error_count: number;
  cat1_error_count: number;
  cat2_error_count: number;
  reject_error_count: number;
  notes?: string;
};

export function useAddTriageQualityCheck() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ session_id, ...input }: AddQualityCheckInput) =>
      phase2Api.addTriageQualityCheck(session_id, input),
    onSuccess: (check) => {
      toast.success(`Contrôle qualité: ${check.error_rate_percent}% correct`);
      qc.invalidateQueries({ queryKey: QK.qualityChecks(check.session_id) });
      qc.invalidateQueries({ queryKey: QK.session(check.session_id) });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}

// ─── Close session + create sub-lots ──────────────────────────────────────

export function useCloseTriageSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string }) => phase2Api.closeTriageSession(id),
    onSuccess: ({ session_number, sub_lots_created, duration_minutes }, { id }) => {
      toast.success(
        `Session ${session_number} clôturée — ${sub_lots_created} sous-lots créés (${duration_minutes} min)`
      );
      qc.invalidateQueries({ queryKey: QK.session(id) });
      qc.invalidateQueries({ queryKey: QK.sessions });
      qc.invalidateQueries({ queryKey: QK.subLots(id) });
      qc.invalidateQueries({ queryKey: ['stock_lots'] });
      qc.invalidateQueries({ queryKey: ['available_sublots_packaging'] });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}

// ─── Pause / Resume ────────────────────────────────────────────────────────

export function usePauseResumeTriageSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'PAUSE' | 'RESUME' }) =>
      phase2Api.toggleTriageRunState(id, { action }),
    onSuccess: (_, { id, action }) => {
      toast.info(action === 'PAUSE' ? 'Session en pause' : 'Session reprise');
      qc.invalidateQueries({ queryKey: QK.session(id) });
      qc.invalidateQueries({ queryKey: QK.sessions });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}

// ─── KPIs ───────────────────────────────────────────────────────────────────

export function useTriageKpis() {
  return useQuery({
    queryKey: ['triage-kpis'],
    queryFn: () => phase2Api.getTriageKpis(),
    refetchInterval: 5 * 60 * 1000,
  });
}
