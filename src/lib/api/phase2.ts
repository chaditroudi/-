import { apiRequest } from '@/integrations/mongodb/client';
import type {
  CleaningCycle,
  CleaningCycleStatus,
  FumigationCycle,
  FumigationCycleStatus,
  FumigationSensorReading,
  HydrationConformity,
  HydrationCycle,
  HydrationCycleStatus,
  FumigationChamber,
  FumigationProtocol,
  HydrationNonConformityAction,
  HydrationProgram,
  Phase2LotRef,
  TriageQualityCheck,
  TriageSession,
  TriageSessionStatus,
  TriageSubLot,
  WasteCategory,
} from '@/types/phase2';
import type { SystemNotification } from '@/types/notifications';

type ApiEnvelope<T> = { data: T };

export interface AvailableLot {
  id: string;
  reception_number: string;
  variety: string | null;
  quantity_total: number | null;
  unit: string | null;
  status: string;
  qc_grade: string | null;
  storage_zone_code: string | null;
  actual_arrival_date: string | null;
  is_bio: boolean;
  supplier_name: string | null;
}

export interface TraceabilityMatch {
  query: string;
  entity_type: string;
  entity_id: string | null;
  matched_reference: string;
  canonical_lot_number: string;
}

export interface TraceabilityTimelineEvent {
  id: string;
  timestamp: string;
  stage: string;
  title: string;
  detail: string;
  entity_type: string;
  entity_id: string | null;
  severity: 'info' | 'warning' | 'error' | 'success';
  actor: string | null;
  document_number: string | null;
}

export interface TraceabilityControlPoint {
  code: string;
  label: string;
  status: 'ok' | 'warning' | 'missing';
  detail: string;
}

export interface TraceabilityControls {
  immutable_collections: string[];
  business_event_count: number;
  audit_log_count: number;
  missing_data: string[];
  control_points: TraceabilityControlPoint[];
}

export interface TraceabilityIntegrationSummary {
  purchase_order_id: string | null;
  delivery_note_number: string | null;
  production_order_numbers: string[];
  packaging_order_numbers: string[];
  shipment_numbers: string[];
  customer_names: string[];
  document_references: string[];
  erp_sync_ready: boolean;
  mes_sync_ready: boolean;
  scm_sync_ready: boolean;
}

export interface TraceabilityLineage {
  inbound_lot_numbers: string[];
  sub_lot_numbers: string[];
  finished_good_lot_numbers: string[];
  shipment_numbers: string[];
}

export interface TraceabilityReceptionLot {
  id: string;
  reception_id: string | null;
  lot_internal: string | null;
  lot_supplier: string | null;
  quantity: number | null;
  unit: string | null;
  stock_status: string | null;
  origin_country: string | null;
  origin_region: string | null;
  origin_farm: string | null;
  harvest_date: string | null;
  expiry_date: string | null;
  quarantine_reason?: string | null;
  release_date?: string | null;
  released_by?: string | null;
  created_at: string | null;
}

export interface TraceabilityQcInspection {
  id: string;
  reception_id: string | null;
  reception_lot_id: string | null;
  inspection_number: string | null;
  inspector_name: string | null;
  started_at: string | null;
  ended_at: string | null;
  decision: string | null;
  comment?: string | null;
  nonconformity_codes?: string[] | null;
  lab_sample_required?: boolean | null;
  lab_sample_code?: string | null;
}

export interface TraceabilityQcCheckResult {
  id: string;
  inspection_id: string | null;
  check_name: string | null;
  check_code: string | null;
  severity: string | null;
  result: string | null;
  checked_at: string | null;
}

export interface TraceabilityReceptionStockMovement {
  id: string;
  movement_number: string | null;
  movement_type: string | null;
  quantity: number | null;
  unit: string | null;
  performed_by: string | null;
  performed_at: string | null;
  notes: string | null;
}

export interface TraceabilityStockLot {
  id: string;
  lot_number: string | null;
  source_reception_id: string | null;
  source_lot_internal: string | null;
  source_lot_supplier: string | null;
  source_stage: string | null;
  status: string | null;
  current_quantity: number | null;
  unit: string | null;
  storage_location_code?: string | null;
  packaging_date?: string | null;
  qc_validated_by?: string | null;
  qc_validated_at?: string | null;
  quality_notes?: string | null;
}

