import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { purchasingApi, type OrderLineInsert, type PurchaseOrderInsert, type RequisitionInsert } from '@/lib/api/purchasing';
import {
  CanonicalPurchaseOrderStatus,
  PurchaseOrder,
  PurchaseOrderLine,
  PurchaseOrderInvoiceStatus,
  PurchaseOrderStatus,
  PurchaseRequisition,
  RequisitionStatus,
  normalizePurchaseOrder,
  normalizePurchaseOrderStatus,
} from '@/types/purchasing';

const PURCHASE_ORDER_APPROVAL_THRESHOLD = 50000;

const normalizeOrder = (order: PurchaseOrder) => normalizePurchaseOrder(order);
const normalizeOrders = (orders: PurchaseOrder[]) => orders.map(normalizeOrder);
const purchaseOrdersQueryKey = (status?: PurchaseOrderStatus) =>
  status ? (['purchase_orders', status] as const) : (['purchase_orders'] as const);

type SageMeta = {
  threeWayMatch?: {
    invoiceNumber?: string;
    invoiceAmount?: number;
    invoiceDate?: string;
    tolerancePct?: number;
    matched?: boolean;
    varianceAmount?: number;
    variancePct?: number;
    updatedAt?: string;
  };
};

type StatsPayload = {
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
};

type QueryOptions = {
  enabled?: boolean;
};

export const matchesPurchaseOrderStatusFilter = (
  order: PurchaseOrder,
  status?: PurchaseOrderStatus,
) => {
  if (!status) return true;
  return normalizeOrder(order).status === normalizePurchaseOrderStatus(status);
};

export const mergePurchaseOrderIntoList = (
  orders: PurchaseOrder[] | undefined,
  incoming: PurchaseOrder,
) => {
  const normalizedIncoming = normalizeOrder(incoming);
  const normalizedOrders = normalizeOrders(orders || []);
  const withoutCurrent = normalizedOrders.filter((order) => order.id !== normalizedIncoming.id);

  return [normalizedIncoming, ...withoutCurrent].sort((left, right) => {
    const leftTs = Date.parse(left.created_at || left.updated_at || '') || 0;
    const rightTs = Date.parse(right.created_at || right.updated_at || '') || 0;
    return rightTs - leftTs;
  });
};

const syncPurchaseOrderCaches = (
  queryClient: ReturnType<typeof useQueryClient>,
  order: PurchaseOrder,
) => {
  const normalizedOrder = normalizeOrder(order);

  queryClient.setQueryData(['purchase_order', normalizedOrder.id], normalizedOrder);

  queryClient.getQueriesData<PurchaseOrder[]>({ queryKey: ['purchase_orders'] }).forEach(([queryKey, cachedOrders]) => {
    const statusFilter =
      Array.isArray(queryKey) && queryKey.length > 1
        ? (queryKey[1] as PurchaseOrderStatus | undefined)
        : undefined;

    const merged = mergePurchaseOrderIntoList(cachedOrders || [], normalizedOrder);
    const nextOrders = statusFilter
      ? merged.filter((candidate) => matchesPurchaseOrderStatusFilter(candidate, statusFilter))
      : merged;

    queryClient.setQueryData(queryKey, nextOrders);
  });
};

const removePurchaseOrderFromCaches = (
  queryClient: ReturnType<typeof useQueryClient>,
  orderId: string,
) => {
  queryClient.removeQueries({ queryKey: ['purchase_order', orderId], exact: true });

  queryClient.getQueriesData<PurchaseOrder[]>({ queryKey: ['purchase_orders'] }).forEach(([queryKey, cachedOrders]) => {
    if (!Array.isArray(cachedOrders)) return;
    queryClient.setQueryData(
      queryKey,
      cachedOrders.filter((order) => order.id !== orderId),
    );
  });
};

export const useRequisitions = (status?: RequisitionStatus, options?: QueryOptions) =>
  useQuery({
    queryKey: ['requisitions', status],
    queryFn: async () => purchasingApi.listRequisitions(status),
    enabled: options?.enabled ?? true,
  });

export const useRequisition = (id: string) =>
  useQuery({
    queryKey: ['requisition', id],
    queryFn: async () => purchasingApi.getRequisition(id),
    enabled: !!id,
  });

export const useCreateRequisition = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (requisition: RequisitionInsert) => purchasingApi.createRequisition(requisition),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requisitions'] });
      toast.success("Demande d'achat créée");
    },
    onError: (error) => {
      toast.error("Erreur lors de la création de la DA");
      console.error(error);
    },
  });
};

export const useUpdateRequisition = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<PurchaseRequisition> & { id: string }) =>
      purchasingApi.updateRequisition(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requisitions'] });
      toast.success("Demande d'achat mise à jour");
    },
    onError: (error) => {
      toast.error('Erreur lors de la mise à jour');
      console.error(error);
    },
  });
};

