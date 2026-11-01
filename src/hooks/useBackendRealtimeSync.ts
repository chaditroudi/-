/**
 * useBackendRealtimeSync
 *
 * Subscribes to the NestJS SSE endpoint (/api/realtime/events) and dispatches
 * RTK Query cache invalidations when the backend publishes a db_change event.
 *
 * The backend emits a semantic `resource` field (e.g. 'receptions', 'suppliers')
 * — the frontend never sees raw MongoDB collection names.
 */
import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthContext } from '@/contexts/AuthContext';
import { canRead } from '@/lib/apiAccess';
import { useAppDispatch } from '@/store/hooks';
import { fetchNotifications } from '@/store/slices/notificationsSlice';
import { fetchReceptions } from '@/store/slices/receptionsSlice';
import { getSseConnection } from '@/lib/sseClient';
import { receptionsApi } from '@/store/api/receptionsApi';
import { productionApi } from '@/store/api/productionApi';
import { batchesApi } from '@/store/api/batchesApi';
import { suppliersApi } from '@/store/api/suppliersApi';
import { materialsApi } from '@/store/api/materialsApi';
import { stockApi } from '@/store/api/stockApi';
import { storageApi } from '@/store/api/storageApi';
import { notificationsApi } from '@/store/api/notificationsApi';
import type { ServerRealtimeEvent } from '@/integrations/mongodb/client';
import type { AppDispatch } from '@/store';

const invalidateApiTags = (dispatch: AppDispatch, apiName: string, tags: unknown) => {
  switch (apiName) {
    case 'receptions':    dispatch(receptionsApi.util.invalidateTags(tags as any)); break;
    case 'production':    dispatch(productionApi.util.invalidateTags(tags as any)); break;
    case 'batches':       dispatch(batchesApi.util.invalidateTags(tags as any)); break;
    case 'suppliers':     dispatch(suppliersApi.util.invalidateTags(tags as any)); break;
    case 'materials':     dispatch(materialsApi.util.invalidateTags(tags as any)); break;
    case 'stock':         dispatch(stockApi.util.invalidateTags(tags as any)); break;
    case 'storage':       dispatch(storageApi.util.invalidateTags(tags as any)); break;
    case 'notifications': dispatch(notificationsApi.util.invalidateTags(tags as any)); break;
  }
};

export const shouldRefetchNotificationsForEvent = (
  event: ServerRealtimeEvent,
  table = event.table,
) =>
  table !== 'system_notifications'
  && (event.relatedTables || []).includes('system_notifications');

// ── resource → RTK Query tag invalidations ────────────────────────────────────
// Keys match the `resource` field emitted by the NestJS realtime bus.

type ApiName = 'receptions' | 'production' | 'batches' | 'suppliers' | 'materials' | 'stock' | 'storage' | 'notifications';
type TagGroup = { api: ApiName; tags: string[] };

const RESOURCE_TAGS: Record<string, TagGroup[]> = {
  receptions: [
    { api: 'receptions', tags: ['Reception', 'ReceptionLot', 'ReceptionUnit', 'QcInspection', 'ReceptionAlert', 'LiberedLot', 'StockMovement', 'ReceptionDraft', 'ReceptionAudit'] },
  ],
  suppliers: [
    { api: 'suppliers', tags: ['Supplier'] },
  ],
  materials: [
    { api: 'materials', tags: ['Material'] },
  ],
  stock: [
    { api: 'stock', tags: ['StockLot', 'StockMovement', 'StockSummary', 'StockLocation', 'StockProduct'] },
  ],
  storage: [
    { api: 'storage', tags: ['StorageZone', 'StorageLocation', 'StorageReading', 'StorageDoorEvent', 'StorageMovement', 'StorageDlcAlert'] },
    { api: 'batches', tags: ['StorageZone'] },
  ],
  batches: [
    { api: 'batches', tags: ['Batch', 'BatchMovement', 'BatchAlert', 'NonConformity', 'QualityInspection'] },
  ],
  production: [
    { api: 'production', tags: ['ProductionOrder', 'ProductionStep', 'QualityCheck', 'LotAllocation', 'LiberedLot', 'OutputLot'] },
  ],
  notifications: [
    { api: 'notifications', tags: ['Notification', 'AuditLog'] },
  ],
};

// ── Hook ───────────────────────────────────────────────────────────────────────

export const useBackendRealtimeSync = () => {
  const { user, roles } = useAuthContext();
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const seen = useRef<Set<string>>(new Set());
  const canReadReceptions = canRead(roles, 'receptions');

  useEffect(() => {
    if (!user?.id) return;
    seen.current.clear();

    const refreshAfterReconnect = () => {
      for (const entries of Object.values(RESOURCE_TAGS)) {
        for (const { api: apiName, tags } of entries) invalidateApiTags(dispatch, apiName, tags);
      }
      if (canReadReceptions) void dispatch(fetchReceptions());
      void dispatch(fetchNotifications({ force: true }));
      void queryClient.invalidateQueries();
    };

    const sse = getSseConnection();

    return sse.subscribe((msg) => {
      if (msg.eventName === 'connected') {
        window.dispatchEvent(new Event('backend-sse-connected'));
        // Events sent while disconnected are gone: anything on screen may be stale.
        if (msg.payload.reconnected) refreshAfterReconnect();
        return;
      }
      if (msg.eventName !== 'db_change') return;

      const { id, resource, relatedResources = [] } = msg.payload;

      // Deduplicate events by id
      if (id) {
        if (seen.current.has(id)) return;
        seen.current.add(id);
        if (seen.current.size > 300) {
          const arr = Array.from(seen.current);
          seen.current = new Set(arr.slice(-250));
        }
      }

      const resourcesToInvalidate = new Set([resource, ...relatedResources]);

      for (const res of resourcesToInvalidate) {
        for (const { api: apiName, tags } of (RESOURCE_TAGS[res] ?? [])) {
          invalidateApiTags(dispatch, apiName, tags);
        }
      }

      // TanStack powers the stage, packaging and indicator screens. Only active,
      // authorized observers refetch; IDs-only events are never treated as records.
      void queryClient.invalidateQueries({ refetchType: 'active' });

      if (resourcesToInvalidate.has('purchase_orders') || resourcesToInvalidate.has('purchase_order_lines')) {
        void queryClient.invalidateQueries({ queryKey: ['purchase_orders'] });
      }

      // Notifications resource also refreshes the Redux slice (which drives toasts)
      if (resourcesToInvalidate.has('notifications')) {
        void dispatch(fetchNotifications({ force: true }));
      }
    });
  }, [dispatch, queryClient, user?.id, canReadReceptions]);
};
