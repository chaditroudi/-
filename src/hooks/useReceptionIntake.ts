import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { apiRequest } from '@/integrations/mongodb/client';
import { ApiRequestError } from '@/lib/axiosClient';
import {
  discardOutboxItem,
  enqueueReceptionIntake,
} from '@/lib/offline/outbox';
import { useAppDispatch } from '@/store/hooks';
import { fetchReceptions, receptionUpserted } from '@/store/slices/receptionsSlice';
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
  client_request_id?: string;
  supplier_id: string;
  purchase_order_id?: string | null;
  purchase_order_line_id?: string | null;
  spontaneous_delivery?: boolean;
  reception_type: 'DATTE' | 'EMBALLAGE' | 'AUTRE';
  material_id?: string | null;
  quantity_total?: number;
  unit?: string;
  packaging_type?: string | null;
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
  maturity_stage: string;
  harvest_method: string;
  harvest_datetime?: string | null;
  estimated_harvest_date?: string | null;
  bio_declared?: boolean;
  arrival_temperature_c: number;
  departure_time?: string | null;
  transport_condition?: string | null;
  quick_visual_state?: string | null;
  quick_check_notes?: string | null;
  storage_zone_code: string;
  transport_duration_hours?: number | null;
  origin_oasis?: string | null;
  origin_gps?: string | null;
  gate_arrival_at?: string | null;
  gross_weight_captured_at?: string | null;
  unloading_started_at?: string | null;
  unloading_completed_at?: string | null;
  tare_weight_captured_at?: string | null;
  phase1_alerts?: string[];
  unit_count: number;
  unit_type: 'PALETTE' | 'CAISSE' | 'VRAC' | 'PL' | 'GC' | 'PLOX' | 'LAMME';
  weighing_source?: 'SCALE' | 'MANUAL';
  weighing_supervisor: string;
  weighing_manual_reason?: string | null;
  created_by?: string | null;
  lots: ReceptionIntakeLotInput[];
}

export interface ReceptionIntakeResponse {
  reception: ReceptionV2;
  lots: ReceptionLot[];
  units: ReceptionUnit[];
  alerts: Array<Record<string, unknown>>;
  notifications: Array<Record<string, unknown>>;
  offline_queued?: boolean;
  queue_id?: string;
}

export const useCreateReceptionIntake = () => {
  const queryClient = useQueryClient();
  const dispatch = useAppDispatch();

  return useMutation({
    mutationFn: async (payload: ReceptionIntakePayload) => {
      const queued = await enqueueReceptionIntake(payload as unknown as Record<string, unknown>);
      try {
        const response = await apiRequest<{ data: ReceptionIntakeResponse }>('/receptions/intake', {
          method: 'POST',
          body: JSON.stringify(queued.payload),
        });
        return response.data;
      } catch (error) {
        const temporary = !(error instanceof ApiRequestError)
          || error.isNetworkError
          || error.status === 409
          || (error.status ?? 500) >= 500;
        if (!temporary) {
          await discardOutboxItem(queued.id);
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
          queue_id: queued.id,
        };
      }
    },
    onSuccess: (data) => {
      if (data.offline_queued) {
        toast.warning('Réception enregistrée hors ligne', {
          description: 'Le numéro officiel et les étiquettes seront disponibles après synchronisation.',
        });
        return;
      }
      dispatch(receptionUpserted(data.reception));
      void dispatch(fetchReceptions());
      queryClient.invalidateQueries({ queryKey: ['receptions-v2'] });
      queryClient.invalidateQueries({ queryKey: ['reception-v2', data.reception.id] });
      queryClient.invalidateQueries({ queryKey: ['reception-lots', data.reception.id] });
      queryClient.invalidateQueries({ queryKey: ['stock_lots'] });
      queryClient.invalidateQueries({ queryKey: ['stock_summary'] });
      data.lots.forEach((lot) => {
        queryClient.invalidateQueries({ queryKey: ['reception-units', lot.id] });
      });
      toast.success(`Reception ${data.reception.reception_number} enregistree`);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Erreur lors de la reception');
      console.error(error);
    },
  });
};
