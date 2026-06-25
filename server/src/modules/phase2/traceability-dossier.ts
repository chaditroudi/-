import { badRequest } from "../../core/app-error.js";
import { getCollectionModel, sanitizeDocument } from "../../db/dynamic-model.js";

type GenericRow = Record<string, unknown> & {
  id?: string;
  created_at?: string | null;
  updated_at?: string | null;
};

type SupplierRow = GenericRow & {
  name?: string | null;
};

type ReceptionRow = GenericRow & {
  reception_number?: string | null;
  status?: string | null;
  variety?: string | null;
  quantity_total?: number | null;
  unit?: string | null;
  actual_arrival_date?: string | null;
  qc_grade?: string | null;
  qc_decision?: string | null;
  supplier_id?: string | null;
  supplier_name_snapshot?: string | null;
  purchase_order_id?: string | null;
  delivery_note_number?: string | null;
  origin_oasis?: string | null;
  origin_gps?: string | null;
  remarks?: string | null;
};

type ReceptionLotRow = GenericRow & {
  reception_id?: string | null;
  lot_internal?: string | null;
  lot_supplier?: string | null;
  qr_code_payload?: string | null;
  rfid_tag?: string | null;
  parent_lot_id?: string | null;
  child_lot_ids?: string[] | null;
  production_date?: string | null;
  expiry_date?: string | null;
  harvest_date?: string | null;
  maturity_stage?: string | null;
  article_ref?: string | null;
  infestation_rate?: number | null;
  variety?: string | null;
  origin_country?: string | null;
  origin_region?: string | null;
  origin_farm?: string | null;
  quantity?: number | null;
  unit?: string | null;
  stock_status?: string | null;
  quarantine_reason?: string | null;
  quarantine_date?: string | null;
  release_date?: string | null;
  released_by?: string | null;
};

type QcInspectionRow = GenericRow & {
  reception_id?: string | null;
  reception_lot_id?: string | null;
  inspection_number?: string | null;
  inspector_name?: string | null;
  started_at?: string | null;
  ended_at?: string | null;
  decision?: string | null;
  comment?: string | null;
  nonconformity_code?: string | null;
  nonconformity_codes?: string[] | null;
  lab_sample_required?: boolean | null;
  lab_analyses?: string[] | null;
  lab_sample_code?: string | null;
  lab_analysis_results?: unknown[] | null;
};

type QcCheckResultRow = GenericRow & {
  inspection_id?: string | null;
  check_name?: string | null;
  check_code?: string | null;
  severity?: string | null;
  result?: string | null;
  checked_at?: string | null;
};

type ReceptionStockMovementRow = GenericRow & {
  reception_id?: string | null;
  reception_lot_id?: string | null;
  movement_number?: string | null;
  movement_type?: string | null;
  quantity?: number | null;
  unit?: string | null;
  from_location_id?: string | null;
  to_location_id?: string | null;
  performed_by?: string | null;
  performed_at?: string | null;
  notes?: string | null;
};

type FumigationCycleRow = GenericRow & {
  cycle_number?: string | null;
  status?: string | null;
  chamber?: string | null;
  protocol?: string | null;
  lot_refs?: Array<Record<string, unknown>> | null;
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
};

type CleaningCycleRow = GenericRow & {
  reception_id?: string | null;
  lot_number?: string | null;
  cycle_number?: string | null;
  status?: string | null;
  program?: string | null;
  started_at?: string | null;
  ended_at?: string | null;
  weight_in_kg?: number | null;
  weight_out_kg?: number | null;
  yield_percent?: number | null;
  waste_weight_kg?: number | null;
  waste_category?: string | null;
  operator_name?: string | null;
};

type HydrationCycleRow = GenericRow & {
  cycle_number?: string | null;
  chamber?: string | null;
  lot_refs?: Array<Record<string, unknown>> | null;
  status?: string | null;
  humidity_in_percent?: number | null;
  humidity_out_avg?: number | null;
  conformity?: string | null;
  program_suggested?: string | null;
  program_applied?: string | null;
  operator_name?: string | null;
  inspector_name?: string | null;
  ended_at?: string | null;
};

type TriageSessionRow = GenericRow & {
  session_number?: string | null;
  line?: string | null;
  parent_reception_id?: string | null;
  parent_lot_number?: string | null;
  variety?: string | null;
  parent_weight_kg?: number | null;
  status?: string | null;
  worker_count?: number | null;
  chef_ligne?: string | null;
  tape_speed?: string | null;
  total_sorted_kg?: number | null;
  extra_percent?: number | null;
  cat1_percent?: number | null;
  cat2_percent?: number | null;
  reject_percent?: number | null;
  quality_score_percent?: number | null;
  started_at?: string | null;
  ended_at?: string | null;
  duration_minutes?: number | null;
  created_by?: string | null;
};

type TriageQualityCheckRow = GenericRow & {
  session_id?: string | null;
  checked_at?: string | null;
  inspector_name?: string | null;
  sample_weight_kg?: number | null;
  error_rate_percent?: number | null;
  notes?: string | null;
};

type TriageSubLotRow = GenericRow & {
  session_id?: string | null;
  parent_reception_id?: string | null;
  parent_lot_number?: string | null;
  grade?: string | null;
  lot_number?: string | null;
  weight_kg?: number | null;
  percent_of_parent?: number | null;
  destination?: string | null;
};

type StockLotRow = GenericRow & {
  lot_number?: string | null;
  reception_lot_id?: string | null;
  source_reception_id?: string | null;
  source_reception_number?: string | null;
  source_lot_internal?: string | null;
  source_lot_supplier?: string | null;
  source_stage?: string | null;
  source_status?: string | null;
  source_sync_reason?: string | null;
  supplier_id?: string | null;
  variety?: string | null;
  origin_country?: string | null;
  origin_farm?: string | null;
  harvest_date?: string | null;
  reception_date?: string | null;
  transformation_date?: string | null;
  packaging_date?: string | null;
  dluo_date?: string | null;
  dlc_date?: string | null;
  initial_quantity?: number | null;
  current_quantity?: number | null;
  unit?: string | null;
  status?: string | null;
  quality_notes?: string | null;
  qc_validated_by?: string | null;
  qc_validated_at?: string | null;
  location_id?: string | null;
  storage_location_id?: string | null;
  storage_location_code?: string | null;
};

type StockMovementRow = GenericRow & {
  movement_number?: string | null;
  movement_type?: string | null;
  movement_date?: string | null;
  lot_id?: string | null;
  product_id?: string | null;
  quantity?: number | null;
  unit?: string | null;
  source_location_id?: string | null;
  destination_location_id?: string | null;
  document_type?: string | null;
  document_reference?: string | null;
  performed_by?: string | null;
  validated_by?: string | null;
  validated_at?: string | null;
  notes?: string | null;
};

