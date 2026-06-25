import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import type { Product, ShipmentLine, ShipmentPreparation, StockAlert, StockLocation, StockLot, StockMovement, ProductCategory } from '@/types/stock';
import type { StockLotStatus } from '@/types/reception';
import {
  useListProductsQuery,
  useCreateProductMutation,
  useUpdateProductMutation,
  useListStockLotsQuery,
  useCreateStockLotMutation,
  useUpdateStockLotMutation,
  useListStockLocationsQuery,
  useUpdateStockLocationMutation,
  useListStockMovementsQuery,
  useGetStockSummaryQuery,
  useListInventoryCountsQuery,
  useListStockAlertsQuery,
  useUpdateStockAlertMutation,
  useListShipmentsQuery,
  useCreateShipmentMutation,
  useUpdateShipmentMutation,
  useCreateShipmentLineMutation,
  useUpdateShipmentLineMutation,
  useDeleteShipmentLineMutation,
  useGetExpeditionLotSuggestionsMutation,
  useListAllReceptionLotsQuery,
} from '@/store/api/stockApi';

// ── Products ───────────────────────────────────────────────────────────────────

export const useProducts = (category?: ProductCategory) => {
  const result = useListProductsQuery();
  return {
    ...result,
    data: (result.data as unknown as Product[] | undefined)
      ?.filter((p) => p.is_active !== false)
      .filter((p) => !category || (p as any).category === category),
  };
};

export const useCreateProduct = () => {
  const { toast } = useToast();
  const [create, state] = useCreateProductMutation();
  return {
    mutateAsync: async (product: Partial<Product>) => {
      const data = await create(product as Record<string, unknown>).unwrap();
      toast({ title: 'Produit créé', description: 'Le produit a été ajouté au catalogue' });
      return data as Product;
    },
    isPending: state.isLoading,
    onError: (error: Error) => toast({ title: 'Erreur', description: error.message, variant: 'destructive' }),
  };
};

export const useUpdateProduct = () => {
  const { toast } = useToast();
  const [update, state] = useUpdateProductMutation();
  return {
    mutateAsync: async ({ id, ...product }: Partial<Product> & { id: string }) => {
      const data = await update({ id, ...product as Record<string, unknown> }).unwrap();
      toast({ title: 'Produit mis à jour', description: 'Les modifications ont été enregistrées' });
      return data as Product;
    },
    isPending: state.isLoading,
  };
};

// ── Stock Lots ─────────────────────────────────────────────────────────────────

export const useStockLots = (status?: string) => {
  return useListStockLotsQuery(status);
};

export const useCreateStockLot = () => {
  const [create, state] = useCreateStockLotMutation();
  return {
    mutateAsync: async (lot: Record<string, unknown>) => create(lot).unwrap(),
    isPending: state.isLoading,
  };
};

export const useUpdateStockLot = () => {
  const [update, state] = useUpdateStockLotMutation();
  return {
    mutateAsync: async ({ id, ...lot }: { id: string } & Record<string, unknown>) =>
      update({ id, ...lot }).unwrap(),
    isPending: state.isLoading,
  };
};

export const useValidateLot = () => {
  const { toast } = useToast();
  const [update, state] = useUpdateStockLotMutation();
  return {
    mutateAsync: async ({ lotId, validatedBy, notes }: { lotId: string; validatedBy: string; notes?: string }) => {
      const data = await update({
        id: lotId,
        status: 'VALIDATED',
        validated_by: validatedBy,
        validated_at: new Date().toISOString(),
        ...(notes ? { quality_notes: notes } : {}),
      }).unwrap();
      toast({ title: 'Lot validé', description: `Validation enregistrée par ${validatedBy}` });
      return data;
    },
    isPending: state.isLoading,
  };
};

// ── Locations ──────────────────────────────────────────────────────────────────

export const useStockLocations = () => {
  return useListStockLocationsQuery();
};

export const useUpdateStockLocation = () => {
  const [update, state] = useUpdateStockLocationMutation();
  return {
    mutateAsync: async ({ id, ...loc }: { id: string } & Record<string, unknown>) =>
      update({ id, ...loc }).unwrap(),
    isPending: state.isLoading,
  };
};

// ── Movements ──────────────────────────────────────────────────────────────────

