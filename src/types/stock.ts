// Types pour le module Gestion des Stocks

export type ProductCategory = 'MP' | 'WIP' | 'PF' | 'EMB';

export type StockMovementType = 
  | 'RECEPTION'
  | 'TRANSFERT'
  | 'CONSOMMATION'
  | 'AJUSTEMENT'
  | 'EXPEDITION'
  | 'PERTE'
  | 'RETOUR';

export type LossReason = 
  | 'MOISISSURE'
  | 'INFESTATION'
  | 'CASSE'
  | 'DESSICCATION'
  | 'FERMENTATION'
  | 'PEREMPTION'
  | 'AUTRE';

export type LotStatus = 'QUARANTINE' | 'VALIDATED' | 'BLOCKED' | 'EXPIRED' | 'CONSUMED';

export type RotationRule = 'FIFO' | 'FEFO';

export type ShipmentStatus = 'DRAFT' | 'PICKING' | 'READY' | 'SHIPPED' | 'CANCELLED';

export type ManufacturingOrderStatus = 'DRAFT' | 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

// Produit
export interface Product {
  id: string;
  code: string;
  name: string;
  category: ProductCategory;
  unit: string;
  variety: string | null;
  description: string | null;
  
  threshold_min: number;
  threshold_security: number;
  threshold_max: number | null;
  
  storage_temp_min: number | null;
  storage_temp_max: number | null;
  storage_humidity_max: number | null;
  shelf_life_days: number | null;
  
  rotation_rule: RotationRule;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  
  // Calculés
  current_stock?: number;
  stock_status?: 'ok' | 'min' | 'security' | 'max';
}

// Emplacement de stockage
export interface StockLocation {
  id: string;
  code: string;
  name: string;
  zone: ProductCategory;
  
  capacity_kg: number;
  capacity_units: number;
  current_load_kg: number;
  current_load_units: number;
  
  is_cold: boolean;
  is_dry: boolean;
  temperature_target: number | null;
  humidity_max: number | null;
  
  access_level: string;
  is_active: boolean;
  notes: string | null;
  
  created_at: string;
  updated_at: string;
  
  // Calculés
  occupancy_percent?: number;
}

// Lot de stock: lot exploitable par le magasin / la production / l'expedition.
// A ne pas confondre avec le lot d'entree de reception (`reception_lots`).
export interface StockLot {
  id: string;
  lot_number: string;
  product_id: string;
  reception_lot_id?: string | null;
  source_reception_id?: string | null;
  source_reception_number?: string | null;
  source_lot_internal?: string | null;
  source_lot_supplier?: string | null;
  source_stage?: string | null;
  source_status?: string | null;
  source_sync_reason?: string | null;
  
  origin_farm: string | null;
  origin_country: string;
  supplier_id: string | null;
  variety: string | null;
  
  harvest_date: string | null;
  reception_date: string;
  transformation_date: string | null;
  packaging_date: string | null;
  dluo_date: string | null;
  dlc_date: string | null;
  
  initial_quantity: number;
  current_quantity: number;
  unit: string;
  
  status: LotStatus;
  humidity_measured: number | null;
  temperature_measured: number | null;
  quality_notes: string | null;
  qc_validated_by: string | null;
  qc_validated_at: string | null;
  
  location_id: string | null;
  storage_location_id?: string | null;
  storage_location_code?: string | null;
  position: string | null;
  
  batch_id: string | null;
  
  created_by: string | null;
  created_at: string;
  updated_at: string;
  
  // Joined
  product?: Product;
  location?: StockLocation;
  storage_location?: {
    id: string;
    code: string;
    name?: string | null;
    zone_code?: string | null;
  } | null;
  supplier?: { name: string; code: string };
  reception_entry_lot?: {
    lot_internal?: string | null;
    lot_supplier?: string | null;
    stock_status?: string | null;
  };
}

// Mouvement de stock
export interface StockMovement {
  id: string;
  movement_number: string;
  movement_type: StockMovementType;
  movement_date: string;
  
  lot_id: string;
  product_id: string;
  
  quantity: number;
  unit: string;
  
  source_location_id: string | null;
  destination_location_id: string | null;
  
  document_type: string | null;
  document_reference: string | null;
  
  loss_reason: LossReason | null;
  loss_description: string | null;
  
  performed_by: string;
  validated_by: string | null;
  validated_at: string | null;
  digital_signature: string | null;
  
  attachments_urls: string[] | null;
  notes: string | null;
  
  created_at: string;
  
  // Joined
  lot?: StockLot;
  product?: Product;
  source_location?: StockLocation;
  destination_location?: StockLocation;
}

// Ordre de fabrication
export interface ManufacturingOrder {
  id: string;
  order_number: string;
  
  output_product_id: string | null;
  target_quantity: number;
  actual_quantity: number;
  unit: string;
  
  status: ManufacturingOrderStatus;
  
  planned_date: string | null;
  started_at: string | null;
  completed_at: string | null;
  
  total_waste: number;
  waste_reason: string | null;
  
  output_lot_ids: string[] | null;
  
  created_by: string | null;
  created_at: string;
  updated_at: string;
  notes: string | null;
  
  // Joined
  output_product?: Product;
  inputs?: ManufacturingOrderInput[];
}

// Entrées OF
export interface ManufacturingOrderInput {
  id: string;
  order_id: string;
  lot_id: string;
  quantity_consumed: number;
  unit: string;
  consumed_at: string;
  consumed_by: string | null;
  notes: string | null;
  