type ProductionOrderRow = GenericRow & {
  order_number?: string | null;
  reception_id?: string | null;
  product_name?: string | null;
  target_quantity?: number | null;
  actual_quantity?: number | null;
  unit?: string | null;
  status?: string | null;
  priority?: number | null;
  planned_start_date?: string | null;
  planned_end_date?: string | null;
  actual_start_date?: string | null;
  actual_end_date?: string | null;
  notes?: string | null;
  created_by?: string | null;
};

type ProductionStepRow = GenericRow & {
  production_order_id?: string | null;
  step_definition_id?: string | null;
  sequence_order?: number | null;
  status?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  operator_name?: string | null;
  input_quantity?: number | null;
  output_quantity?: number | null;
  waste_quantity?: number | null;
  notes?: string | null;
};

type ProductionQualityCheckRow = GenericRow & {
  production_step_id?: string | null;
  check_type?: string | null;
  parameter_name?: string | null;
  expected_value?: string | null;
  actual_value?: string | null;
  is_passed?: boolean | null;
  checked_by?: string | null;
  checked_at?: string | null;
  notes?: string | null;
};

type ProductionAllocationRow = GenericRow & {
  production_order_id?: string | null;
  reception_lot_id?: string | null;
  allocated_quantity?: number | null;
  unit?: string | null;
  allocated_by?: string | null;
  allocated_at?: string | null;
  lot?: Record<string, unknown> | null;
};

type ProductionOutputLotRow = GenericRow & {
  production_order_id?: string | null;
  lot_pf_number?: string | null;
  quantity?: number | null;
  unit?: string | null;
  variety?: string | null;
  bio_declared?: boolean | null;
  recorded_by?: string | null;
  recorded_at?: string | null;
  parent_lot_ids?: string[] | null;
  parent_lots_snapshot?: Array<Record<string, unknown>> | null;
};

type PackagingOrderRow = GenericRow & {
  order_number?: string | null;
  status?: string | null;
  source_sublot_id?: string | null;
  source_lot_number?: string | null;
  target_units?: number | null;
  produced_units?: number | null;
  rejected_units?: number | null;
  bom_name?: string | null;
  grade?: string | null;
  line?: string | null;
  planned_at?: string | null;
  started_at?: string | null;
  ended_at?: string | null;
  duration_minutes?: number | null;
  created_by?: string | null;
};

type PackagingPaletteRow = GenericRow & {
  order_id?: string | null;
  order_number?: string | null;
  palette_number?: string | null;
  status?: string | null;
  box_count?: number | null;
  gross_weight_kg?: number | null;
  net_weight_kg?: number | null;
  seal_number?: string | null;
  sealed_by?: string | null;
  sealed_at?: string | null;
  sscc?: string | null;
  storage_location_id?: string | null;
};

type ShipmentPreparationRow = GenericRow & {
  shipment_number?: string | null;
  customer_name?: string | null;
  destination?: string | null;
  status?: string | null;
  requested_date?: string | null;
  prepared_at?: string | null;
  shipped_at?: string | null;
  prepared_by?: string | null;
  validated_by?: string | null;
  notes?: string | null;
};

type ShipmentLineRow = GenericRow & {
  shipment_id?: string | null;
  product_id?: string | null;
  lot_id?: string | null;
  requested_quantity?: number | null;
  picked_quantity?: number | null;
  unit?: string | null;
  suggested_by_system?: boolean | null;
  picked_at?: string | null;
  picked_by?: string | null;
  notes?: string | null;
};

type AuditLogRow = GenericRow & {
  entity_type?: string | null;
  entity_id?: string | null;
  action?: string | null;
  action_label?: string | null;
  performed_by?: string | null;
  performed_at?: string | null;
  message?: string | null;
  metadata?: Record<string, unknown> | null;
  old_state?: Record<string, unknown> | null;
  new_state?: Record<string, unknown> | null;
  changed_fields?: string[] | null;
  module?: string | null;
  table?: string | null;
  event_type?: string | null;
  affected_ids?: string[] | null;
  ip_address?: string | null;
  user_agent?: string | null;
  session_id?: string | null;
  user_name?: string | null;
  user_email?: string | null;
};

type TraceabilityTimelineEvent = {
  id: string;
  timestamp: string;
  stage: string;
  title: string;
  detail: string;
  entity_type: string;
  entity_id: string | null;
  severity: "info" | "warning" | "error" | "success";
  actor: string | null;
  document_number: string | null;
};

const Receptions = () => getCollectionModel("receptions_v2");
const ReceptionLots = () => getCollectionModel("reception_lots");
const QcInspections = () => getCollectionModel("qc_inspections");
const QcCheckResults = () => getCollectionModel("qc_check_results");
const ReceptionStockMovements = () => getCollectionModel("reception_stock_movements");
const Suppliers = () => getCollectionModel("suppliers");
const FumigationCycles = () => getCollectionModel("fumigation_cycles");
const CleaningCycles = () => getCollectionModel("cleaning_cycles");
const HydrationCycles = () => getCollectionModel("hydration_cycles");
const TriageSessions = () => getCollectionModel("triage_sessions");
const TriageQualityChecks = () => getCollectionModel("triage_quality_checks");
const TriageSublots = () => getCollectionModel("triage_sublots");
const StockLots = () => getCollectionModel("stock_lots");
const StockMovements = () => getCollectionModel("stock_movements");
const ProductionOrders = () => getCollectionModel("production_orders");
const ProductionSteps = () => getCollectionModel("production_steps");
const ProductionQualityChecks = () => getCollectionModel("quality_checks");
const ProductionLotAllocations = () => getCollectionModel("production_lot_allocations");
const ProductionOutputLots = () => getCollectionModel("production_output_lots");
const PackagingOrders = () => getCollectionModel("packaging_orders");
const PackagingPalettes = () => getCollectionModel("packaging_palettes");
const ShipmentPreparations = () => getCollectionModel("shipment_preparations");
const ShipmentLines = () => getCollectionModel("shipment_lines");
const AuditLogs = () => getCollectionModel("system_audit_logs");

const readString = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
};

