import { useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import type {
  Product,
  ShipmentLine,
  ShipmentPreparation,
  StockAlert,
  StockLot,
  StockMovementType,
  ProductCategory,
  LotStatus,
} from '@/types/stock';
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
  useListAllReceptionLotsQuery,
  type ExpeditionLotSuggestion,
} from '@/store/api/stockApi';

export type StockLotFilters = {
  status?: LotStatus;
  category?: ProductCategory;
};

export type StockMovementFilters = {
  type?: StockMovementType;
  lotId?: string;
};

// ── Products ───────────────────────────────────────────────────────────────────

export const useProducts = (category?: ProductCategory) => {
  const result = useListProductsQuery();
  return {
    ...result,
    data: result.data
      ?.filter((p) => p.is_active !== false)
      .filter((p) => !category || p.category === category),
  };
};

export const useCreateProduct = () => {
  const { toast } = useToast();
  const [create, state] = useCreateProductMutation();
  return {
    mutateAsync: async (product: Partial<Product>) => {
      const data = await create(product).unwrap();
      toast({ title: 'Produit créé', description: 'Le produit a été ajouté au catalogue' });
      return data;
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
      const data = await update({ id, ...product }).unwrap();
      toast({ title: 'Produit mis à jour', description: 'Les modifications ont été enregistrées' });
      return data;
    },
    isPending: state.isLoading,
  };
};

// ── Stock Lots ─────────────────────────────────────────────────────────────────

export const useStockLots = (filters?: StockLotFilters | string) => {
  const status =
    typeof filters === 'string'
      ? filters
      : filters?.status;
  const category = typeof filters === 'object' ? filters?.category : undefined;
  const result = useListStockLotsQuery(status);
  const data = useMemo(() => {
    const lots = result.data ?? [];
    if (!category) return lots;
    return lots.filter((lot) => lot.product?.category === category || (lot as StockLot & { category?: string }).category === category);
  }, [result.data, category]);
  return { ...result, data };
};

export const useCreateStockLot = () => {
  const [create, state] = useCreateStockLotMutation();
  return {
    mutateAsync: async (lot: Partial<StockLot>) => create(lot).unwrap(),
    isPending: state.isLoading,
  };
};