export interface TraceabilityFumigationCycle {
  id: string;
  cycle_number: string;
  status: FumigationCycleStatus;
  chamber?: string | null;
  protocol?: FumigationProtocol | null;
  total_weight_kg?: number | null;
  t0_start?: string | null;
  t_end_real?: string | null;
  duration_minutes?: number | null;
  duration_compliant?: boolean | null;
  parameters_compliant?: boolean | null;
  operator_name?: string | null;
  quality_inspector_name?: string | null;
  operator_signed_at?: string | null;
  quality_signed_at?: string | null;
}

export interface TraceabilityCleaningCycle {
  id: string;
  cycle_number: string;
  status: string | null;
  program?: string | null;
  started_at?: string | null;
  ended_at?: string | null;
  weight_in_kg?: number | null;
  weight_out_kg?: number | null;
  yield_percent?: number | null;
}

export interface TraceabilityHydrationCycle {
  id: string;
  cycle_number: string;
  status: string | null;
  chamber?: string | null;
  program_suggested?: string | null;
  program_applied?: string | null;
  humidity_in_percent?: number | null;
  humidity_out_avg?: number | null;
  conformity?: string | null;
  ended_at?: string | null;
}

export interface TraceabilityTriageSession {
  id: string;
  session_number: string;
  status: string | null;
  line?: string | null;
  worker_count?: number | null;
  total_sorted_kg?: number | null;
  extra_percent?: number | null;
  cat1_percent?: number | null;
  cat2_percent?: number | null;
  reject_percent?: number | null;
  quality_score_percent?: number | null;
  started_at?: string | null;
  ended_at?: string | null;
}

export interface TraceabilityTriageQualityCheck {
  id: string;
  session_id: string | null;
  checked_at?: string | null;
  inspector_name?: string | null;
  sample_weight_kg?: number | null;
  error_rate_percent?: number | null;
  notes?: string | null;
}

export interface TraceabilitySubLot {
  id: string;
  session_id?: string | null;
  parent_reception_id?: string | null;
  parent_lot_number?: string | null;
  grade?: string | null;
  lot_number: string;
  weight_kg?: number | null;
  percent_of_parent?: number | null;
  destination?: string | null;
  created_at?: string | null;
}

export interface TraceabilityStockMovement {
  id: string;
  movement_number: string | null;
  movement_type: string | null;
  movement_date: string | null;
  quantity: number | null;
  unit: string | null;
  performed_by: string | null;
  document_type?: string | null;
  document_reference?: string | null;
  notes?: string | null;
}

export interface TraceabilityProductionOrder {
  id: string;
  order_number: string | null;
  reception_id: string | null;
  product_name: string | null;
  target_quantity: number | null;
  actual_quantity: number | null;
  unit: string | null;
  status: string | null;
  actual_start_date?: string | null;
  actual_end_date?: string | null;
  created_at: string | null;
}

export interface TraceabilityProductionStep {
  id: string;
  production_order_id: string | null;
  sequence_order: number | null;
  status: string | null;
  operator_name: string | null;
  input_quantity?: number | null;
  output_quantity?: number | null;
  waste_quantity?: number | null;
  started_at?: string | null;
  completed_at?: string | null;
}

export interface TraceabilityProductionQualityCheck {
  id: string;
  production_step_id: string | null;
  check_type: string | null;
  parameter_name: string | null;
  expected_value?: string | null;
  actual_value?: string | null;
  is_passed?: boolean | null;
  checked_by?: string | null;
  checked_at?: string | null;
}

export interface TraceabilityProductionAllocation {
  id: string;
  production_order_id: string | null;
  reception_lot_id: string | null;
  allocated_quantity: number | null;
  unit: string | null;
  allocated_by: string | null;
  allocated_at: string | null;
  lot?: Record<string, unknown> | null;
}