const readNullableNumber = (value: unknown) => {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const readStringArray = (value: unknown) =>
  Array.isArray(value)
    ? value.map((entry) => readString(entry)).filter(Boolean)
    : [];

const uniqueStrings = (values: unknown[]) =>
  Array.from(
    new Set(
      values
        .flatMap((value) => (Array.isArray(value) ? value : [value]))
        .map((value) => readString(value))
        .filter(Boolean),
    ),
  );

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const pickLatestByDate = <T extends GenericRow>(rows: T[], field: keyof T) =>
  [...rows].sort((a, b) => {
    const left = new Date(readString(a[field])).getTime() || 0;
    const right = new Date(readString(b[field])).getTime() || 0;
    return right - left;
  })[0] || null;

const sortByDateDesc = <T extends GenericRow>(rows: T[], field: keyof T) =>
  [...rows].sort((a, b) => {
    const left = new Date(readString(a[field])).getTime() || 0;
    const right = new Date(readString(b[field])).getTime() || 0;
    return right - left;
  });

const pushTimelineEvent = (
  events: TraceabilityTimelineEvent[],
  event: TraceabilityTimelineEvent | null,
) => {
  if (!event?.timestamp) return;
  events.push(event);
};

const buildAuditActor = (row: AuditLogRow) =>
  readString(row.performed_by, row.user_name, row.user_email) || null;

const buildAuditLabel = (row: AuditLogRow) =>
  readString(row.action_label, row.message, row.action) || "Audit";

const buildControlPoint = (
  code: string,
  label: string,
  status: "ok" | "warning" | "missing",
  detail: string,
) => ({ code, label, status, detail });

export async function buildLotTraceabilityDossier(lotNumber: string) {
  const normalizedLotNumber = readString(lotNumber);
  if (!normalizedLotNumber) {
    throw badRequest("LOT_NUMBER_REQUIRED", "Le numero de lot est requis.");
  }

  const lotRegex = new RegExp(escapeRegex(normalizedLotNumber), "i");

  const [
    receptionExact,
    receptionLotExact,
    stockLotExact,
    subLotExact,
    outputLotExact,
    receptionFuzzy,
    receptionLotsDirect,
    stockLotsDirect,
    subLotsDirect,
    outputLotsDirect,
  ] = await Promise.all([
    sanitizeDocument(await Receptions().findOne({ reception_number: normalizedLotNumber }).lean().exec()) as ReceptionRow | null,
    sanitizeDocument(
      await ReceptionLots()
        .findOne({
          $or: [
            { id: normalizedLotNumber },
            { lot_internal: normalizedLotNumber },
            { lot_supplier: normalizedLotNumber },
            { qr_code_payload: normalizedLotNumber },
            { rfid_tag: normalizedLotNumber },
          ],
        })
        .lean()
        .exec(),
    ) as ReceptionLotRow | null,
    sanitizeDocument(
      await StockLots()
        .findOne({
          $or: [
            { id: normalizedLotNumber },
            { lot_number: normalizedLotNumber },
            { source_lot_internal: normalizedLotNumber },
            { source_lot_supplier: normalizedLotNumber },
            { reception_lot_id: normalizedLotNumber },
          ],
        })
        .lean()
        .exec(),
    ) as StockLotRow | null,
    sanitizeDocument(
      await TriageSublots()
        .findOne({
          $or: [
            { id: normalizedLotNumber },
            { lot_number: normalizedLotNumber },
            { parent_lot_number: normalizedLotNumber },
          ],
        })
        .lean()
        .exec(),
    ) as TriageSubLotRow | null,
    sanitizeDocument(
      await ProductionOutputLots()
        .findOne({
          $or: [
            { id: normalizedLotNumber },
            { lot_pf_number: normalizedLotNumber },
            { "parent_lots_snapshot.lot_internal": normalizedLotNumber },
            { "parent_lots_snapshot.lot_supplier": normalizedLotNumber },
            { "parent_lots_snapshot.reception_number": normalizedLotNumber },
          ],
        })
        .lean()
        .exec(),
    ) as ProductionOutputLotRow | null,
    sanitizeDocument(
      await Receptions()
        .findOne({ reception_number: { $regex: lotRegex } })
        .sort({ actual_arrival_date: -1 })
        .lean()
        .exec(),
    ) as ReceptionRow | null,
    sanitizeDocument(
      await ReceptionLots()
        .find({
          $or: [
            { lot_internal: { $regex: lotRegex } },
            { lot_supplier: { $regex: lotRegex } },
            { qr_code_payload: { $regex: lotRegex } },
            { rfid_tag: { $regex: lotRegex } },
          ],
        })
        .sort({ created_at: -1 })
        .limit(50)
        .lean()
        .exec(),
    ) as ReceptionLotRow[],
    sanitizeDocument(
      await StockLots()
        .find({
          $or: [
            { lot_number: { $regex: lotRegex } },
            { source_lot_internal: { $regex: lotRegex } },
            { source_lot_supplier: { $regex: lotRegex } },
          ],
        })
        .sort({ created_at: -1 })
        .limit(50)
        .lean()
        .exec(),
    ) as StockLotRow[],
    sanitizeDocument(
      await TriageSublots()
        .find({
          $or: [
            { lot_number: { $regex: lotRegex } },
            { parent_lot_number: { $regex: lotRegex } },
          ],
        })
        .sort({ created_at: -1 })
        .limit(50)
        .lean()
        .exec(),
    ) as TriageSubLotRow[],
    sanitizeDocument(
      await ProductionOutputLots()
        .find({
          $or: [
            { lot_pf_number: { $regex: lotRegex } },
            { "parent_lots_snapshot.lot_internal": { $regex: lotRegex } },
            { "parent_lots_snapshot.lot_supplier": { $regex: lotRegex } },
            { "parent_lots_snapshot.reception_number": { $regex: lotRegex } },
          ],
        })
        .sort({ recorded_at: -1 })
        .limit(50)
        .lean()
        .exec(),
    ) as ProductionOutputLotRow[],
  ]);

  const initialReceptionIds = uniqueStrings([
    receptionExact?.id,
    receptionLotExact?.reception_id,
    stockLotExact?.source_reception_id,
    subLotExact?.parent_reception_id,
    ...receptionLotsDirect.map((row) => row.reception_id),
    ...stockLotsDirect.map((row) => row.source_reception_id),
    ...subLotsDirect.map((row) => row.parent_reception_id),
  ]);

  const receptionsByInitialIds = initialReceptionIds.length > 0
    ? sanitizeDocument(
      await Receptions()
        .find({ id: { $in: initialReceptionIds } })
        .sort({ actual_arrival_date: -1 })
        .lean()
        .exec(),
    ) as ReceptionRow[]
    : [];

  let reception = receptionExact
    || receptionsByInitialIds.find((row) => row.id === receptionLotExact?.reception_id)
    || receptionsByInitialIds.find((row) => row.id === stockLotExact?.source_reception_id)
    || receptionsByInitialIds.find((row) => row.id === subLotExact?.parent_reception_id)
    || receptionFuzzy
    || pickLatestByDate(receptionsByInitialIds, "actual_arrival_date");

  const receptionIds = uniqueStrings([
    reception?.id,
    ...initialReceptionIds,
  ]);

  const receptionLots = sortByDateDesc(
    sanitizeDocument(
      await ReceptionLots()
        .find({
          $or: [
            ...(receptionIds.length > 0 ? [{ reception_id: { $in: receptionIds } }] : []),
            { lot_internal: { $regex: lotRegex } },
            { lot_supplier: { $regex: lotRegex } },
            { qr_code_payload: { $regex: lotRegex } },
            { rfid_tag: { $regex: lotRegex } },
          ],
        })
        .lean()
        .exec(),
    ) as ReceptionLotRow[],
    "created_at",
  );

  const receptionLotIds = uniqueStrings(receptionLots.map((row) => row.id));
  const receptionNumbers = uniqueStrings([reception?.reception_number]);

  const [qcInspections, fumigationCycles, cleaningCycles, hydrationCycles, triageSessions, subLots] = await Promise.all([
    sanitizeDocument(
      await QcInspections()
        .find({
          $or: [
            ...(receptionIds.length > 0 ? [{ reception_id: { $in: receptionIds } }] : []),
            ...(receptionLotIds.length > 0 ? [{ reception_lot_id: { $in: receptionLotIds } }] : []),
          ],
        })
        .sort({ started_at: -1 })
        .lean()
        .exec(),
    ) as QcInspectionRow[],
    sanitizeDocument(
      await FumigationCycles()
        .find({
          $or: [
            ...(receptionIds.length > 0 ? [{ "lot_refs.reception_id": { $in: receptionIds } }] : []),
            { "lot_refs.lot_number": { $regex: lotRegex } },
          ],
        })
        .sort({ created_at: -1 })
        .lean()
        .exec(),
    ) as FumigationCycleRow[],
    sanitizeDocument(
      await CleaningCycles()
        .find({
          $or: [
            ...(receptionIds.length > 0 ? [{ reception_id: { $in: receptionIds } }] : []),
            { lot_number: { $regex: lotRegex } },
          ],
        })
        .sort({ created_at: -1 })
        .lean()
        .exec(),
    ) as CleaningCycleRow[],
    sanitizeDocument(
      await HydrationCycles()
        .find({
          $or: [
            ...(receptionIds.length > 0 ? [{ "lot_refs.reception_id": { $in: receptionIds } }] : []),
            { "lot_refs.lot_number": { $regex: lotRegex } },
          ],
        })
        .sort({ created_at: -1 })
        .lean()
        .exec(),
    ) as HydrationCycleRow[],
    sanitizeDocument(
      await TriageSessions()
        .find({
          $or: [
            ...(receptionIds.length > 0 ? [{ parent_reception_id: { $in: receptionIds } }] : []),
            { parent_lot_number: { $regex: lotRegex } },
          ],
        })
        .sort({ created_at: -1 })
        .lean()
        .exec(),
    ) as TriageSessionRow[],
    sanitizeDocument(
      await TriageSublots()
        .find({
          $or: [
            ...(receptionIds.length > 0 ? [{ parent_reception_id: { $in: receptionIds } }] : []),
            { parent_lot_number: { $regex: lotRegex } },
            { lot_number: { $regex: lotRegex } },
          ],
        })
        .sort({ created_at: -1 })
        .lean()
        .exec(),
    ) as TriageSubLotRow[],
  ]);

  const qcInspectionIds = uniqueStrings(qcInspections.map((row) => row.id));
  const triageSessionIds = uniqueStrings(triageSessions.map((row) => row.id));
  const subLotIds = uniqueStrings(subLots.map((row) => row.id));
  const subLotNumbers = uniqueStrings(subLots.map((row) => row.lot_number));

  const [qcCheckResults, triageQualityChecks, receptionStockMovements] = await Promise.all([
    qcInspectionIds.length > 0
      ? sanitizeDocument(
        await QcCheckResults()
          .find({ inspection_id: { $in: qcInspectionIds } })
          .sort({ checked_at: -1 })
          .lean()
          .exec(),
      ) as QcCheckResultRow[]
      : [],
    triageSessionIds.length > 0
      ? sanitizeDocument(
        await TriageQualityChecks()
          .find({ session_id: { $in: triageSessionIds } })
          .sort({ checked_at: -1 })
          .lean()
          .exec(),
      ) as TriageQualityCheckRow[]
      : [],
    sanitizeDocument(
      await ReceptionStockMovements()
        .find({
          $or: [
            ...(receptionIds.length > 0 ? [{ reception_id: { $in: receptionIds } }] : []),
            ...(receptionLotIds.length > 0 ? [{ reception_lot_id: { $in: receptionLotIds } }] : []),
          ],
        })
        .sort({ performed_at: -1 })
        .lean()
        .exec(),
    ) as ReceptionStockMovementRow[],
  ]);

  const stockLots = sortByDateDesc(
    sanitizeDocument(
      await StockLots()
        .find({
          $or: [
            ...(receptionIds.length > 0 ? [{ source_reception_id: { $in: receptionIds } }] : []),
            ...(receptionLotIds.length > 0 ? [{ reception_lot_id: { $in: receptionLotIds } }] : []),
            ...(subLotNumbers.length > 0 ? [{ source_lot_internal: { $in: subLotNumbers } }] : []),
            { lot_number: { $regex: lotRegex } },
            { source_lot_internal: { $regex: lotRegex } },
            { source_lot_supplier: { $regex: lotRegex } },
          ],
        })
        .lean()
        .exec(),
    ) as StockLotRow[],
    "created_at",
  );

  const stockLotIds = uniqueStrings(stockLots.map((row) => row.id));
  const stockMovements = stockLotIds.length > 0
    ? sortByDateDesc(
      sanitizeDocument(
        await StockMovements()
          .find({ lot_id: { $in: stockLotIds } })
          .sort({ movement_date: -1 })
          .lean()
          .exec(),
      ) as StockMovementRow[],
      "movement_date",
    )
    : [];

  const productionAllocations = sortByDateDesc(
    sanitizeDocument(
      await ProductionLotAllocations()
        .find({
          $or: [
            ...(receptionLotIds.length > 0 ? [{ reception_lot_id: { $in: receptionLotIds } }] : []),
            { "lot.lot_internal": { $regex: lotRegex } },
            { "lot.lot_supplier": { $regex: lotRegex } },
            { "lot.reception_number": { $regex: lotRegex } },
          ],
        })
        .lean()
        .exec(),
    ) as ProductionAllocationRow[],
    "allocated_at",
  );

  const productionOrderIds = uniqueStrings([
    outputLotExact?.production_order_id,
    ...productionAllocations.map((row) => row.production_order_id),
  ]);

  const productionOrders = sortByDateDesc(
    sanitizeDocument(
      await ProductionOrders()
        .find({
          $or: [
            ...(productionOrderIds.length > 0 ? [{ id: { $in: productionOrderIds } }] : []),
            ...(receptionIds.length > 0 ? [{ reception_id: { $in: receptionIds } }] : []),
          ],
        })
        .lean()
        .exec(),
    ) as ProductionOrderRow[],
    "created_at",
  );

  const finalProductionOrderIds = uniqueStrings(productionOrders.map((row) => row.id));
  const [productionSteps, outputLots] = await Promise.all([
    finalProductionOrderIds.length > 0
      ? sanitizeDocument(
        await ProductionSteps()
          .find({ production_order_id: { $in: finalProductionOrderIds } })
          .sort({ sequence_order: 1, started_at: -1 })
          .lean()
          .exec(),
      ) as ProductionStepRow[]
      : [],
    sortByDateDesc(
      sanitizeDocument(
        await ProductionOutputLots()
          .find({
            $or: [
              ...(finalProductionOrderIds.length > 0 ? [{ production_order_id: { $in: finalProductionOrderIds } }] : []),
              ...(receptionLotIds.length > 0 ? [{ parent_lot_ids: { $in: receptionLotIds } }] : []),
              { lot_pf_number: { $regex: lotRegex } },
              { "parent_lots_snapshot.lot_internal": { $regex: lotRegex } },
              { "parent_lots_snapshot.lot_supplier": { $regex: lotRegex } },
              ...(receptionNumbers.length > 0 ? [{ "parent_lots_snapshot.reception_number": { $in: receptionNumbers } }] : []),
            ],
          })
          .lean()
          .exec(),
      ) as ProductionOutputLotRow[],
      "recorded_at",
    ),
  ]);

  const productionStepIds = uniqueStrings(productionSteps.map((row) => row.id));
  const productionQualityChecks = productionStepIds.length > 0
    ? sanitizeDocument(
      await ProductionQualityChecks()
        .find({ production_step_id: { $in: productionStepIds } })
        .sort({ checked_at: -1, created_at: -1 })
        .lean()
        .exec(),
    ) as ProductionQualityCheckRow[]
    : [];

  const packagingOrders = sortByDateDesc(
    sanitizeDocument(
      await PackagingOrders()
        .find({
          $or: [
            ...(subLotIds.length > 0 ? [{ source_sublot_id: { $in: subLotIds } }] : []),
            ...(subLotNumbers.length > 0 ? [{ source_lot_number: { $in: subLotNumbers } }] : []),
            { source_lot_number: { $regex: lotRegex } },
          ],
        })
        .lean()
        .exec(),
    ) as PackagingOrderRow[],
    "created_at",
  );

  const packagingOrderIds = uniqueStrings(packagingOrders.map((row) => row.id));
  const packagingPalettes = packagingOrderIds.length > 0
    ? sortByDateDesc(
      sanitizeDocument(
        await PackagingPalettes()
          .find({ order_id: { $in: packagingOrderIds } })
          .lean()
          .exec(),
      ) as PackagingPaletteRow[],
      "created_at",
    )
    : [];

  const shipmentLines = stockLotIds.length > 0
    ? sortByDateDesc(
      sanitizeDocument(
        await ShipmentLines()
          .find({ lot_id: { $in: stockLotIds } })
          .lean()
          .exec(),
      ) as ShipmentLineRow[],
      "picked_at",
    )
    : [];

  const shipmentIds = uniqueStrings(shipmentLines.map((row) => row.shipment_id));
  const shipments = shipmentIds.length > 0
    ? sortByDateDesc(
      sanitizeDocument(
        await ShipmentPreparations()
          .find({ id: { $in: shipmentIds } })
          .lean()
          .exec(),
      ) as ShipmentPreparationRow[],
      "created_at",
    )
    : [];

  if (!reception && receptionIds.length > 0) {
    const receptionsByLots = sanitizeDocument(
      await Receptions()
        .find({ id: { $in: receptionIds } })
        .sort({ actual_arrival_date: -1 })
        .lean()
        .exec(),
    ) as ReceptionRow[];
    reception = pickLatestByDate(receptionsByLots, "actual_arrival_date");
  }

  const supplierIds = uniqueStrings([
    reception?.supplier_id,
    ...stockLots.map((row) => row.supplier_id),
  ]);
  const supplierMap = supplierIds.length > 0
    ? new Map(
      (
        sanitizeDocument(
          await Suppliers()
            .find({ id: { $in: supplierIds } })
            .select("id name")
            .lean()
            .exec(),
        ) as SupplierRow[]
      ).map((row) => [readString(row.id), row]),
    )
    : new Map<string, SupplierRow>();

  const auditEntityIds = uniqueStrings([
    normalizedLotNumber,
    reception?.id,
    ...receptionIds,
    ...receptionLotIds,
    ...qcInspectionIds,
    ...triageSessionIds,
    ...subLotIds,
    ...stockLotIds,
    ...stockMovements.map((row) => row.id),
    ...finalProductionOrderIds,
    ...productionStepIds,
    ...productionAllocations.map((row) => row.id),
    ...outputLots.map((row) => row.id),
    ...packagingOrderIds,
    ...packagingPalettes.map((row) => row.id),
    ...shipmentIds,
    ...shipmentLines.map((row) => row.id),
  ]);

  const auditLogs = sortByDateDesc(
    sanitizeDocument(
      await AuditLogs()
        .find({
          $or: [
            ...(auditEntityIds.length > 0 ? [{ entity_id: { $in: auditEntityIds } }] : []),
            ...(auditEntityIds.length > 0 ? [{ affected_ids: { $in: auditEntityIds } }] : []),
            { message: { $regex: lotRegex } },
            { action_label: { $regex: lotRegex } },
          ],
        })
        .limit(200)
        .lean()
        .exec(),
    ) as AuditLogRow[],
    "performed_at",
  );

  const businessTimeline: TraceabilityTimelineEvent[] = [];

  if (reception) {
    pushTimelineEvent(businessTimeline, {
      id: `reception-${readString(reception.id)}`,
      timestamp: readString(reception.actual_arrival_date, reception.created_at),
      stage: "RECEPTION",
      title: `Reception ${readString(reception.reception_number)}`,
      detail: `Statut ${readString(reception.status)}${readString(reception.qc_decision) ? ` · QC ${readString(reception.qc_decision)}` : ""}`,
      entity_type: "RECEPTION",
      entity_id: readString(reception.id) || null,
      severity: readString(reception.status).includes("REJ") ? "error" : "info",
      actor: null,
      document_number: readString(reception.reception_number) || null,
    });
  }

  receptionLots.forEach((row) => {
    pushTimelineEvent(businessTimeline, {
      id: `reception-lot-${readString(row.id)}`,
      timestamp: readString(row.created_at, row.harvest_date),
      stage: "RECEPTION",
      title: readString(row.lot_internal, row.lot_supplier, row.id),
      detail: `${readString(row.origin_country) || "Origine"}${readString(row.origin_region) ? ` / ${readString(row.origin_region)}` : ""} · ${readNullableNumber(row.quantity) ?? 0} ${readString(row.unit) || "kg"}`,
      entity_type: "RECEPTION_LOT",
      entity_id: readString(row.id) || null,
      severity: readString(row.stock_status).includes("REJ") ? "error" : "info",
      actor: null,
      document_number: readString(row.lot_internal, row.lot_supplier) || null,
    });
  });

  qcInspections.forEach((row) => {
    pushTimelineEvent(businessTimeline, {
      id: `qc-${readString(row.id)}`,
      timestamp: readString(row.ended_at, row.started_at, row.created_at),
      stage: "QUALITY",
      title: readString(row.inspection_number, row.id),
      detail: `${readString(row.decision) || "Inspection"}${readString(row.inspector_name) ? ` · ${readString(row.inspector_name)}` : ""}`,
      entity_type: "QC_INSPECTION",
      entity_id: readString(row.id) || null,
      severity: readString(row.decision).includes("REJ")
        ? "error"
        : readString(row.decision).includes("QUAR")
          ? "warning"
          : "success",
      actor: readString(row.inspector_name) || null,
      document_number: readString(row.inspection_number) || null,
    });
  });

  receptionStockMovements.forEach((row) => {
    pushTimelineEvent(businessTimeline, {
      id: `reception-movement-${readString(row.id)}`,
      timestamp: readString(row.performed_at, row.created_at),
      stage: "STOCK",
      title: readString(row.movement_number, row.movement_type, row.id),
      detail: `${readString(row.movement_type)} · ${readNullableNumber(row.quantity) ?? 0} ${readString(row.unit) || "kg"}`,
      entity_type: "RECEPTION_MOVEMENT",
      entity_id: readString(row.id) || null,
      severity: "info",
      actor: readString(row.performed_by) || null,
      document_number: readString(row.movement_number) || null,
    });
  });

  fumigationCycles.forEach((row) => {
    pushTimelineEvent(businessTimeline, {
      id: `fumigation-${readString(row.id)}`,
      timestamp: readString(row.t_end_real, row.t0_start, row.created_at),
      stage: "PHASE2",
      title: readString(row.cycle_number, row.id),
      detail: `Fumigation ${readString(row.protocol)} · ${readString(row.status)}`,
      entity_type: "FUMIGATION",
      entity_id: readString(row.id) || null,
      severity: readString(row.status).includes("ECHEC") ? "error" : "info",
      actor: readString(row.operator_name, row.quality_inspector_name) || null,
      document_number: readString(row.cycle_number) || null,
    });
  });

  cleaningCycles.forEach((row) => {
    pushTimelineEvent(businessTimeline, {
      id: `cleaning-${readString(row.id)}`,
      timestamp: readString(row.ended_at, row.started_at, row.created_at),
      stage: "PHASE2",
      title: readString(row.cycle_number, row.id),
      detail: `Nettoyage ${readString(row.program)} · ${readString(row.status)}`,
      entity_type: "CLEANING",
      entity_id: readString(row.id) || null,
      severity: readString(row.status).includes("INCIDENT") ? "warning" : "info",
      actor: readString(row.operator_name) || null,
      document_number: readString(row.cycle_number) || null,
    });
  });

  hydrationCycles.forEach((row) => {
    pushTimelineEvent(businessTimeline, {
      id: `hydration-${readString(row.id)}`,
      timestamp: readString(row.ended_at, row.created_at),
      stage: "PHASE2",
      title: readString(row.cycle_number, row.id),
      detail: `Hydratation ${readString(row.program_applied)} · ${readString(row.status)}`,
      entity_type: "HYDRATION",
      entity_id: readString(row.id) || null,
      severity: readString(row.conformity) === "ROUGE" ? "error" : readString(row.conformity) === "JAUNE" ? "warning" : "info",
      actor: readString(row.operator_name, row.inspector_name) || null,
      document_number: readString(row.cycle_number) || null,
    });
  });

  triageSessions.forEach((row) => {
    pushTimelineEvent(businessTimeline, {
      id: `triage-${readString(row.id)}`,
      timestamp: readString(row.ended_at, row.started_at, row.created_at),
      stage: "PHASE2",
      title: readString(row.session_number, row.id),
      detail: `Triage ${readString(row.line)} · ${readString(row.status)}`,
      entity_type: "TRIAGE",
      entity_id: readString(row.id) || null,
      severity: (readNullableNumber(row.reject_percent) ?? 0) > 10 ? "warning" : "info",
      actor: readString(row.chef_ligne, row.created_by) || null,
      document_number: readString(row.session_number) || null,
    });
  });

  subLots.forEach((row) => {
    pushTimelineEvent(businessTimeline, {
      id: `sub-lot-${readString(row.id)}`,
      timestamp: readString(row.created_at),
      stage: "PHASE2",
      title: readString(row.lot_number, row.id),
      detail: `${readString(row.grade)} · ${readNullableNumber(row.weight_kg) ?? 0} kg · ${readString(row.destination)}`,
      entity_type: "SUB_LOT",
      entity_id: readString(row.id) || null,
      severity: readString(row.destination) === "DESTRUCTION" ? "warning" : "success",
      actor: null,
      document_number: readString(row.lot_number) || null,
    });
  });

  stockLots.forEach((row) => {
    pushTimelineEvent(businessTimeline, {
      id: `stock-lot-${readString(row.id)}`,
      timestamp: readString(row.packaging_date, row.transformation_date, row.created_at),
      stage: "STOCK",
      title: readString(row.lot_number, row.id),
      detail: `${readString(row.source_stage) || "STOCK"} · ${readString(row.status)} · ${readNullableNumber(row.current_quantity) ?? 0} ${readString(row.unit) || "kg"}`,
      entity_type: "STOCK_LOT",
      entity_id: readString(row.id) || null,
      severity: readString(row.status).includes("BLOCK") ? "error" : "info",
      actor: readString(row.created_by, row.qc_validated_by) || null,
      document_number: readString(row.lot_number) || null,
    });
  });

  stockMovements.forEach((row) => {
    pushTimelineEvent(businessTimeline, {
      id: `stock-movement-${readString(row.id)}`,
      timestamp: readString(row.movement_date, row.created_at),
      stage: "STOCK",
      title: readString(row.movement_number, row.id),
      detail: `${readString(row.movement_type)} · ${readNullableNumber(row.quantity) ?? 0} ${readString(row.unit) || "kg"}${readString(row.document_reference) ? ` · ${readString(row.document_reference)}` : ""}`,
      entity_type: "STOCK_MOVEMENT",
      entity_id: readString(row.id) || null,
      severity: readString(row.movement_type) === "EXPEDITION" ? "success" : "info",
      actor: readString(row.performed_by, row.validated_by) || null,
      document_number: readString(row.document_reference, row.movement_number) || null,
    });
  });

  productionOrders.forEach((row) => {
    pushTimelineEvent(businessTimeline, {
      id: `production-order-${readString(row.id)}`,
      timestamp: readString(row.actual_end_date, row.actual_start_date, row.created_at),
      stage: "PRODUCTION",
      title: readString(row.order_number, row.id),
      detail: `${readString(row.product_name)} · ${readString(row.status)}`,
      entity_type: "PRODUCTION_ORDER",
      entity_id: readString(row.id) || null,
      severity: readString(row.status).includes("cancel") ? "warning" : "info",
      actor: readString(row.created_by) || null,
      document_number: readString(row.order_number) || null,
    });
  });

  productionSteps.forEach((row) => {
    pushTimelineEvent(businessTimeline, {
      id: `production-step-${readString(row.id)}`,
      timestamp: readString(row.completed_at, row.started_at, row.created_at),
      stage: "PRODUCTION",
      title: `Etape ${readNullableNumber(row.sequence_order) ?? 0}`,
      detail: `${readString(row.status)}${readString(row.operator_name) ? ` · ${readString(row.operator_name)}` : ""}`,
      entity_type: "PRODUCTION_STEP",
      entity_id: readString(row.id) || null,
      severity: readString(row.status) === "failed" ? "error" : "info",
      actor: readString(row.operator_name) || null,
      document_number: null,
    });
  });

  outputLots.forEach((row) => {
    pushTimelineEvent(businessTimeline, {
      id: `output-lot-${readString(row.id)}`,
      timestamp: readString(row.recorded_at, row.created_at),
      stage: "PRODUCTION",
      title: readString(row.lot_pf_number, row.id),
      detail: `Lot PF · ${readNullableNumber(row.quantity) ?? 0} ${readString(row.unit) || "kg"}`,
      entity_type: "OUTPUT_LOT",
      entity_id: readString(row.id) || null,
      severity: "success",
      actor: readString(row.recorded_by) || null,
      document_number: readString(row.lot_pf_number) || null,
    });
  });

  packagingOrders.forEach((row) => {
    pushTimelineEvent(businessTimeline, {
      id: `packaging-order-${readString(row.id)}`,
      timestamp: readString(row.ended_at, row.started_at, row.created_at),
      stage: "PACKAGING",
      title: readString(row.order_number, row.id),
      detail: `${readString(row.status)} · ${readString(row.bom_name, row.grade)}`,
      entity_type: "PACKAGING_ORDER",
      entity_id: readString(row.id) || null,
      severity: readString(row.status) === "ANNULE" ? "warning" : "info",
      actor: readString(row.created_by) || null,
      document_number: readString(row.order_number) || null,
    });
  });

  packagingPalettes.forEach((row) => {
    pushTimelineEvent(businessTimeline, {
      id: `packaging-palette-${readString(row.id)}`,
      timestamp: readString(row.sealed_at, row.created_at),
      stage: "PACKAGING",
      title: readString(row.palette_number, row.sscc, row.id),
      detail: `${readString(row.status)} · ${readNullableNumber(row.net_weight_kg) ?? 0} kg`,
      entity_type: "PACKAGING_PALETTE",
      entity_id: readString(row.id) || null,
      severity: readString(row.status) === "SCELLE" ? "success" : "info",
      actor: readString(row.sealed_by) || null,
      document_number: readString(row.sscc, row.palette_number) || null,
    });
  });

  shipments.forEach((row) => {
    pushTimelineEvent(businessTimeline, {
      id: `shipment-${readString(row.id)}`,
      timestamp: readString(row.shipped_at, row.prepared_at, row.created_at),
      stage: "SHIPMENT",
      title: readString(row.shipment_number, row.id),
      detail: `${readString(row.status)}${readString(row.customer_name) ? ` · ${readString(row.customer_name)}` : ""}`,
      entity_type: "SHIPMENT",
      entity_id: readString(row.id) || null,
      severity: readString(row.status) === "SHIPPED" ? "success" : "info",
      actor: readString(row.validated_by, row.prepared_by) || null,
      document_number: readString(row.shipment_number) || null,
    });
  });

  auditLogs.forEach((row) => {
    pushTimelineEvent(businessTimeline, {
      id: `audit-${readString(row.id)}`,
      timestamp: readString(row.performed_at, row.created_at),
      stage: "AUDIT",
      title: buildAuditLabel(row),
      detail: readString(row.action, row.event_type, row.table),
      entity_type: readString(row.entity_type, row.table) || "AUDIT",
      entity_id: readString(row.entity_id) || null,
      severity: readString(row.event_type).includes("FAIL") || readString(row.action).includes("REJECT") ? "warning" : "info",
      actor: buildAuditActor(row),
      document_number: null,
    });
  });

  const timeline = [...businessTimeline].sort((a, b) => {
    const left = new Date(a.timestamp).getTime() || 0;
    const right = new Date(b.timestamp).getTime() || 0;
    return left - right;
  });

  const customerNames = uniqueStrings(shipments.map((row) => row.customer_name));
  const shipmentNumbers = uniqueStrings(shipments.map((row) => row.shipment_number));
  const productionOrderNumbers = uniqueStrings(productionOrders.map((row) => row.order_number));
  const packagingOrderNumbers = uniqueStrings(packagingOrders.map((row) => row.order_number));
  const documentReferences = uniqueStrings([
    reception?.delivery_note_number,
    ...stockMovements.map((row) => row.document_reference),
    ...shipmentNumbers,
  ]);

  const controlPoints = [
    buildControlPoint(
      "RECEPTION_METADATA",
      "Reception metadata",
      receptionLots.some((row) => readString(row.origin_country, row.origin_region, row.origin_farm, row.lot_supplier))
        ? "ok"
        : "missing",
      receptionLots.some((row) => readString(row.origin_country, row.origin_region, row.origin_farm, row.lot_supplier))
        ? "Origine, lot fournisseur ou ferme renseignes."
        : "Origine amont incomplete sur le lot de reception.",
    ),
    buildControlPoint(
      "INBOUND_QC",
      "Inbound quality release",
      qcInspections.length > 0
        ? (qcInspections.some((row) => readString(row.decision).includes("REJ")) ? "warning" : "ok")
        : "missing",
      qcInspections.length > 0
        ? `${qcInspections.length} inspection(s) QC rattachee(s).`
        : "Aucune inspection QC retrouvee pour ce lot.",
    ),
    buildControlPoint(
      "GENEALOGY",
      "Genealogy continuity",
      (subLots.length > 0 || productionAllocations.length > 0 || outputLots.length > 0 || stockLots.length > 0)
        ? "ok"
        : "warning",
      (subLots.length > 0 || productionAllocations.length > 0 || outputLots.length > 0 || stockLots.length > 0)
        ? "Le lot est relie a des descendants ou a des consommations internes."
        : "Aucune transformation ou descendance detectee; lot limite a la reception/stock.",
    ),
    buildControlPoint(
      "DELIVERY",
      "Delivery linkage",
      shipments.length > 0 || shipmentLines.length > 0
        ? "ok"
        : "warning",
      shipments.length > 0 || shipmentLines.length > 0
        ? `${shipmentNumbers.length} expedition(s) retrouvee(s).`
        : "Aucune expedition client retrouvee pour ce lot.",
    ),
    buildControlPoint(
      "AUDIT",
      "Immutable audit trail",
      auditLogs.length > 0 ? "ok" : "warning",
      auditLogs.length > 0
        ? `${auditLogs.length} evenement(s) d'audit relies au lot et a sa genealogie.`
        : "Aucun audit applicatif directement relie a ce lot.",
    ),
  ];

  const missingData = controlPoints
    .filter((point) => point.status !== "ok")
    .map((point) => point.detail);

  const matchEntityType = receptionExact
    ? "RECEPTION"
    : receptionLotExact
      ? "RECEPTION_LOT"
      : stockLotExact
        ? "STOCK_LOT"
        : subLotExact
          ? "TRIAGE_SUBLOT"
          : outputLotExact
            ? "OUTPUT_LOT"
            : receptionFuzzy
              ? "RECEPTION"
              : receptionLotsDirect[0]
                ? "RECEPTION_LOT"
                : stockLotsDirect[0]
                  ? "STOCK_LOT"
                  : subLotsDirect[0]
                    ? "TRIAGE_SUBLOT"
                    : outputLotsDirect[0]
                      ? "OUTPUT_LOT"
                      : "UNKNOWN";

  const matchedRow =
    receptionExact
    || receptionLotExact
    || stockLotExact
    || subLotExact
    || outputLotExact
    || receptionFuzzy
    || receptionLotsDirect[0]
    || stockLotsDirect[0]
    || subLotsDirect[0]
    || outputLotsDirect[0]
    || null;

  const enrichedReception = reception
    ? {
      ...reception,
      supplier_name:
        readString(reception.supplier_name_snapshot)
        || readString(supplierMap.get(readString(reception.supplier_id))?.name)
        || null,
      quantity_total: readNullableNumber(reception.quantity_total),
    }
    : null;

  return {
    lot_number: normalizedLotNumber,
    match: {
      query: normalizedLotNumber,
      entity_type: matchEntityType,
      entity_id: readString(matchedRow?.id) || null,
      matched_reference: readString(
        (matchedRow as any)?.lot_number,
        (matchedRow as any)?.lot_internal,
        (matchedRow as any)?.lot_pf_number,
        (matchedRow as any)?.reception_number,
        (matchedRow as any)?.shipment_number,
        normalizedLotNumber,
      ) || normalizedLotNumber,
      canonical_lot_number: readString(
        stockLotExact?.lot_number,
        subLotExact?.lot_number,
        outputLotExact?.lot_pf_number,
        receptionLotExact?.lot_internal,
        receptionLotExact?.lot_supplier,
        reception?.reception_number,
        normalizedLotNumber,
      ) || normalizedLotNumber,
    },
    reception: enrichedReception,
    reception_lots: receptionLots,
    qc_inspections: qcInspections,
    qc_check_results: qcCheckResults,
    reception_stock_movements: receptionStockMovements,
    fumigation_cycles: fumigationCycles,
    cleaning_cycles: cleaningCycles,
    hydration_cycles: hydrationCycles,
    triage_sessions: triageSessions,
    triage_quality_checks: triageQualityChecks,
    sub_lots: subLots,
    stock_lots: stockLots,
    stock_movements: stockMovements,
    production_orders: productionOrders,
    production_steps: productionSteps,
    production_quality_checks: productionQualityChecks,
    production_allocations: productionAllocations,
    output_lots: outputLots,
    packaging_orders: packagingOrders,
    packaging_palettes: packagingPalettes,
    shipments,
    shipment_lines: shipmentLines,
    audit_logs: auditLogs,
    timeline,
    controls: {
      immutable_collections: ["stock_movements", "system_audit_logs"],
      business_event_count: businessTimeline.length,
      audit_log_count: auditLogs.length,
      missing_data: missingData,
      control_points: controlPoints,
    },
    integration_summary: {
      purchase_order_id: readString(reception?.purchase_order_id) || null,
      delivery_note_number: readString(reception?.delivery_note_number) || null,
      production_order_numbers: productionOrderNumbers,
      packaging_order_numbers: packagingOrderNumbers,
      shipment_numbers: shipmentNumbers,
      customer_names: customerNames,
      document_references: documentReferences,
      erp_sync_ready: Boolean(readString(reception?.purchase_order_id, reception?.delivery_note_number)),
      mes_sync_ready: businessTimeline.some((event) => event.stage === "PHASE2" || event.stage === "PRODUCTION" || event.stage === "PACKAGING"),
      scm_sync_ready: shipments.length > 0 || stockMovements.some((row) => readString(row.movement_type) === "EXPEDITION"),
    },
    lineage: {
      inbound_lot_numbers: uniqueStrings([
        ...receptionLots.map((row) => row.lot_internal),
        ...receptionLots.map((row) => row.lot_supplier),
      ]),
      sub_lot_numbers: subLotNumbers,
      finished_good_lot_numbers: uniqueStrings([
        ...outputLots.map((row) => row.lot_pf_number),
        ...stockLots
          .filter((row) => readString(row.source_stage) === "PACKAGING")
          .map((row) => row.lot_number),
      ]),
      shipment_numbers: shipmentNumbers,
    },
  };
}