export const useApproveRequisition = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, approverName }: { id: string; approverName: string }) =>
      purchasingApi.approveRequisition(id, approverName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requisitions'] });
      toast.success('Demande approuvée');
    },
    onError: (error) => {
      toast.error("Erreur lors de l'approbation");
      console.error(error);
    },
  });
};

export const useRejectRequisition = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, reason, rejectorName }: { id: string; reason: string; rejectorName: string }) =>
      purchasingApi.rejectRequisition(id, reason, rejectorName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requisitions'] });
      toast.success('Demande rejetée');
    },
    onError: (error) => {
      toast.error('Erreur lors du rejet');
      console.error(error);
    },
  });
};

export const useDeleteRequisition = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => purchasingApi.deleteRequisition(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requisitions'] });
      toast.success('Demande supprimée');
    },
    onError: (error) => {
      toast.error('Erreur lors de la suppression');
      console.error(error);
    },
  });
};

export const usePurchaseOrders = (status?: PurchaseOrderStatus, options?: QueryOptions) =>
  useQuery({
    queryKey: purchaseOrdersQueryKey(status),
    queryFn: async () => {
      const orders = await purchasingApi.listOrders(status);
      if (!status) return normalizeOrders(orders || []);

      const canonicalStatus = normalizePurchaseOrderStatus(status);
      return normalizeOrders(orders || []).filter((order) => order.status === canonicalStatus);
    },
    enabled: options?.enabled ?? true,
  });

export const usePurchaseOrder = (id: string) =>
  useQuery({
    queryKey: ['purchase_order', id],
    queryFn: async () => {
      const order = await purchasingApi.getOrder(id);
      return order ? normalizeOrder(order) : null;
    },
    enabled: !!id,
  });

export const useCreatePurchaseOrder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      order,
      lines,
    }: {
      order: PurchaseOrderInsert;
      lines: Omit<OrderLineInsert, 'order_id'>[];
    }) => purchasingApi.createOrder({ order, lines }),
    onSuccess: (createdOrder) => {
      if (createdOrder) {
        syncPurchaseOrderCaches(queryClient, createdOrder);
      }
      queryClient.invalidateQueries({ queryKey: ['purchase_orders'] });
      queryClient.invalidateQueries({ queryKey: ['requisitions'] });
      queryClient.invalidateQueries({ queryKey: ['purchasing_stats'] });
      toast.success('Bon de commande créé');
    },
    onError: (error: any) => {
      console.error('BC creation error:', error);
      const msg =
        error?.message ||
        error?.details ||
        error?.hint ||
        (typeof error === 'string' ? error : null) ||
        'Erreur lors de la création du BC';
      toast.error(msg);
    },
  });
};

export const useUpdatePurchaseOrder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      order,
      lines,
    }: {
      id: string;
      order: PurchaseOrderInsert;
      lines: Omit<OrderLineInsert, 'order_id'>[];
    }) => {
      const result = await purchasingApi.updateOrder(id, { order, lines });
      return normalizeOrder(result);
    },
    onSuccess: (updatedOrder) => {
      syncPurchaseOrderCaches(queryClient, updatedOrder);
      queryClient.invalidateQueries({ queryKey: ['purchase_orders'] });
      queryClient.invalidateQueries({ queryKey: ['purchasing_stats'] });
      toast.success('Bon de commande mis à jour');
    },
    onError: (error) => {
      toast.error('Erreur lors de la mise à jour');
      console.error(error);
    },
  });
};

export const useSendPurchaseOrder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => normalizeOrder(await purchasingApi.sendOrder(id)),
    onSuccess: (updatedOrder) => {
      syncPurchaseOrderCaches(queryClient, updatedOrder);
      queryClient.invalidateQueries({ queryKey: ['purchase_orders'] });
      toast.success('Bon de commande envoyé');
    },
    onError: (error) => {
      toast.error("Erreur lors de l'envoi");
      console.error(error);
    },
  });
};

export const useConfirmPurchaseOrder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, expectedDate }: { id: string; expectedDate?: string }) =>
      normalizeOrder(await purchasingApi.confirmOrder(id, expectedDate)),
    onSuccess: (updatedOrder) => {
      syncPurchaseOrderCaches(queryClient, updatedOrder);
      queryClient.invalidateQueries({ queryKey: ['purchase_orders'] });
      toast.success('Bon de commande confirmé');
    },
    onError: (error) => {
      toast.error('Erreur lors de la confirmation');
      console.error(error);
    },
  });
};

export const useApprovePurchaseOrder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, approverName }: { id: string; approverName: string }) =>
      normalizeOrder(await purchasingApi.approveOrder(id, approverName)),
    onSuccess: (updatedOrder) => {
      syncPurchaseOrderCaches(queryClient, updatedOrder);
      queryClient.invalidateQueries({ queryKey: ['purchase_orders'] });
      toast.success('Bon de commande validé en interne');
    },
    onError: (error) => {
      toast.error('Erreur lors de la validation interne');
      console.error(error);
    },
  });
};

