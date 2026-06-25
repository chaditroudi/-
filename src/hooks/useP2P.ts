import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { p2pApi } from '@/lib/api/p2p';
import type {
  BudgetCenter,
  GoodsReceipt,
  GoodsReceiptLine,
  RFQRequest,
  RFQResponse,
  SupplierCertificate,
  SupplierInvoice,
} from '@/types/p2p';

// ── RFQ ────────────────────────────────────────────────────────────────────────
export const useRFQs = (status?: string) =>
  useQuery({
    queryKey: ['rfqs', status],
    queryFn: () => p2pApi.listRFQs({ status }),
  });

export const useCreateRFQ = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<RFQRequest>) => p2pApi.createRFQ(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rfqs'] });
      toast.success("Appel d'offres créé");
    },
    onError: () => toast.error("Erreur création AO"),
  });
};

export const useUpdateRFQ = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...p }: Partial<RFQRequest> & { id: string }) => p2pApi.updateRFQ(id, p),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rfqs'] });
      toast.success('AO mis à jour');
    },
    onError: () => toast.error('Erreur mise à jour AO'),
  });
};

export const useRFQResponses = (rfqId: string) =>
  useQuery({
    queryKey: ['rfq-responses', rfqId],
    queryFn: () => p2pApi.getRFQResponses(rfqId),
    enabled: !!rfqId,
  });

export const useAddRFQResponse = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ rfqId, ...p }: Partial<RFQResponse> & { rfqId: string }) =>
      p2pApi.addRFQResponse(rfqId, p),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['rfq-responses', vars.rfqId] });
      toast.success('Réponse fournisseur enregistrée');
    },
    onError: () => toast.error('Erreur enregistrement réponse'),
  });
};

export const useSelectRFQWinner = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ rfqId, supplierId, reason }: { rfqId: string; supplierId: string; reason: string }) =>
      p2pApi.selectRFQWinner(rfqId, supplierId, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rfqs'] });
      toast.success('Fournisseur attributaire sélectionné');
    },
    onError: () => toast.error('Erreur sélection fournisseur'),
  });
};

// ── Goods Receipts ─────────────────────────────────────────────────────────────
export const useGoodsReceipts = (params?: { status?: string; supplier_id?: string }) =>
  useQuery({
    queryKey: ['goods-receipts', params],
    queryFn: () => p2pApi.listGoodsReceipts(params),
  });

export const useGoodsReceipt = (id: string) =>
  useQuery({
    queryKey: ['goods-receipt', id],
    queryFn: () => p2pApi.getGoodsReceipt(id),
    enabled: !!id,
  });

export const useCreateGoodsReceipt = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<GoodsReceipt> & { lines?: Partial<GoodsReceiptLine>[] }) =>
      p2pApi.createGoodsReceipt(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['goods-receipts'] });
      toast.success('Bon de réception créé');
    },
    onError: () => toast.error('Erreur création BR'),
  });
};

export const useUpdateGoodsReceipt = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...p }: Partial<GoodsReceipt> & { id: string }) =>
      p2pApi.updateGoodsReceipt(id, p),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['goods-receipts'] });
      toast.success('BR mis à jour');
    },
    onError: () => toast.error('Erreur mise à jour BR'),
  });
};

export const useReleaseQuarantine = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      decision,
      by,
      notes,
    }: { id: string; decision: 'ACCEPTE' | 'REFUSE'; by: string; notes?: string }) =>
      p2pApi.releaseQuarantine(id, decision, by, notes),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['goods-receipts'] });
      toast.success(vars.decision === 'ACCEPTE' ? 'Marchandise acceptée' : 'Marchandise refusée');
    },
    onError: () => toast.error('Erreur libération quarantaine'),
  });
};

// ── Supplier Invoices ──────────────────────────────────────────────────────────
export const useSupplierInvoices = (params?: { status?: string; supplier_id?: string }) =>
  useQuery({
    queryKey: ['supplier-invoices', params],
    queryFn: () => p2pApi.listInvoices(params),
  });

export const useCreateInvoice = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<SupplierInvoice>) => p2pApi.createInvoice(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['supplier-invoices'] });
      toast.success('Facture créée');
    },
    onError: () => toast.error('Erreur création facture'),
  });
};

export const useUpdateInvoice = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...p }: Partial<SupplierInvoice> & { id: string }) =>
      p2pApi.updateInvoice(id, p),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['supplier-invoices'] });
      toast.success('Facture mise à jour');
    },
    onError: () => toast.error('Erreur mise à jour facture'),
  });
};

export const useRunThreeWayMatch = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ invoiceId, tolerancePct }: { invoiceId: string; tolerancePct?: number }) =>
      p2pApi.runThreeWayMatch(invoiceId, tolerancePct),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['supplier-invoices'] });
      toast.success('Rapprochement 3 documents effectué');
    },
    onError: () => toast.error('Erreur rapprochement'),
  });
};

export const useApproveInvoicePayment = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ invoiceId, by }: { invoiceId: string; by: string }) =>
      p2pApi.approvePayment(invoiceId, by),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['supplier-invoices'] });
      toast.success('Facture approuvée — bon à payer');
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : 'Erreur approbation paiement'),
  });
};

export const useMarkInvoicePaid = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      invoiceId,
      paymentRef,
      by,
    }: { invoiceId: string; paymentRef: string; by: string }) =>
      p2pApi.markPaid(invoiceId, paymentRef, by),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['supplier-invoices'] });
      toast.success('Facture marquée payée');
    },
    onError: () => toast.error('Erreur marquage paiement'),
  });
};

// ── Supplier Certificates ──────────────────────────────────────────────────────
export const useSupplierCertificates = (params?: { supplier_id?: string; type?: string }) =>
  useQuery({
    queryKey: ['supplier-certificates', params],
    queryFn: () => p2pApi.listCertificates(params),
  });

export const useCreateCertificate = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<SupplierCertificate>) => p2pApi.createCertificate(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['supplier-certificates'] });
      toast.success('Certificat ajouté');
    },
    onError: () => toast.error('Erreur ajout certificat'),
  });
};

export const useUpdateCertificate = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...p }: Partial<SupplierCertificate> & { id: string }) =>
      p2pApi.updateCertificate(id, p),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['supplier-certificates'] });
      toast.success('Certificat mis à jour');
    },
    onError: () => toast.error('Erreur mise à jour certificat'),
  });
};

export const useDeleteCertificate = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => p2pApi.deleteCertificate(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['supplier-certificates'] });
      toast.success('Certificat supprimé');
    },
    onError: () => toast.error('Erreur suppression certificat'),
  });
};

// ── Budget Centers ─────────────────────────────────────────────────────────────
export const useBudgetCenters = (site?: string) =>
  useQuery({
    queryKey: ['budget-centers', site],
    queryFn: () => p2pApi.listBudgetCenters({ site }),
  });

export const useCreateBudgetCenter = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<BudgetCenter>) => p2pApi.createBudgetCenter(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['budget-centers'] });
      toast.success('Centre budgétaire créé');
    },
    onError: () => toast.error('Erreur création centre budgétaire'),
  });
};

export const useUpdateBudgetCenter = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...p }: Partial<BudgetCenter> & { id: string }) =>
      p2pApi.updateBudgetCenter(id, p),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['budget-centers'] });
    },
    onError: () => toast.error('Erreur mise à jour budget'),
  });
};