export interface TraceabilityOutputLot {
  id: string;
  production_order_id: string | null;
  lot_pf_number: string | null;
  quantity: number | null;
  unit: string | null;
  variety?: string | null;
  bio_declared?: boolean | null;
  recorded_by?: string | null;
  recorded_at?: string | null;
  parent_lot_ids?: string[] | null;
  parent_lots_snapshot?: Array<Record<string, unknown>> | null;
}

export interface TraceabilityPackagingOrder {
  id: string;
  order_number: string | null;
  status: string | null;
  source_sublot_id?: string | null;
  source_lot_number?: string | null;
  bom_name?: string | null;
  grade?: string | null;
  target_units?: number | null;
  produced_units?: number | null;
  rejected_units?: number | null;
  started_at?: string | null;
  ended_at?: string | null;
}

export interface TraceabilityPackagingPalette {
  id: string;
  order_id: string | null;
  palette_number: string | null;
  status: string | null;
  net_weight_kg?: number | null;
  seal_number?: string | null;
  sealed_by?: string | null;
  sealed_at?: string | null;
  sscc?: string | null;
}

export interface TraceabilityShipment {
  id: string;
  shipment_number: string | null;
  customer_name: string | null;
  destination: string | null;
  status: string | null;
  requested_date?: string | null;
  prepared_at?: string | null;
  shipped_at?: string | null;
  validated_by?: string | null;
}

export interface TraceabilityShipmentLine {
  id: string;
  shipment_id: string | null;
  lot_id: string | null;
  requested_quantity: number | null;
  picked_quantity: number | null;
  unit: string | null;
  picked_by?: string | null;
  picked_at?: string | null;
}

export interface TraceabilityAuditLog {
  id: string;
  entity_type: string | null;
  entity_id: string | null;
  action: string | null;
  action_label: string | null;
  performed_by: string | null;
  performed_at: string | null;
  message?: string | null;
  module?: string | null;
  table?: string | null;
  changed_fields?: string[] | null;
  metadata?: Record<string, unknown> | null;
}

export interface LotTraceabilityData {
  lot_number: string;
  match?: TraceabilityMatch;
  reception: {
    id: string;
    reception_number: string;
    status: string;
    variety: string | null;
    quantity_total: number | null;
    unit: string | null;
    actual_arrival_date: string | null;
    qc_grade: string | null;
    qc_decision?: string | null;
    supplier_name: string | null;
    purchase_order_id?: string | null;
    delivery_note_number?: string | null;
    remarks?: string | null;
  } | null;
  reception_lots: TraceabilityReceptionLot[];
  qc_inspections: TraceabilityQcInspection[];
  qc_check_results: TraceabilityQcCheckResult[];
  reception_stock_movements: TraceabilityReceptionStockMovement[];
  fumigation_cycles: TraceabilityFumigationCycle[];
  cleaning_cycles: TraceabilityCleaningCycle[];
  hydration_cycles: TraceabilityHydrationCycle[];
  triage_sessions: TraceabilityTriageSession[];
  triage_quality_checks: TraceabilityTriageQualityCheck[];
  sub_lots: TraceabilitySubLot[];
  stock_lots: TraceabilityStockLot[];
  stock_movements: TraceabilityStockMovement[];
  production_orders: TraceabilityProductionOrder[];
  production_steps: TraceabilityProductionStep[];
  production_quality_checks: TraceabilityProductionQualityCheck[];
  production_allocations: TraceabilityProductionAllocation[];
  output_lots: TraceabilityOutputLot[];
  packaging_orders: TraceabilityPackagingOrder[];
  packaging_palettes: TraceabilityPackagingPalette[];
  shipments: TraceabilityShipment[];
  shipment_lines: TraceabilityShipmentLine[];
  audit_logs: TraceabilityAuditLog[];
  timeline: TraceabilityTimelineEvent[];
  controls: TraceabilityControls;
  integration_summary: TraceabilityIntegrationSummary;
  lineage: TraceabilityLineage;
}

// ── Genealogy tree ─────────────────────────────────────────────────────────────

export type GenealogyNodeType =
  | 'reception_lot' | 'qc_inspection' | 'fumigation' | 'cleaning' | 'hydration'
  | 'triage' | 'sub_lot' | 'production_order' | 'output_lot'
  | 'stock_lot' | 'packaging_order' | 'palette' | 'shipment';

