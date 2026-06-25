import { toast } from 'sonner';
import type {
  Module3SeedResult,
  Module3StorageZone,
  StorageConditionReading,
  StorageDoorEvent,
  StorageDlcAlert,
  StorageLocation,
  StorageLocationMovement,
  StorageLocationSuggestion,
  StorageRuleEvaluationResult,
} from '@/types/storage';
import type {
  CreateStorageReadingInput,
  CreateStorageDoorEventInput,
  MoveStorageStockInput,
  SuggestFefoLotsInput,
  SuggestStorageLocationInput,
} from '@/lib/api/storage';
import {
  useListModule3ZonesQuery,
  useListModule3LocationsQuery,
  useListStorageConditionReadingsQuery,
  useListStorageLocationMovementsQuery,
  useListStorageDoorEventsQuery,
  useListStorageDlcAlertsQuery,
  useCreateReadingMutation,
  useCreateDoorEventMutation,
  useSuggestLocationMutation,
  useSuggestFefoMutation,
  useMoveStorageStockMutation,
  useSeedModule3Mutation,
} from '@/store/api/storageApi';

export const useModule3StorageZones = () => {
  return useListModule3ZonesQuery(undefined, { pollingInterval: 30_000 });
};

export const useModule3StorageLocations = (storageZoneId?: string) => {
  return useListModule3LocationsQuery(storageZoneId, { pollingInterval: 30_000 });
};

export const useStorageConditionReadings = (limit = 80) => {
  return useListStorageConditionReadingsQuery(limit, { pollingInterval: 60_000 });
};

export const useStorageLocationMovements = (limit = 80) => {
  return useListStorageLocationMovementsQuery(limit, { pollingInterval: 30_000 });
};

export const useStorageDoorEvents = (limit = 80) => {
  return useListStorageDoorEventsQuery(limit, { pollingInterval: 30_000 });
};

export const useStorageDlcAlerts = () => {
  return useListStorageDlcAlertsQuery(15, { pollingInterval: 5 * 60_000 });
};

export const useSeedStorageModule3 = () => {
  const [seed, state] = useSeedModule3Mutation();
  return {
    mutateAsync: async () => {
      const data = await seed().unwrap() as any;
      const count = data?.locationsInserted ?? 0;
      toast.success(count > 0 ? `${count} emplacements ajoutés au plan Royal Palm` : 'Plan Royal Palm déjà synchronisé');
      return data;
    },
    isPending: state.isLoading,
  };
};

export const useCreateStorageReading = () => {
  const [create, state] = useCreateReadingMutation();
  return {
    mutateAsync: async (payload: CreateStorageReadingInput) => {
      const data = await create(payload).unwrap();
      toast.success(data.status === 'normal' ? 'Lecture capteur enregistrée' : 'Lecture enregistrée avec alerte');
      return data;
    },
    isPending: state.isLoading,
  };
};

export const useCreateStorageDoorEvent = () => {
  const [create, state] = useCreateDoorEventMutation();
  return {
    mutateAsync: async (payload: CreateStorageDoorEventInput) => {
      const data = await create(payload).unwrap();
      toast.success('Événement porte enregistré');
      return data;
    },
    isPending: state.isLoading,
  };
};

export const useSuggestStorageLocation = () => {
  const [suggest, state] = useSuggestLocationMutation();
  return {
    mutateAsync: (payload: SuggestStorageLocationInput) => suggest(payload).unwrap() as Promise<StorageLocationSuggestion>,
    isPending: state.isLoading,
  };
};

export const useSuggestFefoLots = () => {
  const [suggest, state] = useSuggestFefoMutation();
  return {
    mutateAsync: (payload: SuggestFefoLotsInput) => suggest(payload).unwrap(),
    isPending: state.isLoading,
  };
};

export const useEvaluateStorageRules = () => {
  // evaluateRules is not in the RTK slice yet — call via lib API
  return {
    mutateAsync: async () => {
      const { storageApi: libApi } = await import('@/lib/api/storage');
      const data = await libApi.evaluateRules();
      toast.success(`${(data as any).dlcAlerts + (data as any).rawDelayAlerts} alerte(s), ${(data as any).cycleCountsCreated} comptage(s) planifié(s)`);
      return data;
    },
    isPending: false,
  };
};

export const useMoveStorageStock = () => {
  const [moveStock, state] = useMoveStorageStockMutation();
  return {
    mutateAsync: async (payload: MoveStorageStockInput) => {
      const data = await moveStock(payload).unwrap();
      toast.success(`Mouvement ${(data.movement as any)?.movement_number} enregistré`);
      return data;
    },
    isPending: state.isLoading,
  };
};
