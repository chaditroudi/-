import { Injectable } from "@nestjs/common";

import { getCollectionModel, sanitizeDocument } from "../../db/dynamic-model.js";

type FounderAnalyticsPeriod = "today" | "week" | "month" | "quarter";

type PurchaseOrderStatus =
  | "draft"
  | "submitted"
  | "confirmed"
  | "partially_delivered"
  | "delivered"
  | "invoiced"
  | "cancelled"
  | "on_hold";

type PurchaseOrderLineRow = Record<string, unknown> & {
  id?: string;
  order_id?: string | null;
  quantity?: number | null;
  confirmed_quantity?: number | null;
  received_quantity?: number | null;
  accepted_quantity?: number | null;
  rejected_quantity?: number | null;
  invoiced_quantity?: number | null;
  over_delivery_tolerance_pct?: number | null;
  under_delivery_tolerance_pct?: number | null;
  line_status?: string | null;
  notes?: string | null;
};

type PurchaseOrderRow = Record<string, unknown> & {
  id?: string;
  status?: string | null;
  total_amount?: number | null;
  notes?: string | null;
  approved_by?: string | null;
};

type ThreeWayMatchMeta = {
  matched?: boolean;
};

type FindOptions = {
  filter?: Record<string, unknown>;
  select?: string;
  sort?: Record<string, 1 | -1>;
  limit?: number;
};

const META_START = "[SAGE_META]";
const META_END = "[/SAGE_META]";
const PURCHASE_ORDER_APPROVAL_THRESHOLD = 5000;

const LEGACY_STATUS_MAP: Record<string, PurchaseOrderStatus> = {
  sent: "submitted",
  partially_received: "partially_delivered",
  received: "delivered",
};

const PHASE2_INPUT_COLLECTIONS = [
  "fumigation_cycles",
  "cleaning_cycles",
  "hydration_cycles",
  "triage_sessions",
] as const;

const PACKAGING_LINES = ["L-PKG-1", "L-PKG-2", "L-PKG-3"];

const COMPLETED_STATUS = "TERMINE";
const ACTIVE_STATUS = "EN_COURS";

const readNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const readString = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
};

const roundQuantity = (value: number, precision = 3) => {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
};

const startOfToday = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

const startOfMonthLocal = (date = new Date()) => new Date(date.getFullYear(), date.getMonth(), 1);

const shiftDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const shiftMonths = (date: Date, months: number) => {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
};

const toLocalDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const toChartDate = (date: Date) => {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}`;
};

const buildLastThirtyDays = () => {
  const today = startOfToday();
  return Array.from({ length: 30 }, (_, index) => shiftDays(today, index - 29));
};

const sumBy = (rows: Array<Record<string, unknown>>, ...keys: string[]) =>
  rows.reduce((sum, row) => sum + readNumber(keys.map((key) => row[key]).find((value) => value != null), 0), 0);

const normalizePurchaseOrderStatus = (status?: string | null): PurchaseOrderStatus => {
  if (!status) return "draft";

  if (status in LEGACY_STATUS_MAP) {
    return LEGACY_STATUS_MAP[status];
  }

  switch (status) {
    case "draft":
    case "submitted":
    case "confirmed":
    case "partially_delivered":
    case "delivered":
    case "invoiced":
    case "cancelled":
    case "on_hold":
      return status;
    default:
      return "draft";
  }
};

const normalizePurchaseOrderInvoiceStatus = (status?: string | null) => {
  switch (status) {
    case "partially_invoiced":
    case "invoiced":
    case "blocked":
      return status;
    default:
      return "not_invoiced";
  }
};

const normalizePurchaseOrderLineStatus = (status?: string | null) => {
  switch (status) {
    case "partially_delivered":
    case "delivered":
    case "closed":
    case "discrepancy":
    case "cancelled":
      return status;
    default:
      return "open";
  }
};

const getPurchaseOrderLineTargetQuantity = (line: Partial<PurchaseOrderLineRow>) =>
  roundQuantity(readNumber(line.confirmed_quantity ?? line.quantity));

const computePurchaseOrderLineStatus = (line: Partial<PurchaseOrderLineRow>) => {
  const explicitStatus = normalizePurchaseOrderLineStatus(String(line.line_status || "open"));
  if (explicitStatus === "cancelled") return explicitStatus;

  const targetQuantity = getPurchaseOrderLineTargetQuantity(line);
  const receivedQuantity = roundQuantity(readNumber(line.received_quantity));
  const acceptedQuantity = roundQuantity(readNumber(line.accepted_quantity));
  const rejectedQuantity = roundQuantity(readNumber(line.rejected_quantity));
  const invoicedQuantity = roundQuantity(readNumber(line.invoiced_quantity));

  if (acceptedQuantity + rejectedQuantity > receivedQuantity + 0.0001) {
    return "discrepancy";
  }

  if (targetQuantity > 0 && invoicedQuantity >= targetQuantity && acceptedQuantity + rejectedQuantity >= targetQuantity) {
    return "closed";
  }

  if (receivedQuantity <= 0) return "open";
  if (receivedQuantity + 0.0001 < targetQuantity) return "partially_delivered";
  return "delivered";
};

const deriveReceiptStatusFromLines = (lines: PurchaseOrderLineRow[]) => {
  if (lines.length === 0) return "not_received" as const;

  const hasReceipts = lines.some((line) => readNumber(line.received_quantity) > 0);
  if (!hasReceipts) return "not_received" as const;

  const hasToleranceReceipt = lines.some(
    (line) => readNumber(line.received_quantity) > getPurchaseOrderLineTargetQuantity(line) + 0.0001,
  );
  const allDelivered = lines.every((line) => {
    const lineStatus = computePurchaseOrderLineStatus(line);
    return lineStatus === "delivered" || lineStatus === "closed";
  });

  if (allDelivered) {
    return hasToleranceReceipt ? ("delivered_with_tolerance" as const) : ("delivered" as const);
  }

  return "partially_delivered" as const;
};

const normalizePurchaseOrder = (order: PurchaseOrderRow, lines: PurchaseOrderLineRow[]) => {
  const receiptStatus = deriveReceiptStatusFromLines(lines);
  const invoiceStatus = normalizePurchaseOrderInvoiceStatus(String(order.invoice_status || ""));
  const explicitStatus = normalizePurchaseOrderStatus(String(order.status || ""));

  let status = explicitStatus;
  if (status !== "cancelled") {
    if (invoiceStatus === "invoiced" && (receiptStatus === "delivered" || receiptStatus === "delivered_with_tolerance")) {
      status = "invoiced";
    } else if (String(order.receipt_status || "") === "discrepancy") {
      status = "on_hold";
    } else if (receiptStatus === "delivered" || receiptStatus === "delivered_with_tolerance") {
      status = "delivered";
    } else if (receiptStatus === "partially_delivered") {
      status = "partially_delivered";
    }
  }

  return {
    ...order,
    status,
  };
};

const parseThreeWayMatch = (notes: string | null | undefined): ThreeWayMatchMeta | null => {
  if (!notes) return null;

  const start = notes.indexOf(META_START);
  const end = notes.indexOf(META_END);
  if (start === -1 || end === -1 || end < start) return null;

  try {
    const raw = notes.slice(start + META_START.length, end);
    const parsed = JSON.parse(raw) as { threeWayMatch?: ThreeWayMatchMeta };
    return parsed.threeWayMatch || null;
  } catch {
    return null;
  }
};

const hasReceptionTrace = (lineNotes: string | null | undefined) => {
  if (!lineNotes) return false;
  return lineNotes.includes("RECEPTION:") && lineNotes.includes("LOT:");
};

const normalizePeriod = (period?: string): FounderAnalyticsPeriod => {
  switch (period) {
    case "today":
    case "week":
    case "month":
    case "quarter":
      return period;
    default:
      return "month";
  }
};

const periodStart = (period: FounderAnalyticsPeriod) => {
  const now = new Date();
  if (period === "today") return startOfToday();
  if (period === "week") return shiftDays(now, -7);
  if (period === "quarter") return shiftMonths(startOfMonthLocal(now), -3);
  return startOfMonthLocal(now);
};

const matchesDatePrefix = (value: unknown, dateKey: string) => readString(value).startsWith(dateKey);

const normalizeNotificationSeverity = (value: unknown) => {
  const raw = readString(value).toUpperCase();
  if (raw === "URGENT" || raw === "URGENCE") return "URGENCE";
  if (raw === "CRITICAL" || raw === "CRITIQUE") return "CRITIQUE";
  if (raw === "WARNING" || raw === "WARN" || raw === "AVERTISSEMENT") return "AVERTISSEMENT";
  return "INFO";
};

const normalizeNotificationStatus = (value: unknown) => {
  const raw = readString(value).toUpperCase();
  if (raw === "ACKNOWLEDGED") return "ACKNOWLEDGED";
  if (raw === "RESOLVED") return "RESOLVED";
  return "ACTIVE";
};

const readLotQuantityKg = (row: Record<string, unknown>) =>
  readNumber(row.quantity_kg ?? row.current_quantity ?? row.quantity ?? row.initial_quantity);

const readMovementQuantityKg = (row: Record<string, unknown>) =>
  readNumber(row.quantity_kg ?? row.quantity ?? row.current_quantity);

const readMovementType = (row: Record<string, unknown>) =>
  readString(row.type, row.movement_type).toUpperCase();

const readMovementDate = (row: Record<string, unknown>) =>
  readString(row.created_at, row.movement_date, row.updated_at);

const readZoneCurrentKg = (row: Record<string, unknown>) =>
  readNumber(row.current_weight_kg ?? row.current_load_kg ?? row.occupied_kg);

const readZoneTemperature = (row: Record<string, unknown>) =>
  readNumber(
    row.temperature_celsius
      ?? row.current_temperature_c
      ?? row.temperature_c
      ?? row.current_temperature,
    Number.NaN,
  );

const readZoneHumidity = (row: Record<string, unknown>) =>
  readNumber(
    row.humidity_pct
      ?? row.current_humidity_percent
      ?? row.humidity_percent
      ?? row.current_humidity,
    Number.NaN,
  );

const readReadingTemperature = (row: Record<string, unknown>) =>
  readNumber(row.temperature_celsius ?? row.temperature_c, Number.NaN);

const readReadingHumidity = (row: Record<string, unknown>) =>
  readNumber(row.humidity_pct ?? row.humidity_percent, Number.NaN);

const avgBy = (rows: Array<Record<string, unknown>>, key: string) => {
  const values = rows
    .map((row) => readNumber(row[key], Number.NaN))
    .filter((value) => Number.isFinite(value) && value > 0);
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
};

const yieldOf = (rows: Array<Record<string, unknown>>) => {
  const totalIn = rows.reduce((sum, row) => sum + readNumber(row.weight_in_kg), 0);
  const totalOut = rows.reduce((sum, row) => sum + readNumber(row.weight_out_kg), 0);
  return totalIn > 0 ? (totalOut / totalIn) * 100 : 0;
};

const normalizeRows = (rows: unknown) =>
  (Array.isArray(rows) ? rows : []) as Array<Record<string, unknown>>;

const safeFind = async (
  collection: string,
  {
    filter = {},
    select,
    sort,
    limit,
  }: FindOptions = {},
) => {
  try {
    const Model = getCollectionModel(collection);
    let query = Model.find(filter).lean();
    if (select) query = query.select(select);
    if (sort) query = query.sort(sort);
    if (typeof limit === "number") query = query.limit(limit);
    return sanitizeDocument(await query.exec()) as Array<Record<string, unknown>>;
  } catch (error) {
    console.warn(`[analytics] ${collection} query failed:`, error);
    return [];
  }
};

const safeFindByDate = (
  collection: string,
  dateField: string,
  startIso: string,
  select?: string,
  extraFilter: Record<string, unknown> = {},
) =>
  safeFind(collection, {
    filter: {
      ...extraFilter,
      [dateField]: { $gte: startIso },
    },
    select,
  });

@Injectable()
export class AnalyticsService {
  private async getSuppliersMapByIds(ids: string[]) {
    const supplierIds = Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));
    if (supplierIds.length === 0) return new Map<string, Record<string, unknown>>();

    const suppliers = await safeFind("suppliers", {
      filter: { id: { $in: supplierIds } },
      select: "id name code",
    });

    return new Map(suppliers.map((supplier) => [String(supplier.id), supplier]));
  }

  async getSageOperations() {
    const [
      requisitions,
      orders,
      orderLines,
      receptions,
      receptionLots,
      productionOrders,
      stockLots,
    ] = await Promise.all([
      safeFind("purchase_requisitions", {
        select: "id status estimated_cost",
      }),
      safeFind("purchase_orders", {
        select: "id order_number status total_amount approved_by notes created_at invoice_status receipt_status",
      }),
      safeFind("purchase_order_lines", {
        select: "id order_id quantity confirmed_quantity received_quantity accepted_quantity rejected_quantity invoiced_quantity line_status notes",
      }),
      safeFind("receptions_v2", {
        select: "id status qc_decision created_at",
      }),
      safeFind("reception_lots", {
        select: "id stock_status",
      }),
      safeFind("production_orders", {
        select: "id status",
      }),
      safeFind("stock_lots", {
        select: "id status current_quantity",
      }),
    ]);

    const orderRows = orders as PurchaseOrderRow[];
    const orderLineRows = orderLines as PurchaseOrderLineRow[];

    const linesByOrderId = new Map<string, PurchaseOrderLineRow[]>();
    for (const line of orderLineRows) {
      const orderId = String(line.order_id || "");
      if (!orderId) continue;
      const current = linesByOrderId.get(orderId) || [];
      current.push(line);
      linesByOrderId.set(orderId, current);
    }

    const pendingDa = requisitions.filter((row) => row.status === "pending_approval").length;

    const poPendingInternalApproval = orderRows.filter((row) =>
      row.status === "draft" && readNumber(row.total_amount) >= PURCHASE_ORDER_APPROVAL_THRESHOLD && !row.approved_by,
    ).length;

    const poReadyToSend = orderRows.filter((row) =>
      row.status === "draft" && (readNumber(row.total_amount) < PURCHASE_ORDER_APPROVAL_THRESHOLD || Boolean(row.approved_by)),
    ).length;

    const normalizedOrders = orderRows.map((row) => normalizePurchaseOrder(row, linesByOrderId.get(String(row.id || "")) || []));

    const poSubmitted = normalizedOrders.filter((row) => row.status === "submitted").length;
    const poConfirmed = normalizedOrders.filter((row) => row.status === "confirmed").length;
    const poPartiallyDelivered = normalizedOrders.filter((row) => row.status === "partially_delivered").length;
    const poDelivered = normalizedOrders.filter((row) => row.status === "delivered").length;

    const receptionsWaitingQc = receptions.filter(
      (row) => row.status === "EN_ATTENTE_QC" || row.status === "EN_QC",
    ).length;
    const receptionsBlocked = receptions.filter((row) => row.status === "BLOQUE").length;

    const quarantineLots = receptionLots.filter((row) => row.stock_status === "EN_QUARANTAINE").length;
    const rejectedLots = receptionLots.filter((row) => row.stock_status === "STOCK_REJETE").length;

    const productionInProgress = productionOrders.filter((row) => row.status === "in_progress").length;
    const productionDelayed = productionOrders.filter((row) => row.status === "planned").length;

    const quarantinedStockLots = stockLots.filter((row) => row.status === "QUARANTINE").length;

    const linesWithReceipt = orderLineRows.filter((row) => readNumber(row.received_quantity) > 0);
    const linesWithLotTrace = linesWithReceipt.filter((row) => hasReceptionTrace(String(row.notes || "")));
    const traceabilityCoverage = linesWithReceipt.length > 0
      ? Math.round((linesWithLotTrace.length / linesWithReceipt.length) * 100)
      : 100;

    const threeWayOrders = normalizedOrders
      .map((row) => parseThreeWayMatch(String(row.notes || "")))
      .filter((meta): meta is ThreeWayMatchMeta => Boolean(meta));
    const threeWayMatched = threeWayOrders.filter((meta) => meta.matched).length;
    const threeWayMismatch = threeWayOrders.filter((meta) => meta.matched === false).length;
    const threeWayCoverage = normalizedOrders.length > 0
      ? Math.round((threeWayOrders.length / normalizedOrders.length) * 100)
      : 0;

    return {
      flow: {
        pendingDa,
        poPendingInternalApproval,
        poReadyToSend,
        poSubmitted,
        poConfirmed,
        poPartiallyDelivered,
        poDelivered,
        receptionsWaitingQc,
        receptionsBlocked,
        quarantineLots,
        rejectedLots,
        productionInProgress,
        productionDelayed,
        quarantinedStockLots,
      },
      compliance: {
        traceabilityCoverage,
        threeWayCoverage,
        threeWayMatched,
        threeWayMismatch,
      },
      blockers: [
        {
          key: "approval",
          label: "BC en attente validation interne",
          count: poPendingInternalApproval,
          tab: "purchasing",
          severity: poPendingInternalApproval > 0 ? "high" : "low",
        },
        {
          key: "qc",
          label: "Réceptions en attente QC",
          count: receptionsWaitingQc,
          tab: "receptions",
          severity: receptionsWaitingQc > 0 ? "high" : "low",
        },
        {
          key: "3way",
          label: "Écarts 3-way match",
          count: threeWayMismatch,
          tab: "purchasing",
          severity: threeWayMismatch > 0 ? "high" : "low",
        },
        {
          key: "quarantine",
          label: "Lots en quarantaine",
          count: quarantineLots + quarantinedStockLots,
          tab: "stock-lots",
          severity: quarantineLots + quarantinedStockLots > 0 ? "medium" : "low",
        },
      ],
      last_updated_at: new Date().toISOString(),
    };
  }

  async getFounderLiveFactory() {
    const todayKey = toLocalDateKey(new Date());

    const [
      fumActive,
      netActive,
      hydActive,
      triActive,
      pkgActive,
      alerts,
      fumToday,
      netToday,
      hydToday,
      triToday,
      pkgToday,
      receptions,
    ] = await Promise.all([
      safeFind("fumigation_cycles", {
        filter: { status: ACTIVE_STATUS },
        select: "id cycle_number lot_number started_at",
      }),
      safeFind("cleaning_cycles", {
        filter: { status: ACTIVE_STATUS },
        select: "id cycle_number lot_number started_at",
      }),
      safeFind("hydration_cycles", {
        filter: { status: ACTIVE_STATUS },
        select: "id cycle_number lot_number started_at",
      }),
      safeFind("triage_sessions", {
        filter: { status: ACTIVE_STATUS },
        select: "id session_number lot_number started_at",
      }),
      safeFind("packaging_orders", {
        filter: { status: ACTIVE_STATUS },
        select: "id order_number line produced_units target_units started_at",
      }),
      safeFind("system_notifications", {
        filter: { status: { $in: ["ACTIVE", "active"] } },
        select: "id severity status created_at",
      }),
      safeFindByDate("fumigation_cycles", "started_at", todayKey, "weight_in_kg weight_out_kg", { status: COMPLETED_STATUS }),
      safeFindByDate("cleaning_cycles", "started_at", todayKey, "weight_in_kg weight_out_kg", { status: COMPLETED_STATUS }),
      safeFindByDate("hydration_cycles", "started_at", todayKey, "weight_in_kg weight_out_kg", { status: COMPLETED_STATUS }),
      safeFindByDate("triage_sessions", "started_at", todayKey, "weight_in_kg weight_out_kg", { status: COMPLETED_STATUS }),
      safeFindByDate("packaging_orders", "started_at", todayKey, "produced_units yield_pct target_units", { status: COMPLETED_STATUS }),
      safeFindByDate("receptions_v2", "created_at", todayKey, "id status quantity_total qc_decision"),
    ]);

    const fumIn = sumBy(fumToday, "weight_in_kg");
    const fumOut = sumBy(fumToday, "weight_out_kg");
    const netIn = sumBy(netToday, "weight_in_kg");
    const netOut = sumBy(netToday, "weight_out_kg");
    const hydIn = sumBy(hydToday, "weight_in_kg");
    const hydOut = sumBy(hydToday, "weight_out_kg");
    const triIn = sumBy(triToday, "weight_in_kg");
    const triOut = sumBy(triToday, "weight_out_kg");
    const pkgUnits = sumBy(pkgToday, "produced_units");

    const alertList = alerts.map((alert) => ({
      ...alert,
      severity: normalizeNotificationSeverity(alert.severity),
      status: normalizeNotificationStatus(alert.status),
    }));

    const ratios = [
      fumIn > 0 ? fumOut / fumIn : 0,
      netIn > 0 ? netOut / netIn : 0,
      hydIn > 0 ? hydOut / hydIn : 0,
      triIn > 0 ? triOut / triIn : 0,
    ].filter(Boolean);

    return {
      active: {
        fumigation: fumActive.length,
        nettoyage: netActive.length,
        hydratation: hydActive.length,
        triage: triActive.length,
        packaging: pkgActive.length,
        packagingDetail: pkgActive,
        total: fumActive.length + netActive.length + hydActive.length + triActive.length + pkgActive.length,
      },
      today: {
        fumKgIn: fumIn,
        fumYield: fumIn > 0 ? (fumOut / fumIn) * 100 : 0,
        netKgIn: netIn,
        netYield: netIn > 0 ? (netOut / netIn) * 100 : 0,
        hydKgIn: hydIn,
        hydYield: hydIn > 0 ? (hydOut / hydIn) * 100 : 0,
        triKgIn: triIn,
        triYield: triIn > 0 ? (triOut / triIn) * 100 : 0,
        pkgUnits,
        totalKgProcessed: fumIn + netIn + hydIn + triIn,
        avgYield: ratios.length > 0 ? (ratios.reduce((sum, value) => sum + value, 0) / ratios.length) * 100 : 0,
      },
      alerts: {
        critique: alertList.filter((alert) => ["CRITIQUE", "URGENCE"].includes(String(alert.severity))).length,
        avertissement: alertList.filter((alert) => String(alert.severity) === "AVERTISSEMENT").length,
        info: alertList.filter((alert) => String(alert.severity) === "INFO").length,
        total: alertList.length,
      },
      receptions: {
        today: receptions.length,
        kgToday: sumBy(receptions, "quantity_total"),
        accepted: receptions.filter((row) => row.qc_decision === "ACCEPTE").length,
      },
      lastUpdated: new Date().toISOString(),
    };
  }

  async getFounderSupplyFunnel(period?: string) {
    const normalizedPeriod = normalizePeriod(period);
    const start = periodStart(normalizedPeriod).toISOString();

    const [
      receptions,
      fumigation,
      cleaning,
      hydration,
      triage,
      triageSublots,
      packagingOrders,
      palettes,
    ] = await Promise.all([
      safeFindByDate("receptions_v2", "created_at", start, "quantity_total qc_decision"),
      safeFindByDate("fumigation_cycles", "started_at", start, "weight_in_kg weight_out_kg", { status: COMPLETED_STATUS }),
      safeFindByDate("cleaning_cycles", "started_at", start, "weight_in_kg weight_out_kg", { status: COMPLETED_STATUS }),
      safeFindByDate("hydration_cycles", "started_at", start, "weight_in_kg weight_out_kg", { status: COMPLETED_STATUS }),
      safeFindByDate("triage_sessions", "started_at", start, "weight_in_kg weight_out_kg", { status: COMPLETED_STATUS }),
      safeFindByDate("triage_sublots", "created_at", start, "weight_kg destination"),
      safeFindByDate("packaging_orders", "started_at", start, "target_units produced_units rejected_units", { status: COMPLETED_STATUS }),
      safeFindByDate("packaging_palettes", "created_at", start, "box_count gross_weight_kg status"),
    ]);

    const recKg = sumBy(receptions, "quantity_total");
    const fumOut = sumBy(fumigation, "weight_out_kg");
    const netOut = sumBy(cleaning, "weight_out_kg");
    const hydOut = sumBy(hydration, "weight_out_kg");
    const triOut = sumBy(triage, "weight_out_kg");
    const phase2KgOut = triOut || hydOut || netOut || fumOut;

    const conditioningKg = triageSublots
      .filter((row) => ["CONDITIONNEMENT_PREMIUM", "CONDITIONNEMENT_STANDARD"].includes(readString(row.destination)))
      .reduce((sum, row) => sum + readNumber(row.weight_kg), 0);

    const producedUnits = sumBy(packagingOrders, "produced_units");
    const targetUnits = sumBy(packagingOrders, "target_units");
    const sealedPalettes = palettes.filter((row) => readString(row.status).toUpperCase() === "SCELLE").length;
    const palettesKg = sumBy(palettes, "gross_weight_kg");

    return {
      stages: [
        { label: "Réception", value: recKg, unit: "kg", icon: "truck", color: "#3b82f6" },
        { label: "Phase 2", value: phase2KgOut, unit: "kg", icon: "beaker", color: "#8b5cf6" },
        { label: "Vers Cond.", value: conditioningKg, unit: "kg", icon: "scissors", color: "#f59e0b" },
        { label: "Conditionné", value: producedUnits, unit: "unités", icon: "package", color: "#10b981" },
        { label: "Palettes PF", value: sealedPalettes, unit: "pal.", icon: "layers", color: "#107754" },
      ],
      yields: {
        reception: 100,
        phase2: recKg > 0 ? (phase2KgOut / recKg) * 100 : 0,
        triage: phase2KgOut > 0 ? (conditioningKg / phase2KgOut) * 100 : 0,
        packaging: targetUnits > 0 ? (producedUnits / targetUnits) * 100 : 0,
      },
      palettesKg,
    };
  }

  async getFounderPhase2Analytics(period?: string) {
    const normalizedPeriod = normalizePeriod(period);
    const start = periodStart(normalizedPeriod).toISOString();

    const [fumigation, cleaning, hydration, triage, sublots] = await Promise.all([
      safeFindByDate("fumigation_cycles", "started_at", start, "status weight_in_kg weight_out_kg ph2_concentration_pct al_phosphine_ppm started_at"),
      safeFindByDate("cleaning_cycles", "started_at", start, "status program weight_in_kg weight_out_kg turbidity_ntu ph_water started_at"),
      safeFindByDate("hydration_cycles", "started_at", start, "status weight_in_kg weight_out_kg humidity_before_pct humidity_after_pct started_at"),
      safeFindByDate("triage_sessions", "started_at", start, "status weight_in_kg weight_out_kg grade_extra_pct grade_cat1_pct grade_cat2_pct grade_rejete_pct started_at"),
      safeFindByDate("triage_sublots", "created_at", start, "grade weight_kg destination"),
    ]);

    const completed = (rows: Array<Record<string, unknown>>) =>
      rows.filter((row) => readString(row.status).toUpperCase() === COMPLETED_STATUS);

    const fumDone = completed(fumigation);
    const netDone = completed(cleaning);
    const hydDone = completed(hydration);
    const triDone = completed(triage);

    const gradeKg: Record<string, number> = { EXTRA: 0, CATEGORIE_I: 0, CATEGORIE_II: 0, REJETE: 0 };
    sublots.forEach((row) => {
      const grade = readString(row.grade);
      if (grade in gradeKg) {
        gradeKg[grade] += readNumber(row.weight_kg);
      }
    });
    const gradeTotal = Object.values(gradeKg).reduce((sum, value) => sum + value, 0);

    const dailyThroughput = buildLastThirtyDays().map((day) => {
      const dateKey = toLocalDateKey(day);
      const kgIn = [...fumDone, ...netDone, ...hydDone, ...triDone]
        .filter((row) => matchesDatePrefix(row.started_at, dateKey))
        .reduce((sum, row) => sum + readNumber(row.weight_in_kg), 0);
      return {
        date: toChartDate(day),
        kgIn,
      };
    });

    const ccpOk = fumDone.filter((row) => {
      const ph2 = readNumber(row.ph2_concentration_pct, Number.NaN);
      const phosphine = row.al_phosphine_ppm == null ? 0 : readNumber(row.al_phosphine_ppm, Number.NaN);
      return ph2 >= 0.3 && ph2 <= 1.5 && (!Number.isFinite(phosphine) || phosphine <= 0.3);
    }).length;

    return {
      fumigation: {
        count: fumigation.length,
        done: fumDone.length,
        yield: yieldOf(fumDone),
        ccpCompliance: fumDone.length > 0 ? (ccpOk / fumDone.length) * 100 : 100,
      },
      nettoyage: {
        count: cleaning.length,
        done: netDone.length,
        yield: yieldOf(netDone),
        avgTurbidity: avgBy(netDone, "turbidity_ntu"),
        avgPH: avgBy(netDone, "ph_water"),
      },
      hydratation: {
        count: hydration.length,
        done: hydDone.length,
        yield: yieldOf(hydDone),
        avgHumidityGain: avgBy(hydDone, "humidity_after_pct") - avgBy(hydDone, "humidity_before_pct"),
      },
      triage: {
        count: triage.length,
        done: triDone.length,
        yield: yieldOf(triDone),
        avgExtraPct: avgBy(triDone, "grade_extra_pct"),
        avgRejetePct: avgBy(triDone, "grade_rejete_pct"),
      },
      gradeDistribution: Object.entries(gradeKg).map(([grade, kg]) => ({
        grade,
        label: grade === "CATEGORIE_I" ? "Cat. I" : grade === "CATEGORIE_II" ? "Cat. II" : grade === "REJETE" ? "Rejeté" : "Extra",
        kg,
        pct: gradeTotal > 0 ? (kg / gradeTotal) * 100 : 0,
      })),
      dailyThroughput,
      totalKgProcessed: fumDone.reduce((sum, row) => sum + readNumber(row.weight_in_kg), 0),
    };
  }

  async getFounderPackagingAnalytics(period?: string) {
    const normalizedPeriod = normalizePeriod(period);
    const start = periodStart(normalizedPeriod).toISOString();

    const [orders, palettes] = await Promise.all([
      safeFindByDate("packaging_orders", "started_at", start, "status line target_units produced_units rejected_units metal_detector_failures yield_pct started_at ended_at closed_at"),
      safeFindByDate("packaging_palettes", "created_at", start, "status box_count gross_weight_kg tare_weight_kg net_weight_kg sealed_at"),
    ]);

    const doneOrders = orders.filter((row) => readString(row.status).toUpperCase() === COMPLETED_STATUS);
    const totalTarget = sumBy(orders, "target_units");
    const totalProduced = sumBy(orders, "produced_units");
    const totalRejected = sumBy(orders, "rejected_units");
    const metalFailures = sumBy(orders, "metal_detector_failures");
    const avgYield = doneOrders.length > 0
      ? doneOrders.reduce((sum, row) => {
          const storedYield = readNumber(row.yield_pct, Number.NaN);
          const derivedYield = readNumber(row.target_units) > 0
            ? (readNumber(row.produced_units) / readNumber(row.target_units)) * 100
            : 0;
          return sum + (Number.isFinite(storedYield) && storedYield > 0 ? storedYield : derivedYield);
        }, 0) / doneOrders.length
      : 0;

    const lineOEE = PACKAGING_LINES.map((line) => {
      const lineOrders = doneOrders.filter((row) => readString(row.line) === line);
      const produced = sumBy(lineOrders, "produced_units");
      const target = sumBy(lineOrders, "target_units");
      return {
        line,
        produced,
        target,
        oee: target > 0 ? (produced / target) * 100 : 0,
        count: lineOrders.length,
      };
    });

    const daily = buildLastThirtyDays().map((day) => {
      const dateKey = toLocalDateKey(day);
      const dayOrders = orders.filter((row) => matchesDatePrefix(row.started_at, dateKey));
      return {
        date: toChartDate(day),
        units: sumBy(dayOrders, "produced_units"),
        palettes: palettes.filter((row) => matchesDatePrefix(row.sealed_at, dateKey)).length,
      };
    });

    const sealedPalettes = palettes.filter((row) => readString(row.status).toUpperCase() === "SCELLE").length;
    const totalNetKg = sumBy(palettes.filter((row) => readString(row.status).toUpperCase() === "SCELLE"), "net_weight_kg");

    return {
      kpis: {
        totalTarget,
        totalProduced,
        totalRejected,
        metalFailures,
        avgYield,
        sealedPalettes,
        totalNetKg,
      },
      oee: totalTarget > 0 ? (totalProduced / totalTarget) * 100 : 0,
      lineOEE,
      daily,
      ordersCount: {
        total: orders.length,
        done: doneOrders.length,
        active: orders.filter((row) => readString(row.status).toUpperCase() === ACTIVE_STATUS).length,
      },
    };
  }

  async getFounderAlertIntelligence(period?: string) {
    const normalizedPeriod = normalizePeriod(period);
    const start = periodStart(normalizedPeriod).toISOString();
    const alerts = await safeFindByDate("system_notifications", "created_at", start);

    const normalizedAlerts = alerts.map((alert) => ({
      ...alert,
      severity: normalizeNotificationSeverity(alert.severity),
      status: normalizeNotificationStatus(alert.status),
      created_at: readString(alert.created_at),
      resolved_at: readString(alert.resolved_at),
      alert_code: readString(alert.alert_code, alert.notification_type, alert.type, "UNKNOWN"),
    }));

    const bySeverity = {
      URGENCE: normalizedAlerts.filter((alert) => alert.severity === "URGENCE").length,
      CRITIQUE: normalizedAlerts.filter((alert) => alert.severity === "CRITIQUE").length,
      AVERTISSEMENT: normalizedAlerts.filter((alert) => alert.severity === "AVERTISSEMENT").length,
      INFO: normalizedAlerts.filter((alert) => alert.severity === "INFO").length,
    };

    const byStatus = {
      ACTIVE: normalizedAlerts.filter((alert) => alert.status === "ACTIVE").length,
      ACKNOWLEDGED: normalizedAlerts.filter((alert) => alert.status === "ACKNOWLEDGED").length,
      RESOLVED: normalizedAlerts.filter((alert) => alert.status === "RESOLVED").length,
    };

    const typeMap: Record<string, number> = {};
    normalizedAlerts.forEach((alert) => {
      const code = readString(alert.alert_code) || "UNKNOWN";
      typeMap[code] = (typeMap[code] || 0) + 1;
    });

    const topTypes = Object.entries(typeMap)
      .sort((left, right) => right[1] - left[1])
      .slice(0, 8)
      .map(([code, count]) => ({ code, count }));

    const daily = buildLastThirtyDays().map((day) => {
      const dateKey = toLocalDateKey(day);
      const rows = normalizedAlerts.filter((alert) => alert.created_at.startsWith(dateKey));
      return {
        date: toChartDate(day),
        critical: rows.filter((alert) => ["URGENCE", "CRITIQUE"].includes(alert.severity)).length,
        warning: rows.filter((alert) => alert.severity === "AVERTISSEMENT").length,
        total: rows.length,
      };
    });

    const resolved = normalizedAlerts.filter((alert) => alert.status === "RESOLVED" && alert.resolved_at && alert.created_at);
    const mttrMs = resolved.length > 0
      ? resolved.reduce((sum, alert) => {
          const createdAt = new Date(alert.created_at).getTime();
          const resolvedAt = new Date(alert.resolved_at).getTime();
          return sum + Math.max(0, resolvedAt - createdAt);
        }, 0) / resolved.length
      : 0;

    return {
      bySeverity,
      byStatus,
      topTypes,
      daily,
      mttrMin: Math.round(mttrMs / 60_000),
      total: normalizedAlerts.length,
    };
  }

  async getFounderReceptionPhase1Analytics(period?: string) {
    const normalizedPeriod = normalizePeriod(period);
    const start = periodStart(normalizedPeriod).toISOString();

    const [receptions, lots, qcInspections, batches, batchMovements] = await Promise.all([
      safeFindByDate("receptions_v2", "created_at", start, "id status quantity_total qc_decision variety created_at"),
      safeFindByDate("reception_lots", "created_at", start, "id status stock_status quantity_kg quantity variety created_at"),
      safeFindByDate("qc_inspections", "created_at", start, "id decision grade defect_rate_pct sugar_content_brix moisture_pct created_at"),
      safeFindByDate("batches", "created_at", start, "id status total_weight_kg variety created_at"),
      safeFindByDate("batch_movements", "created_at", start, "id type movement_type quantity_kg quantity created_at"),
    ]);

    const sum = (rows: Array<Record<string, unknown>>, key: string, fallbackKey?: string) =>
      rows.reduce((total, row) => total + readNumber(row[key] ?? (fallbackKey ? row[fallbackKey] : undefined)), 0);

    const avg = (rows: Array<Record<string, unknown>>, key: string) => {
      const values = rows
        .map((row) => row[key])
        .filter((value) => value != null)
        .map((value) => readNumber(value));
      return values.length > 0 ? values.reduce((total, value) => total + value, 0) / values.length : 0;
    };

    const qcDecided = qcInspections.filter((row) => Boolean(row.decision));
    const qcAccepted = qcDecided.filter((row) => row.decision === "ACCEPTE").length;
    const qcRejected = qcDecided.filter((row) => row.decision === "REJETE").length;
    const qcQuarantine = qcDecided.filter((row) => row.decision === "QUARANTAINE").length;
    const qcRate = qcDecided.length > 0 ? (qcAccepted / qcDecided.length) * 100 : 0;

    const receptionDecided = receptions.filter((row) => Boolean(row.qc_decision));
    const recAccepted = receptionDecided.filter((row) => row.qc_decision === "ACCEPTE").length;
    const recRejected = receptionDecided.filter((row) => row.qc_decision === "REJETE").length;
    const recQuarantine = receptionDecided.filter((row) => row.qc_decision === "QUARANTAINE").length;

    const varietyMap: Record<string, number> = {};
    receptions.forEach((row) => {
      const variety = readString(row.variety);
      if (variety) {
        varietyMap[variety] = (varietyMap[variety] || 0) + readNumber(row.quantity_total);
      }
    });

    const byVariety = Object.entries(varietyMap)
      .sort((left, right) => right[1] - left[1])
      .slice(0, 8)
      .map(([variety, kg]) => ({ variety, kg }));

    const dailyReceptions = buildLastThirtyDays().map((day) => {
      const dateKey = toLocalDateKey(day);
      const rows = receptions.filter((row) => matchesDatePrefix(row.created_at, dateKey));
      return {
        date: toChartDate(day),
        kg: sum(rows, "quantity_total"),
        count: rows.length,
      };
    });

    return {
      receptions: {
        total: receptions.length,
        totalKg: sum(receptions, "quantity_total"),
        accepted: recAccepted,
        rejected: recRejected,
        quarantine: recQuarantine,
        acceptanceRate: receptionDecided.length > 0 ? (recAccepted / receptionDecided.length) * 100 : 0,
      },
      lots: {
        total: lots.length,
        totalKg: sum(lots, "quantity_kg", "quantity"),
      },
      qc: {
        total: qcInspections.length,
        accepted: qcAccepted,
        rejected: qcRejected,
        quarantine: qcQuarantine,
        acceptanceRate: qcRate,
        avgDefectRate: avg(qcInspections, "defect_rate_pct"),
        avgBrix: avg(qcInspections.filter((row) => row.sugar_content_brix != null), "sugar_content_brix"),
        avgMoisture: avg(qcInspections.filter((row) => row.moisture_pct != null), "moisture_pct"),
      },
      batches: {
        total: batches.length,
        totalKg: sum(batches, "total_weight_kg"),
        byStatus: {
          EN_ATTENTE: batches.filter((row) => row.status === "EN_ATTENTE").length,
          EN_COURS: batches.filter((row) => row.status === "EN_COURS").length,
          TERMINE: batches.filter((row) => row.status === "TERMINE").length,
          REJETE: batches.filter((row) => row.status === "REJETE").length,
        },
      },
      byVariety,
      dailyReceptions,
      moveCount: batchMovements.length,
    };
  }

  async getFounderStockStorageAnalytics(period?: string) {
    const normalizedPeriod = normalizePeriod(period);
    const start = periodStart(normalizedPeriod).toISOString();

    const [stockLots, stockMovements, stockAlerts, storageZones, conditionReadings] = await Promise.all([
      safeFind("stock_lots", {
        select: "id status quantity_kg current_quantity quantity variety location created_at",
      }),
      safeFindByDate("stock_movements", "created_at", start, "id type movement_type quantity_kg quantity created_at movement_date"),
      safeFind("stock_alerts", {
        filter: { status: { $in: ["ACTIVE", "active"] } },
        select: "id severity status created_at",
      }),
      safeFind("storage_zones", {
        select: "id name code capacity_kg current_weight_kg current_load_kg temperature_celsius current_temperature_c humidity_pct current_humidity_percent status condition_status",
      }),
      safeFindByDate("storage_condition_readings", "recorded_at", start, "storage_zone_id zone_id temperature_celsius temperature_c humidity_pct humidity_percent recorded_at"),
    ]);

    const activeLots = stockLots.filter((row) => {
      const status = readString(row.status).toUpperCase();
      const quantityKg = readLotQuantityKg(row);
      return quantityKg > 0 && !["SORTI", "EPUISE", "CONSUMED", "DESTROYED"].includes(status);
    });

    const totalStockKg = activeLots.reduce((sum, row) => sum + readLotQuantityKg(row), 0);

    const varietyStock: Record<string, number> = {};
    activeLots.forEach((row) => {
      const variety = readString(row.variety);
      if (variety) {
        varietyStock[variety] = (varietyStock[variety] || 0) + readLotQuantityKg(row);
      }
    });

    const stockByVariety = Object.entries(varietyStock)
      .sort((left, right) => right[1] - left[1])
      .slice(0, 8)
      .map(([variety, kg]) => ({ variety, kg }));

    const inMoves = stockMovements.filter((row) => ["ENTREE", "RECEPTION", "TRANSFERT_IN", "ENTREE_ZONE"].includes(readMovementType(row)));
    const outMoves = stockMovements.filter((row) => ["SORTIE", "TRANSFERT_OUT", "LIVRAISON", "SORTIE_ZONE", "EXPEDITION"].includes(readMovementType(row)));
    const totalIn = inMoves.reduce((sum, row) => sum + readMovementQuantityKg(row), 0);
    const totalOut = outMoves.reduce((sum, row) => sum + readMovementQuantityKg(row), 0);

    const dailyMovements = buildLastThirtyDays().map((day) => {
      const dateKey = toLocalDateKey(day);
      const dayRows = stockMovements.filter((row) => matchesDatePrefix(readMovementDate(row), dateKey));
      const dayIns = dayRows.filter((row) => ["ENTREE", "RECEPTION", "TRANSFERT_IN", "ENTREE_ZONE"].includes(readMovementType(row)));
      const dayOuts = dayRows.filter((row) => ["SORTIE", "TRANSFERT_OUT", "LIVRAISON", "SORTIE_ZONE", "EXPEDITION"].includes(readMovementType(row)));
      return {
        date: toChartDate(day),
        in: dayIns.reduce((sum, row) => sum + readMovementQuantityKg(row), 0),
        out: dayOuts.reduce((sum, row) => sum + readMovementQuantityKg(row), 0),
      };
    });

    const zones = storageZones.map((row) => {
      const capacity = readNumber(row.capacity_kg);
      const current = readZoneCurrentKg(row);
      const temperature = readZoneTemperature(row);
      const humidity = readZoneHumidity(row);
      return {
        name: readString(row.name, row.code) || "Zone",
        capacity,
        current,
        occupancy: capacity > 0 ? (current / capacity) * 100 : 0,
        temperature: Number.isFinite(temperature) ? temperature : null,
        humidity: Number.isFinite(humidity) ? humidity : null,
        status: readString(row.status, row.condition_status),
      };
    });

    const totalCapacity = zones.reduce((sum, zone) => sum + zone.capacity, 0);
    const totalOccupied = zones.reduce((sum, zone) => sum + zone.current, 0);

    const condAlerts = conditionReadings.filter((row) => {
      const temperature = readReadingTemperature(row);
      const humidity = readReadingHumidity(row);
      return (
        (Number.isFinite(temperature) && (temperature < 0 || temperature > 8)) ||
        (Number.isFinite(humidity) && (humidity < 50 || humidity > 80))
      );
    }).length;
    const condCompliance = conditionReadings.length > 0 ? ((conditionReadings.length - condAlerts) / conditionReadings.length) * 100 : 100;

    const normalizedAlerts = stockAlerts.map((alert) => normalizeNotificationSeverity(alert.severity));

    return {
      stock: {
        totalLots: activeLots.length,
        totalKg: totalStockKg,
        byVariety: stockByVariety,
        activeAlerts: stockAlerts.length,
        criticalAlerts: normalizedAlerts.filter((severity) => severity === "CRITIQUE" || severity === "URGENCE").length,
      },
      movements: {
        totalIn,
        totalOut,
        balance: totalIn - totalOut,
        count: stockMovements.length,
        daily: dailyMovements,
      },
      storage: {
        zones,
        totalCapacity,
        totalOccupied,
        occupancyPct: totalCapacity > 0 ? (totalOccupied / totalCapacity) * 100 : 0,
        condCompliance,
        condReadings: conditionReadings.length,
      },
    };
  }

  async getFounderSupplierIntelligence(period?: string) {
    const normalizedPeriod = normalizePeriod(period);
    const start = periodStart(normalizedPeriod).toISOString();
    const receptions = await safeFindByDate("receptions_v2", "created_at", start, "supplier_id supplier_name_snapshot quantity_total qc_decision created_at");
    const suppliersMap = await this.getSuppliersMapByIds(receptions.map((row) => readString(row.supplier_id)));

    const aggregation: Record<string, {
      supplierId: string;
      name: string;
      kgReceived: number;
      accepted: number;
      rejected: number;
      quarantine: number;
      deliveries: number;
    }> = {};

    receptions.forEach((row) => {
      const supplierId = readString(row.supplier_id) || "unknown";
      const supplier = suppliersMap.get(supplierId);
      const name = readString(supplier?.name, row.supplier_name_snapshot) || "Inconnu";
      if (!aggregation[supplierId]) {
        aggregation[supplierId] = {
          supplierId,
          name,
          kgReceived: 0,
          accepted: 0,
          rejected: 0,
          quarantine: 0,
          deliveries: 0,
        };
      }

      aggregation[supplierId].kgReceived += readNumber(row.quantity_total);
      aggregation[supplierId].deliveries += 1;
      if (row.qc_decision === "ACCEPTE") aggregation[supplierId].accepted += 1;
      else if (row.qc_decision === "REJETE") aggregation[supplierId].rejected += 1;
      else if (row.qc_decision === "QUARANTAINE") aggregation[supplierId].quarantine += 1;
    });

    const topSuppliers = Object.values(aggregation)
      .map((supplier) => ({
        ...supplier,
        acceptanceRate: supplier.deliveries > 0 ? (supplier.accepted / supplier.deliveries) * 100 : 0,
      }))
      .sort((left, right) => right.kgReceived - left.kgReceived)
      .slice(0, 8);

    const decided = receptions.filter((row) => Boolean(row.qc_decision));
    const accepted = decided.filter((row) => row.qc_decision === "ACCEPTE").length;

    return {
      topSuppliers,
      kpiTotal: receptions.reduce((sum, row) => sum + readNumber(row.quantity_total), 0),
      overallAcceptance: decided.length > 0 ? (accepted / decided.length) * 100 : 0,
      totalReceptions: receptions.length,
    };
  }

  async getFounderPlantHealthScore(period?: string) {
    const normalizedPeriod = normalizePeriod(period);
    const start = periodStart(normalizedPeriod).toISOString();

    const [receptions, alerts, packagingOrders, ...phase2Collections] = await Promise.all([
      safeFindByDate("receptions_v2", "created_at", start, "qc_decision"),
      safeFind("system_notifications", {
        filter: { status: { $in: ["ACTIVE", "active"] } },
        select: "severity status created_at",
      }),
      safeFindByDate("packaging_orders", "started_at", start, "target_units produced_units", { status: COMPLETED_STATUS }),
      ...PHASE2_INPUT_COLLECTIONS.map((collection) =>
        safeFindByDate(collection, "started_at", start, "weight_in_kg weight_out_kg", { status: COMPLETED_STATUS }),
      ),
    ]);

    const decided = receptions.filter((row) => Boolean(row.qc_decision));
    const acceptanceScore = decided.length > 0
      ? (decided.filter((row) => row.qc_decision === "ACCEPTE").length / decided.length) * 100
      : 100;

    const phase2Yields = phase2Collections
      .map((rows) => {
        const totalIn = rows.reduce((sum, row) => sum + readNumber(row.weight_in_kg), 0);
        const totalOut = rows.reduce((sum, row) => sum + readNumber(row.weight_out_kg), 0);
        return totalIn > 0 ? (totalOut / totalIn) * 100 : null;
      })
      .filter((v): v is number => v !== null);
    const phase2Score = phase2Yields.length > 0
      ? phase2Yields.reduce((sum, value) => sum + value, 0) / phase2Yields.length
      : 100;

    const targetUnits = sumBy(packagingOrders, "target_units");
    const producedUnits = sumBy(packagingOrders, "produced_units");
    const packagingScore = targetUnits > 0 ? (producedUnits / targetUnits) * 100 : 100;

    const criticalAlerts = alerts
      .map((alert) => normalizeNotificationSeverity(alert.severity))
      .filter((severity) => severity === "URGENCE" || severity === "CRITIQUE").length;
    const alertPenalty = Math.min(criticalAlerts * 5, 30);
    const alertScore = 100 - alertPenalty;

    const overall = acceptanceScore * 0.2 + phase2Score * 0.3 + packagingScore * 0.25 + alertScore * 0.25;

    return {
      score: Math.round(overall),
      breakdown: {
        reception: Math.round(acceptanceScore),
        phase2: Math.round(phase2Score),
        packaging: Math.round(packagingScore),
        alerts: Math.round(alertScore),
      },
    };
  }
}