export const useUpdateStockLot = () => {
  const [update, state] = useUpdateStockLotMutation();
  return {
    mutateAsync: async ({ id, ...lot }: { id: string } & Partial<StockLot> & Record<string, unknown>) =>
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

const mergeLotQualityNotes = (
  currentNotes: string | null | undefined,
  nextEntry: string,
) => {
  const trimmedCurrent = (currentNotes || '').trim();
  if (!trimmedCurrent) return nextEntry;
  return `${trimmedCurrent}\n${nextEntry}`;
};

export const useBlockLot = () => {
  const { toast } = useToast();
  const [update, state] = useUpdateStockLotMutation();

  return {
    mutateAsync: async ({
      lotId,
      lotNumber,
      blockedBy,
      reason,
      currentNotes,
    }: {
      lotId: string;
      lotNumber: string;
      blockedBy: string;
      reason: string;
      currentNotes?: string | null;
    }) => {
      const blockedAt = new Date().toISOString();
      const entry = `[${new Date(blockedAt).toLocaleString('fr-FR')}] Blocage manuel par ${blockedBy}: ${reason}`;
      const data = await update({
        id: lotId,
        status: 'BLOCKED',
        block_reason: reason,
        blocked_by: blockedBy,
        blocked_at: blockedAt,
        quality_notes: mergeLotQualityNotes(currentNotes, entry),
      }).unwrap();
      toast({
        title: 'Lot bloqué',
        description: `${lotNumber} a été bloqué manuellement`,
      });
      return data;
    },
    isPending: state.isLoading,
  };
};

export const useReleaseBlockedLot = () => {
  const { toast } = useToast();
  const [update, state] = useUpdateStockLotMutation();

  return {
    mutateAsync: async ({
      lotId,
      lotNumber,
      releasedBy,
      releaseComment,
      currentNotes,
    }: {
      lotId: string;
      lotNumber: string;
      releasedBy: string;
      releaseComment?: string;
      currentNotes?: string | null;
    }) => {
      const releasedAt = new Date().toISOString();
      const releaseEntry = releaseComment?.trim()
        ? `[${new Date(releasedAt).toLocaleString('fr-FR')}] Déblocage manuel par ${releasedBy}: ${releaseComment.trim()}`
        : `[${new Date(releasedAt).toLocaleString('fr-FR')}] Déblocage manuel par ${releasedBy}`;
      const data = await update({
        id: lotId,
        status: 'VALIDATED',
        block_reason: null,
        blocked_by: null,
        blocked_at: null,
        released_by: releasedBy,
        released_at: releasedAt,
        qc_validated_by: releasedBy,
        qc_validated_at: releasedAt,
        quality_notes: mergeLotQualityNotes(currentNotes, releaseEntry),
      }).unwrap();
      toast({
        title: 'Lot débloqué',
        description: `${lotNumber} est de nouveau disponible`,
      });
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

export const useStockMovements = (filters?: StockMovementFilters | string) => {
  const lotId = typeof filters === 'string' ? filters : filters?.lotId;
  const type = typeof filters === 'object' ? filters?.type : undefined;
  const result = useListStockMovementsQuery(lotId);
  const data = useMemo(() => {
    const movements = result.data ?? [];
    if (!type) return movements;
    return movements.filter((m) => m.movement_type === type);
  }, [result.data, type]);
  return { ...result, data };
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
    data: result.data?.filter((a) => !status || a.status === status),
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
  return { ...result, data: result.data ?? [] };
};

export const useCreateShipment = () => {
  const { toast } = useToast();
  const [create, state] = useCreateShipmentMutation();
  return {
    mutateAsync: async (payload: Partial<ShipmentPreparation>) => {
      const data = await create(payload).unwrap();
      toast({ title: 'Expédition créée' });
      return data;
    },
    isPending: state.isLoading,
  };
};

export const useUpdateShipment = () => {
  const { toast } = useToast();
  const [update, state] = useUpdateShipmentMutation();
  return {
    mutateAsync: async ({ id, ...patch }: Partial<ShipmentPreparation> & { id: string }) => {
      const data = await update({ id, ...patch }).unwrap();
      toast({ title: 'Expédition mise à jour' });
      return data;
    },
    isPending: state.isLoading,
  };
};

export const useCreateShipmentLine = () => {
  const [create, state] = useCreateShipmentLineMutation();
  return {
    mutateAsync: async (payload: Partial<ShipmentLine>) => create(payload).unwrap(),
    isPending: state.isLoading,
  };
};

export const useUpdateShipmentLine = () => {
  const [update, state] = useUpdateShipmentLineMutation();
  return {
    mutateAsync: async ({ id, ...patch }: Partial<ShipmentLine> & { id: string }) =>
      update({ id, ...patch }).unwrap(),
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

/**
 * Read-only FEFO/FIFO lot suggestions for a product.
 * Gate 2 P0: must NEVER call POST /stock/expedition (that endpoint decrements stock).
 */
export const useLotSuggestions = (productId: string, requestedQty: number) => {
  const result = useListStockLotsQuery(undefined);
  const released = new Set(['VALIDATED', 'RELEASED', 'STOCK_LIBERE', 'LIBERE']);

  const data = useMemo(() => {
    if (!productId || requestedQty <= 0) return [] as ExpeditionLotSuggestion[];
    const lots = (result.data ?? [])
      .filter((lot) => lot.product_id === productId)
      .filter((lot) => released.has(String(lot.status || '').toUpperCase()))
      .filter((lot) => Number(lot.current_quantity || 0) > 0)
      .slice()
      .sort((a, b) => {
        const aDate = String(a.dluo_date || a.dlc_date || a.reception_date || a.created_at || '');
        const bDate = String(b.dluo_date || b.dlc_date || b.reception_date || b.created_at || '');
        return aDate.localeCompare(bDate);
      });

    let remaining = requestedQty;
    const suggestions: ExpeditionLotSuggestion[] = [];
    for (const lot of lots) {
      if (remaining <= 0) break;
      const available = Number(lot.current_quantity || 0);
      suggestions.push({
        lot_id: lot.id,
        lot_number: lot.lot_number,
        available_qty: available,
        rotation_rule: lot.dluo_date || lot.dlc_date ? 'FEFO' : 'FIFO',
        sort_date: lot.dluo_date || lot.dlc_date || lot.reception_date || lot.created_at || null,
        product_id: lot.product_id,
        status: lot.status,
      });
      remaining -= available;
    }
    return suggestions;
  }, [productId, requestedQty, result.data]);

  const error = result.isError && productId && requestedQty > 0
    ? new Error('Suggestions de lots indisponibles. Sélectionnez un lot autorisé manuellement.')
    : null;
  return { data, isLoading: result.isLoading || result.isFetching, error };
};

// ── All reception lots (unified storage view) ──────────────────────────────────

export const useAllReceptionLots = (stockStatus?: StockLotStatus, options?: { enabled?: boolean }) => {
  const result = useListAllReceptionLotsQuery(stockStatus ? { stockStatus } : undefined, { skip: !(options?.enabled ?? true) });
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