export const useReceivePurchaseOrderLine = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      orderId,
      lineId,
      receivedNow,
      supplierLot,
      qcStatus,
      grnNumber,
      quarantineReason,
      rejectionReason,
      receivedBy,
    }: {
      orderId: string;
      lineId: string;
      receivedNow: number;
      supplierLot: string;
      qcStatus: 'accepted' | 'conditional' | 'rejected';
      grnNumber?: string;
      quarantineReason?: string;
      rejectionReason?: string;
      receivedBy?: string;
    }) =>
      normalizeOrder(
        await purchasingApi.receiveOrderLine(orderId, {
          lineId,
          receivedNow,
          supplierLot,
          qcStatus,
          grnNumber,
          quarantineReason,
          rejectionReason,
          receivedBy,
        }),
      ),
    onSuccess: (updatedOrder) => {
      syncPurchaseOrderCaches(queryClient, updatedOrder);
      queryClient.invalidateQueries({ queryKey: ['purchase_orders'] });
      queryClient.invalidateQueries({ queryKey: ['purchasing_stats'] });
      toast.success('Réception enregistrée');
    },
    onError: (error) => {
      toast.error('Erreur lors de la réception');
      console.error(error);
    },
  });
};

export const useSavePurchaseOrderThreeWayMatch = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      orderId,
      invoiceNumber,
      invoiceAmount,
      invoiceDate,
      tolerancePct,
    }: {
      orderId: string;
      invoiceNumber: string;
      invoiceAmount: number;
      invoiceDate: string;
      tolerancePct: number;
    }) =>
      normalizeOrder(
        await purchasingApi.saveThreeWayMatch(orderId, {
          invoiceNumber,
          invoiceAmount,
          invoiceDate,
          tolerancePct,
        }),
      ),
    onSuccess: (updatedOrder) => {
      syncPurchaseOrderCaches(queryClient, updatedOrder);
      queryClient.invalidateQueries({ queryKey: ['purchase_orders'] });
      toast.success('3-way match enregistré');
    },
    onError: (error) => {
      toast.error("Erreur lors de l'enregistrement du 3-way match");
      console.error(error);
    },
  });
};

export const useClosePurchaseOrder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => normalizeOrder(await purchasingApi.closeOrder(id)),
    onSuccess: (updatedOrder) => {
      syncPurchaseOrderCaches(queryClient, updatedOrder);
      queryClient.invalidateQueries({ queryKey: ['purchase_orders'] });
      queryClient.invalidateQueries({ queryKey: ['purchasing_stats'] });
      toast.success('Bon de commande clôturé');
    },
    onError: (error) => {
      toast.error('Erreur lors de la clôture');
      console.error(error);
    },
  });
};

export const useDeletePurchaseOrder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => purchasingApi.deleteOrder(id),
    onSuccess: (result, orderId) => {
      removePurchaseOrderFromCaches(queryClient, result?.id || orderId);
      queryClient.invalidateQueries({ queryKey: ['purchase_orders'] });
      toast.success('Bon de commande supprimé');
    },
    onError: (error) => {
      toast.error('Erreur lors de la suppression');
      console.error(error);
    },
  });
};

export const useAddOrderLine = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (line: OrderLineInsert) => purchasingApi.addOrderLine(line),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase_orders'] });
      toast.success('Ligne ajoutée');
    },
    onError: (error) => {
      toast.error("Erreur lors de l'ajout de la ligne");
      console.error(error);
    },
  });
};

export const useUpdateOrderLine = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<PurchaseOrderLine> & { id: string }) =>
      purchasingApi.updateOrderLine(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase_orders'] });
    },
    onError: (error) => {
      toast.error('Erreur lors de la mise à jour');
      console.error(error);
    },
  });
};

export const useDeleteOrderLine = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => purchasingApi.deleteOrderLine(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase_orders'] });
      toast.success('Ligne supprimée');
    },
    onError: (error) => {
      toast.error('Erreur lors de la suppression');
      console.error(error);
    },
  });
};

export const usePurchasingStats = (options?: QueryOptions) =>
  useQuery({
    queryKey: ['purchasing_stats'],
    queryFn: async () => {
      const stats = await purchasingApi.getStats();
      return stats as StatsPayload;
    },
    enabled: options?.enabled ?? true,
  });

export type {
  CanonicalPurchaseOrderStatus,
  OrderLineInsert,
  PurchaseOrderInsert,
  PurchaseOrderInvoiceStatus,
  RequisitionInsert,
};

export { PURCHASE_ORDER_APPROVAL_THRESHOLD };
