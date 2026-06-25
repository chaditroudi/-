import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { materialReceptionsApi } from '@/lib/api/receptions';
import { MaterialReception, ReceptionStatus } from '@/types/mes';
import { toast } from 'sonner';

type QueryOptions = {
  enabled?: boolean;
};

const inferBatchGrade = (qualityScore?: number) => {
  if (qualityScore === undefined || qualityScore === null) return null;
  if (qualityScore >= 8) return 'premium';
  if (qualityScore >= 6) return 'standard';
  if (qualityScore > 0) return 'economy';
  return 'rejected';
};

export const useReceptions = (options?: QueryOptions) => {
  return useQuery({
    queryKey: ['receptions'],
    queryFn: () => materialReceptionsApi.list() as Promise<MaterialReception[]>,
    enabled: options?.enabled ?? true,
  });
};

export const useCreateReception = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (reception: {
      supplier_id: string;
      material_id: string;
      quantity: number;
      unit: string;
      lot_number?: string;
      notes?: string;
      temperature?: number;
      humidity?: number;
      delivery_note_number?: string;
      supplier_certificate_number?: string;
      origin_country?: string;
      origin_farm?: string;
      harvest_date?: string;
      visual_appearance?: string;
      defect_percentage?: number;
      caliber_uniformity?: boolean;
      inspector_name?: string;
    }) => {
      const samplingSize = Math.max(1, Math.ceil(Math.sqrt(reception.quantity / 10)));
      const data = await materialReceptionsApi.create({
        reception_number: 'REC-' + Date.now(),
        supplier_id: reception.supplier_id,
        material_id: reception.material_id,
        quantity: reception.quantity,
        unit: reception.unit,
        lot_number: reception.lot_number ?? null,
        notes: reception.notes ?? null,
        temperature: reception.temperature ?? null,
        humidity: reception.humidity ?? null,
        delivery_note_number: reception.delivery_note_number ?? null,
        supplier_certificate_number: reception.supplier_certificate_number ?? null,
        origin_country: reception.origin_country ?? 'Tunisie',
        origin_farm: reception.origin_farm ?? null,
        harvest_date: reception.harvest_date ?? null,
        visual_appearance: reception.visual_appearance ?? null,
        defect_percentage: reception.defect_percentage ?? null,
        caliber_uniformity: reception.caliber_uniformity ?? null,
        inspector_name: reception.inspector_name ?? null,
        sampling_size: samplingSize,
      }) as any;

      materialReceptionsApi.createAuditLog(data.id, {
        action: 'CREATED',
        new_status: 'pending',
        performed_by: reception.inspector_name ?? null,
        details: { reception },
      }).catch(() => null);

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receptions'] });
      toast.success('Réception enregistrée');
    },
    onError: (error) => {
      toast.error("Erreur lors de l'enregistrement");
      console.error(error);
    },
  });
};

export const useUpdateReceptionStatus = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: {
      id: string;
      status: ReceptionStatus;
      verified_by?: string;
      quality_score?: number;
      visual_appearance?: string;
      defect_percentage?: number;
      rejection_reason?: string;
      document_compliance?: string;
      origin_compliance?: string;
      visual_compliance?: string;
      temperature_compliance?: string;
      humidity_compliance?: string;
      contamination_check?: string;
      packaging_compliance?: string;
      qc_decision?: string;
      quarantine_reason?: string;
      critical_non_conformity_count?: number;
      non_conformity_count?: number;
    }) => {
      const { id, ...payload } = args;
      return materialReceptionsApi.updateStatus(id, payload as Record<string, unknown>);
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['receptions'] });
      queryClient.invalidateQueries({ queryKey: ['batches'] });
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      if (data?.status === 'accepted') {
        toast.success('Réception ACCEPTÉE - Lot créé automatiquement');
      } else if (data?.status === 'rejected') {
        toast.error('Réception REJETÉE');
      } else if (data?.status === 'quarantine') {
        toast.warning('Réception mise en QUARANTAINE');
      } else {
        toast.success('Statut mis à jour');
      }
    },
    onError: (error) => {
      toast.error('Erreur lors de la mise à jour');
      console.error(error);
    },
  });
};

export const useReceptionAuditLogs = (receptionId: string) => {
  return useQuery({
    queryKey: ['reception-audit', receptionId],
    queryFn: () => materialReceptionsApi.listAuditLogs(receptionId),
    enabled: !!receptionId,
  });
};
