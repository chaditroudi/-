import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { exportOrdersApi, coaApi, exportContractsApi } from '@/lib/api/exportOrders';
import type {
  ExportOrder,
  COADocument,
  ExportContract,
  ContractVersion,
} from '@/types/exportOrders';

// ── Query keys ────────────────────────────────────────────────────────────────

const QK = {
  orders:    ['export_orders']    as const,
  order:     (id: string) => ['export_orders', id] as const,
  coa:       ['coa_documents']   as const,
  coaItem:   (id: string) => ['coa_documents', id] as const,
  contracts: ['export_contracts'] as const,
  contract:  (id: string) => ['export_contracts', id] as const,
};

// ── Export Orders ─────────────────────────────────────────────────────────────

export const useExportOrders = () =>
  useQuery<ExportOrder[]>({
    queryKey: QK.orders,
    queryFn: exportOrdersApi.list,
    staleTime: 60_000,
  });

export const useExportOrder = (id: string) =>
  useQuery<ExportOrder | null>({
    queryKey: QK.order(id),
    queryFn: () => exportOrdersApi.get(id),
    enabled: !!id,
  });

export const useCreateExportOrder = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<ExportOrder>) => exportOrdersApi.create(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.orders });
      toast.success('Commande export créée');
    },
    onError: (e: Error) => toast.error(e.message),
  });
};

export const useUpdateExportOrder = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: Partial<ExportOrder> & { id: string }) =>
      exportOrdersApi.update(id, patch),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: QK.orders });
      qc.setQueryData(QK.order(data.id), data);
      toast.success('Commande mise à jour');
    },
    onError: (e: Error) => toast.error(e.message),
  });
};

export const useDeleteExportOrder = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => exportOrdersApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.orders });
      toast.success('Commande supprimée');
    },
    onError: (e: Error) => toast.error(e.message),
  });
};

// ── COA Documents ─────────────────────────────────────────────────────────────

export const useCOADocuments = () =>
  useQuery<COADocument[]>({
    queryKey: QK.coa,
    queryFn: coaApi.list,
    staleTime: 60_000,
  });

export const useCreateCOA = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<COADocument>) => coaApi.create(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.coa });
      toast.success('COA créé');
    },
    onError: (e: Error) => toast.error(e.message),
  });
};

export const useUpdateCOA = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: Partial<COADocument> & { id: string }) =>
      coaApi.update(id, patch),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: QK.coa });
      qc.setQueryData(QK.coaItem(data.id), data);
      toast.success('COA mis à jour');
    },
    onError: (e: Error) => toast.error(e.message),
  });
};

export const useDeleteCOA = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => coaApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.coa });
      toast.success('COA supprimé');
    },
    onError: (e: Error) => toast.error(e.message),
  });
};

// ── Export Contracts ──────────────────────────────────────────────────────────

export const useExportContracts = () =>
  useQuery<ExportContract[]>({
    queryKey: QK.contracts,
    queryFn: exportContractsApi.list,
    staleTime: 60_000,
  });

export const useCreateExportContract = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<ExportContract>) => exportContractsApi.create(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.contracts });
      toast.success('Contrat généré');
    },
    onError: (e: Error) => toast.error(e.message),
  });
};

export const useUpdateExportContract = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: Partial<ExportContract> & { id: string }) =>
      exportContractsApi.update(id, patch),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: QK.contracts });
      qc.setQueryData(QK.contract(data.id), data);
    },
    onError: (e: Error) => toast.error(e.message),
  });
};

// Approve + lock a contract: hashes the content, bumps version, sets status=locked
export const useApproveExportContract = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      contract,
      approvedBy,
      htmlContent,
    }: {
      contract: ExportContract;
      approvedBy: string;
      htmlContent: string;
    }) => {
      // SHA-256 of the rendered HTML
      const encoder = new TextEncoder();
      const buf = await crypto.subtle.digest('SHA-256', encoder.encode(htmlContent));
      const hash = Array.from(new Uint8Array(buf))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

      const now = new Date().toISOString();
      const newVersion: ContractVersion = {
        version: contract.current_version,
        generated_at: now,
        generated_by: approvedBy,
        doc_hash: hash,
        reason: 'Approbation finale',
      };

      return exportContractsApi.update(contract.id, {
        status: 'locked',
        doc_hash: hash,
        locked_at: now,
        locked_by: approvedBy,
        version_history: [...(contract.version_history ?? []), newVersion],
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.contracts });
      toast.success('Contrat approuvé et verrouillé');
    },
    onError: (e: Error) => toast.error(e.message),
  });
};

// Re-generate: increments version (1.0 → 1.1), stores old version in history
export const useRegenerateExportContract = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      contract,
      generatedBy,
      reason,
    }: {
      contract: ExportContract;
      generatedBy: string;
      reason: string;
    }) => {
      const [major, minor] = contract.current_version.split('.').map(Number);
      const nextVersion = `${major}.${minor + 1}`;
      const now = new Date().toISOString();

      const archiveEntry: ContractVersion = {
        version: contract.current_version,
        generated_at: now,
        generated_by: generatedBy,
        doc_hash: contract.doc_hash ?? undefined,
        reason,
      };

      return exportContractsApi.update(contract.id, {
        status: 'draft',
        current_version: nextVersion,
        doc_hash: null,
        locked_at: null,
        locked_by: null,
        version_history: [...(contract.version_history ?? []), archiveEntry],
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.contracts });
      toast.success('Nouvelle version générée');
    },
    onError: (e: Error) => toast.error(e.message),
  });
};
