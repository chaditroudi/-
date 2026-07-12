import { apiRequest } from '@/integrations/mongodb/client';
import type {
  PurchaseOrder,
  PurchaseOrderLine,
  PurchaseOrderStatus,
  PurchaseRequisition,
  RequisitionStatus,
} from '@/types/purchasing';

type ApiEnvelope<T> = {
  data: T;
};

export type RequisitionInsert = {
  requester_id?: string | null;
  requester_name: string;
  department?: string | null;
  material_id?: string | null;
  material_name: string;
  quantity: number;
  unit: string;
  urgency?: 'low' | 'normal' | 'high' | 'critical';
  justification?: string | null;
  estimated_cost?: number | null;
  preferred_supplier_id?: string | null;
  status?: 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'ordered' | 'cancelled';
  notes?: string | null;
};

export type PurchaseOrderInsert = {
  supplier_id: string;
  requisition_id?: string | null;
  status?: string;
  order_date?: string;
  expected_delivery_date?: string | null;
  subtotal?: number;
  tax_amount?: number;
  total_amount?: number;
  currency?: string;
  payment_terms?: string | null;
  delivery_address?: string | null;
  delivery_site?: string | null;
  incoterm?: string | null;
  supplier_reference?: string | null;
  notes?: string | null;
  created_by?: string | null;
  buyer_name?: string | null;
  approval_required?: boolean | null;
  approval_threshold?: number | null;
  invoice_status?: string | null;
  receipt_status?: string | null;
  goods_receipt_count?: number;
  line_count?: number;
  order_type?: string | null;
  variety?: string | null;
  quality_expected?: string | null;
  bio_required?: boolean | null;
  tolerance_pct?: number | null;
  advance_paid?: number | null;
  transport_mode?: string | null;
  payment_status?: string | null;
  supplier_confirmed_at?: string | null;
};

export type OrderLineInsert = {
  order_id: string;
  material_id?: string | null;
  line_number?: number | null;
  description: string;
  quantity: number;
  confirmed_quantity?: number;
  unit: string;
  unit_price: number;
  received_quantity?: number;
  accepted_quantity?: number;
  rejected_quantity?: number;
  invoiced_quantity?: number;
  over_delivery_tolerance_pct?: number;
  under_delivery_tolerance_pct?: number;
  line_status?: string | null;
  notes?: string | null;
};

/** Matière sous son point de commande (§4.1). */
export interface ReplenishmentNeed {
  material_id: string;
  material_name: string;
  code: string;
  unit: string;
  min_stock: number;
  current_stock: number;
  suggested_quantity: number;
  preferred_supplier_id: string | null;
  already_requested: boolean;
}