export const useStockMovements = (lotId?: string) => {
  return useListStockMovementsQuery(lotId);
};

// ── Summary ────────────────────────────────────────────────────────────────────

export const useStockSummary = () => {
  return useGetStockSummaryQuery();
};

// ── Inventory counts ───────────────────────────────────────────────────────────

export const useInventoryCounts = () => {
  return useListInventoryCountsQuery();
};

// ── Stock Alerts ───────────────────────────────────────────────────────────────

export const useStockAlerts = (status?: StockAlert['status']) => {
  const result = useListStockAlertsQuery();
  return {
    ...result,
    data: (result.data as unknown as StockAlert[] | undefined)
      ?.filter((a) => !status || a.status === status),
  };
};

export const useUpdateStockAlert = () => {
  const [update, state] = useUpdateStockAlertMutation();
  return {
    mutateAsync: async ({ id, ...patch }: { id: string } & Record<string, unknown>) =>
      update({ id, ...patch }).unwrap(),
    isPending: state.isLoading,
  };
};

// ── Shipments ──────────────────────────────────────────────────────────────────

export const useShipments = () => {
  const result = useListShipmentsQuery();
  return { ...result, data: (result.data as unknown as ShipmentPreparation[] | undefined) ?? [] };
};

export const useCreateShipment = () => {
  const { toast } = useToast();
  const [create, state] = useCreateShipmentMutation();
  return {
    mutateAsync: async (payload: Partial<ShipmentPreparation>) => {
      const data = await create(payload as Record<string, unknown>).unwrap();
      toast({ title: 'Expédition créée' });
      return data as ShipmentPreparation;
    },
    isPending: state.isLoading,
  };
};

export const useUpdateShipment = () => {
  const { toast } = useToast();
  const [update, state] = useUpdateShipmentMutation();
  return {
    mutateAsync: async ({ id, ...patch }: Partial<ShipmentPreparation> & { id: string }) => {
      const data = await update({ id, ...patch as Record<string, unknown> }).unwrap();
      toast({ title: 'Expédition mise à jour' });
      return data as ShipmentPreparation;
    },
    isPending: state.isLoading,
  };
};

export const useCreateShipmentLine = () => {
  const [create, state] = useCreateShipmentLineMutation();
  return {
    mutateAsync: async (payload: Partial<ShipmentLine>) =>
      (await create(payload as Record<string, unknown>).unwrap()) as ShipmentLine,
    isPending: state.isLoading,
  };
};

export const useUpdateShipmentLine = () => {
  const [update, state] = useUpdateShipmentLineMutation();
  return {
    mutateAsync: async ({ id, ...patch }: Partial<ShipmentLine> & { id: string }) =>
      (await update({ id, ...patch as Record<string, unknown> }).unwrap()) as ShipmentLine,
    isPending: state.isLoading,
  };
};

export const useDeleteShipmentLine = () => {
  const [del, state] = useDeleteShipmentLineMutation();
  return {
    mutate: (id: string) => del(id),
    isPending: state.isLoading,
  };
};

export const useLotSuggestions = (productId: string, requestedQty: number) => {
  const [getSuggestions, state] = useGetExpeditionLotSuggestionsMutation();
  const [data, setData] = useState<unknown[]>([]);

  useEffect(() => {
    if (productId && requestedQty > 0) {
      getSuggestions({ product_id: productId, requested_qty: requestedQty })
        .unwrap()
        .then((res) => setData((res as any)?.suggestions ?? (Array.isArray(res) ? res : [])))
        .catch(() => setData([]));
    } else {
      setData([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, requestedQty]);

  return { data, isLoading: state.isLoading };
};

// ── All reception lots (unified storage view) ──────────────────────────────────

export const useAllReceptionLots = (stockStatus?: StockLotStatus) => {
  const result = useListAllReceptionLotsQuery(stockStatus ? { stockStatus } : undefined);
  return {
    ...result,
    data: (result.data ?? []) as Array<{
      id: string;
      lot_internal?: string;
      lot_supplier?: string;
      variety?: string;
      quantity?: number;
      unit?: string;
      stock_status?: StockLotStatus;
      storage_zone_code?: string;
      reception_id?: string;
      harvest_date?: string;
      created_at?: string;
      quarantine_reason?: string;
    }>,
  };
};
