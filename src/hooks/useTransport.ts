import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { transportApi } from '@/lib/api/transport';
import { useToast } from '@/hooks/use-toast';
import type {
  TransportDriver,
  TransportDriverStatus,
  TransportMission,
  TransportMissionStatus,
  TransportPositionLog,
  TransportVehicle,
  TransportVehicleStatus,
} from '@/types/transport';

const VEHICLES_KEY = ['transport', 'vehicles'];
const DRIVERS_KEY = ['transport', 'drivers'];
const MISSIONS_KEY = ['transport', 'missions'];
const POSITIONS_KEY = ['transport', 'positions'];

const invalidateTransportQueries = (queryClient: ReturnType<typeof useQueryClient>, missionId?: string | null) => {
  queryClient.invalidateQueries({ queryKey: VEHICLES_KEY });
  queryClient.invalidateQueries({ queryKey: DRIVERS_KEY });
  queryClient.invalidateQueries({ queryKey: MISSIONS_KEY });
  if (missionId) {
    queryClient.invalidateQueries({ queryKey: [...POSITIONS_KEY, missionId] });
  } else {
    queryClient.invalidateQueries({ queryKey: POSITIONS_KEY });
  }
};

export const useTransportVehicles = (status?: TransportVehicleStatus, refetchSeconds?: number) =>
  useQuery({
    queryKey: [...VEHICLES_KEY, status ?? 'all', refetchSeconds ?? 'static'],
    queryFn: async () => {
      const data = await transportApi.listVehicles(status ? { status } : undefined);
      return data as unknown as TransportVehicle[];
    },
    refetchInterval: refetchSeconds ? refetchSeconds * 1000 : false,
  });

export const useCreateTransportVehicle = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (vehicle: Partial<TransportVehicle>) => {
      return await transportApi.createVehicle(vehicle as Record<string, unknown>) as TransportVehicle;
    },
    onSuccess: (vehicle) => {
      invalidateTransportQueries(queryClient);
      toast({
        title: 'Camion ajouté',
        description: `${vehicle.registration_number} est disponible dans la flotte`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erreur transport',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
};

export const useUpdateTransportVehicle = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<TransportVehicle> & { id: string }) => {
      return await transportApi.updateVehicle(id, updates as Record<string, unknown>) as TransportVehicle;
    },
    onSuccess: (vehicle) => {
      invalidateTransportQueries(queryClient);
      toast({
        title: 'Véhicule mis à jour',
        description: `${vehicle.registration_number} a été synchronisé`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erreur transport',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
};

export const useTransportDrivers = (status?: TransportDriverStatus, refetchSeconds?: number) =>
  useQuery({
    queryKey: [...DRIVERS_KEY, status ?? 'all', refetchSeconds ?? 'static'],
    queryFn: async () => {
      const data = await transportApi.listDrivers(status ? { status } : undefined);
      return data as unknown as TransportDriver[];
    },
    refetchInterval: refetchSeconds ? refetchSeconds * 1000 : false,
  });

export const useCreateTransportDriver = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (driver: Partial<TransportDriver>) => {
      return await transportApi.createDriver(driver as Record<string, unknown>) as TransportDriver;
    },
    onSuccess: (driver) => {
      invalidateTransportQueries(queryClient);
      toast({
        title: 'Chauffeur ajouté',
        description: `${driver.full_name} peut maintenant être affecté aux missions`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erreur transport',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
};

export const useUpdateTransportDriver = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<TransportDriver> & { id: string }) => {
      return await transportApi.updateDriver(id, updates as Record<string, unknown>) as TransportDriver;
    },
    onSuccess: (driver) => {
      invalidateTransportQueries(queryClient);
      toast({
        title: 'Chauffeur mis à jour',
        description: `${driver.full_name} a été synchronisé`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erreur transport',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
};

export const useTransportMissions = (status?: TransportMissionStatus, refetchSeconds?: number) =>
  useQuery({
    queryKey: [...MISSIONS_KEY, status ?? 'all', refetchSeconds ?? 'static'],
    queryFn: async () => {
      const data = await transportApi.listMissions(status ? { status } : undefined);
      return data as unknown as TransportMission[];
    },
    refetchInterval: refetchSeconds ? refetchSeconds * 1000 : false,
  });

export const useCreateTransportMission = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (mission: Partial<TransportMission>) => {
      return await transportApi.createMission(mission as Record<string, unknown>) as TransportMission;
    },
    onSuccess: (mission) => {
      invalidateTransportQueries(queryClient, mission.id);
      toast({
        title: 'Ordre de mission créé',
        description: `${mission.mission_number} est prêt à être affecté`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erreur mission',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
};

export const useUpdateTransportMission = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<TransportMission> & { id: string }) => {
      return await transportApi.updateMission(id, updates as Record<string, unknown>) as TransportMission;
    },
    onSuccess: (mission) => {
      invalidateTransportQueries(queryClient, mission.id);
      toast({
        title: 'Mission mise à jour',
        description: `${mission.mission_number} a été mis à jour`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erreur mission',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
};

export const useMissionPositions = (missionId?: string | null, refetchSeconds = 30) =>
  useQuery({
    queryKey: [...POSITIONS_KEY, missionId ?? 'none', refetchSeconds],
    queryFn: async () => {
      const data = await transportApi.listPositionLogs({ mission_id: missionId as string });
      // Keep only latest 40, sorted descending by captured_at (server returns ascending by default)
      return (data as unknown as TransportPositionLog[])
        .sort((a, b) => new Date(b.captured_at).getTime() - new Date(a.captured_at).getTime())
        .slice(0, 40);
    },
    enabled: Boolean(missionId),
    refetchInterval: missionId ? refetchSeconds * 1000 : false,
  });

export const useCreateTransportPositionLog = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (
      payload: Partial<TransportPositionLog> & {
        mission_id: string;
        latitude: number;
        longitude: number;
      },
    ) => {
      const capturedAt = payload.captured_at || new Date().toISOString();

      const position = await transportApi.createPositionLog({
        ...payload,
        captured_at: capturedAt,
      } as Record<string, unknown>) as TransportPositionLog;

      // Update mission last position (fire-and-forget)
      transportApi.updateMission(payload.mission_id, {
        last_position_at: capturedAt,
        last_latitude: payload.latitude,
        last_longitude: payload.longitude,
        last_speed_kmh: payload.speed_kmh ?? null,
        last_heading: payload.heading ?? null,
        tracking_active: true,
      }).catch(() => null);

      // Update vehicle last position if provided (fire-and-forget)
      if (payload.vehicle_id) {
        transportApi.updateVehicle(payload.vehicle_id as string, {
          last_position_at: capturedAt,
          last_latitude: payload.latitude,
          last_longitude: payload.longitude,
          last_speed_kmh: payload.speed_kmh ?? null,
        }).catch(() => null);
      }

      return position;
    },
    onSuccess: (position) => {
      invalidateTransportQueries(queryClient, position.mission_id);
    },
    onError: (error: Error) => {
      toast({
        title: 'Erreur tracking',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
};
