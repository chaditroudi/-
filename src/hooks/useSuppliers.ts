import { toast } from 'sonner';
import { checkCinUniqueness } from '@/lib/phase1RuleEngine';
import type { Supplier } from '@/types/mes';
import {
  useListSuppliersQuery,
  useGetSupplierQuery,
  useCreateSupplierMutation,
  useUpdateSupplierMutation,
  useDeleteSupplierMutation,
  useListSupplierLotsQuery,
  useListSupplierOrdersQuery,
  useListSupplierPaymentsQuery,
  useListSupplierAuditLogsQuery,
  useCreateSupplierAuditLogMutation,
} from '@/store/api/suppliersApi';

type QueryOptions = { enabled?: boolean };

export const useSuppliers = (options?: QueryOptions) => {
  return useListSuppliersQuery(undefined, { skip: !(options?.enabled ?? true) });
};

export const useSupplier = (id: string) => {
  return useGetSupplierQuery(id, { skip: !id });
};

export const useCreateSupplier = () => {
  const [createSupplier, state] = useCreateSupplierMutation();

  return {
    mutateAsync: async (supplier: Omit<Supplier, 'id' | 'created_at' | 'updated_at'>) => {
      if (supplier.fiscal_identifier?.trim()) {
        const cinCheck = await checkCinUniqueness(supplier.fiscal_identifier);
        if (cinCheck.duplicate) {
          throw new Error(
            `RG-F01 — CIN/Matricule déjà enregistré pour ${cinCheck.existingName} (${cinCheck.existingCode}). Vérifiez la fiche existante.`,
          );
        }
      }
      const data = await createSupplier(supplier).unwrap();
      toast.success('Fournisseur créé avec succès');
      return data;
    },
    isPending: state.isLoading,
    isError: !!state.error,
  };
};

export const useUpdateSupplier = () => {
  const [update, state] = useUpdateSupplierMutation();

  return {
    mutateAsync: async ({ id, ...supplier }: Partial<Supplier> & { id: string }) => {
      const data = await update({ id, ...supplier }).unwrap();
      toast.success('Fournisseur mis à jour');
      return data;
    },
    isPending: state.isLoading,
    isError: !!state.error,
  };
};

export const useDeleteSupplier = () => {
  const [remove, state] = useDeleteSupplierMutation();

  return {
    mutateAsync: async (id: string) => {
      await remove(id).unwrap();
      toast.success('Fournisseur supprimé');
    },
    isPending: state.isLoading,
    isError: !!state.error,
  };
};

export const useSupplierLots = (supplierId: string) => {
  return useListSupplierLotsQuery(supplierId, { skip: !supplierId });
};

export const useSupplierOrders = (supplierId: string) => {
  return useListSupplierOrdersQuery(supplierId, { skip: !supplierId });
};

export const useSupplierPayments = (supplierId: string) => {
  return useListSupplierPaymentsQuery(supplierId, { skip: !supplierId });
};

export const useSupplierAuditLogs = (supplierId: string) => {
  return useListSupplierAuditLogsQuery(supplierId, { skip: !supplierId });
};

// Alias used by SupplierDetailSheet
export const useSupplierAuditLog = useSupplierAuditLogs;

export const useCreateSupplierAuditLog = () => {
  const [createLog, state] = useCreateSupplierAuditLogMutation();

  return {
    mutateAsync: async (id: string, payload: Record<string, unknown>) => {
      return createLog({ id, ...payload }).unwrap();
    },
    isPending: state.isLoading,
  };
};

export const useApproveSupplier = () => {
  const [update, state] = useUpdateSupplierMutation();

  return {
    mutateAsync: async (id: string) => {
      const data = await update({ id, supplier_status: 'active', is_active: true } as any).unwrap();
      toast.success('Fournisseur approuvé');
      return data;
    },
    isPending: state.isLoading,
    isError: !!state.error,
  };
};

export const useBlockSupplier = () => {
  const [update, state] = useUpdateSupplierMutation();

  return {
    mutateAsync: async (id: string, reason?: string) => {
      const data = await update({ id, supplier_status: 'blocked', is_active: false, ...(reason ? { block_reason: reason } : {}) } as any).unwrap();
      toast.success('Fournisseur bloqué');
      return data;
    },
    isPending: state.isLoading,
    isError: !!state.error,
  };
};

export const useArchiveSupplier = () => {
  const [update, state] = useUpdateSupplierMutation();

  return {
    mutateAsync: async (id: string) => {
      const data = await update({ id, supplier_status: 'archived', is_active: false } as any).unwrap();
      toast.success('Fournisseur archivé');
      return data;
    },
    isPending: state.isLoading,
    isError: !!state.error,
  };
};
