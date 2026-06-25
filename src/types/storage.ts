import type { StorageZoneType } from "./batch";

export type StorageFamily = "reception" | "raw" | "cold" | "fumigation" | "export";

export type StorageConditionStatus = "normal" | "warning" | "critical";

export type StorageLocationStatus = "free" | "occupied" | "reserved" | "blocked";

export type StorageMovementType = "ENTREE_ZONE" | "SORTIE_ZONE" | "TRANSFERT" | "INVENTAIRE" | "AJUSTEMENT";

export type StorageMovementReason =
  | "RECEPTION"
  | "FUMIGATION"
  | "LAVAGE"
  | "TRIAGE"
  | "EMBALLAGE"
  | "PICKING_EXPORT"
  | "INVENTAIRE"
  | "AUTRE";

export const storageMovementTypeLabels: Record<StorageMovementType, string> = {
  ENTREE_ZONE: "Entree zone",
  SORTIE_ZONE: "Sortie zone",
  TRANSFERT: "Transfert",
  INVENTAIRE: "Inventaire",
  AJUSTEMENT: "Ajustement",
};

export const storageMovementReasonLabels: Record<StorageMovementReason, string> = {
  RECEPTION: "Reception",
  FUMIGATION: "Fumigation",
  LAVAGE: "Lavage",
  TRIAGE: "Triage",
  EMBALLAGE: "Emballage",
  PICKING_EXPORT: "Picking export",
  INVENTAIRE: "Inventaire",
  AUTRE: "Autre",
};

export interface Module3StorageZone {
  id: string;
  code: string;
  name: string;
  storage_family?: StorageFamily;
  zone_type: StorageZoneType;
  capacity_palettes?: number;
  current_load_palettes?: number;
  capacity_kg: number;
  current_load_kg: number;
  capacity_label?: string;
  physical_type?: string;
  target_temperature_label?: string;
  temperature_min: number | null;
  temperature_max: number | null;
  humidity_min: number | null;
  humidity_max: number | null;
  temperature_sensor_count?: number;
  humidity_sensor_count?: number;
  gas_sensor_count?: number;
  sensor_summary?: string;
  is_bio_only?: boolean;
  allowed_varieties?: string[];
  current_temperature_c?: number | null;
  current_humidity_percent?: number | null;
  current_gas_ppm?: number | null;
  condition_status?: StorageConditionStatus;
  condition_messages?: string[];
  last_reading_at?: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface StorageLocation {
  id: string;
  code: string;
  name: string;
  storage_zone_id: string | null;
  zone_code: string | null;
  capacity_palettes: number;
  occupied_palettes: number;
  capacity_kg: number;
  occupied_kg: number;
  location_status: StorageLocationStatus;
  lot_ids_present: string[];
  last_movement_at: string | null;
  current_temperature_c: number | null;
  current_humidity_percent: number | null;
  current_gas_ppm: number | null;
  condition_status?: StorageConditionStatus;
  condition_messages?: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
  storage_zone?: Module3StorageZone | null;
  door_distance_rank?: number | null;
  preferred_variety?: string | null;
}

export interface StorageConditionReading {
  id: string;
  reading_number: string;
  storage_zone_id: string;
  zone_code: string;
  storage_location_id: string | null;
  location_code: string | null;
  reading_at: string;
  temperature_c: number | null;
  humidity_percent: number | null;
  gas_ppm: number | null;
  condition_status: StorageConditionStatus;
  messages: string[];
  sensor_ref: string | null;
  recorded_by: string | null;
  created_at: string;
  updated_at: string;
  storage_zone?: Module3StorageZone | null;
  storage_location?: StorageLocation | null;
}

export interface StorageLocationMovement {
  id: string;
  movement_number: string;
  movement_type: string;
  movement_date: string;
  lot_id: string | null;
  lot_code: string | null;
  source_location_id: string | null;
  source_location_code: string | null;
  destination_location_id: string | null;
  destination_location_code: string | null;
  source_zone_code?: string | null;
  destination_zone_code?: string | null;
  quantity_palettes: number;
  quantity_kg: number;
  movement_reason?: StorageMovementReason;
  reason: string | null;
  destination_suggested_by_system?: boolean;
  performed_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  source_location?: StorageLocation | null;
  destination_location?: StorageLocation | null;
}

export interface StorageDoorEvent {
  id: string;
  event_number: string;
  storage_zone_id: string;
  zone_code: string;
  event_type: "OPEN" | "CLOSE";
  event_at: string;
  sensor_ref: string | null;
  recorded_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface StorageCycleCount {
  id: string;
  count_number: string;
  storage_zone_id: string;
  zone_code: string;
  count_month: string;
  scheduled_for: string;
  status: "scheduled" | "in_progress" | "completed" | "cancelled";
  variance_report: string | null;
  created_at: string;
  updated_at: string;
}

export interface StorageRuleEvaluationResult {
  dlcAlerts: number;
  rawDelayAlerts: number;
  cycleCountsCreated: number;
  evaluatedAt: string;
}

export interface StorageDlcAlert {
  id: string;
  title: string;
  message: string;
  severity: string;
  notification_type: string;
  created_at: string;
}

export interface StorageLocationSuggestion {
  zone: Module3StorageZone;
  suggestion: StorageLocation | null;
  alternatives: StorageLocation[];
  algorithm: "FIFO_DOOR_DISTANCE" | "VARIETY_GROUP_THEN_DOOR_DISTANCE";
}

export interface Module3SeedResult {
  zonesInserted: number;
  zonesSynced: number;
  locationsInserted: number;
  locationsSynced: number;
}
