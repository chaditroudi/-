var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Injectable } from "@nestjs/common";
import { badRequest, notFound } from "../../core/app-error.js";
import { prepareInsertDocument } from "../../db/defaults.js";
import { getCollectionModel, sanitizeDocument } from "../../db/dynamic-model.js";
const META_START = "[SAGE_META]";
const META_END = "[/SAGE_META]";
const PURCHASE_ORDER_APPROVAL_THRESHOLD = 5000;
const PurchaseRequisitions = () => getCollectionModel("purchase_requisitions");
const PurchaseOrders = () => getCollectionModel("purchase_orders");
const PurchaseOrderLines = () => getCollectionModel("purchase_order_lines");
const ReceiptLogs = () => getCollectionModel("purchase_order_receipt_logs");
const ReceptionLots = () => getCollectionModel("reception_lots");
const Suppliers = () => getCollectionModel("suppliers");
const Materials = () => getCollectionModel("materials");
const LEGACY_STATUS_MAP = {
    sent: "submitted",
    partially_received: "partially_delivered",
    received: "delivered",
};
const uniqueStrings = (values) => Array.from(new Set(values.map((value) => String(value || "").trim()).filter(Boolean)));
const readNumber = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};
const readString = (...values) => {
    for (const value of values) {
        if (typeof value === "string" && value.trim()) {
            return value.trim();
        }
    }
    return "";
};
const roundQuantity = (value, precision = 3) => {
    const factor = 10 ** precision;
    return Math.round(value * factor) / factor;
};
const normalizePurchaseOrderStatus = (status) => {
    if (!status)
        return "draft";
    if (status in LEGACY_STATUS_MAP)
        return LEGACY_STATUS_MAP[status];
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
const normalizeInvoiceStatus = (status) => {
    switch (status) {
        case "partially_invoiced":
        case "invoiced":
        case "blocked":
            return status;
        default:
            return "not_invoiced";
    }
};
const normalizeLineStatus = (status) => {
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
const getLineTargetQuantity = (line) => roundQuantity(readNumber(line.confirmed_quantity ?? line.quantity));
const computePurchaseOrderLineStatus = (line) => {
    const explicitStatus = normalizeLineStatus(String(line.line_status || "open"));
    if (explicitStatus === "cancelled")
        return explicitStatus;
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
    if (receivedQuantity <= 0)
        return "open";
    if (receivedQuantity + 0.0001 < targetQuantity)
        return "partially_delivered";
    return "delivered";
};
const deriveReceiptStatusFromLines = (lines) => {
    if (lines.length === 0)
        return "not_received";
    const hasReceipts = lines.some((line) => readNumber(line.received_quantity) > 0);
    if (!hasReceipts)
        return "not_received";
    const hasToleranceReceipt = lines.some((line) => readNumber(line.received_quantity) > getLineTargetQuantity(line) + 0.0001);
    const allDelivered = lines.every((line) => {
        const lineStatus = computePurchaseOrderLineStatus(line);
        return lineStatus === "delivered" || lineStatus === "closed";
    });
    if (allDelivered) {
        return hasToleranceReceipt ? "delivered_with_tolerance" : "delivered";
    }
    return "partially_delivered";
};
const normalizePurchaseOrderForClient = (order) => {
    const lines = (order.lines || []).map((line) => ({
        ...line,
        quantity: readNumber(line.quantity),
        confirmed_quantity: readNumber(line.confirmed_quantity ?? line.quantity),
        received_quantity: readNumber(line.received_quantity),
        accepted_quantity: readNumber(line.accepted_quantity),
        rejected_quantity: readNumber(line.rejected_quantity),
        invoiced_quantity: readNumber(line.invoiced_quantity),
        unit_price: readNumber(line.unit_price),
        total_price: readNumber(line.total_price, roundQuantity(readNumber(line.quantity) * readNumber(line.unit_price), 2)),
        over_delivery_tolerance_pct: readNumber(line.over_delivery_tolerance_pct),
        under_delivery_tolerance_pct: readNumber(line.under_delivery_tolerance_pct, 100),
        line_status: computePurchaseOrderLineStatus(line),
        last_reception_id: line.last_reception_id ?? line.reception_id ?? null,
        last_received_at: line.last_received_at ?? null,
        last_supplier_lot: line.last_supplier_lot ?? null,
    }));
    const receiptStatus = deriveReceiptStatusFromLines(lines);
    const invoiceStatus = normalizeInvoiceStatus(String(order.invoice_status || "not_invoiced"));
    const explicitStatus = normalizePurchaseOrderStatus(String(order.status || "draft"));
    let status = explicitStatus;
    if (status !== "cancelled") {
        if (invoiceStatus === "invoiced" && (receiptStatus === "delivered" || receiptStatus === "delivered_with_tolerance")) {
            status = "invoiced";
        }
        else if (String(order.receipt_status || "") === "discrepancy") {
            status = "on_hold";
        }
        else if (receiptStatus === "delivered" || receiptStatus === "delivered_with_tolerance") {
            status = "delivered";
        }
        else if (receiptStatus === "partially_delivered") {
            status = "partially_delivered";
        }
    }
    return {
        ...order,
        status,
        lines,
        invoice_status: invoiceStatus,
        receipt_status: String(order.receipt_status || "") === "discrepancy" ? "discrepancy" : receiptStatus,
        goods_receipt_count: order.goods_receipt_count ??
            Array.from(new Set(lines.map((line) => line.last_reception_id || line.reception_id).filter(Boolean))).length,
        line_count: order.line_count ?? lines.length,
        approval_required: order.approval_required ?? readNumber(order.total_amount) >= readNumber(order.approval_threshold, PURCHASE_ORDER_APPROVAL_THRESHOLD),
        approval_threshold: readNumber(order.approval_threshold, PURCHASE_ORDER_APPROVAL_THRESHOLD),
    };
};
const parseNotesMeta = (notes) => {
    if (!notes)
        return { plain: "", meta: {} };
    const start = notes.indexOf(META_START);
    const end = notes.indexOf(META_END);
    if (start === -1 || end === -1 || end < start) {
        return { plain: notes.trim(), meta: {} };
    }
    const plain = `${notes.slice(0, start)}${notes.slice(end + META_END.length)}`.trim();
    const jsonRaw = notes.slice(start + META_START.length, end);
    try {
        return { plain, meta: JSON.parse(jsonRaw) };
    }
    catch {
        return { plain: notes.trim(), meta: {} };
    }
};
const buildNotesWithMeta = (plain, meta) => {
    const normalizedPlain = plain?.trim() || "";
    const hasMeta = Object.keys(meta || {}).length > 0;
    if (!hasMeta)
        return normalizedPlain;
    const metaBlock = `${META_START}${JSON.stringify(meta)}${META_END}`;
    return normalizedPlain ? `${normalizedPlain}\n\n${metaBlock}` : metaBlock;
};
const cleanPatch = (input, blocked = []) => {
    const output = {};
    for (const [key, value] of Object.entries(input || {})) {
        if (value === undefined)
            continue;
        if (blocked.includes(key))
            continue;
        output[key] = value;
    }
    return output;
};
const buildOrderHeaderPayload = (order, lines) => {
    const supplierId = readString(order.supplier_id);
    if (!supplierId) {
        throw badRequest("SUPPLIER_REQUIRED", "supplier_id obligatoire");
    }
    if (!Array.isArray(lines) || lines.length === 0) {
        throw badRequest("LINES_REQUIRED", "Ajoutez au moins une ligne");
    }
    const today = new Date().toISOString().split("T")[0];
    const computedSubtotal = lines.reduce((sum, line) => sum + readNumber(line.quantity) * readNumber(line.unit_price), 0);
    const computedTax = readNumber(order.tax_amount);
    const computedTotal = computedSubtotal + computedTax;
    const payload = {
        status: order.status ?? "draft",
        order_date: order.order_date || today,
        currency: order.currency || "TND",
        tax_amount: computedTax,
        subtotal: order.subtotal ?? computedSubtotal,
        total_amount: order.total_amount ?? computedTotal,
        invoice_status: order.invoice_status ?? "not_invoiced",
        receipt_status: order.receipt_status ?? "not_received",
        goods_receipt_count: order.goods_receipt_count ?? 0,
        line_count: lines.length,
        approval_threshold: order.approval_threshold ?? PURCHASE_ORDER_APPROVAL_THRESHOLD,
        ...order,
    };
    payload.subtotal = readNumber(payload.subtotal, computedSubtotal);
    payload.total_amount = readNumber(payload.total_amount, computedTotal);
    payload.approval_threshold = readNumber(payload.approval_threshold, PURCHASE_ORDER_APPROVAL_THRESHOLD);
    payload.approval_required =
        payload.approval_required ??
            readNumber(payload.total_amount) >= readNumber(payload.approval_threshold, PURCHASE_ORDER_APPROVAL_THRESHOLD);
    payload.buyer_name = payload.buyer_name || payload.created_by || null;
    payload.line_count = lines.length;
    return payload;
};
const buildOrderLinePayloads = (orderId, lines) => lines.map((line, index) => {
    const quantity = readNumber(line.quantity);
    const unitPrice = readNumber(line.unit_price);
    return {
        ...line,
        order_id: orderId,
        line_number: line.line_number ?? index + 1,
        confirmed_quantity: line.confirmed_quantity ?? quantity,
        received_quantity: line.received_quantity ?? 0,
        accepted_quantity: line.accepted_quantity ?? 0,
        rejected_quantity: line.rejected_quantity ?? 0,
        invoiced_quantity: line.invoiced_quantity ?? 0,
        over_delivery_tolerance_pct: line.over_delivery_tolerance_pct ?? 0,
        under_delivery_tolerance_pct: line.under_delivery_tolerance_pct ?? 100,
        line_status: line.line_status ?? "open",
        total_price: quantity * unitPrice,
        material_id: line.material_id ?? null,
        notes: line.notes ?? null,
    };
});
const getOrderReceiptLifecycle = (orderLines) => {
    const normalized = orderLines.map((line) => ({
        target: getLineTargetQuantity(line),
        received: readNumber(line.received_quantity),
    }));
    const hasReceipt = normalized.some((line) => line.received > 0);
    const allDelivered = normalized.length > 0 && normalized.every((line) => line.received + 0.0001 >= line.target);
    return {
        hasReceipt,
        allDelivered,
        nextStatus: allDelivered
            ? "delivered"
            : hasReceipt
                ? "partially_delivered"
                : "confirmed",
    };
};
let PurchasingService = class PurchasingService {
    async loadSuppliersMap(ids) {
        if (ids.length === 0)
            return new Map();
        const rows = sanitizeDocument(await Suppliers().find({ id: { $in: ids } }).lean().exec());
        return new Map(rows.map((row) => [String(row.id), row]));
    }
    async loadMaterialsMap(ids) {
        if (ids.length === 0)
            return new Map();
        const rows = sanitizeDocument(await Materials().find({ id: { $in: ids } }).lean().exec());
        return new Map(rows.map((row) => [String(row.id), row]));
    }
    async attachRequisitionRelations(requisitions) {
        if (requisitions.length === 0)
            return [];
        const supplierIds = uniqueStrings(requisitions.map((row) => row.preferred_supplier_id));
        const materialIds = uniqueStrings(requisitions.map((row) => row.material_id));
        const [supplierMap, materialMap] = await Promise.all([
            this.loadSuppliersMap(supplierIds),
            this.loadMaterialsMap(materialIds),
        ]);
        return requisitions.map((row) => ({
            ...row,
            material: materialMap.get(String(row.material_id || "")) || null,
            preferred_supplier: supplierMap.get(String(row.preferred_supplier_id || "")) || null,
        }));
    }
    async attachOrderRelations(orders) {
        if (orders.length === 0)
            return [];
        const orderIds = uniqueStrings(orders.map((row) => row.id));
        const supplierIds = uniqueStrings(orders.map((row) => row.supplier_id));
        const requisitionIds = uniqueStrings(orders.map((row) => row.requisition_id));
        const [rawLines, suppliers, requisitions] = await Promise.all([
            sanitizeDocument(await PurchaseOrderLines()
                .find({ order_id: { $in: orderIds } })
                .sort({ line_number: 1, created_at: 1 })
                .lean()
                .exec()),
            this.loadSuppliersMap(supplierIds),
            sanitizeDocument(await PurchaseRequisitions().find({ id: { $in: requisitionIds } }).lean().exec()),
        ]);
        const materialMap = await this.loadMaterialsMap(uniqueStrings(rawLines.map((line) => line.material_id)));
        const requisitionMap = new Map(requisitions.map((row) => [String(row.id), row]));
        const linesByOrder = new Map();
        for (const line of rawLines) {
            const orderId = String(line.order_id || "");
            const list = linesByOrder.get(orderId) || [];
            list.push({
                ...line,
                material: materialMap.get(String(line.material_id || "")) || null,
            });
            linesByOrder.set(orderId, list);
        }
        return orders.map((row) => sanitizeDocument({
            ...row,
            supplier: suppliers.get(String(row.supplier_id || "")) || null,
            requisition: requisitionMap.get(String(row.requisition_id || "")) || null,
            lines: linesByOrder.get(String(row.id || "")) || [],
        }));
    }
    async listRequisitions(status) {
        const query = status ? { status } : {};
        const rows = sanitizeDocument(await PurchaseRequisitions().find(query).sort({ created_at: -1 }).lean().exec());
        return this.attachRequisitionRelations(rows);
    }
    async getRequisitionById(requisitionId) {
        if (!requisitionId)
            return null;
        const row = sanitizeDocument(await PurchaseRequisitions().findOne({ id: requisitionId }).lean().exec());
        if (!row)
            return null;
        const [requisition] = await this.attachRequisitionRelations([row]);
        return requisition || null;
    }
    async createRequisition(payload, actor) {
        const requisition = await prepareInsertDocument("purchase_requisitions", {
            ...payload,
            requester_id: payload.requester_id ?? actor?.id ?? null,
        });
        await PurchaseRequisitions().create([requisition]);
        return this.getRequisitionById(String(requisition.id));
    }
    async updateRequisition(requisitionId, payload) {
        const existing = await PurchaseRequisitions().findOne({ id: requisitionId }).lean().exec();
        if (!existing) {
            throw notFound("REQUISITION_NOT_FOUND", "Demande d'achat introuvable.");
        }
        await PurchaseRequisitions().updateOne({ id: requisitionId }, {
            $set: {
                ...cleanPatch(payload, ["id", "material", "preferred_supplier", "requisition_number", "created_at"]),
                updated_at: new Date().toISOString(),
            },
        }).exec();
        return this.getRequisitionById(requisitionId);
    }
    async approveRequisition(requisitionId, approverName) {
        if (!readString(approverName)) {
            throw badRequest("APPROVER_REQUIRED", "approverName is required.");
        }
        return this.updateRequisition(requisitionId, {
            status: "approved",
            approved_by: approverName,
            approved_at: new Date().toISOString(),
        });
    }
    async rejectRequisition(requisitionId, reason, rejectorName) {
        if (!readString(reason)) {
            throw badRequest("REJECTION_REASON_REQUIRED", "reason is required.");
        }
        if (!readString(rejectorName)) {
            throw badRequest("REJECTOR_REQUIRED", "rejectorName is required.");
        }
        return this.updateRequisition(requisitionId, {
            status: "rejected",
            rejection_reason: reason,
            approved_by: rejectorName,
            approved_at: new Date().toISOString(),
        });
    }
    async deleteRequisition(requisitionId) {
        const result = await PurchaseRequisitions().deleteOne({ id: requisitionId }).exec();
        if (!result.deletedCount) {
            throw notFound("REQUISITION_NOT_FOUND", "Demande d'achat introuvable.");
        }
        return { id: requisitionId, deleted: true };
    }
    async listOrders(status) {
        const rows = sanitizeDocument(await PurchaseOrders().find({}).sort({ created_at: -1 }).lean().exec());
        const orders = await this.attachOrderRelations(rows);
        if (!status)
            return orders;
        const expected = normalizePurchaseOrderStatus(status);
        return orders.filter((order) => normalizePurchaseOrderForClient(order).status === expected);
    }
    async getOrderById(orderId) {
        if (!orderId)
            return null;
        const row = sanitizeDocument(await PurchaseOrders().findOne({ id: orderId }).lean().exec());
        if (!row)
            return null;
        const [order] = await this.attachOrderRelations([row]);
        return order || null;
    }
    async createOrder(input, actor) {
        const orderPayload = buildOrderHeaderPayload({
            ...(input.order || {}),
            status: input.order?.status ?? "draft",
            created_by: input.order?.created_by ?? actor?.id ?? null,
        }, input.lines || []);
        const preparedOrder = await prepareInsertDocument("purchase_orders", orderPayload);
        await PurchaseOrders().create([preparedOrder]);
        try {
            const linePayloads = buildOrderLinePayloads(String(preparedOrder.id), input.lines || []);
            const preparedLines = [];
            for (const line of linePayloads) {
                preparedLines.push(await prepareInsertDocument("purchase_order_lines", line));
            }
            if (preparedLines.length > 0) {
                await PurchaseOrderLines().insertMany(preparedLines);
            }
            if (preparedOrder.requisition_id) {
                await PurchaseRequisitions().updateOne({ id: preparedOrder.requisition_id }, { $set: { status: "ordered", updated_at: new Date().toISOString() } }).exec();
            }
        }
        catch (error) {
            await PurchaseOrderLines().deleteMany({ order_id: preparedOrder.id }).exec();
            await PurchaseOrders().deleteOne({ id: preparedOrder.id }).exec();
            throw error;
        }
        return this.getOrderById(String(preparedOrder.id));
    }
    async updateOrder(orderId, input) {
        const existing = await PurchaseOrders().findOne({ id: orderId }).lean().exec();
        if (!existing) {
            throw notFound("PURCHASE_ORDER_NOT_FOUND", "Bon de commande introuvable.");
        }
        const orderPayload = buildOrderHeaderPayload(input.order || {}, input.lines || []);
        await PurchaseOrders().updateOne({ id: orderId }, {
            $set: {
                ...cleanPatch(orderPayload, ["id", "supplier", "requisition", "lines", "order_number", "created_at"]),
                updated_at: new Date().toISOString(),
            },
        }).exec();
        await PurchaseOrderLines().deleteMany({ order_id: orderId }).exec();
        const linePayloads = buildOrderLinePayloads(orderId, input.lines || []);
        const preparedLines = [];
        for (const line of linePayloads) {
            preparedLines.push(await prepareInsertDocument("purchase_order_lines", line));
        }
        if (preparedLines.length > 0) {
            await PurchaseOrderLines().insertMany(preparedLines);
        }
        if (orderPayload.requisition_id) {
            await PurchaseRequisitions().updateOne({ id: orderPayload.requisition_id }, { $set: { status: "ordered", updated_at: new Date().toISOString() } }).exec();
        }
        return this.getOrderById(orderId);
    }
    async sendOrder(orderId) {
        await PurchaseOrders().updateOne({ id: orderId }, {
            $set: {
                status: "submitted",
                submitted_at: new Date().toISOString(),
                sent_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            },
        }).exec();
        const order = await this.getOrderById(orderId);
        if (!order) {
            throw notFound("PURCHASE_ORDER_NOT_FOUND", "Bon de commande introuvable.");
        }
        return order;
    }
    async confirmOrder(orderId, expectedDate) {
        await PurchaseOrders().updateOne({ id: orderId }, {
            $set: {
                status: "confirmed",
                confirmed_at: new Date().toISOString(),
                expected_delivery_date: expectedDate || null,
                updated_at: new Date().toISOString(),
            },
        }).exec();
        const order = await this.getOrderById(orderId);
        if (!order) {
            throw notFound("PURCHASE_ORDER_NOT_FOUND", "Bon de commande introuvable.");
        }
        return order;
    }
    async approveOrder(orderId, approverName) {
        if (!readString(approverName)) {
            throw badRequest("APPROVER_REQUIRED", "approverName is required.");
        }
        await PurchaseOrders().updateOne({ id: orderId }, {
            $set: {
                approved_by: approverName,
                approved_at: new Date().toISOString(),
                approval_required: true,
                approval_threshold: PURCHASE_ORDER_APPROVAL_THRESHOLD,
                updated_at: new Date().toISOString(),
            },
        }).exec();
        const order = await this.getOrderById(orderId);
        if (!order) {
            throw notFound("PURCHASE_ORDER_NOT_FOUND", "Bon de commande introuvable.");
        }
        return order;
    }
    async receiveOrderLine(orderId, payload) {
        const lineId = readString(payload.lineId, payload.line_id);
        const supplierLot = readString(payload.supplierLot, payload.supplier_lot);
        const qcStatus = readString(payload.qcStatus, payload.qc_status) || "accepted";
        const receivedNow = readNumber(payload.receivedNow ?? payload.received_now);
        const grnNumber = readString(payload.grnNumber, payload.grn_number);
        const quarantineReason = readString(payload.quarantineReason, payload.quarantine_reason);
        const rejectionReason = readString(payload.rejectionReason, payload.rejection_reason);
        const receivedBy = readString(payload.receivedBy, payload.received_by);
        if (!lineId)
            throw badRequest("LINE_REQUIRED", "lineId est requis.");
        if (receivedNow <= 0)
            throw badRequest("INVALID_RECEIVED_QUANTITY", "Quantité réceptionnée invalide.");
        if (!supplierLot)
            throw badRequest("SUPPLIER_LOT_REQUIRED", "Lot fournisseur obligatoire pour traçabilité.");
        const line = sanitizeDocument(await PurchaseOrderLines().findOne({ id: lineId, order_id: orderId }).lean().exec());
        if (!line)
            throw notFound("PURCHASE_ORDER_LINE_NOT_FOUND", "Ligne de commande introuvable.");
        const targetQuantity = getLineTargetQuantity(line);
        const previousReceived = readNumber(line.received_quantity);
        const previousAccepted = readNumber(line.accepted_quantity);
        const previousRejected = readNumber(line.rejected_quantity);
        const previousQuarantine = readNumber(line.quarantine_quantity);
        const overTolerancePct = readNumber(line.over_delivery_tolerance_pct);
        const maxReceivable = targetQuantity * (1 + overTolerancePct / 100);
        const newReceived = previousReceived + receivedNow;
        if (newReceived > maxReceivable + 0.0001) {
            throw badRequest("RECEIPT_EXCEEDS_TOLERANCE", `La quantité dépasse la tolérance +${overTolerancePct}% (max autorisé: ${maxReceivable.toFixed(2)}).`);
        }
        // QC routing: accepted→accepted_qty, conditional→quarantine_qty, rejected→rejected_qty
        const nextAcceptedQuantity = qcStatus === "accepted" ? previousAccepted + receivedNow : previousAccepted;
        const nextQuarantineQuantity = qcStatus === "conditional" ? previousQuarantine + receivedNow : previousQuarantine;
        const nextRejectedQuantity = qcStatus === "rejected" ? previousRejected + receivedNow : previousRejected;
        const now = new Date().toISOString();
        const nextLineStatus = computePurchaseOrderLineStatus({
            ...line,
            received_quantity: newReceived,
            accepted_quantity: nextAcceptedQuantity,
            rejected_quantity: nextRejectedQuantity,
        });
        await PurchaseOrderLines().updateOne({ id: lineId }, {
            $set: {
                received_quantity: newReceived,
                accepted_quantity: nextAcceptedQuantity,
                quarantine_quantity: nextQuarantineQuantity,
                rejected_quantity: nextRejectedQuantity,
                last_supplier_lot: supplierLot,
                last_received_at: now,
                line_status: nextLineStatus,
                updated_at: now,
            },
        }).exec();
        // Immutable receipt log — replaces notes-append pattern
        const logDoc = await prepareInsertDocument("purchase_order_receipt_logs", {
            order_id: orderId,
            line_id: lineId,
            grn_number: grnNumber || null,
            received_qty: receivedNow,
            supplier_lot: supplierLot,
            qc_status: qcStatus,
            quarantine_reason: qcStatus === "conditional" ? (quarantineReason || "Sous réserve QC") : null,
            rejection_reason: qcStatus === "rejected" ? (rejectionReason || null) : null,
            received_by: receivedBy || null,
        });
        ReceiptLogs().insertOne(logDoc).catch(() => null);
        const orderLines = sanitizeDocument(await PurchaseOrderLines().find({ order_id: orderId }).lean().exec());
        const lifecycle = getOrderReceiptLifecycle(orderLines);
        const hasDiscrepancy = qcStatus === "conditional" || qcStatus === "rejected" ||
            orderLines.some((l) => l.quarantine_quantity > 0 || readNumber(l.rejected_quantity) > 0);
        const nextReceiptStatus = hasDiscrepancy
            ? "discrepancy"
            : lifecycle.allDelivered
                ? "delivered"
                : lifecycle.hasReceipt
                    ? "partially_delivered"
                    : "not_received";
        const orderUpdate = {
            status: nextReceiptStatus === "discrepancy" ? "on_hold" : lifecycle.nextStatus,
            receipt_status: nextReceiptStatus,
            updated_at: now,
        };
        if (lifecycle.allDelivered && !hasDiscrepancy) {
            orderUpdate.delivered_at = now;
            orderUpdate.actual_delivery_date = now.split("T")[0];
        }
        await PurchaseOrders().updateOne({ id: orderId }, { $set: orderUpdate }).exec();
        const order = await this.getOrderById(orderId);
        if (!order)
            throw notFound("PURCHASE_ORDER_NOT_FOUND", "Bon de commande introuvable.");
        return order;
    }
    async saveThreeWayMatch(orderId, payload) {
        const invoiceNumber = readString(payload.invoiceNumber, payload.invoice_number);
        const invoiceDate = readString(payload.invoiceDate, payload.invoice_date);
        const invoiceAmount = readNumber(payload.invoiceAmount ?? payload.invoice_amount);
        const tolerancePct = readNumber(payload.tolerancePct ?? payload.tolerance_pct);
        if (!invoiceNumber)
            throw badRequest("INVOICE_NUMBER_REQUIRED", "N° facture requis.");
        if (!invoiceDate)
            throw badRequest("INVOICE_DATE_REQUIRED", "Date facture requise.");
        if (invoiceAmount <= 0)
            throw badRequest("INVOICE_AMOUNT_REQUIRED", "Montant facture invalide.");
        const order = sanitizeDocument(await PurchaseOrders().findOne({ id: orderId }).lean().exec());
        if (!order)
            throw notFound("PURCHASE_ORDER_NOT_FOUND", "Bon de commande introuvable.");
        const totalAmount = readNumber(order.total_amount);
        const varianceAmount = invoiceAmount - totalAmount;
        const variancePct = totalAmount > 0 ? (varianceAmount / totalAmount) * 100 : 0;
        const matched = Math.abs(variancePct) <= tolerancePct;
        const currentStatus = normalizePurchaseOrderStatus(String(order.status || "draft"));
        // Auto-advance to "invoiced" only when matched AND goods were delivered
        const nextStatus = matched && ["delivered", "partially_delivered", "on_hold"].includes(currentStatus)
            ? "invoiced"
            : matched && currentStatus === "on_hold"
                ? "on_hold"
                : currentStatus;
        const nextInvoiceStatus = matched ? "invoiced" : "blocked";
        const now = new Date().toISOString();
        // Store all 3-way match data in dedicated fields — NOT in notes JSON
        await PurchaseOrders().updateOne({ id: orderId }, {
            $set: {
                status: nextStatus,
                invoice_number: invoiceNumber,
                invoice_date: invoiceDate,
                invoice_amount: invoiceAmount,
                invoice_tolerance_pct: tolerancePct,
                invoice_variance_amount: Math.round(varianceAmount * 100) / 100,
                invoice_variance_pct: Math.round(variancePct * 1000) / 1000,
                three_way_match_status: matched ? "matched" : "mismatch",
                three_way_match_at: now,
                invoice_status: nextInvoiceStatus,
                invoiced_at: matched ? now : null,
                updated_at: now,
            },
        }).exec();
        const refreshed = await this.getOrderById(orderId);
        if (!refreshed)
            throw notFound("PURCHASE_ORDER_NOT_FOUND", "Bon de commande introuvable.");
        return refreshed;
    }
    async getReceiptLogs(orderId) {
        return sanitizeDocument(await ReceiptLogs()
            .find({ order_id: orderId })
            .sort({ received_at: -1 })
            .lean()
            .exec());
    }
    async getLinkedReceptions(orderId) {
        // Fetch reception lots that reference this PO
        const lots = sanitizeDocument(await ReceptionLots()
            .find({ purchase_order_id: orderId })
            .sort({ created_at: -1 })
            .lean()
            .exec());
        // Also fetch via receptions_v2 (some may have PO at reception level not lot level)
        const receptions = sanitizeDocument(await getCollectionModel("receptions_v2")
            .find({ purchase_order_id: orderId })
            .sort({ created_at: -1 })
            .lean()
            .exec());
        return { lots, receptions };
    }
    async deleteOrder(orderId) {
        await PurchaseOrderLines().deleteMany({ order_id: orderId }).exec();
        const result = await PurchaseOrders().deleteOne({ id: orderId }).exec();
        if (!result.deletedCount) {
            throw notFound("PURCHASE_ORDER_NOT_FOUND", "Bon de commande introuvable.");
        }
        return { id: orderId, deleted: true };
    }
    async addOrderLine(payload) {
        const orderId = readString(payload.order_id, payload.orderId);
        if (!orderId) {
            throw badRequest("ORDER_REQUIRED", "order_id is required.");
        }
        const line = await prepareInsertDocument("purchase_order_lines", {
            ...payload,
            order_id: orderId,
            confirmed_quantity: payload.confirmed_quantity ?? readNumber(payload.quantity),
            received_quantity: payload.received_quantity ?? 0,
            accepted_quantity: payload.accepted_quantity ?? 0,
            rejected_quantity: payload.rejected_quantity ?? 0,
            invoiced_quantity: payload.invoiced_quantity ?? 0,
            over_delivery_tolerance_pct: payload.over_delivery_tolerance_pct ?? 0,
            under_delivery_tolerance_pct: payload.under_delivery_tolerance_pct ?? 100,
            line_status: payload.line_status ?? "open",
        });
        await PurchaseOrderLines().create([line]);
        await PurchaseOrders().updateOne({ id: orderId }, { $set: { updated_at: new Date().toISOString() }, $inc: { line_count: 1 } }).exec();
        return sanitizeDocument(line);
    }
    async updateOrderLine(lineId, payload) {
        const existing = sanitizeDocument(await PurchaseOrderLines().findOne({ id: lineId }).lean().exec());
        if (!existing) {
            throw notFound("PURCHASE_ORDER_LINE_NOT_FOUND", "Ligne de commande introuvable.");
        }
        await PurchaseOrderLines().updateOne({ id: lineId }, {
            $set: {
                ...cleanPatch(payload, ["id", "material", "created_at"]),
                updated_at: new Date().toISOString(),
            },
        }).exec();
        await PurchaseOrders().updateOne({ id: existing.order_id }, { $set: { updated_at: new Date().toISOString() } }).exec();
        return sanitizeDocument(await PurchaseOrderLines().findOne({ id: lineId }).lean().exec());
    }
    async deleteOrderLine(lineId) {
        const existing = sanitizeDocument(await PurchaseOrderLines().findOne({ id: lineId }).lean().exec());
        if (!existing) {
            throw notFound("PURCHASE_ORDER_LINE_NOT_FOUND", "Ligne de commande introuvable.");
        }
        await PurchaseOrderLines().deleteOne({ id: lineId }).exec();
        await PurchaseOrders().updateOne({ id: existing.order_id }, { $set: { updated_at: new Date().toISOString() }, $inc: { line_count: -1 } }).exec();
        return { id: lineId, deleted: true, order_id: existing.order_id };
    }
    async getStats() {
        const [requisitions, orders] = await Promise.all([
            sanitizeDocument(await PurchaseRequisitions().find({}).lean().exec()),
            this.listOrders(),
        ]);
        const normalizedOrders = orders.map((order) => normalizePurchaseOrderForClient(order));
        const thisMonth = new Date().toISOString().slice(0, 7);
        return {
            requisitions: {
                total: requisitions.length,
                pending: requisitions.filter((requisition) => requisition.status === "pending_approval").length,
                approved: requisitions.filter((requisition) => requisition.status === "approved").length,
                rejected: requisitions.filter((requisition) => requisition.status === "rejected").length,
            },
            orders: {
                total: normalizedOrders.length,
                draft: normalizedOrders.filter((order) => order.status === "draft").length,
                submitted: normalizedOrders.filter((order) => order.status === "submitted").length,
                confirmed: normalizedOrders.filter((order) => order.status === "confirmed").length,
                partiallyDelivered: normalizedOrders.filter((order) => order.status === "partially_delivered").length,
                delivered: normalizedOrders.filter((order) => order.status === "delivered").length,
                invoiced: normalizedOrders.filter((order) => order.status === "invoiced").length,
                onHold: normalizedOrders.filter((order) => order.status === "on_hold").length,
                totalAmount: normalizedOrders.reduce((sum, order) => sum + readNumber(order.total_amount), 0),
                monthlyAmount: normalizedOrders
                    .filter((order) => String(order.order_date || "").startsWith(thisMonth))
                    .reduce((sum, order) => sum + readNumber(order.total_amount), 0),
            },
        };
    }
};
PurchasingService = __decorate([
    Injectable()
], PurchasingService);
export { PurchasingService };