export interface GenealogyNode {
  id: string;
  type: GenealogyNodeType;
  label: string;
  sublabel: string | null;
  status: string | null;
  column: number;
  row: number;
  meta: Record<string, unknown>;
}

export interface GenealogyEdge {
  id: string;
  from: string;
  to: string;
  edgeType: 'process' | 'output' | 'shipment' | 'link';
}

export interface GenealogyTree {
  lot_number: string;
  nodes: GenealogyNode[];
  edges: GenealogyEdge[];
  stats: {
    total_kg_in: number | null;
    final_units: number | null;
    palette_count: number;
    shipment_count: number;
    stage_count: number;
  };
}

export interface CleaningKpis {
  active_count: number;
  completed_count: number;
  avg_yield_pct: number | null;
  program_counts: Record<string, number>;
}

export interface FumigationKpis {
  active_count: number;
  completed_count: number;
  compliance_pct: number | null;
  total_kg_treated: number;
}

export interface HydrationKpis {
  active_count: number;
  completed_count: number;
  conform_pct: number | null;
  override_count: number;
}

export interface TriageKpis {
  active_count: number;
  completed_count: number;
  avg_extra_pct: number | null;
  avg_reject_pct: number | null;
  total_sorted_kg: number;
}

const withQuery = (path: string, params: Record<string, string | undefined>) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (!value) return;
    search.set(key, value);
  });
  const query = search.toString();
  return query ? `${path}?${query}` : path;
};

const serializeStatuses = (statuses?: string[]) =>
  statuses && statuses.length > 0 ? statuses.join(',') : undefined;

