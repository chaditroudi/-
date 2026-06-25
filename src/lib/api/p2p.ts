import { apiRequest } from '@/integrations/mongodb/client';
import type {
  BudgetCenter,
  GoodsReceipt,
  GoodsReceiptLine,
  RFQRequest,
  RFQResponse,
  SupplierCertificate,
  SupplierInvoice,
} from '@/types/p2p';

type Env<T> = { data: T };

export const p2pApi = {
  // ── RFQ ────────────────────────────────────────────────────────────────────
  listRFQs: async (params?: { status?: string }): Promise<RFQRequest[]> => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    const s = qs.toString() ? `?${qs.toString()}` : '';
    const r = await apiRequest<Env<RFQRequest[]>>(`/p2p/rfq${s}`);
    return r.data ?? [];
  },

  getRFQ: async (id: string): Promise<RFQRequest | null> => {
    const r = await apiRequest<Env<RFQRequest | null>>(`/p2p/rfq/${encodeURIComponent(id)}`);
    return r.data;
  },

  createRFQ: async (payload: Partial<RFQRequest>): Promise<RFQRequest> => {
    const r = await apiRequest<Env<RFQRequest>>('/p2p/rfq', { method: 'POST', body: JSON.stringify(payload) });
    return r.data;
  },

  updateRFQ: async (id: string, payload: Partial<RFQRequest>): Promise<RFQRequest> => {
    const r = await apiRequest<Env<RFQRequest>>(`/p2p/rfq/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(payload) });
    return r.data;
  },

  getRFQResponses: async (rfqId: string): Promise<RFQResponse[]> => {
    const r = await apiRequest<Env<RFQResponse[]>>(`/p2p/rfq/${encodeURIComponent(rfqId)}/responses`);
    return r.data ?? [];
  },

  addRFQResponse: async (rfqId: string, payload: Partial<RFQResponse>): Promise<RFQResponse> => {
    const r = await apiRequest<Env<RFQResponse>>(`/p2p/rfq/${encodeURIComponent(rfqId)}/responses`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return r.data;
  },

  selectRFQWinner: async (rfqId: string, supplierId: string, reason: string): Promise<RFQRequest> => {
    const r = await apiRequest<Env<RFQRequest>>(`/p2p/rfq/${encodeURIComponent(rfqId)}/select`, {
      method: 'POST',
      body: JSON.stringify({ supplier_id: supplierId, supplierId, reason }),
    });
    return r.data;
  },

  // ── Goods Receipts ─────────────────────────────────────────────────────────
  listGoodsReceipts: async (params?: { status?: string; supplier_id?: string }): Promise<GoodsReceipt[]> => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    if (params?.supplier_id) qs.set('supplier_id', params.supplier_id);
    const s = qs.toString() ? `?${qs.toString()}` : '';
    const r = await apiRequest<Env<GoodsReceipt[]>>(`/p2p/goods-receipts${s}`);
    return r.data ?? [];
  },

  getGoodsReceipt: async (id: string): Promise<(GoodsReceipt & { lines?: GoodsReceiptLine[] }) | null> => {
    const r = await apiRequest<Env<GoodsReceipt & { lines?: GoodsReceiptLine[] }>>(`/p2p/goods-receipts/${encodeURIComponent(id)}`);
    return r.data;
  },

  createGoodsReceipt: async (payload: Partial<GoodsReceipt> & { lines?: Partial<GoodsReceiptLine>[] }): Promise<GoodsReceipt> => {
    const r = await apiRequest<Env<GoodsReceipt>>('/p2p/goods-receipts', { method: 'POST', body: JSON.stringify(payload) });
    return r.data;
  },

  updateGoodsReceipt: async (id: string, payload: Partial<GoodsReceipt>): Promise<GoodsReceipt> => {
    const r = await apiRequest<Env<GoodsReceipt>>(`/p2p/goods-receipts/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(payload) });
    return r.data;
  },

  releaseQuarantine: async (id: string, decision: 'ACCEPTE' | 'REFUSE', by: string, notes?: string): Promise<GoodsReceipt> => {
    const r = await apiRequest<Env<GoodsReceipt>>(`/p2p/goods-receipts/${encodeURIComponent(id)}/release`, {
      method: 'POST',
      body: JSON.stringify({ decision, by, notes }),
    });
    return r.data;
  },

  // ── Supplier Invoices ──────────────────────────────────────────────────────
  listInvoices: async (params?: { status?: string; supplier_id?: string }): Promise<SupplierInvoice[]> => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    if (params?.supplier_id) qs.set('supplier_id', params.supplier_id);
    const s = qs.toString() ? `?${qs.toString()}` : '';
    const r = await apiRequest<Env<SupplierInvoice[]>>(`/p2p/invoices${s}`);
    return r.data ?? [];
  },

  getInvoice: async (id: string): Promise<SupplierInvoice | null> => {
    const r = await apiRequest<Env<SupplierInvoice | null>>(`/p2p/invoices/${encodeURIComponent(id)}`);
    return r.data;
  },

  createInvoice: async (payload: Partial<SupplierInvoice>): Promise<SupplierInvoice> => {
    const r = await apiRequest<Env<SupplierInvoice>>('/p2p/invoices', { method: 'POST', body: JSON.stringify(payload) });
    return r.data;
  },

  updateInvoice: async (id: string, payload: Partial<SupplierInvoice>): Promise<SupplierInvoice> => {
    const r = await apiRequest<Env<SupplierInvoice>>(`/p2p/invoices/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(payload) });
    return r.data;
  },

  runThreeWayMatch: async (invoiceId: string, tolerancePct?: number): Promise<SupplierInvoice> => {
    const r = await apiRequest<Env<SupplierInvoice>>(`/p2p/invoices/${encodeURIComponent(invoiceId)}/three-way-match`, {
      method: 'POST',
      body: JSON.stringify({ tolerance_pct: tolerancePct, tolerancePct }),
    });
    return r.data;
  },

  approvePayment: async (invoiceId: string, by: string): Promise<SupplierInvoice> => {
    const r = await apiRequest<Env<SupplierInvoice>>(`/p2p/invoices/${encodeURIComponent(invoiceId)}/approve-payment`, {
      method: 'POST',
      body: JSON.stringify({ by }),
    });
    return r.data;
  },

  markPaid: async (invoiceId: string, paymentRef: string, by: string): Promise<SupplierInvoice> => {
    const r = await apiRequest<Env<SupplierInvoice>>(`/p2p/invoices/${encodeURIComponent(invoiceId)}/mark-paid`, {
      method: 'POST',
      body: JSON.stringify({ payment_reference: paymentRef, paymentRef, by }),
    });
    return r.data;
  },

  // ── Supplier Certificates ──────────────────────────────────────────────────
  listCertificates: async (params?: { supplier_id?: string; type?: string }): Promise<SupplierCertificate[]> => {
    const qs = new URLSearchParams();
    if (params?.supplier_id) qs.set('supplier_id', params.supplier_id);
    if (params?.type) qs.set('type', params.type);
    const s = qs.toString() ? `?${qs.toString()}` : '';
    const r = await apiRequest<Env<SupplierCertificate[]>>(`/p2p/certificates${s}`);
    return r.data ?? [];
  },

  createCertificate: async (payload: Partial<SupplierCertificate>): Promise<SupplierCertificate> => {
    const r = await apiRequest<Env<SupplierCertificate>>('/p2p/certificates', { method: 'POST', body: JSON.stringify(payload) });
    return r.data;
  },

  updateCertificate: async (id: string, payload: Partial<SupplierCertificate>): Promise<SupplierCertificate> => {
    const r = await apiRequest<Env<SupplierCertificate>>(`/p2p/certificates/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(payload) });
    return r.data;
  },

  deleteCertificate: async (id: string): Promise<{ id: string }> => {
    const r = await apiRequest<Env<{ id: string }>>(`/p2p/certificates/${encodeURIComponent(id)}`, { method: 'DELETE' });
    return r.data;
  },

  // ── Budget Centers ─────────────────────────────────────────────────────────
  listBudgetCenters: async (params?: { site?: string }): Promise<BudgetCenter[]> => {
    const qs = new URLSearchParams();
    if (params?.site) qs.set('site', params.site);
    const s = qs.toString() ? `?${qs.toString()}` : '';
    const r = await apiRequest<Env<BudgetCenter[]>>(`/p2p/budget-centers${s}`);
    return r.data ?? [];
  },

  createBudgetCenter: async (payload: Partial<BudgetCenter>): Promise<BudgetCenter> => {
    const r = await apiRequest<Env<BudgetCenter>>('/p2p/budget-centers', { method: 'POST', body: JSON.stringify(payload) });
    return r.data;
  },

  updateBudgetCenter: async (id: string, payload: Partial<BudgetCenter>): Promise<BudgetCenter> => {
    const r = await apiRequest<Env<BudgetCenter>>(`/p2p/budget-centers/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(payload) });
    return r.data;
  },
};
