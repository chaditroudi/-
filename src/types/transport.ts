import type { ShipmentPreparation } from './stock';

export type TransportVehicleStatus = 'AVAILABLE' | 'IN_MISSION' | 'MAINTENANCE' | 'OUT_OF_SERVICE';
export type TransportDriverStatus = 'AVAILABLE' | 'ASSIGNED' | 'OFF_DUTY';
export type TransportMissionStatus =
  | 'PLANNED'
  | 'READY_TO_DEPART'
  | 'EN_ROUTE'
  | 'ARRIVED'
  | 'COMPLETED'
  | 'CANCELLED';
export type TransportMissionType = 'DELIVERY' | 'TRANSFER' | 'COLLECTION';
export type TransportPositionSource = 'driver_browser' | 'dispatcher_manual' | 'gps_device';
export type TransportPositionStatus = 'moving' | 'idle' | 'arrived';

export interface TransportVehicle {
  id: string;
  vehicle_code: string;
  registration_number: string;
  trailer_number: string | null;
  vehicle_type: string | null;
  capacity_kg: number;
  gps_device_id: string | null;
  assigned_driver_id: string | null;
  status: TransportVehicleStatus;
  notes: string | null;
  last_position_at: string | null;
  last_latitude: number | null;
  last_longitude: number | null;
  last_speed_kmh: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  missions?: TransportMission[];
}

export interface TransportDriver {
  id: string;
  driver_code: string;
  full_name: string;
  phone: string | null;
  license_number: string | null;
  license_expiry_date: string | null;
  preferred_vehicle_id: string | null;
  status: TransportDriverStatus;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  missions?: TransportMission[];
}

export interface TransportMission {
  id: string;
  mission_number: string;
  mission_type: TransportMissionType;
  shipment_id: string | null;
  vehicle_id: string | null;
  driver_id: string | null;
  status: TransportMissionStatus;
  origin_label: string | null;
  destination_label: string | null;
  destination_address: string | null;
  planned_departure_at: string | null;
  planned_arrival_at: string | null;
  actual_departure_at: string | null;
  actual_arrival_at: string | null;
  tracking_active: boolean;
  cargo_summary: string | null;
  estimated_distance_km: number | null;
  last_position_at: string | null;
  last_latitude: number | null;
  last_longitude: number | null;
  last_speed_kmh: number | null;
  last_heading: number | null;
  created_by: string | null;
  updated_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  vehicle?: TransportVehicle | null;
  driver?: TransportDriver | null;
  shipment?: ShipmentPreparation | null;
  positions?: TransportPositionLog[];
}

export interface TransportPositionLog {
  id: string;
  position_number: string;
  mission_id: string;
  vehicle_id: string | null;
  driver_id: string | null;
  latitude: number;
  longitude: number;
  accuracy_m: number | null;
  speed_kmh: number | null;
  heading: number | null;
  captured_at: string;
  source: TransportPositionSource;
  position_status: TransportPositionStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  mission?: TransportMission | null;
  vehicle?: TransportVehicle | null;
  driver?: TransportDriver | null;
}

export const transportVehicleStatusLabels: Record<TransportVehicleStatus, string> = {
  AVAILABLE: 'Disponible',
  IN_MISSION: 'En mission',
  MAINTENANCE: 'Maintenance',
  OUT_OF_SERVICE: 'Hors service',
};

export const transportDriverStatusLabels: Record<TransportDriverStatus, string> = {
  AVAILABLE: 'Disponible',
  ASSIGNED: 'Affecté',
  OFF_DUTY: 'Hors service',
};

export const transportMissionStatusLabels: Record<TransportMissionStatus, string> = {
  PLANNED: 'Planifiée',
  READY_TO_DEPART: 'Prête au départ',
  EN_ROUTE: 'En route',
  ARRIVED: 'Arrivée',
  COMPLETED: 'Terminée',
  CANCELLED: 'Annulée',
};

export const transportMissionTypeLabels: Record<TransportMissionType, string> = {
  DELIVERY: 'Livraison',
  TRANSFER: 'Transfert',
  COLLECTION: 'Collecte',
};

export const transportPositionStatusLabels: Record<TransportPositionStatus, string> = {
  moving: 'En mouvement',
  idle: 'À l’arrêt',
  arrived: 'Arrivé',
};

export const transportStatusColor: Record<string, string> = {
  AVAILABLE: 'bg-emerald-600',
  IN_MISSION: 'bg-blue-600',
  MAINTENANCE: 'bg-amber-600',
  OUT_OF_SERVICE: 'bg-slate-600',
  ASSIGNED: 'bg-blue-600',
  OFF_DUTY: 'bg-slate-600',
  PLANNED: 'bg-slate-500',
  READY_TO_DEPART: 'bg-violet-600',
  EN_ROUTE: 'bg-blue-600',
  ARRIVED: 'bg-amber-600',
  COMPLETED: 'bg-emerald-600',
  CANCELLED: 'bg-rose-600',
};
