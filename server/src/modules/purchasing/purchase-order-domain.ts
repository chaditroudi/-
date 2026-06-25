import { badRequest, notFound } from "../../core/app-error.js";
import { prepareInsertDocument } from "../../db/defaults.js";
import { getCollectionModel, sanitizeDocument } from "../../db/dynamic-model.js";

type CanonicalPurchaseOrderStatus =
  | "draft"
  | "submitted"
  | "confirmed"
  | "partially_delivered"
  | "delivered"
  | "invoiced"
  | "cancelled"
  | "on_hold";
type PurchaseOrderReceiptStatus =
  | "not_received"
  | "partially_delivered"
  | "delivered"
  | "delivered_with_tolerance"
  | "discrepancy";
type PurchaseOrderLineStatus = "open" | "partially_delivered" | "delivered" | "closed" | "discrepancy" | "cancelled";
type PurchaseOrderInvoiceStatus = "not_invoiced" | "partially_invoiced" | "invoiced" | "blocked";
type ReceiptQcOutcome = "pending_qc" | "accepted" | "conditional" | "rejected";

type PurchaseOrderRow = Record<string, unknown> & {
  id?: string;
  order_number?: string;
  supplier_id?: string | null;
  status?: string | null;
  invoice_status?: string | null;
  actual_delivery_date?: string | null;
  delivered_at?: string | null;
};

type PurchaseOrderLineRow = Record<string, unknown> & {
  id?: string;
  order_id?: string | null;
  line_number?: number | null;
  material_id?: string | null;
  quantity?: number | null;
  confirmed_quantity?: number | null;
  received_quantity?: number | null;
  accepted_quantity?: number | null;
  rejected_quantity?: number | null;
  invoiced_quantity?: number | null;
  over_delivery_tolerance_pct?: number | null;
  line_status?: string | null;
};

type PurchaseOrderReceiptRow = Record<string, unknown> & {
  id?: string;
  purchase_order_id?: string | null;
  purchase_order_line_id?: string | null;
  reception_id?: string | null;
  reception_lot_id?: string | null;
  received_quantity?: number | null;
  accepted_quantity?: number | null;
  rejected_quantity?: number | null;
  qc_outcome?: string | null;
};

type ReceptionLike = Record<string, unknown> & {
  id?: string;
  created_at?: string;
  created_by?: string | null;
  supplier_id?: string | null;
};

type ReceptionLotLike = Record<string, unknown> & {
  id?: string;
  lot_supplier?: string | null;
  lot_internal?: string | null;
  quantity?: number | null;
  unit?: string | null;
};

type ResolvedReceiptTarget = {
  order: PurchaseOrderRow;
  line: PurchaseOrderLineRow;
  lines: PurchaseOrderLineRow[];
};

const PurchaseOrders = () => getCollectionModel("purchase_orders");
const PurchaseOrderLines = () => getCollectionModel("purchase_order_lines");
const PurchaseOrderReceivingLots = () => getCollectionModel("purchase_order_receiving_lots");

const LEGACY_STATUS_MAP: Record<string, CanonicalPurchaseOrderStatus> = {
  sent: "submitted",
  partially_received: "partially_delivered",
  received: "delivered",
};

const RECEIVABLE_STATUSES = new Set<CanonicalPurchaseOrderStatus>([
  "submitted",
  "confirmed",
  "partially_delivered",
  "on_hold",
]);

const readNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const roundQuantity = (value: number, precision = 3) => {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
};