  // Joined
  lot?: StockLot;
}

// Comptage inventaire
export interface InventoryCount {
  id: string;
  inventory_number: string;
  inventory_date: string;
  
  location_id: string | null;
  lot_id: string | null;
  product_id: string | null;
  
  expected_quantity: number;
  counted_quantity: number;
  variance: number;
  variance_percent: number;
  
  adjustment_approved: boolean;
  adjustment_reason: string | null;
  approved_by: string | null;
  approved_at: string | null;
  
  counted_by: string;
  created_at: string;
  
  // Joined
  location?: StockLocation;
  lot?: StockLot;
  product?: Product;
}

// Préparation expédition
export interface ShipmentPreparation {
  id: string;
  shipment_number: string;
  
  customer_name: string | null;
  destination: string | null;
  
  status: ShipmentStatus;
  
  requested_date: string | null;
  prepared_at: string | null;
  shipped_at: string | null;
  
  prepared_by: string | null;
  validated_by: string | null;
  
  notes: string | null;
  created_at: string;
  updated_at: string;
  
  // Joined
  lines?: ShipmentLine[];
}

// Ligne d'expédition
export interface ShipmentLine {
  id: string;
  shipment_id: string;
  
  product_id: string;
  lot_id: string | null;
  
  requested_quantity: number;
  picked_quantity: number;
  unit: string;
  
  suggested_by_system: boolean;
  
  picked_at: string | null;
  picked_by: string | null;
  
  notes: string | null;
  
  // Joined
  product?: Product;
  lot?: StockLot;
}

// Alerte stock
export interface StockAlert {
  id: string;
  alert_type: string;
  severity: 'info' | 'warning' | 'critical';
  
  product_id: string | null;
  lot_id: string | null;
  location_id: string | null;
  
  title: string;
  message: string;
  
  threshold_value: number | null;
  current_value: number | null;
  
  days_before_expiry: number | null;
  
  status: 'active' | 'acknowledged' | 'resolved';
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  
  created_at: string;
  
  // Joined
  product?: Product;
  lot?: StockLot;
  location?: StockLocation;
}

// KPI Stock
export interface StockKpi {
  id: string;
  kpi_date: string;
  product_id: string | null;
  category: ProductCategory | null;
  
  stock_value: number;
  stock_quantity: number;
  rotation_rate: number;
  loss_rate: number;
  average_storage_days: number;
  
  reception_qty: number;
  consumption_qty: number;
  expedition_qty: number;
  loss_qty: number;
  
  created_at: string;
}

// Suggestion FIFO/FEFO
export interface LotSuggestion {
  lot_id: string;
  lot_number: string;
  available_qty: number;
  suggested_qty: number;
  sort_date: string;
  rotation_rule: RotationRule;
}

// Labels
export const productCategoryLabels: Record<ProductCategory, string> = {
  MP: 'Matière Première',
  WIP: 'En-cours',
  PF: 'Produit Fini',
  EMB: 'Emballage'
};

export const productCategoryColors: Record<ProductCategory, string> = {
  MP: 'bg-amber-500',
  WIP: 'bg-blue-500',
  PF: 'bg-green-500',
  EMB: 'bg-purple-500'
};

export const lotStatusLabels: Record<LotStatus, string> = {
  QUARANTINE: 'Quarantaine',
  VALIDATED: 'Validé',
  BLOCKED: 'Bloqué',
  EXPIRED: 'Périmé',
  CONSUMED: 'Consommé'
};

export const lotStatusColors: Record<LotStatus, string> = {
  QUARANTINE: 'bg-yellow-500',
  VALIDATED: 'bg-green-500',
  BLOCKED: 'bg-red-500',
  EXPIRED: 'bg-gray-700',
  CONSUMED: 'bg-gray-400'
};

export const movementTypeLabels: Record<StockMovementType, string> = {
  RECEPTION: 'Réception',
  TRANSFERT: 'Transfert',
  CONSOMMATION: 'Consommation',
  AJUSTEMENT: 'Ajustement',
  EXPEDITION: 'Expédition',
  PERTE: 'Perte',
  RETOUR: 'Retour'
};

export const movementTypeColors: Record<StockMovementType, string> = {
  RECEPTION: 'bg-green-500',
  TRANSFERT: 'bg-blue-500',
  CONSOMMATION: 'bg-orange-500',
  AJUSTEMENT: 'bg-purple-500',
  EXPEDITION: 'bg-teal-500',
  PERTE: 'bg-red-500',
  RETOUR: 'bg-pink-500'
};

export const lossReasonLabels: Record<LossReason, string> = {
  MOISISSURE: 'Moisissure',
  INFESTATION: 'Infestation',
  CASSE: 'Casse',
  DESSICCATION: 'Dessiccation',
  FERMENTATION: 'Fermentation',
  PEREMPTION: 'Péremption',
  AUTRE: 'Autre'
};

export const shipmentStatusLabels: Record<ShipmentStatus, string> = {
  DRAFT: 'Brouillon',
  PICKING: 'En préparation',
  READY: 'Prêt',
  SHIPPED: 'Expédié',
  CANCELLED: 'Annulé'
};

export const shipmentStatusColors: Record<ShipmentStatus, string> = {
  DRAFT: 'bg-gray-400',
  PICKING: 'bg-blue-500',
  READY: 'bg-green-500',
  SHIPPED: 'bg-teal-500',
  CANCELLED: 'bg-red-500'
};