export const phase2Api = {
  listAvailableLots: async () => {
    const response = await apiRequest<ApiEnvelope<AvailableLot[]>>('/phase2/available-lots');
    return response.data;
  },

  listFumigationCycles: async (statuses?: FumigationCycleStatus[]) => {
    const response = await apiRequest<ApiEnvelope<FumigationCycle[]>>(
      withQuery('/phase2/fumigation/cycles', { status: serializeStatuses(statuses) })
    );
    return response.data;
  },

  getFumigationCycle: async (id: string) => {
    const response = await apiRequest<ApiEnvelope<FumigationCycle>>(`/phase2/fumigation/cycles/${id}`);
    return response.data;
  },

  listFumigationSensorReadings: async (cycleId: string) => {
    const response = await apiRequest<ApiEnvelope<FumigationSensorReading[]>>(
      `/phase2/fumigation/cycles/${cycleId}/readings`
    );
    return response.data;
  },

  createFumigationCycle: async (payload: {
    chamber: FumigationChamber;
    protocol: FumigationProtocol;
    lot_refs: Phase2LotRef[];
    total_weight_kg: number;
    fill_rate_percent: number;
    created_by: string;
  }) => {
    const response = await apiRequest<ApiEnvelope<FumigationCycle>>('/phase2/fumigation/cycles', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return response.data;
  },

  updateFumigationCycle: async (
    id: string,
    patch: Partial<Omit<FumigationCycle, 'id' | 'cycle_number' | 'created_at' | 'readings'>>
  ) => {
    const response = await apiRequest<ApiEnvelope<FumigationCycle>>(`/phase2/fumigation/cycles/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    return response.data;
  },

  startFumigationCycle: async (id: string) => {
    const response = await apiRequest<ApiEnvelope<FumigationCycle>>(`/phase2/fumigation/cycles/${id}/start`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    return response.data;
  },

  signFumigationCycle: async (id: string, payload: {
    role: 'operator' | 'quality';
    signerName: string;
    signerId: string;
  }) => {
    const response = await apiRequest<ApiEnvelope<FumigationCycle>>(`/phase2/fumigation/cycles/${id}/sign`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return response.data;
  },

  addFumigationSensorReading: async (payload: Omit<FumigationSensorReading, 'id'>) => {
    const response = await apiRequest<ApiEnvelope<FumigationSensorReading>>('/phase2/fumigation/readings', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return response.data;
  },

  getFumigationKpis: async () => {
    const response = await apiRequest<ApiEnvelope<FumigationKpis>>('/phase2/fumigation/kpis');
    return response.data;
  },

  listCleaningCycles: async (statuses?: CleaningCycleStatus[]) => {
    const response = await apiRequest<ApiEnvelope<CleaningCycle[]>>(
      withQuery('/phase2/cleaning/cycles', { status: serializeStatuses(statuses) })
    );
    return response.data;
  },

  getCleaningCycle: async (id: string) => {
    const response = await apiRequest<ApiEnvelope<CleaningCycle>>(`/phase2/cleaning/cycles/${id}`);
    return response.data;
  },

  createCleaningCycle: async (payload: {
    reception_id: string;
    lot_number: string;
    variety: string | null;
    program: string;
    program_forced_reason?: string;
    operator_name: string;
    created_by: string;
  }) => {
    const response = await apiRequest<ApiEnvelope<CleaningCycle>>('/phase2/cleaning/cycles', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return response.data;
  },

  closeCleaningCycle: async (id: string, payload: {
    weight_in_kg: number;
    weight_out_kg: number;
    waste_weight_kg: number;
    waste_category: WasteCategory;
    water_volume_liters?: number;
    water_recycled_percent?: number;
    water_temperature_c?: number;
    turbidity_ntu?: number;
    ph_water?: number;
  }) => {
    const response = await apiRequest<ApiEnvelope<{ yield_percent: number | null }>>(
      `/phase2/cleaning/cycles/${id}/close`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );
    return response.data;
  },

  updateCleaningCycle: async (id: string, patch: Partial<Omit<CleaningCycle, 'id' | 'cycle_number' | 'created_at'>>) => {
    const response = await apiRequest<ApiEnvelope<CleaningCycle>>(`/phase2/cleaning/cycles/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    return response.data;
  },

  getCleaningKpis: async () => {
    const response = await apiRequest<ApiEnvelope<CleaningKpis>>('/phase2/cleaning/kpis');
    return response.data;
  },

  listHydrationCycles: async (statuses?: HydrationCycleStatus[]) => {
    const response = await apiRequest<ApiEnvelope<HydrationCycle[]>>(
      withQuery('/phase2/hydration/cycles', { status: serializeStatuses(statuses) })
    );
    return response.data;
  },

  getHydrationCycle: async (id: string) => {
    const response = await apiRequest<ApiEnvelope<HydrationCycle>>(`/phase2/hydration/cycles/${id}`);
    return response.data;
  },

  createHydrationCycle: async (payload: {
    chamber: string;
    lot_refs: Phase2LotRef[];
    humidity_in_percent: number | null;
    program_override?: HydrationProgram;
    program_override_reason?: string;
    operator_name: string;
    created_by: string;
  }) => {
    const response = await apiRequest<ApiEnvelope<HydrationCycle>>('/phase2/hydration/cycles', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return response.data;
  },

  recordHydrationExit: async (id: string, payload: {
    humidity_out_1: number;
    humidity_out_2: number;
    humidity_out_3: number;
    inspector_name: string;
  }) => {
    const response = await apiRequest<ApiEnvelope<{ avg: number; conformity: HydrationConformity }>>(
      `/phase2/hydration/cycles/${id}/record-exit`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );
    return response.data;
  },

  closeHydrationCycle: async (id: string, payload: { non_conformity_action?: HydrationNonConformityAction }) => {
    const response = await apiRequest<ApiEnvelope<HydrationCycle>>(`/phase2/hydration/cycles/${id}/close`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return response.data;
  },

  updateHydrationSensors: async (id: string, sensors: {
    temperature_t1_c?: number;
    temperature_t2_c?: number;
    air_humidity_percent?: number;
    steam_injected_kg?: number;
    energy_kwh?: number;
  }) => {
    const response = await apiRequest<ApiEnvelope<HydrationCycle>>(`/phase2/hydration/cycles/${id}/sensors`, {
      method: 'PATCH',
      body: JSON.stringify(sensors),
    });
    return response.data;
  },

  getHydrationKpis: async () => {
    const response = await apiRequest<ApiEnvelope<HydrationKpis>>('/phase2/hydration/kpis');
    return response.data;
  },

  listTriageSessions: async (statuses?: TriageSessionStatus[]) => {
    const response = await apiRequest<ApiEnvelope<TriageSession[]>>(
      withQuery('/phase2/triage/sessions', { status: serializeStatuses(statuses) })
    );
    return response.data;
  },

  getTriageSession: async (id: string) => {
    const response = await apiRequest<ApiEnvelope<TriageSession>>(`/phase2/triage/sessions/${id}`);
    return response.data;
  },

  listTriageQualityChecks: async (sessionId: string) => {
    const response = await apiRequest<ApiEnvelope<TriageQualityCheck[]>>(
      `/phase2/triage/sessions/${sessionId}/quality-checks`
    );
    return response.data;
  },

  listTriageSublots: async (sessionId: string) => {
    const response = await apiRequest<ApiEnvelope<TriageSubLot[]>>(
      `/phase2/triage/sessions/${sessionId}/sub-lots`
    );
    return response.data;
  },

  createTriageSession: async (payload: {
    line: string;
    parent_reception_id: string;
    parent_lot_number: string;
    variety: string | null;
    parent_weight_kg: number;
    worker_count: number;
    worker_ids: string[];
    chef_ligne: string;
    tape_speed: string;
    created_by: string;
  }) => {
    const response = await apiRequest<ApiEnvelope<TriageSession>>('/phase2/triage/sessions', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return response.data;
  },

  updateTriageWeights: async (id: string, payload: {
    weight_extra_kg: number;
    weight_cat1_kg: number;
    weight_cat2_kg: number;
    weight_reject_kg: number;
    started_at: string;
  }) => {
    const response = await apiRequest<ApiEnvelope<TriageSession>>(`/phase2/triage/sessions/${id}/weights`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    return response.data;
  },

  addTriageQualityCheck: async (sessionId: string, payload: {
    inspector_name: string;
    sample_weight_kg: number;
    extra_error_count: number;
    cat1_error_count: number;
    cat2_error_count: number;
    reject_error_count: number;
    notes?: string;
  }) => {
    const response = await apiRequest<ApiEnvelope<TriageQualityCheck>>(
      `/phase2/triage/sessions/${sessionId}/quality-checks`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );
    return response.data;
  },

  closeTriageSession: async (id: string) => {
    const response = await apiRequest<ApiEnvelope<{
      session_number: string;
      sub_lots_created: number;
      duration_minutes: number;
    }>>(`/phase2/triage/sessions/${id}/close`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    return response.data;
  },

  toggleTriageRunState: async (id: string, payload: { action: 'PAUSE' | 'RESUME' }) => {
    const response = await apiRequest<ApiEnvelope<{ status: TriageSessionStatus }>>(
      `/phase2/triage/sessions/${id}/toggle-run`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );
    return response.data;
  },

  getTriageKpis: async () => {
    const response = await apiRequest<ApiEnvelope<TriageKpis>>('/phase2/triage/kpis');
    return response.data;
  },

  getLotTraceability: async (lotNumber: string) => {
    const response = await apiRequest<ApiEnvelope<LotTraceabilityData>>(
      `/phase2/traceability/${encodeURIComponent(lotNumber)}`
    );
    return response.data;
  },

  getLotGenealogy: async (lotNumber: string): Promise<GenealogyTree> => {
    const response = await apiRequest<ApiEnvelope<GenealogyTree>>(
      `/phase2/traceability/${encodeURIComponent(lotNumber)}/genealogy`
    );
    return response.data;
  },

  acknowledgePhase2Alert: async (id: string, readBy = 'operator') => {
    const response = await apiRequest<ApiEnvelope<SystemNotification>>(`/phase2/alerts/${id}/acknowledge`, {
      method: 'POST',
      body: JSON.stringify({ read_by: readBy }),
    });
    return response.data;
  },

  acknowledgeAllPhase2Alerts: async (readBy = 'operator') => {
    const response = await apiRequest<ApiEnvelope<string[]>>('/phase2/alerts/acknowledge-all', {
      method: 'POST',
      body: JSON.stringify({ read_by: readBy }),
    });
    return response.data;
  },
};
