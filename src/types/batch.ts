export type BatchStatus = 
  | 'pending_inspection'
  | 'in_inspection'
  | 'accepted'
  | 'rejected'
  | 'quarantine'
  | 'reclassified'
  | 'stored'
  | 'in_production'
  | 'destroyed'
  | 'returned_to_supplier';

export type QualityGrade = 'premium' | 'standard' | 'economy' | 'rejected';

export type StorageZoneType = 'cold_room' | 'ventilated' | 'quarantine' | 'processing';

export type NonConformityAction = 'return_to_supplier' | 'destruction' | 'reclassification' | 'quarantine';

export type AlertSeverity = 'info' | 'warning' | 'critical';

export type AlertStatus = 'active' | 'acknowledged' | 'resolved';

export interface StorageZone {
  id: string;
  code: string;
  name: string;
  zone_type: StorageZoneType;
  capacity_kg: number;
  current_load_kg: number;
  temperature_min: number | null;
  temperature_max: number | null;
  humidity_min: number | null;
  humidity_max: number | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Batch {
  id: string;
  batch_number: string;
  reception_id: string | null;
  supplier_id: string | null;
  material_id: string | null;
  origin_region: string | null;
  origin_farm: string | null;
  harvest_date: string | null;
  reception_date: string;
  initial_weight_kg: number;
  current_weight_kg: number;
  quality_grade: QualityGrade | null;
  status: BatchStatus;
  storage_zone_id: string | null;
  storage_position: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  supplier?: { name: string; code: string };
  material?: { name: string; code: string };
  storage_zone?: StorageZone;
  inspections?: QualityInspection[];
}

export interface QualityInspection {
  id: string;
  batch_id: string;
  inspection_number: string;
  inspection_date: string;
  
  // Weight
  weight_measured_kg: number | null;
  weight_expected_kg: number | null;
  weight_variance_percent: number | null;
  weight_passed: boolean | null;
  
  // Visual
  visual_appearance: string | null;
  color_uniformity: boolean | null;
  size_uniformity: boolean | null;
  visual_passed: boolean | null;
  
  // Contamination
  mold_detected: boolean | null;
  mold_percentage: number | null;
  pest_detected: boolean | null;
  pest_type: string | null;
  contamination_passed: boolean | null;
  
  // Humidity
  humidity_measured: number | null;
  humidity_target_min: number;
  humidity_target_max: number;
  humidity_passed: boolean | null;
  
  temperature_measured: number | null;
  
  // Results
  overall_passed: boolean | null;
  recommended_grade: QualityGrade | null;
  recommended_action: string | null;
  
  inspector_name: string;
  notes: string | null;
  photos_urls: string[] | null;
  created_at: string;
}

export interface NonConformity {
  id: string;
  nc_number: string;
  batch_id: string;
  inspection_id: string | null;
  
  reason: string;
  description: string | null;
  severity: AlertSeverity;
  
  action_taken: NonConformityAction;
  action_date: string | null;
  action_performed_by: string | null;
  
  return_reference: string | null;
  return_date: string | null;
  
  destruction_date: string | null;
  destruction_method: string | null;
  destruction_certificate: string | null;
  
  original_grade: QualityGrade | null;
  new_grade: QualityGrade | null;
  
  status: string;
  closed_at: string | null;
  closed_by: string | null;
  
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  
  // Joined
  batch?: Batch;
}

export interface Alert {
  id: string;
  alert_type: string;
  title: string;
  message: string;
  severity: AlertSeverity;
  status: AlertStatus;
  
  batch_id: string | null;
  inspection_id: string | null;
  non_conformity_id: string | null;
  storage_zone_id: string | null;
  
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  
  created_at: string;
  
  // Joined
  batch?: Batch;
  storage_zone?: StorageZone;
}

export interface BatchMovement {
  id: string;
  batch_id: string;
  movement_type: string;
  from_zone_id: string | null;
  to_zone_id: string | null;
  from_status: BatchStatus | null;
  to_status: BatchStatus | null;
  quantity_kg: number | null;
  reason: string | null;
  performed_by: string | null;
  created_at: string;
}

// Labels
export const batchStatusLabels: Record<BatchStatus, string> = {
  pending_inspection: 'En attente d\'inspection',
  in_inspection: 'En inspection',
  accepted: 'Accepté',
  rejected: 'Rejeté',
  quarantine: 'Quarantaine',
  reclassified: 'Reclassé',
  stored: 'Stocké',
  in_production: 'En production',
  destroyed: 'Détruit',
  returned_to_supplier: 'Retourné fournisseur'
};

export const batchStatusColors: Record<BatchStatus, string> = {
  pending_inspection: 'bg-yellow-500',
  in_inspection: 'bg-blue-500',
  accepted: 'bg-green-500',
  rejected: 'bg-red-500',
  quarantine: 'bg-orange-500',
  reclassified: 'bg-purple-500',
  stored: 'bg-teal-500',
  in_production: 'bg-indigo-500',
  destroyed: 'bg-gray-700',
  returned_to_supplier: 'bg-pink-500'
};

export const qualityGradeLabels: Record<QualityGrade, string> = {
  premium: 'Premium',
  standard: 'Standard',
  economy: 'Économique',
  rejected: 'Rejeté'
};

export const qualityGradeColors: Record<QualityGrade, string> = {
  premium: 'bg-amber-500',
  standard: 'bg-blue-500',
  economy: 'bg-gray-500',
  rejected: 'bg-red-500'
};

export const zoneTypeLabels: Record<StorageZoneType, string> = {
  cold_room: 'Chambre Froide',
  ventilated: 'Zone Ventilée',
  quarantine: 'Quarantaine',
  processing: 'Production'
};

export const alertSeverityLabels: Record<AlertSeverity, string> = {
  info: 'Information',
  warning: 'Attention',
  critical: 'Critique'
};

export const alertSeverityColors: Record<AlertSeverity, string> = {
  info: 'bg-blue-500',
  warning: 'bg-yellow-500',
  critical: 'bg-red-500'
};

export const nonConformityActionLabels: Record<NonConformityAction, string> = {
  return_to_supplier: 'Retour fournisseur',
  destruction: 'Destruction',
  reclassification: 'Reclassement',
  quarantine: 'Quarantaine'
};
