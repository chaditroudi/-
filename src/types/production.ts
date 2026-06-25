export type ProductionOrderStatus = 'draft' | 'planned' | 'in_progress' | 'completed' | 'cancelled';
export type ProductionStepStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';

/**
 * Flux code per the "Cartographie complète des flux de production" v3.0.
 * F1–F8 are the 8 product lines; null means the order predates this field.
 */
export type ProductionFluxCode = 'F1' | 'F2' | 'F3' | 'F4' | 'F5' | 'F6' | 'F7' | 'F8' | null;

export const FLUX_CODE_LABELS: Record<NonNullable<ProductionFluxCode>, string> = {
  F1: 'Datte branchée',
  F2: 'Datte vrac calibrée',
  F3: 'Datte dénoyautée',
  F4: 'Datte glacée / enrobée',
  F5: 'Pâte de datte',
  F6: 'Sirop de datte',
  F7: 'Sucre de datte',
  F8: 'Noyaux valorisés',
};

export const FLUX_CODE_COLORS: Record<NonNullable<ProductionFluxCode>, string> = {
  F1: '#D4A017',
  F2: '#C8860A',
  F3: '#A0780A',
  F4: '#E8B84B',
  F5: '#8B6914',
  F6: '#B5651D',
  F7: '#CD853F',
  F8: '#6B4423',
};

export interface ProductionStepDefinition {
  id: string;
  code: string;
  name: string;
  description: string | null;
  sequence_order: number;
  requires_quality_check: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductionOrder {
  id: string;
  order_number: string;
  reception_id: string | null;
  product_name: string;
  /** Flux code per "Cartographie complète des flux" v3.0 (F1–F8). */
  flux_code: ProductionFluxCode;
  target_quantity: number;
  actual_quantity: number;
  unit: string;
  status: ProductionOrderStatus;
  priority: number;
  planned_start_date: string | null;
  planned_end_date: string | null;
  actual_start_date: string | null;
  actual_end_date: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Denormalized snapshot saved at order creation (survives join failures)
  reception_number_snapshot?: string | null;
  supplier_name_snapshot?: string | null;
  // Joined data (may be null when reception_id points to receptions_v2 and backend joins material_receptions)
  reception?: {
    reception_number: string;
    variety?: string | null;
    material?: { name: string } | null;
    supplier?: { name: string } | null;
  } | null;
  steps?: ProductionStep[];
}

export interface ProductionStep {
  id: string;
  production_order_id: string;
  step_definition_id: string;
  sequence_order: number;
  status: ProductionStepStatus;
  started_at: string | null;
  completed_at: string | null;
  operator_name: string | null;
  input_quantity: number | null;
  output_quantity: number | null;
  waste_quantity: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  step_definition?: ProductionStepDefinition;
  quality_checks?: QualityCheck[];
}

export interface QualityCheck {
  id: string;
  production_step_id: string;
  check_type: string;
  parameter_name: string;
  expected_value: string | null;
  actual_value: string | null;
  is_passed: boolean | null;
  checked_by: string | null;
  checked_at: string;
  notes: string | null;
  created_at: string;
}

export interface ProductionAuditLog {
  id: string;
  production_order_id: string;
  action: string;
  old_status: ProductionOrderStatus | null;
  new_status: ProductionOrderStatus | null;
  step_id: string | null;
  performed_by: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

export const orderStatusLabels: Record<ProductionOrderStatus, string> = {
  draft: 'Brouillon',
  planned: 'Planifié',
  in_progress: 'En cours',
  completed: 'Terminé',
  cancelled: 'Annulé'
};

export const orderStatusColors: Record<ProductionOrderStatus, string> = {
  draft: 'bg-gray-500',
  planned: 'bg-blue-500',
  in_progress: 'bg-yellow-500',
  completed: 'bg-green-500',
  cancelled: 'bg-red-500'
};

export const stepStatusLabels: Record<ProductionStepStatus, string> = {
  pending: 'En attente',
  in_progress: 'En cours',
  completed: 'Terminé',
  failed: 'Échoué',
  skipped: 'Ignoré'
};

export const stepStatusColors: Record<ProductionStepStatus, string> = {
  pending: 'bg-gray-400',
  in_progress: 'bg-blue-500',
  completed: 'bg-green-500',
  failed: 'bg-red-500',
  skipped: 'bg-orange-400'
};

export interface LotAllocation {
  id: string;
  production_order_id: string;
  reception_lot_id: string;
  allocated_quantity: number;
  unit: string;
  allocated_by: string | null;
  allocated_at: string;
  lot?: {
    lot_internal: string | null;
    lot_supplier: string;
    stock_status: string;
    quantity: number;
    unit: string;
    bio_declared?: boolean | null;
    variety?: string | null;
    reception_number?: string | null;
    supplier_name?: string | null;
  };
}

export interface ProductionOutputLot {
  id: string;
  production_order_id: string;
  lot_pf_number: string;
  quantity: number;
  unit: string;
  variety: string | null;
  bio_declared: boolean | null;
  recorded_by: string | null;
  recorded_at: string;
  /** Snapshot of the parent MP lot IDs for audit */
  parent_lot_ids: string[];
  /** Denormalized snapshot of each parent lot for display */
  parent_lots_snapshot: Array<{
    reception_lot_id: string;
    lot_internal: string | null;
    lot_supplier: string;
    reception_number: string | null;
    supplier_name: string | null;
    allocated_quantity: number;
    unit: string;
  }>;
}

export interface ProductionConfigEntry {
  id: string;
  code: string;
  label: string;
  color: string;
}

export interface ProductionConfig {
  flux_codes: ProductionConfigEntry[];
  order_statuses: ProductionConfigEntry[];
  step_statuses: ProductionConfigEntry[];
}

export interface LiberedLot {
  id: string;
  reception_id: string;
  lot_internal: string | null;
  lot_supplier: string;
  stock_status: string;
  quantity: number;
  unit: string;
  bio_declared: boolean | null;
  variety: string | null;
  reception_number: string | null;
  supplier_name: string | null;
}
