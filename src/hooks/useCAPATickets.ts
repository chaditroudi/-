import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { qualityExtApi } from '@/lib/api/quality-ext';
import { CAPATicket, CAPAStatus, CAPASeverity } from '@/types/capa';
import { toast } from 'sonner';

export const useCAPATickets = (filter?: { status?: CAPAStatus; supplierId?: string }) => {
  return useQuery({
    queryKey: ['capa-tickets', filter],
    queryFn: async () => {
      const data = await qualityExtApi.listCAPATickets({
        status: filter?.status,
        supplier_id: filter?.supplierId,
      });
      return (data ?? []) as CAPATicket[];
    },
  });
};

export const useCAPATicket = (id: string) => {
  return useQuery({
    queryKey: ['capa-ticket', id],
    queryFn: async () => {
      return await qualityExtApi.getCAPATicket(id) as CAPATicket | null;
    },
    enabled: !!id,
  });
};

export interface UpdateCAPAInput {
  id: string;
  status?: CAPAStatus;
  root_cause?: string | null;
  corrective_action?: string | null;
  preventive_action?: string | null;
  deadline?: string | null;
  responsible?: string | null;
  verified_by?: string | null;
}

export interface CreateCAPAInput {
  nc_codes: string[];
  severity: CAPASeverity;
  reception_id?: string;
  inspection_id?: string;
  supplier_id?: string | null;
  supplier_name?: string | null;
  reception_number?: string | null;
  root_cause?: string | null;
  corrective_action?: string | null;
  preventive_action?: string | null;
  deadline?: string | null;
  responsible?: string | null;
  created_by?: string | null;
}

export const useCreateCAPA = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateCAPAInput) => {
      const now = new Date().toISOString();
      const d = now.slice(0, 10).replace(/-/g, '');
      const rand = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
      const ticketNumber = `CAPA-${d}-${rand}`;
      return await qualityExtApi.createCAPATicket({
        ticket_number: ticketNumber,
        nc_codes: input.nc_codes,
        severity: input.severity,
        status: 'OUVERT',
        reception_id: input.reception_id ?? null,
        inspection_id: input.inspection_id ?? null,
        supplier_id: input.supplier_id ?? null,
        supplier_name: input.supplier_name ?? null,
        reception_number: input.reception_number ?? null,
        root_cause: input.root_cause ?? null,
        corrective_action: input.corrective_action ?? null,
        preventive_action: input.preventive_action ?? null,
        deadline: input.deadline ?? null,
        responsible: input.responsible ?? null,
        created_by: input.created_by ?? null,
        created_at: now,
        updated_at: now,
        closed_at: null,
        verified_at: null,
        verified_by: null,
      }) as CAPATicket;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['capa-tickets'] });
      toast.success('Ticket CAPA créé');
    },
    onError: (error: unknown) => {
      const msg = error instanceof Error ? error.message : 'Erreur création CAPA';
      toast.error(msg);
    },
  });
};

export const useUpdateCAPA = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateCAPAInput) => {
      const now = new Date().toISOString();
      const patch: Record<string, unknown> = { updated_at: now };

      if (input.status !== undefined) patch.status = input.status;
      if (input.root_cause !== undefined) patch.root_cause = input.root_cause;
      if (input.corrective_action !== undefined) patch.corrective_action = input.corrective_action;
      if (input.preventive_action !== undefined) patch.preventive_action = input.preventive_action;
      if (input.deadline !== undefined) patch.deadline = input.deadline;
      if (input.responsible !== undefined) patch.responsible = input.responsible;

      if (input.status === 'FERME') patch.closed_at = now;
      if (input.status === 'VERIFIE') {
        patch.verified_at = now;
        patch.verified_by = input.verified_by ?? null;
      }

      return await qualityExtApi.updateCAPATicket(input.id, patch) as CAPATicket;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['capa-tickets'] });
      queryClient.invalidateQueries({ queryKey: ['capa-ticket', data.id] });
      toast.success('CAPA mise à jour');
    },
    onError: (error: unknown) => {
      const msg = error instanceof Error ? error.message : 'Erreur CAPA';
      toast.error(msg);
    },
  });
};
