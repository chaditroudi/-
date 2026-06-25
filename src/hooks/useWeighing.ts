import { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '@/integrations/mongodb/client';
import { useToast } from '@/hooks/use-toast';

export type WeighingType = 'GROSS' | 'TARE';
export type WeighingSource = 'MANUAL' | 'SCALE';

export interface WeighingRecord {
  id: string;
  lot_id: string;
  reception_id: string | null;
  type: WeighingType;
  weight_kg: number;
  source: WeighingSource;
  device_ref: string | null;
  supervisor: string | null;
  recorded_by: string | null;
  notes: string | null;
  created_at: string;
}

export interface Gs1LabelPayload {
  lot_id: string;
  gtin14: string;
  lot_code: string;
  net_weight_g: number;
  gs1_128: string;
  datamatrix: string;
  ai_payload: string;
  printed_at: string;
}

type ApiEnvelope<T> = { data: T };

// ── useWeighings — read-only list for a lot ───────────────────────────────────

export function useWeighings(lotId: string | null | undefined) {
  const [weighings, setWeighings] = useState<WeighingRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const fetch = useCallback(async () => {
    if (!lotId) { setWeighings([]); return; }
    setIsLoading(true);
    try {
      const r = await apiRequest<ApiEnvelope<WeighingRecord[]>>(
        `/reception-lots/${encodeURIComponent(lotId)}/weighings`,
      );
      setWeighings(r.data ?? []);
    } catch (err: any) {
      toast({ title: 'Erreur', description: 'Impossible de charger les pesées', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [lotId, toast]);

  useEffect(() => { fetch(); }, [fetch]);

  return { weighings, isLoading, refetch: fetch };
}

// ── useRecordWeighing — POST /reception-lots/:id/weighing ─────────────────────

export interface RecordWeighingInput {
  type: WeighingType;
  weight_kg: number;
  source?: WeighingSource;
  device_ref?: string | null;
  supervisor?: string | null;
  notes?: string | null;
}

export function useRecordWeighing() {
  const [isPending, setIsPending] = useState(false);
  const { toast } = useToast();

  const mutate = async (
    lotId: string,
    payload: RecordWeighingInput,
  ): Promise<{ weighing: WeighingRecord; lot: any } | null> => {
    setIsPending(true);
    try {
      const r = await apiRequest<ApiEnvelope<{ weighing: WeighingRecord; lot: any }>>(
        `/reception-lots/${encodeURIComponent(lotId)}/weighing`,
        { method: 'POST', body: JSON.stringify(payload) },
      );
      const label = payload.type === 'GROSS' ? 'Poids brut' : 'Tare';
      toast({
        title: `${label} enregistré`,
        description: `${payload.weight_kg.toFixed(3)} kg — source : ${payload.source ?? 'MANUEL'}`,
      });
      return r.data;
    } catch (err: any) {
      const msg: string = err?.message ?? 'Erreur lors de l\'enregistrement';
      toast({ title: 'Erreur pesée', description: msg, variant: 'destructive' });
      throw err;
    } finally {
      setIsPending(false);
    }
  };

  return { mutate, isPending };
}

// ── useGenerateLotLabel — POST /reception-lots/:id/label ──────────────────────

export function useGenerateLotLabel() {
  const [isPending, setIsPending] = useState(false);
  const { toast } = useToast();

  const mutate = async (lotId: string): Promise<Gs1LabelPayload | null> => {
    setIsPending(true);
    try {
      const r = await apiRequest<ApiEnvelope<Gs1LabelPayload>>(
        `/reception-lots/${encodeURIComponent(lotId)}/label`,
        { method: 'POST' },
      );
      toast({ title: 'Étiquette générée', description: `GS1-128 : ${r.data?.gs1_128 ?? ''}` });
      return r.data;
    } catch (err: any) {
      toast({ title: 'Erreur étiquette', description: err?.message ?? 'Génération échouée', variant: 'destructive' });
      throw err;
    } finally {
      setIsPending(false);
    }
  };

  return { mutate, isPending };
}
