var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import mongoose from "mongoose";
import { Injectable } from "@nestjs/common";
import { badRequest, notFound } from "../../core/app-error.js";
import { getCollectionModel, sanitizeDocument } from "../../db/dynamic-model.js";
import { prepareInsertDocument } from "../../db/defaults.js";
import { applyPurchaseOrderQcDecision, registerReceptionAgainstPurchaseOrder, resolvePurchaseOrderReceiptTarget, } from "../purchasing/purchase-order-domain.js";
import { syncReceptionLotsToStock, loadReceptionLots } from "./reception-stock-sync.js";
// ── Supplier business-rule helpers ────────────────────────────────────────────
const Suppliers = () => getCollectionModel("suppliers");
const gradeQualityScore = (grade) => {
    if (grade === "EXTRA")
        return 100;
    if (grade === "CATEGORIE_I")
        return 80;
    if (grade === "CATEGORIE_II")
        return 60;
    return 0; // REJETE or unknown
};
/**
 * After each QC decision, recompute the supplier's live metrics from
 * the full reception history then enforce RG-F03, RG-F04, RG-F05.
 */
const recalculateSupplierMetrics = async (supplierId, actorId) => {
    const supplier = sanitizeDocument(await Suppliers().findOne({ $or: [{ id: supplierId }, { code: supplierId }] }).lean().exec());
    if (!supplier)
        return;
    // Pull every closed reception for this supplier
    const allReceptions = sanitizeDocument(await getCollectionModel("receptions_v2")
        .find({ supplier_id: supplierId, status: { $in: ["LIBERE", "REJETE", "BLOQUE"] } })
        .lean()
        .exec());
    const total = allReceptions.length;
    const rejected = allReceptions.filter((r) => r.status === "REJETE").length;
    const rejectionRate = total > 0 ? Math.round((rejected / total) * 100 * 10) / 10 : 0;
    // Quality score = average of per-lot grade scores (last 12 months)
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1);
    const recentReceptions = allReceptions.filter((r) => r.qc_grade && new Date(String(r.created_at)).getTime() > twelveMonthsAgo.getTime());
    const qualityScore = recentReceptions.length > 0
        ? Math.round(recentReceptions.reduce((sum, r) => sum + gradeQualityScore(r.qc_grade), 0) /
            recentReceptions.length)
        : Number(supplier.quality_score ?? 0);
    const totalTons = allReceptions.reduce((sum, r) => sum + Number(r.quantity_total ?? 0), 0) / 1000;
    const deliveredLotsCount = total;
    const now = new Date().toISOString();
    // ── RG-F03: auto-block when rejection_rate > 20% ─────────────────────────
    const shouldAutoBlock = rejectionRate > 20;
    const newStatus = shouldAutoBlock ? "blocked" : String(supplier.supplier_status ?? "active");
    const newIsActive = !shouldAutoBlock && supplier.supplier_status === "active";
    await Suppliers().updateOne({ $or: [{ id: supplierId }, { code: supplierId }] }, {
        $set: {
            quality_score: qualityScore,
            rejection_rate: rejectionRate,
            delivered_lots_count: deliveredLotsCount,
            total_delivered_tons: Math.round(totalTons * 100) / 100,
            last_delivery_date: now.slice(0, 10),
            supplier_status: newStatus,
            is_active: newIsActive,
            updated_at: now,
        },
    }).exec();
    const notifs = [];
    if (shouldAutoBlock) {
        // RG-F03 notification
        notifs.push({
            notification_type: "SUPPLIER_AUTO_BLOCKED",
            category: "supplier",
            title: `Fournisseur bloqué automatiquement — ${supplier.name}`,
            message: `RG-F03 : taux de rejet ${rejectionRate}% > 20% sur les 6 derniers mois. Fournisseur ${supplier.code} passé en statut Bloqué.`,
            severity: "critical",
            entity_type: "suppliers",
            entity_id: String(supplier.id || supplier._id),
            metadata: { supplier_code: supplier.code, rejection_rate: rejectionRate },
        });
    }
    // ── RG-F04: score alert when quality_score < 60 ───────────────────────────
    if (qualityScore < 60 && Number(supplier.quality_score ?? 100) >= 60) {
        notifs.push({
            notification_type: "SUPPLIER_SCORE_ALERT",
            category: "supplier",
            title: `Alerte score fournisseur — ${supplier.name}`,
            message: `RG-F04 : score qualité ${qualityScore}/100 < 60. Un plan d'amélioration est recommandé pour ${supplier.code}.`,
            severity: "warning",
            entity_type: "suppliers",
            entity_id: String(supplier.id || supplier._id),
            metadata: { supplier_code: supplier.code, quality_score: qualityScore },
        });
    }
    if (notifs.length > 0) {
        const Notifications = getCollectionModel("system_notifications");
        const prepared = await Promise.all(notifs.map((n) => prepareInsertDocument("system_notifications", n)));
        await Notifications.insertMany(prepared);
    }
    console.log(`[RG] Supplier ${supplier.code} metrics updated — score=${qualityScore}, rejection=${rejectionRate}%, status=${newStatus}`);
};
/**
 * RG-F05: scan all suppliers for contracts expiring within 30 days and
 * create a notification if one hasn't been sent this month.
 * Called from /api/suppliers/check-expirations (cron or manual).
 */
