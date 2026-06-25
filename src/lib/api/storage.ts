import { apiRequest } from '@/integrations/mongodb/client';
import type {
  Module3SeedResult,
  Module3StorageZone,
  StorageConditionReading,
  StorageDoorEvent,
  StorageDlcAlert,
  StorageLocation,
  StorageLocationMovement,
  StorageLocationSuggestion,
  StorageMovementReason,
  StorageMovementType,
  StorageRuleEvaluationResult,
} from '@/types/storage';

type ApiEnvelope<T> = {
  data: T;
};

export type CreateStorageReadingInput = {
  storageZoneId?: string;
  zoneCode?: string;
  locationId?: string;
  locationCode?: string;
  temperatureC?: number | '';
  humidityPercent?: number | '';
  gasPpm?: number | '';
  sensorRef?: string;
  recordedBy?: string;
};

export type CreateStorageDoorEventInput = {
  storageZoneId?: string;
  zoneCode?: string;
  eventType: 'OPEN' | 'CLOSE';
  sensorRef?: string;
};

export type SuggestStorageLocationInput = {
  destinationZoneId?: string;
  destinationZoneCode?: string;
  quantityPalettes?: number;
  variety?: string;
  lotIsBio?: boolean;
};

export type SuggestFefoLotsInput = {
  productId?: string;
  variety?: string;
  limit?: number;
};

export type MoveStorageStockInput = {
  sourceLocationId?: string;
  destinationLocationId?: string;
  destinationZoneId?: string;
  lotCode?: string;
  lotId?: string;
  productId?: string;
  variety?: string;
  lotIsBio?: boolean;
  quantityPalettes?: number;
  quantityKg?: number;
  movementType?: StorageMovementType;
  reason?: StorageMovementReason;
  fefoOverrideReason?: string;
  notes?: string;
};

export type CreateStorageReadingResult = {
  reading: StorageConditionReading;
  status: string;
  messages: string[];
  alerts?: unknown[];
  notifications?: unknown[];
};

export type CreateStorageDoorEventResult = {
  event: StorageDoorEvent;
  rule: unknown;
  alerts?: unknown[];
  notifications?: unknown[];
};

export type EvaluateStorageRulesResult = StorageRuleEvaluationResult & {
  alerts?: unknown[];
  notifications?: unknown[];
  cycleCounts?: Record<string, unknown>[];
};

export type MoveStorageStockResult = {
  movement: StorageLocationMovement;
  locations?: StorageLocation[];
  alerts?: unknown[];
  notifications?: unknown[];
};

const buildQueryString = (params: Record<string, string | number | boolean | undefined>) => {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    searchParams.set(key, String(value));
  }

  const suffix = searchParams.toString();
  return suffix ? `?${suffix}` : '';
};

export const storageApi = {
  listModule3Zones: async () => {
    const response = await apiRequest<ApiEnvelope<Module3StorageZone[]>>('/storage/module3/zones');
    return response.data || [];
  },

  listModule3Locations: async (storageZoneId?: string) => {
    const suffix = buildQueryString({ storageZoneId });
    const response = await apiRequest<ApiEnvelope<StorageLocation[]>>(`/storage/module3/locations${suffix}`);
    return response.data || [];
  },

  listStorageConditionReadings: async (limit = 80) => {
    const suffix = buildQueryString({ limit });
    const response = await apiRequest<ApiEnvelope<StorageConditionReading[]>>(`/storage/module3/readings${suffix}`);
    return response.data || [];
  },

  listStorageLocationMovements: async (limit = 80) => {
    const suffix = buildQueryString({ limit });
    const response = await apiRequest<ApiEnvelope<StorageLocationMovement[]>>(`/storage/module3/location-movements${suffix}`);
    return response.data || [];
  },

  listStorageDoorEvents: async (limit = 80) => {
    const suffix = buildQueryString({ limit });
    const response = await apiRequest<ApiEnvelope<StorageDoorEvent[]>>(`/storage/module3/door-events${suffix}`);
    return response.data || [];
  },

  listStorageDlcAlerts: async (limit = 15) => {
    const suffix = buildQueryString({ limit });
    const response = await apiRequest<ApiEnvelope<StorageDlcAlert[]>>(`/storage/module3/dlc-alerts${suffix}`);
    return response.data || [];
  },

  seedModule3: async () => {
    const response = await apiRequest<ApiEnvelope<Module3SeedResult>>('/storage/module3/seed', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    return response.data;
  },

  createReading: async (payload: CreateStorageReadingInput) => {
    const response = await apiRequest<ApiEnvelope<CreateStorageReadingResult>>('/storage/readings', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return response.data;
  },

  createDoorEvent: async (payload: CreateStorageDoorEventInput) => {
    const response = await apiRequest<ApiEnvelope<CreateStorageDoorEventResult>>('/storage/door-events', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return response.data;
  },

  suggestLocation: async (payload: SuggestStorageLocationInput) => {
    const response = await apiRequest<ApiEnvelope<StorageLocationSuggestion>>('/storage/suggest-location', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return response.data;
  },

  suggestFefo: async (payload: SuggestFefoLotsInput) => {
    const response = await apiRequest<ApiEnvelope<Array<Record<string, unknown> & { lot_number?: string; dlc_alert_level?: string | null }>>>('/storage/suggest-fefo', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return response.data || [];
  },

  evaluateRules: async () => {
    const response = await apiRequest<ApiEnvelope<EvaluateStorageRulesResult>>('/storage/rules/evaluate', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    return response.data;
  },

  moveStock: async (payload: MoveStorageStockInput) => {
    const response = await apiRequest<ApiEnvelope<MoveStorageStockResult>>('/storage/move', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return response.data;
  },
};