const normalizeStatus = (status?: string | null): CanonicalPurchaseOrderStatus => {
  if (!status) return "draft";
  if (status in LEGACY_STATUS_MAP) return LEGACY_STATUS_MAP[status];

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

const normalizeInvoiceStatus = (status?: string | null): PurchaseOrderInvoiceStatus => {
  switch (status) {
    case "partially_invoiced":
    case "invoiced":
    case "blocked":
      return status;
    default:
      return "not_invoiced";
  }
};

const normalizeLineStatus = (status?: string | null): PurchaseOrderLineStatus => {
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

const getLineTargetQuantity = (line: PurchaseOrderLineRow) =>
  roundQuantity(readNumber(line.confirmed_quantity ?? line.quantity));

const computePhysicalLineStatus = (line: PurchaseOrderLineRow): PurchaseOrderLineStatus => {
  const explicit = normalizeLineStatus(line.line_status);
  if (explicit === "cancelled") return explicit;

  const targetQuantity = getLineTargetQuantity(line);
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

const deriveReceiptStatus = (
  lines: PurchaseOrderLineRow[],
  receipts: PurchaseOrderReceiptRow[],
): PurchaseOrderReceiptStatus => {
  if (receipts.some((receipt) => ["conditional", "rejected"].includes(String(receipt.qc_outcome || "")))) {
    return "discrepancy";
  }

  if (lines.length === 0) return "not_received";

  const hasReceipts = lines.some((line) => readNumber(line.received_quantity) > 0);
  if (!hasReceipts) return "not_received";

  const hasToleranceReceipt = lines.some(
    (line) => readNumber(line.received_quantity) > getLineTargetQuantity(line) + 0.0001,
  );
  const allDelivered = lines.every((line) => {
    const lineStatus = computePhysicalLineStatus(line);
    return lineStatus === "delivered" || lineStatus === "closed";
  });

  if (allDelivered) {
    return hasToleranceReceipt ? "delivered_with_tolerance" : "delivered";
  }

  return "partially_delivered";
};

const deriveHeaderStatus = (
  order: PurchaseOrderRow,
  receiptStatus: PurchaseOrderReceiptStatus,
): CanonicalPurchaseOrderStatus => {
  const currentStatus = normalizeStatus(String(order.status || "draft"));
  const invoiceStatus = normalizeInvoiceStatus(String(order.invoice_status || "not_invoiced"));

  if (currentStatus === "cancelled") return currentStatus;
  if (invoiceStatus === "invoiced" && ["delivered", "delivered_with_tolerance"].includes(receiptStatus)) {
    return "invoiced";
  }
  if (receiptStatus === "discrepancy") return "on_hold";
  if (receiptStatus === "delivered" || receiptStatus === "delivered_with_tolerance") return "delivered";
  if (receiptStatus === "partially_delivered") return "partially_delivered";
  return currentStatus;
};

const loadPurchaseOrder = async (purchaseOrderId: string) => {
  const order = sanitizeDocument(
    await PurchaseOrders().findOne({ id: purchaseOrderId }).lean().exec(),
  ) as PurchaseOrderRow | null;

  if (!order) {
    throw notFound("PURCHASE_ORDER_NOT_FOUND", "Purchase order not found.");
  }

  const lines = sanitizeDocument(
    await PurchaseOrderLines()
      .find({ order_id: purchaseOrderId })
      .sort({ line_number: 1, created_at: 1 })
      .lean()
      .exec(),
  ) as PurchaseOrderLineRow[];

  return { order, lines };
};

const syncPurchaseOrderDerivedFields = async (purchaseOrderId: string) => {
  const { order, lines } = await loadPurchaseOrder(purchaseOrderId);
  const receipts = sanitizeDocument(
    await PurchaseOrderReceivingLots().find({ purchase_order_id: purchaseOrderId }).lean().exec(),
  ) as PurchaseOrderReceiptRow[];

  const receiptStatus = deriveReceiptStatus(lines, receipts);
  const nextStatus = deriveHeaderStatus(order, receiptStatus);
  const deliveredAt =
    nextStatus === "delivered" || nextStatus === "invoiced"
      ? String(order.delivered_at || new Date().toISOString())
      : null;
  const goodsReceiptCount = Array.from(
    new Set(receipts.map((receipt) => String(receipt.reception_id || "")).filter(Boolean)),
  ).length;

  await PurchaseOrders().updateOne(
    { id: purchaseOrderId },
    {
      $set: {
        status: nextStatus,
        receipt_status: receiptStatus,
        goods_receipt_count: goodsReceiptCount,
        line_count: lines.length,
        delivered_at: deliveredAt,
        actual_delivery_date: deliveredAt ? deliveredAt.slice(0, 10) : order.actual_delivery_date ?? null,
        updated_at: new Date().toISOString(),
      },
    },
  ).exec();

  return loadPurchaseOrder(purchaseOrderId);
};

export const resolvePurchaseOrderReceiptTarget = async ({
  purchaseOrderId,
  purchaseOrderLineId,
  supplierId,
  materialId,
}: {
  purchaseOrderId: string;
  purchaseOrderLineId?: string | null;
  supplierId: string;
  materialId?: string | null;
}) => {
  const { order, lines } = await loadPurchaseOrder(purchaseOrderId);
  const canonicalStatus = normalizeStatus(String(order.status || "draft"));

  if (!RECEIVABLE_STATUSES.has(canonicalStatus)) {
    throw badRequest(
      "PURCHASE_ORDER_NOT_RECEIVABLE",
      `Purchase order ${order.order_number || purchaseOrderId} is not open for receipt.`,
    );
  }

  if (String(order.supplier_id || "") !== String(supplierId || "")) {
    throw badRequest(
      "PURCHASE_ORDER_SUPPLIER_MISMATCH",
      "The selected purchase order does not belong to the chosen supplier.",
    );
  }

  const eligibleLines = lines.filter((line) => {
    if (normalizeLineStatus(line.line_status) === "cancelled") return false;

    const targetQuantity = getLineTargetQuantity(line);
    const overTolerancePct = readNumber(line.over_delivery_tolerance_pct);
    const maxReceivable = roundQuantity(targetQuantity * (1 + overTolerancePct / 100));
    return readNumber(line.received_quantity) + 0.0001 < maxReceivable;
  });

  let targetLine: PurchaseOrderLineRow | undefined;
  if (purchaseOrderLineId) {
    targetLine = eligibleLines.find((line) => String(line.id || "") === String(purchaseOrderLineId));
    if (!targetLine) {
      throw badRequest(
        "PURCHASE_ORDER_LINE_NOT_FOUND",
        "The selected purchase order line was not found on this order.",
      );
    }
  } else if (materialId) {
    const matchingLines = eligibleLines.filter((line) => String(line.material_id || "") === String(materialId));
    if (matchingLines.length === 1) {
      targetLine = matchingLines[0];
    } else if (matchingLines.length > 1) {
      throw badRequest(
        "PURCHASE_ORDER_LINE_REQUIRED",
        "Multiple order lines match this material. Please choose the exact purchase order line.",
      );
    }
  } else if (eligibleLines.length === 1) {
    targetLine = eligibleLines[0];
  }

  if (!targetLine) {
    throw badRequest(
      "PURCHASE_ORDER_LINE_REQUIRED",
      "A purchase order line must be selected before receiving this delivery.",
    );
  }

  return {
    order,
    line: targetLine,
    lines,
  } satisfies ResolvedReceiptTarget;
};

export const registerReceptionAgainstPurchaseOrder = async ({
  resolution,
  reception,
  lots,
  quantityTotal,
  actorId,
}: {
  resolution: ResolvedReceiptTarget;
  reception: ReceptionLike;
  lots: ReceptionLotLike[];
  quantityTotal: number;
  actorId?: string | null;
}) => {
  const now = new Date().toISOString();
  const receiptQuantity = roundQuantity(readNumber(quantityTotal));
  if (receiptQuantity <= 0) {
    throw badRequest("INVALID_RECEIPT_QUANTITY", "The received quantity must be greater than zero.");
  }

  const targetQuantity = getLineTargetQuantity(resolution.line);
  const previousReceived = roundQuantity(readNumber(resolution.line.received_quantity));
  const overTolerancePct = readNumber(resolution.line.over_delivery_tolerance_pct);
  const maxReceivable = roundQuantity(targetQuantity * (1 + overTolerancePct / 100));
  const nextReceived = roundQuantity(previousReceived + receiptQuantity);

  if (nextReceived > maxReceivable + 0.0001) {
    throw badRequest(
      "OVERDELIVERY_TOLERANCE_EXCEEDED",
      `The receipt exceeds the authorized quantity for order ${resolution.order.order_number || resolution.order.id}.`,
    );
  }

  await PurchaseOrderLines().updateOne(
    { id: resolution.line.id },
    {
      $set: {
        received_quantity: nextReceived,
        reception_id: reception.id || null,
        last_reception_id: reception.id || null,
        last_received_at: now,
        last_supplier_lot: String(lots[0]?.lot_supplier || ""),
        line_status: nextReceived + 0.0001 < targetQuantity ? "partially_delivered" : "delivered",
        updated_at: now,
      },
    },
  ).exec();

  const preparedReceipts = [];
  for (const lot of lots) {
    preparedReceipts.push(
      await prepareInsertDocument("purchase_order_receiving_lots", {
        purchase_order_id: resolution.order.id,
        purchase_order_line_id: resolution.line.id,
        reception_id: reception.id || null,
        reception_lot_id: lot.id || null,
        supplier_lot: lot.lot_supplier || null,
        internal_lot: lot.lot_internal || null,
        received_quantity: readNumber(lot.quantity),
        accepted_quantity: 0,
        rejected_quantity: 0,
        unit: lot.unit || "kg",
        qc_outcome: "pending_qc",
        received_at: now,
        received_by: actorId || reception.created_by || null,
        notes: null,
      }),
    );
  }

  if (preparedReceipts.length > 0) {
    await PurchaseOrderReceivingLots().insertMany(preparedReceipts);
  }

  return syncPurchaseOrderDerivedFields(String(resolution.order.id || ""));
};

export const applyPurchaseOrderQcDecision = async ({
  purchaseOrderId,
  receptionId,
  decision,
}: {
  purchaseOrderId: string;
  receptionId: string;
  decision: string;
}) => {
  const receipts = sanitizeDocument(
    await PurchaseOrderReceivingLots()
      .find({ purchase_order_id: purchaseOrderId, reception_id: receptionId })
      .lean()
      .exec(),
  ) as PurchaseOrderReceiptRow[];

  if (receipts.length === 0) {
    return null;
  }

  const now = new Date().toISOString();
  const qcOutcome: ReceiptQcOutcome =
    decision === "ACCEPTE" ? "accepted" : decision === "REJETE" ? "rejected" : "conditional";

  for (const receipt of receipts) {
    const receivedQuantity = roundQuantity(readNumber(receipt.received_quantity));
    await PurchaseOrderReceivingLots().updateOne(
      { id: receipt.id },
      {
        $set: {
          qc_outcome: qcOutcome,
          accepted_quantity: qcOutcome === "accepted" ? receivedQuantity : 0,
          rejected_quantity: qcOutcome === "rejected" ? receivedQuantity : 0,
          updated_at: now,
        },
      },
    ).exec();
  }

  const groupedLineIds = Array.from(
    new Set(receipts.map((receipt) => String(receipt.purchase_order_line_id || "")).filter(Boolean)),
  );

  for (const lineId of groupedLineIds) {
    const lineReceipts = sanitizeDocument(
      await PurchaseOrderReceivingLots().find({ purchase_order_line_id: lineId }).lean().exec(),
    ) as PurchaseOrderReceiptRow[];

    const acceptedQuantity = roundQuantity(
      lineReceipts.reduce((sum, receipt) => sum + readNumber(receipt.accepted_quantity), 0),
    );
    const rejectedQuantity = roundQuantity(
      lineReceipts.reduce((sum, receipt) => sum + readNumber(receipt.rejected_quantity), 0),
    );
    const existingLine = sanitizeDocument(
      await PurchaseOrderLines().findOne({ id: lineId }).lean().exec(),
    ) as PurchaseOrderLineRow | null;

    if (!existingLine) continue;

    await PurchaseOrderLines().updateOne(
      { id: lineId },
      {
        $set: {
          accepted_quantity: acceptedQuantity,
          rejected_quantity: rejectedQuantity,
          line_status: computePhysicalLineStatus({
            ...existingLine,
            accepted_quantity: acceptedQuantity,
            rejected_quantity: rejectedQuantity,
          }),
          updated_at: now,
        },
      },
    ).exec();
  }

  return syncPurchaseOrderDerivedFields(purchaseOrderId);
};
