import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { useAuthContext } from '@/contexts/AuthContext';
import { ApiRequestError, axiosClient } from '@/lib/axiosClient';
import { deleteLocalDraft } from '@/lib/offline/draftStore';
import {
  discardOutboxItem,
  enqueueReceptionIntake,
  isOutboxRetryable,
  isSessionExpiredError,
} from '@/lib/offline/outbox';
import { useAppDispatch } from '@/store/hooks';
import { fetchReceptions, receptionUpserted } from '@/store/slices/receptionsSlice';
import { receptionsApi } from '@/store/api/receptionsApi';
import { ReceptionLot, ReceptionUnit, ReceptionV2 } from '@/types/reception';

export interface ReceptionIntakeLotInput {
  lot_supplier: string;
  quantity: number;
  origin_country?: string;
  origin_region?: string;
  origin_farm?: string;
  harvest_date?: string | null;
  maturity_stage?: string | null;
  article_ref?: string | null;
  infestation_rate?: number | null;
  variety?: string | null;
  rfid_tag?: string | null;
  parent_lot_id?: string | null;
}

export interface ReceptionIntakePayload {
  client_request_id: string;
  draft_version?: number;
  supplier_id: string;
  purchase_order_id?: string | null;
  purchase_order_line_id?: string | null;
  reception_type: 'DATTE' | 'EMBALLAGE' | 'AUTRE';
  material_id?: string | null;
  quantity_total?: number;
  unit?: string;
  presentation?: 'En caisses' | 'En regimes' | 'En vrac' | 'Melange';
  delivery_note_number?: string | null;
  delivery_note_photos: string[];
  vehicle_number: string;
  driver_name?: string | null;
  remarks?: string | null;
  gross_weight_kg: number;
  tare_weight_kg: number;
  gross_reading_id?: string | null;
  tare_reading_id?: string | null;
  declared_weight_kg?: number | null;
  variety: string;
  /** Golden-thread route; the server defaults to PREMIUM_WHOLE. */
  manufacturing_route?: 'PREMIUM_WHOLE' | 'GENERIC';
  maturity_stage: string;
  harvest_method: string;
  estimated_harvest_date?: string | null;
  bio_declared?: boolean;
  arrival_temperature_c: number;
  departure_time?: string | null;
  origin_gps?: string | null;
  phase1_alerts?: string[];
  transport_condition?: string | null;
  quick_visual_state?: string | null;
  quick_check_notes?: string | null;
  storage_zone_code: string;
  origin_oasis?: string | null;
  gate_arrival_at?: string | null;
  gross_weight_captured_at?: string | null;
  tare_weight_captured_at?: string | null;
  unit_count: number;
  unit_type: 'PALETTE' | 'CAISSE' | 'VRAC' | 'PL' | 'GC' | 'PLOX' | 'LAMME';
  /** SCALE = read on the scale and typed; MANUAL = no scale. Connected weighings send reading ids instead. */
  weighing_source?: 'SCALE' | 'MANUAL';
  weighing_manual_reason?: string | null;
  lots: ReceptionIntakeLotInput[];
}

export interface ReceptionIntakeResponse {
  reception: ReceptionV2;
  lots: ReceptionLot[];
  units: ReceptionUnit[];
  alerts: Array<Record<string, unknown>>;
  notifications: Array<Record<string, unknown>>;
  /** Held on this device: not a reception yet, whatever the screen shows. */
  offline_queued?: boolean;
  session_expired?: boolean;
  queue_id?: string;
}

/** Past this the delivery waits in the queue: a replay is safe, a frozen button is not. */
const INTAKE_TIMEOUT_MS = 30_000;

export const useCreateReceptionIntake = () => {
  const queryClient = useQueryClient();
  const dispatch = useAppDispatch();
  const { user } = useAuthContext();

  return useMutation({
    mutationFn: async (payload: ReceptionIntakePayload): Promise<ReceptionIntakeResponse> => {
      // Queued before sending: a dropped connection or a closed tablet loses nothing.
      // The queue is a safety net: when local storage fails, the request still goes out.
      const queued = await enqueueReceptionIntake(payload as unknown as Record<string, unknown>, user?.id ?? null)
        .catch((error) => {
          if (error instanceof ApiRequestError) throw error;
          return null;
        });
      try {
        const response = await axiosClient.post<{ data: ReceptionIntakeResponse }>(
          '/receptions/intake',
          queued?.payload ?? payload,
          { timeout: INTAKE_TIMEOUT_MS },
        );
        if (queued) await discardOutboxItem(queued.id).catch(() => undefined);
        await deleteLocalDraft(payload.client_request_id).catch(() => undefined);
        return response.data.data;
      } catch (error) {
        if (!queued) throw error;
        if (!isOutboxRetryable(error)) {
          // The employee is on the form and sees why: the draft is intact for correction.
          await discardOutboxItem(queued.id).catch(() => undefined);
          throw error;
        }

        return {
          reception: {
            id: queued.id,
            reception_number: 'EN ATTENTE DE SYNCHRONISATION',
            storage_zone_code: payload.storage_zone_code,
            created_at: queued.createdAt,
          } as ReceptionV2,
          lots: payload.lots.map((lot, index) => ({
            id: `${queued.id}-lot-${index + 1}`,
            reception_id: queued.id,
            lot_internal: 'Attribué après synchronisation',
            ...lot,
          })) as ReceptionLot[],
          units: [],
          alerts: [],
          notifications: [],
          offline_queued: true,
          session_expired: isSessionExpiredError(error),
          queue_id: queued.id,
        };
      }
    },
    onSuccess: (data) => {
      if (data.offline_queued) return;
      dispatch(receptionUpserted(data.reception));
      void dispatch(fetchReceptions());
      queryClient.invalidateQueries({ queryKey: ['receptions-v2'] });
      queryClient.invalidateQueries({ queryKey: ['reception-v2', data.reception.id] });
      queryClient.invalidateQueries({ queryKey: ['reception-lots', data.reception.id] });
      queryClient.invalidateQueries({ queryKey: ['stock_lots'] });
      queryClient.invalidateQueries({ queryKey: ['stock_summary'] });
      queryClient.invalidateQueries({ queryKey: ['purchase_orders'] });
      dispatch(receptionsApi.util.invalidateTags(['Reception', 'ReceptionDraft']));
      data.lots.forEach((lot) => {
        queryClient.invalidateQueries({ queryKey: ['reception-units', lot.id] });
      });
    },
  });
};