export const checkSupplierContractExpirations = async () => {
    const today = new Date();
    const in30Days = new Date(today);
    in30Days.setDate(in30Days.getDate() + 30);
    const todayStr = today.toISOString().slice(0, 10);
    const in30DaysStr = in30Days.toISOString().slice(0, 10);
    const expiring = sanitizeDocument(await Suppliers()
        .find({
        contract_expiry_alert_at: { $gte: todayStr, $lte: in30DaysStr },
        supplier_status: "active",
    })
        .lean()
        .exec());
    const Notifications = getCollectionModel("system_notifications");
    let sent = 0;
    for (const supplier of expiring) {
        const existing = await Notifications.findOne({
            notification_type: "SUPPLIER_CONTRACT_EXPIRY",
            entity_id: String(supplier.id || supplier._id),
            created_at: { $gte: new Date(today.getFullYear(), today.getMonth(), 1).toISOString() },
        }).lean().exec();
        if (existing)
            continue;
        const prepared = await prepareInsertDocument("system_notifications", {
            notification_type: "SUPPLIER_CONTRACT_EXPIRY",
            category: "supplier",
            title: `Contrat expirant bientôt — ${supplier.name}`,
            message: `RG-F05 : le contrat du fournisseur ${supplier.code} expire le ${supplier.contract_end_date}. Renouvellement requis.`,
            severity: "warning",
            entity_type: "suppliers",
            entity_id: String(supplier.id || supplier._id),
            metadata: { supplier_code: supplier.code, contract_end_date: supplier.contract_end_date },
        });
        await Notifications.create([prepared]);
        sent++;
    }
    return { checked: expiring.length, notificationsSent: sent };
};
const Receptions = () => getCollectionModel("receptions_v2");
const ReceptionLots = () => getCollectionModel("reception_lots");
const ReceptionUnits = () => getCollectionModel("reception_units");
const ReceptionAlerts = () => getCollectionModel("reception_alerts");
const Notifications = () => getCollectionModel("system_notifications");
const QCInspections = () => getCollectionModel("qc_inspections");
const QCCheckResults = () => getCollectionModel("qc_check_results");
const QCChecklists = () => getCollectionModel("qc_checklists");
const QCChecklistItems = () => getCollectionModel("qc_checklist_items");
const ReceptionStockMovements = () => getCollectionModel("reception_stock_movements");
const ReceptionAuditLogs = () => getCollectionModel("reception_audit_logs_v2");
const StockLots = () => getCollectionModel("stock_lots");
const WeighingRecords = () => getCollectionModel("weighing_records");
const EpcisEvents = () => getCollectionModel("epcis_events");
// ── EPCIS helper ──────────────────────────────────────────────────────────────
const writeEpcisObjectEvent = async (params) => {
    const evt = await prepareInsertDocument("epcis_events", {
        event_type: "ObjectEvent",
        event_time: new Date().toISOString(),
        event_time_zone_offset: "+01:00",
        biz_step: params.bizStep,
        disposition: params.disposition,
        epc_list: params.epcList,
        read_point: params.readPoint || null,
        biz_location: params.bizLocation || null,
        actor_id: params.actorId || null,
        entity_type: params.entityType,
        entity_id: params.entityId,
        metadata: params.metadata || {},
    });
    await EpcisEvents().create([evt]);
    return evt;
};
// ── GS1 payload builder ───────────────────────────────────────────────────────
const buildGs1Payload = (lot) => {
    const lotCode = String(lot.lot_internal || lot.qr_code_payload || lot.id || "");
    const netWeightKg = Number(lot.net_weight_kg ?? 0);
    const weightIn3103 = String(Math.round(netWeightKg * 1000)).padStart(6, "0");
    // AI (01) GTIN-14 — plant-level placeholder (no real GS1 company prefix)
    const rawGtin = lotCode.replace(/[^0-9]/g, "").padEnd(13, "0").slice(0, 13);
    const checkDigit = (10 - ([3, 1, 3, 1, 3, 1, 3, 1, 3, 1, 3, 1, 3]
        .reduce((sum, w, i) => sum + w * Number(rawGtin[i] ?? 0), 0) % 10)) % 10;
    const gtin14 = rawGtin + String(checkDigit);
    // AI (10) lot/batch number
    // AI (3103) net weight in kg, 3 implied decimal places
    // AI (11) production date YYMMDD
    const prodDate = String(lot.production_date || lot.created_at || "").slice(2, 10).replace(/-/g, "");
    const gs1_128 = `(01)${gtin14}(10)${lotCode}(3103)${weightIn3103}${prodDate ? `(11)${prodDate}` : ""}`;
    // GS1 DataMatrix uses FNC1 character (0x1D as GS)
    const GS = "\x1D";
    const datamatrix = `]d201${gtin14}${GS}10${lotCode}${GS}3103${weightIn3103}`;
    return { gtin14, lot_code: lotCode, net_weight_g: Math.round(netWeightKg * 1000), gs1_128, datamatrix, ai_payload: gs1_128 };
};
const ADMIN_ACTOR_ROLES = new Set([
    "admin",
    "administrateur_systeme",
    "directeur_general",
    "directeur_usine",
]);
const readString = (...values) => {
    for (const value of values) {
        if (typeof value === "string" && value.trim()) {
            return value.trim();
        }
    }
    return "";
};
const uniqueStrings = (values) => Array.from(new Set(values.map((value) => String(value || "").trim()).filter(Boolean)));
const getActorRoles = (actor) => {
    const actorRecord = (actor || {});
    const metadataValue = actorRecord.user_metadata;
    const metadata = metadataValue && typeof metadataValue === "object"
        ? metadataValue
        : undefined;
    const rawRoles = [
        ...(Array.isArray(metadata?.roles) ? metadata.roles : []),
        ...(Array.isArray(metadata?.domains) ? metadata.domains : []),
        metadata?.role,
    ];
    return rawRoles
        .map((role) => String(role || "").trim().toLowerCase())
        .filter(Boolean);
};
const isAdminActor = (actor) => getActorRoles(actor).some((role) => ADMIN_ACTOR_ROLES.has(role));
const receptionIdentityFilter = (receptionId) => {
    const filters = [{ id: receptionId }];
    if (mongoose.Types.ObjectId.isValid(receptionId)) {
        filters.push({ _id: new mongoose.Types.ObjectId(receptionId) });
    }
    return { $or: filters };
};
const ensureSupplierExists = async (supplierId) => {
    const Suppliers = getCollectionModel("suppliers");
    const orClauses = [
        { id: supplierId },
        { code: supplierId },
    ];
    if (mongoose.Types.ObjectId.isValid(supplierId)) {
        orClauses.push({ _id: new mongoose.Types.ObjectId(supplierId) });
    }
    const supplier = await Suppliers.findOne({ $or: orClauses }).lean().exec();
    if (!supplier) {
        throw badRequest("SUPPLIER_REQUIRED", "A valid supplier is required.");
    }
    return sanitizeDocument(supplier);
};
const round = (value, precision = 2) => {
    const factor = 10 ** precision;
    return Math.round(value * factor) / factor;
};
const buildReceptionStatusFromDecision = (decision) => {
    if (decision === "ACCEPTE")
        return "LIBERE";
    if (decision === "REJETE")
        return "REJETE";
    return "BLOQUE";
};
const buildLotStatusFromDecision = (decision) => {
    if (decision === "ACCEPTE")
        return "STOCK_LIBERE";
    if (decision === "REJETE")
        return "STOCK_REJETE";
    return "EN_QUARANTAINE";
};
const ZONE_STATUS_MAP = {
    // ── Legacy semantic zone IDs ──────────────────────────────────────────────
    ZONE_RECEPTION: "NON_STOCKE",
    ZONE_QUARANTAINE: "EN_QUARANTAINE",
    ZONE_MP_LIBEREE: "STOCK_LIBERE",
    ZONE_MP_LIBEREE_BIO: "STOCK_LIBERE",
    ZONE_REJET: "STOCK_REJETE",
};
/** Determine target stock status from zone code using prefix rules — more robust than a fixed map. */
const resolveZoneStatus = (zoneCode, currentStatus) => {
    if (ZONE_STATUS_MAP[zoneCode])
        return ZONE_STATUS_MAP[zoneCode];
    const up = zoneCode.toUpperCase();
    if (up.startsWith("CF-") || up.startsWith("ZE-"))
        return "STOCK_LIBERE";
    if (up.startsWith("FU-") || up.includes("QUARAN"))
        return "EN_QUARANTAINE";
    if (up.startsWith("ZR-") || up.startsWith("SB-"))
        return "NON_STOCKE";
    if (up.startsWith("ZONE_REJET") || up.includes("REJET"))
        return "STOCK_REJETE";
    // fallback: preserve current status
    const valid = ["NON_STOCKE", "EN_QUARANTAINE", "STOCK_LIBERE", "STOCK_REJETE"];
    return (valid.includes(currentStatus) ? currentStatus : "NON_STOCKE");
};
const buildStockLotStatus = (lotStatus) => {
    if (lotStatus === "STOCK_LIBERE")
        return "VALIDATED";
    if (lotStatus === "STOCK_REJETE")
        return "BLOCKED";
    return "QUARANTINE";
};
const RAW_ZONE_PREFIX = "SB-";
const TERMINAL_RECEPTION_STATUSES = ["REJETE", "ANNULE", "VALIDE", "ACCEPTE"];
const attachSuppliersToReceptions = async (receptions) => {
    if (receptions.length === 0)
        return receptions;
    const supplierIds = uniqueStrings(receptions.map((reception) => reception.supplier_id));
    if (supplierIds.length === 0) {
        return receptions.map((reception) => ({ ...reception, supplier: null }));
    }
    const suppliers = sanitizeDocument(await Suppliers().find({ id: { $in: supplierIds } }).lean().exec());
    const supplierMap = new Map(suppliers.map((supplier) => [String(supplier.id), supplier]));
    return receptions.map((reception) => ({
        ...reception,
        supplier: supplierMap.get(String(reception.supplier_id || "")) || null,
    }));
};
let ReceptionsService = class ReceptionsService {
    async listReceptions() {
        const receptions = sanitizeDocument(await Receptions().find({}).sort({ created_at: -1 }).lean().exec());
        return attachSuppliersToReceptions(receptions);
    }
    async getReceptionById(receptionId) {
        if (!receptionId)
            return null;
        const reception = sanitizeDocument(await Receptions().findOne(receptionIdentityFilter(receptionId)).lean().exec());
        if (!reception)
            return null;
        const [enrichedReception] = await attachSuppliersToReceptions([reception]);
        return enrichedReception || null;
    }
    async listReceptionLots(receptionId) {
        if (!receptionId) {
            throw badRequest("RECEPTION_REQUIRED", "receptionId is required.");
        }
        return sanitizeDocument(await ReceptionLots().find({ reception_id: receptionId }).sort({ created_at: 1 }).lean().exec());
    }
    async listReceptionUnits(lotId) {
        if (!lotId) {
            throw badRequest("RECEPTION_LOT_REQUIRED", "lotId is required.");
        }
        return sanitizeDocument(await ReceptionUnits().find({ reception_lot_id: lotId }).sort({ created_at: 1 }).lean().exec());
    }
    async listQcInspections(receptionId) {
        if (!receptionId) {
            throw badRequest("RECEPTION_REQUIRED", "receptionId is required.");
        }
        return sanitizeDocument(await QCInspections().find({ reception_id: receptionId }).sort({ created_at: -1 }).lean().exec());
    }
    async listQcChecklists(receptionType) {
        const query = { is_active: true };
        if (receptionType) {
            query.reception_type = receptionType;
        }
        return sanitizeDocument(await QCChecklists().find(query).sort({ name: 1 }).lean().exec());
    }
    async listQcChecklistItems(checklistId) {
        if (!checklistId) {
            throw badRequest("CHECKLIST_REQUIRED", "checklistId is required.");
        }
        return sanitizeDocument(await QCChecklistItems()
            .find({ checklist_id: checklistId, is_active: true })
            .sort({ sequence_order: 1 })
            .lean()
            .exec());
    }
    async listActiveAlerts() {
        return sanitizeDocument(await ReceptionAlerts().find({ status: "ACTIVE" }).sort({ created_at: -1 }).lean().exec());
    }
    async updateReceptionAlertStatus(alertId, payload) {
        if (!alertId) {
            throw badRequest("ALERT_REQUIRED", "alertId is required.");
        }
        const actorName = readString(payload.actorName);
        if (!actorName) {
            throw badRequest("ACTOR_NAME_REQUIRED", "actorName is required.");
        }
        const now = new Date().toISOString();
        const update = payload.status === "RESOLVED"
            ? {
                status: "RESOLVED",
                resolved_at: now,
                resolved_by: actorName,
            }
            : {
                status: "ACKNOWLEDGED",
                acknowledged_at: now,
                acknowledged_by: actorName,
            };
        await ReceptionAlerts().updateOne({ id: alertId }, { $set: update }).exec();
        const updated = sanitizeDocument(await ReceptionAlerts().findOne({ id: alertId }).lean().exec());
        if (!updated) {
            throw notFound("ALERT_NOT_FOUND", "Reception alert not found.");
        }
        return updated;
    }
    async getCalibrationStatus() {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        try {
            const rows = sanitizeDocument(await Notifications()
                .find({
                notification_type: "QC_CALIBRATION_OK",
                created_at: { $gte: thirtyDaysAgo },
            })
                .sort({ created_at: -1 })
                .limit(1)
                .lean()
                .exec());
            return { calibrated: rows.length > 0 };
        }
        catch {
            return { calibrated: true };
        }
    }
    async listRawStorageOverdueReceptions() {
        const threshold48h = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
        const rows = sanitizeDocument(await Receptions()
            .find({ actual_arrival_date: { $lte: threshold48h } })
            .sort({ actual_arrival_date: 1 })
            .limit(30)
            .lean()
            .exec());
        return rows.filter((row) => String(row.storage_zone_code || "").startsWith(RAW_ZONE_PREFIX) &&
            !TERMINAL_RECEPTION_STATUSES.includes(String(row.status || "")));
    }
    async findReceptionLotByScan(scanValue) {
        const normalizedValue = readString(scanValue);
        if (!normalizedValue)
            return null;
        const lot = sanitizeDocument(await ReceptionLots()
            .findOne({
            $or: [
                { lot_internal: normalizedValue },
                { lot_supplier: normalizedValue },
                { qr_code_payload: normalizedValue },
            ],
        })
            .lean()
            .exec());
        if (!lot)
            return null;
        const reception = await this.getReceptionById(String(lot.reception_id || ""));
        return {
            ...lot,
            reception,
        };
    }
    async intake(payload, actor) {
        if (!payload?.supplier_id) {
            throw badRequest("SUPPLIER_REQUIRED", "supplier_id is required.");
        }
        if (!Array.isArray(payload?.lots) || payload.lots.length === 0) {
            throw badRequest("LOTS_REQUIRED", "At least one lot is required.");
        }
        const zeroQtyLots = payload.lots.filter(lot => Number(lot.quantity || 0) <= 0);
        if (zeroQtyLots.length > 0) {
            throw badRequest("INVALID_LOT_QUANTITY", "All lots must have a quantity greater than 0.");
        }
        const supplier = await ensureSupplierExists(String(payload.supplier_id));
        const purchaseOrderId = readString(payload.purchase_order_id);
        const purchaseOrderLineId = readString(payload.purchase_order_line_id);
        const materialId = readString(payload.material_id);
        if (purchaseOrderLineId && !purchaseOrderId) {
            throw badRequest("PURCHASE_ORDER_REQUIRED", "purchase_order_id is required when purchase_order_line_id is provided.");
        }
        const receiptResolution = purchaseOrderId
            ? await resolvePurchaseOrderReceiptTarget({
                purchaseOrderId,
                purchaseOrderLineId: purchaseOrderLineId || null,
                supplierId: String(supplier.id || payload.supplier_id),
                materialId: materialId || null,
            })
            : null;
        const now = new Date().toISOString();
        const lots = payload.lots || [];
        const quantityTotal = Number(payload.quantity_total ?? lots.reduce((sum, lot) => sum + Number(lot.quantity || 0), 0));
        const declaredWeightKg = payload.declared_weight_kg ?? payload.declaredWeightKg ?? null;
        const netWeight = Number(payload.gross_weight_kg ?? 0) - Number(payload.tare_weight_kg ?? 0);
        const weightGapPercent = declaredWeightKg && Number(declaredWeightKg) > 0 ? round(((netWeight - Number(declaredWeightKg)) / Number(declaredWeightKg)) * 100) : null;
        const reception = await prepareInsertDocument("receptions_v2", {
            ...payload,
            supplier_id: supplier.id || payload.supplier_id,
            purchase_order_id: purchaseOrderId || null,
            purchase_order_line_id: receiptResolution?.line?.id || purchaseOrderLineId || null,
            spontaneous_delivery: purchaseOrderId ? false : payload.spontaneous_delivery ?? true,
            supplier_code_snapshot: supplier.code || null,
            supplier_name_snapshot: supplier.name || null,
            material_id: materialId || receiptResolution?.line?.material_id || payload.material_id || null,
            quantity_total: quantityTotal,
            unit: payload.unit || "kg",
            declared_weight_kg: declaredWeightKg,
            weight_gap_percent: weightGapPercent,
            status: "EN_ATTENTE_QC",
            created_by: actor?.id || payload.created_by || null,
            actual_arrival_date: payload.actual_arrival_date || now,
        });
        await Receptions().create([reception]);
        const lotInputs = lots.map((lot, index) => ({
            ...lot,
            reception_id: reception.id,
            quantity: Number(lot.quantity || 0),
            unit: payload.unit || lot.unit || "kg",
            stock_status: "EN_QUARANTAINE",
            origin_country: lot.origin_country || payload.origin_country || "Tunisie",
            variety: lot.variety || payload.variety || null,
            maturity_stage: lot.maturity_stage || payload.maturity_stage || null,
            article_ref: lot.article_ref || null,
            qr_code_payload: lot.qr_code_payload || `${reception.reception_number}-LOT-${index + 1}`,
        }));
        const createdLots = [];
        for (const lotInput of lotInputs) {
            const prepared = await prepareInsertDocument("reception_lots", lotInput);
            createdLots.push(prepared);
        }
        await ReceptionLots().insertMany(createdLots);
        const totalUnits = Math.max(1, Number(payload.unit_count || createdLots.length || 1));
        const createdUnits = [];
        for (let index = 0; index < totalUnits; index += 1) {
            const lot = createdLots[index % createdLots.length];
            const prepared = await prepareInsertDocument("reception_units", {
                reception_lot_id: lot.id,
                unit_type: payload.unit_type || "PALETTE",
                quantity: round(quantityTotal / totalUnits, 3),
                unit: payload.unit || "kg",
                gross_weight: null,
                net_weight: null,
                tare_weight: null,
                unit_status: "EN_QUARANTAINE",
            });
            createdUnits.push(prepared);
        }
        await ReceptionUnits().insertMany(createdUnits);
        await syncReceptionLotsToStock(createdLots, {
            reception,
            actorId: actor?.id || null,
        });
        if (receiptResolution) {
            await registerReceptionAgainstPurchaseOrder({
                resolution: receiptResolution,
                reception,
                lots: createdLots,
                quantityTotal,
                actorId: actor?.id || null,
            });
        }
        const alerts = [];
        const alertMessages = Array.isArray(payload.phase1_alerts) ? payload.phase1_alerts : [];
        for (const message of alertMessages) {
            alerts.push(await prepareInsertDocument("reception_alerts", {
                alert_type: "PHASE1_RECEPTION_ALERT",
                severity: "MAJEUR",
                reception_id: reception.id,
                supplier_id: reception.supplier_id,
                title: "Alerte reception",
                message,
                status: "ACTIVE",
            }));
        }
        if (alerts.length > 0) {
            await ReceptionAlerts().insertMany(alerts);
        }
        const notification = await prepareInsertDocument("system_notifications", {
            notification_type: "RECEPTION_CREATED",
            category: "reception",
            title: `Nouvelle reception ${reception.reception_number}`,
            message: `Reception ${reception.reception_number} enregistree et en attente QC.`,
            severity: "info",
            entity_type: "receptions_v2",
            entity_id: reception.id,
            metadata: {
                supplier_id: reception.supplier_id,
            },
        });
        await Notifications().create([notification]);
        return {
            reception: sanitizeDocument(reception),
            lots: sanitizeDocument(createdLots),
            units: sanitizeDocument(createdUnits),
            alerts: sanitizeDocument(alerts),
            notifications: sanitizeDocument([notification]),
        };
    }
    async startQcInspection(payload, actor) {
        const receptionId = readString(payload?.reception_id, payload?.receptionId, payload?.id);
        if (!receptionId) {
            throw badRequest("RECEPTION_REQUIRED", "reception_id is required.");
        }
        const reception = sanitizeDocument(await Receptions().findOne(receptionIdentityFilter(receptionId)).lean().exec());
        if (!reception) {
            throw notFound("RECEPTION_NOT_FOUND", "Reception not found.");
        }
        if (reception.created_by && actor?.id && reception.created_by === actor.id && !isAdminActor(actor)) {
            throw badRequest("QC_ROLE_SEPARATION", "Reception operator cannot inspect the same lot.");
        }
        const inspection = await prepareInsertDocument("qc_inspections", {
            ...payload,
            reception_id: receptionId,
            inspector_id: actor?.id || null,
            started_at: new Date().toISOString(),
            decision: null,
        });
        await QCInspections().create([inspection]);
        await Receptions().updateOne(receptionIdentityFilter(receptionId), {
            $set: {
                status: "EN_QC",
                updated_at: new Date().toISOString(),
            },
        }).exec();
        return sanitizeDocument(inspection);
    }
    async submitQcDecision(payload, actor) {
        const inspectionId = readString(payload.inspectionId, payload.inspection_id);
        const decision = readString(payload.decision);
        if (!inspectionId) {
            throw badRequest("INSPECTION_REQUIRED", "inspectionId is required.");
        }
        if (!decision) {
            throw badRequest("DECISION_REQUIRED", "decision is required.");
        }
        const inspection = sanitizeDocument(await QCInspections().findOne({ id: inspectionId }).lean().exec());
        if (!inspection) {
            throw notFound("INSPECTION_NOT_FOUND", "QC inspection not found.");
        }
        const now = new Date().toISOString();
        const qualitySummary = payload.qualitySummary || {};
        const checkResults = Array.isArray(payload.checkResults) ? payload.checkResults : [];
        await QCCheckResults().deleteMany({ inspection_id: inspectionId }).exec();
        const preparedResults = [];
        for (const result of checkResults) {
            preparedResults.push(await prepareInsertDocument("qc_check_results", {
                inspection_id: inspectionId,
                checklist_item_id: result.checklist_item_id || null,
                check_code: result.check_code,
                check_name: result.check_name,
                category: result.category || null,
                severity: result.severity || "MAJEUR",
                result: result.result || "NA",
                note: result.note || null,
                measured_value: result.measured_value || null,
                expected_value: result.expected_value || null,
                checked_at: now,
                checked_by: actor?.id || null,
            }));
        }
        if (preparedResults.length > 0) {
            await QCCheckResults().insertMany(preparedResults);
        }
        const inspectionUpdate = {
            decision,
            comment: payload.comment || null,
            ended_at: now,
            updated_at: now,
            lab_sample_required: Boolean(payload.labSampleRequired),
            lab_analyses: payload.labAnalyses || [],
            lab_storage_location: payload.labStorageLocation || null,
            lab_sample_code: payload.labSampleRequired ? `LAB-${Date.now()}` : null,
            secondary_inspector_name: payload.secondaryInspectorName || null,
            recommended_decision: payload.recommendedDecision || null,
            override_justification: payload.overrideJustification || null,
        };
        await QCInspections().updateOne({ id: inspectionId }, { $set: inspectionUpdate }).exec();
        const receptionStatus = buildReceptionStatusFromDecision(decision);
        await Receptions().updateOne(receptionIdentityFilter(inspection.reception_id), {
            $set: {
                status: receptionStatus,
                qc_decision: decision,
                qc_score: qualitySummary.score ?? null,
                qc_grade: qualitySummary.grade ?? null,
                qc_auto_reject_reasons: qualitySummary.automaticRejectReasons || [],
                qc_closed_at: now,
                qc_closed_by: actor?.id || null,
                updated_at: now,
            },
        }).exec();
        const lotStatus = buildLotStatusFromDecision(decision);
        await ReceptionLots().updateMany({ reception_id: inspection.reception_id }, {
            $set: {
                stock_status: lotStatus,
                quarantine_reason: decision === "QUARANTAINE" || decision === "REJETE" ? payload.comment || null : null,
                quarantine_date: decision === "QUARANTAINE" ? now : null,
                release_date: decision === "ACCEPTE" ? now : null,
                released_by: decision === "ACCEPTE" ? actor?.id || null : null,
                updated_at: now,
            },
        }).exec();
        await ReceptionUnits().updateMany({ reception_lot_id: { $in: (await loadReceptionLots(inspection.reception_id)).map((lot) => lot.id) } }, {
            $set: {
                unit_status: lotStatus,
                updated_at: now,
            },
        }).exec();
        const updatedReception = sanitizeDocument(await Receptions().findOne(receptionIdentityFilter(inspection.reception_id)).lean().exec());
        const updatedLots = await loadReceptionLots(inspection.reception_id);
        try {
            await syncReceptionLotsToStock(updatedLots, {
                reception: updatedReception,
                actorId: actor?.id || null,
            });
        }
        catch (syncError) {
            console.error("[QC] syncReceptionLotsToStock failed — stock_lots may be out of sync:", syncError);
            throw new Error("La synchronisation du stock a échoué. Veuillez réessayer ou contacter le support.");
        }
        if (updatedReception?.purchase_order_id) {
            try {
                await applyPurchaseOrderQcDecision({
                    purchaseOrderId: String(updatedReception.purchase_order_id),
                    receptionId: String(inspection.reception_id),
                    decision,
                });
            }
            catch (purchaseOrderError) {
                console.error("[QC] purchase order sync failed:", purchaseOrderError);
                throw new Error("La synchronisation du bon de commande a échoué. Veuillez réessayer.");
            }
        }
        const storedInspection = sanitizeDocument(await QCInspections().findOne({ id: inspectionId }).lean().exec());
        // ── RG-F03/F04: update supplier metrics + trigger business rules ─────────
        if (updatedReception?.supplier_id) {
            recalculateSupplierMetrics(String(updatedReception.supplier_id), actor?.id ?? null).catch((err) => console.error("[RG] supplier metric recalc failed:", err));
        }
        // ── RG-R07: notify QC inspector that a new lot awaits inspection ─────────
        const qcNotification = await prepareInsertDocument("system_notifications", {
            notification_type: "QC_DECISION_RECORDED",
            category: "quality",
            title: `Décision QC enregistrée — ${updatedReception?.reception_number ?? inspectionId}`,
            message: `Décision ${decision} enregistrée pour la réception ${updatedReception?.reception_number ?? ""}. Grade: ${payload.qualitySummary?.grade ?? "—"}.`,
            severity: decision === "REJETE" ? "critical" : decision === "QUARANTAINE" ? "warning" : "info",
            entity_type: "receptions_v2",
            entity_id: String(inspection.reception_id),
            metadata: { decision, grade: payload.qualitySummary?.grade ?? null },
        });
        await Notifications().create([qcNotification]);
        return storedInspection;
    }
    async markUnitPrinted(unitId, actor) {
        if (!unitId) {
            throw badRequest("UNIT_REQUIRED", "unitId is required.");
        }
        await ReceptionUnits().updateOne({ id: unitId }, {
            $set: {
                label_printed_at: new Date().toISOString(),
                label_printed_by: actor?.id || null,
                updated_at: new Date().toISOString(),
            },
        }).exec();
        const updatedUnit = sanitizeDocument(await ReceptionUnits().findOne({ id: unitId }).lean().exec());
        if (!updatedUnit) {
            throw notFound("UNIT_NOT_FOUND", "Reception unit not found.");
        }
        return updatedUnit;
    }
    async createReceptionUnit(payload, actor) {
        const receptionLotId = readString(payload.reception_lot_id, payload.receptionLotId);
        if (!receptionLotId) {
            throw badRequest("RECEPTION_LOT_REQUIRED", "reception_lot_id is required.");
        }
        const quantity = Number(payload.quantity ?? 0);
        if (quantity <= 0) {
            throw badRequest("INVALID_UNIT_QUANTITY", "quantity must be greater than 0.");
        }
        const lot = sanitizeDocument(await ReceptionLots().findOne({ id: receptionLotId }).lean().exec());
        if (!lot) {
            throw notFound("RECEPTION_LOT_NOT_FOUND", "Reception lot not found.");
        }
        const unit = await prepareInsertDocument("reception_units", {
            reception_lot_id: receptionLotId,
            unit_type: readString(payload.unit_type, payload.unitType) || "PALETTE",
            quantity,
            unit: readString(payload.unit) || String(lot.unit || "kg"),
            gross_weight: payload.gross_weight ?? payload.grossWeight ?? null,
            net_weight: payload.net_weight ?? payload.netWeight ?? null,
            unit_status: lot.stock_status || "NON_STOCKE",
            created_by: actor?.id || null,
        });
        await ReceptionUnits().create([unit]);
        return sanitizeDocument(unit);
    }
    async moveReceptionLotToStorage(payload, _actor) {
        const lotId = readString(payload.lotId);
        const targetZone = readString(payload.targetZone);
        const performedBy = readString(payload.performedBy);
        if (!lotId) {
            throw badRequest("RECEPTION_LOT_REQUIRED", "lotId is required.");
        }
        if (!targetZone) {
            throw badRequest("TARGET_ZONE_REQUIRED", "targetZone is required.");
        }
        if (!performedBy) {
            throw badRequest("PERFORMED_BY_REQUIRED", "performedBy is required.");
        }
        const lot = sanitizeDocument(await ReceptionLots().findOne({ id: lotId }).lean().exec());
        if (!lot) {
            throw notFound("RECEPTION_LOT_NOT_FOUND", "Reception lot not found.");
        }
        const nextStatus = resolveZoneStatus(targetZone, String(lot.stock_status || "NON_STOCKE"));
        const now = new Date().toISOString();
        const notes = readString(payload.notes);
        const position = readString(payload.position);
        const movement = await prepareInsertDocument("reception_stock_movements", {
            reception_id: lot.reception_id || null,
            reception_lot_id: lot.id,
            movement_type: "MISE_EN_STOCK",
            to_location_id: targetZone,
            quantity: Number(lot.quantity || 0),
            unit: lot.unit || "kg",
            performed_by: performedBy,
            notes: notes || null,
        });
        await ReceptionStockMovements().create([movement]);
        const lotUpdate = {
            stock_status: nextStatus,
            storage_zone_code: targetZone,
            updated_at: now,
        };
        if (nextStatus === "STOCK_LIBERE") {
            lotUpdate.release_date = now;
            lotUpdate.released_by = performedBy;
            lotUpdate.quarantine_reason = null;
            lotUpdate.quarantine_date = null;
        }
        else if (nextStatus === "EN_QUARANTAINE") {
            lotUpdate.quarantine_date = now;
            if (notes) {
                lotUpdate.quarantine_reason = notes;
            }
        }
        await ReceptionLots().updateOne({ id: lotId }, { $set: lotUpdate }).exec();
        await ReceptionUnits().updateMany({ reception_lot_id: lotId }, {
            $set: {
                location_id: targetZone,
                position: position || null,
                unit_status: nextStatus,
                updated_at: now,
            },
        }).exec();
        const stockLotUpdate = {
            status: buildStockLotStatus(nextStatus),
            source_status: nextStatus,
            location_id: targetZone,
            updated_at: now,
        };
        if (nextStatus === "STOCK_LIBERE") {
            stockLotUpdate.qc_validated_by = performedBy;
            stockLotUpdate.qc_validated_at = now;
        }
        if (position) {
            stockLotUpdate.position = position;
        }
        await StockLots().updateMany({ reception_lot_id: lotId }, { $set: stockLotUpdate }).exec();
        const auditLog = await prepareInsertDocument("reception_audit_logs_v2", {
            entity_type: "LOT",
            entity_id: lotId,
            action: "STOCK_MOVE",
            new_state: { zone: targetZone, position: position || null, stock_status: nextStatus },
            performed_by: performedBy,
        });
        await ReceptionAuditLogs().create([auditLog]);
        const updatedLot = sanitizeDocument(await ReceptionLots().findOne({ id: lotId }).lean().exec());
        return {
            movement: sanitizeDocument(movement),
            lot: updatedLot,
            auditLog: sanitizeDocument(auditLog),
        };
    }
    // ── T-502 / T-503 — Record weighing + compute net + transition state ────────
    async listWeighings(lotId) {
        if (!lotId)
            throw badRequest("LOT_REQUIRED", "lotId is required.");
        const records = sanitizeDocument(await WeighingRecords().find({ lot_id: lotId }).sort({ created_at: 1 }).lean().exec());
        return records;
    }
    async recordWeighing(lotId, payload, actor) {
        if (!lotId)
            throw badRequest("LOT_REQUIRED", "lotId is required.");
        const weighType = payload.type === "TARE" ? "TARE" : "GROSS";
        const weightKg = Number(payload.weight_kg);
        if (isNaN(weightKg) || weightKg < 0) {
            throw badRequest("INVALID_WEIGHT", "weight_kg must be ≥ 0.");
        }
        const lot = sanitizeDocument(await ReceptionLots().findOne({ id: lotId }).lean().exec());
        if (!lot)
            throw notFound("RECEPTION_LOT_NOT_FOUND", "Reception lot not found.");
        // Persist weighing record
        const weighing = await prepareInsertDocument("weighing_records", {
            lot_id: lotId,
            reception_id: lot.reception_id || null,
            type: weighType,
            weight_kg: weightKg,
            source: payload.source || "MANUAL",
            device_ref: payload.device_ref || null,
            supervisor: payload.supervisor || null,
            recorded_by: actor?.id || null,
            notes: payload.notes || null,
        });
        await WeighingRecords().create([weighing]);
        // Re-fetch all weighings to compute net
        const allWeighings = sanitizeDocument(await WeighingRecords().find({ lot_id: lotId }).sort({ created_at: -1 }).lean().exec());
        const latestGross = allWeighings.find((w) => w.type === "GROSS");
        const latestTare = allWeighings.find((w) => w.type === "TARE");
        const now = new Date().toISOString();
        const lotUpdate = { updated_at: now };
        if (weighType === "GROSS")
            lotUpdate.gross_weight_kg = weightKg;
        if (weighType === "TARE")
            lotUpdate.tare_weight_kg = weightKg;
        if (latestGross && latestTare) {
            const grossKg = Number(latestGross.weight_kg);
            const tareKg = Number(latestTare.weight_kg);
            const netKg = round(grossKg - tareKg);
            if (netKg <= 0) {
                throw badRequest("NET_WEIGHT_NOT_POSITIVE", `Poids net (${netKg} kg) ≤ 0. Vérifiez brut (${grossKg} kg) et tare (${tareKg} kg).`);
            }
            lotUpdate.gross_weight_kg = grossKg;
            lotUpdate.tare_weight_kg = tareKg;
            lotUpdate.net_weight_kg = netKg;
            // T-503: transition to EN_ATTENTE_QC on the reception
            await Receptions().updateOne({ id: lot.reception_id }, { $set: { status: "EN_ATTENTE_QC", updated_at: now } }).exec();
        }
        await ReceptionLots().updateOne({ id: lotId }, { $set: lotUpdate }).exec();
        // Audit log
        const auditLog = await prepareInsertDocument("reception_audit_logs_v2", {
            entity_type: "LOT",
            entity_id: lotId,
            action: `WEIGHING_${weighType}`,
            actor_id: actor?.id || null,
            new_state: { weight_kg: weightKg, type: weighType, source: payload.source || "MANUAL" },
            performed_by: actor?.id || "system",
        });
        await ReceptionAuditLogs().create([auditLog]);
        // EPCIS ObjectEvent
        await writeEpcisObjectEvent({
            bizStep: "urn:epcglobal:cbv:bizstep:receiving",
            disposition: "urn:epcglobal:cbv:disp:in_progress",
            epcList: [String(lot.lot_internal || lot.qr_code_payload || lot.id)],
            actorId: actor?.id || null,
            entityType: "reception_lots",
            entityId: lotId,
            metadata: { weighing_type: weighType, weight_kg: weightKg, source: payload.source || "MANUAL" },
        });
        const updatedLot = sanitizeDocument(await ReceptionLots().findOne({ id: lotId }).lean().exec());
        return { weighing: sanitizeDocument(weighing), lot: updatedLot };
    }
    // ── T-201 / T-202 — Generate GS1 label payload + mark printed ───────────────
    async generateLotLabel(lotId, actor) {
        if (!lotId)
            throw badRequest("LOT_REQUIRED", "lotId is required.");
        const lot = sanitizeDocument(await ReceptionLots().findOne({ id: lotId }).lean().exec());
        if (!lot)
            throw notFound("RECEPTION_LOT_NOT_FOUND", "Reception lot not found.");
        const gs1 = buildGs1Payload(lot);
        const now = new Date().toISOString();
        // Mark lot label printed
        await ReceptionLots().updateOne({ id: lotId }, { $set: { label_printed_at: now, label_printed_by: actor?.id || null, updated_at: now } }).exec();
        // Audit
        const auditLog = await prepareInsertDocument("reception_audit_logs_v2", {
            entity_type: "LOT",
            entity_id: lotId,
            action: "LABEL_PRINTED",
            actor_id: actor?.id || null,
            new_state: { gs1_128: gs1.gs1_128, gtin14: gs1.gtin14 },
            performed_by: actor?.id || "system",
        });
        await ReceptionAuditLogs().create([auditLog]);
        // EPCIS
        await writeEpcisObjectEvent({
            bizStep: "urn:epcglobal:cbv:bizstep:receiving",
            disposition: "urn:epcglobal:cbv:disp:active",
            epcList: [`urn:epc:id:sgtin:0.${gs1.gtin14}.${gs1.lot_code}`],
            actorId: actor?.id || null,
            entityType: "reception_lots",
            entityId: lotId,
            metadata: { label_type: "GS1-128", ai_payload: gs1.ai_payload, net_weight_g: gs1.net_weight_g },
        });
        return { ...gs1, lot_id: lotId, printed_at: now };
    }
    async checkSupplierContractExpirations() {
        return checkSupplierContractExpirations();
    }
};
ReceptionsService = __decorate([
    Injectable()
], ReceptionsService);
export { ReceptionsService };
export const receptionsService = new ReceptionsService();