export const purchasingApi = {
  listReplenishmentNeeds: async () => {
    const response = await apiRequest<ApiEnvelope<ReplenishmentNeed[]>>('/purchasing/replenishment-needs');
    return response.data || [];
  },

  generateReplenishment: async () => {
    const response = await apiRequest<ApiEnvelope<{ created_count: number; requisitions: PurchaseRequisition[] }>>(
      '/purchasing/requisitions/auto-replenish',
      { method: 'POST' },
    );
    return response.data;
  },

  listRequisitions: async (status?: RequisitionStatus) => {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    const suffix = params.toString() ? `?${params.toString()}` : '';
    const response = await apiRequest<ApiEnvelope<PurchaseRequisition[]>>(`/purchasing/requisitions${suffix}`);
    return response.data || [];
  },

  getRequisition: async (id: string) => {
    const response = await apiRequest<ApiEnvelope<PurchaseRequisition | null>>(`/purchasing/requisitions/${encodeURIComponent(id)}`);
    return response.data;
  },

  createRequisition: async (payload: RequisitionInsert) => {
    const response = await apiRequest<ApiEnvelope<PurchaseRequisition>>('/purchasing/requisitions', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return response.data;
  },

  updateRequisition: async (id: string, payload: Record<string, unknown>) => {
    const response = await apiRequest<ApiEnvelope<PurchaseRequisition>>(`/purchasing/requisitions/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    return response.data;
  },

  approveRequisition: async (id: string, approverName: string) => {
    const response = await apiRequest<ApiEnvelope<PurchaseRequisition>>(`/purchasing/requisitions/${encodeURIComponent(id)}/approve`, {
      method: 'POST',
      body: JSON.stringify({ approverName }),
    });
    return response.data;
  },

  rejectRequisition: async (id: string, reason: string, rejectorName: string) => {
    const response = await apiRequest<ApiEnvelope<PurchaseRequisition>>(`/purchasing/requisitions/${encodeURIComponent(id)}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason, rejectorName }),
    });
    return response.data;
  },

  deleteRequisition: async (id: string) => {
    const response = await apiRequest<ApiEnvelope<{ id: string; deleted: boolean }>>(`/purchasing/requisitions/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    return response.data;
  },

  listOrders: async (status?: PurchaseOrderStatus) => {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    const suffix = params.toString() ? `?${params.toString()}` : '';
    const response = await apiRequest<ApiEnvelope<PurchaseOrder[]>>(`/purchasing/orders${suffix}`);
    return response.data || [];
  },

  getOrder: async (id: string) => {
    const response = await apiRequest<ApiEnvelope<PurchaseOrder | null>>(`/purchasing/orders/${encodeURIComponent(id)}`);
    return response.data;
  },

  createOrder: async (payload: { order: PurchaseOrderInsert; lines: Omit<OrderLineInsert, 'order_id'>[] }) => {
    const response = await apiRequest<ApiEnvelope<PurchaseOrder>>('/purchasing/orders', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return response.data;
  },

  updateOrder: async (id: string, payload: { order: PurchaseOrderInsert; lines: Omit<OrderLineInsert, 'order_id'>[] }) => {
    const response = await apiRequest<ApiEnvelope<PurchaseOrder>>(`/purchasing/orders/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    return response.data;
  },

  sendOrder: async (id: string) => {
    const response = await apiRequest<ApiEnvelope<PurchaseOrder>>(`/purchasing/orders/${encodeURIComponent(id)}/send`, {
      method: 'POST',
    });
    return response.data;
  },

  confirmOrder: async (id: string, expectedDate?: string) => {
    const response = await apiRequest<ApiEnvelope<PurchaseOrder>>(`/purchasing/orders/${encodeURIComponent(id)}/confirm`, {
      method: 'POST',
      body: JSON.stringify({ expectedDate }),
    });
    return response.data;
  },

  approveOrder: async (id: string, approverName: string) => {
    const response = await apiRequest<ApiEnvelope<PurchaseOrder>>(`/purchasing/orders/${encodeURIComponent(id)}/approve`, {
      method: 'POST',
      body: JSON.stringify({ approverName }),
    });
    return response.data;
  },

  receiveOrderLine: async (
    orderId: string,
    payload: {
      lineId: string;
      receivedNow: number;
      supplierLot: string;
      qcStatus: 'accepted' | 'conditional' | 'rejected';
      grnNumber?: string;
      quarantineReason?: string;
      rejectionReason?: string;
      receivedBy?: string;
    },
  ) => {
    const response = await apiRequest<ApiEnvelope<PurchaseOrder>>(`/purchasing/orders/${encodeURIComponent(orderId)}/receive-line`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return response.data;
  },

  getOrderReceiptLogs: async (orderId: string) => {
    const response = await apiRequest<ApiEnvelope<Record<string, unknown>[]>>(
      `/purchasing/orders/${encodeURIComponent(orderId)}/receipt-logs`,
    );
    return response.data || [];
  },

  getOrderLinkedReceptions: async (orderId: string) => {
    const response = await apiRequest<ApiEnvelope<{ lots: Record<string, unknown>[]; receptions: Record<string, unknown>[] }>>(
      `/purchasing/orders/${encodeURIComponent(orderId)}/linked-receptions`,
    );
    return response.data || { lots: [], receptions: [] };
  },

  saveThreeWayMatch: async (
    orderId: string,
    payload: {
      invoiceNumber: string;
      invoiceAmount: number;
      invoiceDate: string;
      tolerancePct: number;
    },
  ) => {
    const response = await apiRequest<ApiEnvelope<PurchaseOrder>>(`/purchasing/orders/${encodeURIComponent(orderId)}/three-way-match`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return response.data;
  },

  closeOrder: async (id: string) => {
    const response = await apiRequest<ApiEnvelope<PurchaseOrder>>(`/purchasing/orders/${encodeURIComponent(id)}/close`, {
      method: 'POST',
    });
    return response.data;
  },

  deleteOrder: async (id: string) => {
    const response = await apiRequest<ApiEnvelope<{ id: string; deleted: boolean }>>(`/purchasing/orders/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    return response.data;
  },

  addOrderLine: async (payload: OrderLineInsert) => {
    const response = await apiRequest<ApiEnvelope<PurchaseOrderLine>>('/purchasing/order-lines', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return response.data;
  },

  updateOrderLine: async (id: string, payload: Record<string, unknown>) => {
    const response = await apiRequest<ApiEnvelope<PurchaseOrderLine>>(`/purchasing/order-lines/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    return response.data;
  },

  deleteOrderLine: async (id: string) => {
    const response = await apiRequest<ApiEnvelope<{ id: string; deleted: boolean }>>(`/purchasing/order-lines/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    return response.data;
  },

  getStats: async () => {
    const response = await apiRequest<
      ApiEnvelope<{
        requisitions: {
          total: number;
          pending: number;
          approved: number;
          rejected: number;
        };
        orders: {
          total: number;
          draft: number;
          submitted: number;
          confirmed: number;
          partiallyDelivered: number;
          delivered: number;
          invoiced: number;
          onHold: number;
          totalAmount: number;
          monthlyAmount: number;
        };
      }>
    >('/purchasing/stats');
    return response.data;
  },
};
