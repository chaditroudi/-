import { badRequest } from "../../core/app-error.js";
import { getCollectionModel, sanitizeDocument } from "../../db/dynamic-model.js";
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
const readString = (...values) => {
    for (const value of values) {
        if (typeof value === "string" && value.trim()) {
            return value.trim();
        }
    }
    return "";
};
const readNullableNumber = (value) => {
    if (value == null || value === "")
        return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
};
const readStringArray = (value) => Array.isArray(value)
    ? value.map((entry) => readString(entry)).filter(Boolean)
    : [];
const uniqueStrings = (values) => Array.from(new Set(values
    .flatMap((value) => (Array.isArray(value) ? value : [value]))
    .map((value) => readString(value))
    .filter(Boolean)));
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const pickLatestByDate = (rows, field) => [...rows].sort((a, b) => {
    const left = new Date(readString(a[field])).getTime() || 0;
    const right = new Date(readString(b[field])).getTime() || 0;
    return right - left;
})[0] || null;
const sortByDateDesc = (rows, field) => [...rows].sort((a, b) => {
    const left = new Date(readString(a[field])).getTime() || 0;
    const right = new Date(readString(b[field])).getTime() || 0;
    return right - left;
});
const pushTimelineEvent = (events, event) => {
    if (!event?.timestamp)
        return;
    events.push(event);
};
const buildAuditActor = (row) => readString(row.performed_by, row.user_name, row.user_email) || null;
const buildAuditLabel = (row) => readString(row.action_label, row.message, row.action) || "Audit";
const buildControlPoint = (code, label, status, detail) => ({ code, label, status, detail });
export async function buildLotTraceabilityDossier(lotNumber) {
    const normalizedLotNumber = readString(lotNumber);
    if (!normalizedLotNumber) {
        throw badRequest("LOT_NUMBER_REQUIRED", "Le numero de lot est requis.");
    }
    const lotRegex = new RegExp(escapeRegex(normalizedLotNumber), "i");
    // Chaque élément passé à Promise.all doit être une promesse : un `await`
    // écrit dans le tableau sérialise les requêtes (25 allers-retours Atlas ≈ 9s).
    const runQuery = async (query) => sanitizeDocument(await query.exec());
    const [receptionExact, receptionLotExact, stockLotExact, subLotExact, outputLotExact, receptionFuzzy, receptionLotsDirect, stockLotsDirect, subLotsDirect, outputLotsDirect,] = await Promise.all([
        runQuery(Receptions().findOne({ reception_number: normalizedLotNumber }).lean()),
        runQuery(ReceptionLots()
            .findOne({
            $or: [
                { id: normalizedLotNumber },
                { lot_internal: normalizedLotNumber },
                { lot_supplier: normalizedLotNumber },
                { qr_code_payload: normalizedLotNumber },
                { rfid_tag: normalizedLotNumber },
            ],
        })
            .lean()),
        runQuery(StockLots()
            .findOne({
            $or: [
                { id: normalizedLotNumber },
                { lot_number: normalizedLotNumber },
                { source_lot_internal: normalizedLotNumber },
                { source_lot_supplier: normalizedLotNumber },
                { reception_lot_id: normalizedLotNumber },
            ],
        })
            .lean()),
        runQuery(TriageSublots()
            .findOne({
            $or: [
                { id: normalizedLotNumber },
                { lot_number: normalizedLotNumber },
                { parent_lot_number: normalizedLotNumber },
            ],
        })
            .lean()),
        runQuery(ProductionOutputLots()
            .findOne({
            $or: [
                { id: normalizedLotNumber },
                { lot_pf_number: normalizedLotNumber },
                { "parent_lots_snapshot.lot_internal": normalizedLotNumber },
                { "parent_lots_snapshot.lot_supplier": normalizedLotNumber },
                { "parent_lots_snapshot.reception_number": normalizedLotNumber },
            ],
        })
            .lean()),
        runQuery(Receptions()
            .findOne({ reception_number: { $regex: lotRegex } })
            .sort({ actual_arrival_date: -1 })
            .lean()),
        runQuery(ReceptionLots()
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
            .lean()),
        runQuery(StockLots()
            .find({
            $or: [
                { lot_number: { $regex: lotRegex } },
                { source_lot_internal: { $regex: lotRegex } },
                { source_lot_supplier: { $regex: lotRegex } },
            ],
        })
            .sort({ created_at: -1 })
            .limit(50)
            .lean()),
        runQuery(TriageSublots()
            .find({
            $or: [
                { lot_number: { $regex: lotRegex } },
                { parent_lot_number: { $regex: lotRegex } },
            ],
        })
            .sort({ created_at: -1 })
            .limit(50)
            .lean()),
        runQuery(ProductionOutputLots()
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
            .lean()),
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
        ? sanitizeDocument(await Receptions()
            .find({ id: { $in: initialReceptionIds } })
            .sort({ actual_arrival_date: -1 })
            .lean()
            .exec())
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
    const receptionLots = sortByDateDesc(sanitizeDocument(await ReceptionLots()
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
        .exec()), "created_at");
    const receptionLotIds = uniqueStrings(receptionLots.map((row) => row.id));
    const receptionNumbers = uniqueStrings([reception?.reception_number]);
    const [qcInspections, fumigationCycles, cleaningCycles, hydrationCycles, triageSessions, subLots] = await Promise.all([
        sanitizeDocument(await QcInspections()
            .find({
            $or: [
                ...(receptionIds.length > 0 ? [{ reception_id: { $in: receptionIds } }] : []),
                ...(receptionLotIds.length > 0 ? [{ reception_lot_id: { $in: receptionLotIds } }] : []),
            ],
        })
            .sort({ started_at: -1 })
            .lean()
            .exec()),
        sanitizeDocument(await FumigationCycles()
            .find({
            $or: [
                ...(receptionIds.length > 0 ? [{ "lot_refs.reception_id": { $in: receptionIds } }] : []),
                { "lot_refs.lot_number": { $regex: lotRegex } },
            ],
        })
            .sort({ created_at: -1 })
            .lean()
            .exec()),
        sanitizeDocument(await CleaningCycles()
            .find({
            $or: [
                ...(receptionIds.length > 0 ? [{ reception_id: { $in: receptionIds } }] : []),
                { lot_number: { $regex: lotRegex } },
            ],
        })
            .sort({ created_at: -1 })
            .lean()
            .exec()),
        sanitizeDocument(await HydrationCycles()
            .find({
            $or: [
                ...(receptionIds.length > 0 ? [{ "lot_refs.reception_id": { $in: receptionIds } }] : []),
                { "lot_refs.lot_number": { $regex: lotRegex } },
            ],
        })
            .sort({ created_at: -1 })
            .lean()
            .exec()),
        sanitizeDocument(await TriageSessions()
            .find({
            $or: [
                ...(receptionIds.length > 0 ? [{ parent_reception_id: { $in: receptionIds } }] : []),
                { parent_lot_number: { $regex: lotRegex } },
            ],
        })
            .sort({ created_at: -1 })
            .lean()
            .exec()),
        sanitizeDocument(await TriageSublots()
            .find({
            $or: [
                ...(receptionIds.length > 0 ? [{ parent_reception_id: { $in: receptionIds } }] : []),
                { parent_lot_number: { $regex: lotRegex } },
                { lot_number: { $regex: lotRegex } },
            ],
        })
            .sort({ created_at: -1 })
            .lean()
            .exec()),
    ]);
    const qcInspectionIds = uniqueStrings(qcInspections.map((row) => row.id));
    const triageSessionIds = uniqueStrings(triageSessions.map((row) => row.id));
    const subLotIds = uniqueStrings(subLots.map((row) => row.id));
    const subLotNumbers = uniqueStrings(subLots.map((row) => row.lot_number));
    const [qcCheckResults, triageQualityChecks, receptionStockMovements] = await Promise.all([
        qcInspectionIds.length > 0
            ? sanitizeDocument(await QcCheckResults()
                .find({ inspection_id: { $in: qcInspectionIds } })
                .sort({ checked_at: -1 })
                .lean()
                .exec())
            : [],
        triageSessionIds.length > 0
            ? sanitizeDocument(await TriageQualityChecks()
                .find({ session_id: { $in: triageSessionIds } })
                .sort({ checked_at: -1 })
                .lean()
                .exec())
            : [],
        sanitizeDocument(await ReceptionStockMovements()
            .find({
            $or: [
                ...(receptionIds.length > 0 ? [{ reception_id: { $in: receptionIds } }] : []),
                ...(receptionLotIds.length > 0 ? [{ reception_lot_id: { $in: receptionLotIds } }] : []),
            ],
        })
            .sort({ performed_at: -1 })
            .lean()
            .exec()),
    ]);
    const stockLots = sortByDateDesc(sanitizeDocument(await StockLots()
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
        .exec()), "created_at");
    const stockLotIds = uniqueStrings(stockLots.map((row) => row.id));
    const stockMovements = stockLotIds.length > 0
        ? sortByDateDesc(sanitizeDocument(await StockMovements()
            .find({ lot_id: { $in: stockLotIds } })
            .sort({ movement_date: -1 })
            .lean()
            .exec()), "movement_date")
        : [];
    const productionAllocations = sortByDateDesc(sanitizeDocument(await ProductionLotAllocations()
        .find({
        $or: [
            ...(receptionLotIds.length > 0 ? [{ reception_lot_id: { $in: receptionLotIds } }] : []),
            { "lot.lot_internal": { $regex: lotRegex } },
            { "lot.lot_supplier": { $regex: lotRegex } },
            { "lot.reception_number": { $regex: lotRegex } },
        ],
    })
        .lean()
        .exec()), "allocated_at");
    const productionOrderIds = uniqueStrings([
        outputLotExact?.production_order_id,
        ...productionAllocations.map((row) => row.production_order_id),
    ]);
    const productionOrders = sortByDateDesc(sanitizeDocument(await ProductionOrders()
        .find({
        $or: [
            ...(productionOrderIds.length > 0 ? [{ id: { $in: productionOrderIds } }] : []),
            ...(receptionIds.length > 0 ? [{ reception_id: { $in: receptionIds } }] : []),
        ],
    })
        .lean()
        .exec()), "created_at");
    const finalProductionOrderIds = uniqueStrings(productionOrders.map((row) => row.id));
    const [productionSteps, outputLots] = await Promise.all([
        finalProductionOrderIds.length > 0
            ? sanitizeDocument(await ProductionSteps()
                .find({ production_order_id: { $in: finalProductionOrderIds } })
                .sort({ sequence_order: 1, started_at: -1 })
                .lean()
                .exec())
            : [],
        sortByDateDesc(sanitizeDocument(await ProductionOutputLots()
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
            .exec()), "recorded_at"),
    ]);
    const productionStepIds = uniqueStrings(productionSteps.map((row) => row.id));
    const productionQualityChecks = productionStepIds.length > 0
        ? sanitizeDocument(await ProductionQualityChecks()
            .find({ production_step_id: { $in: productionStepIds } })
            .sort({ checked_at: -1, created_at: -1 })
            .lean()
            .exec())
        : [];
    const packagingOrders = sortByDateDesc(sanitizeDocument(await PackagingOrders()
        .find({
        $or: [
            ...(subLotIds.length > 0 ? [{ source_sublot_id: { $in: subLotIds } }] : []),
            ...(subLotNumbers.length > 0 ? [{ source_lot_number: { $in: subLotNumbers } }] : []),
            { source_lot_number: { $regex: lotRegex } },
        ],
    })
        .lean()
        .exec()), "created_at");
    const packagingOrderIds = uniqueStrings(packagingOrders.map((row) => row.id));
    const packagingPalettes = packagingOrderIds.length > 0
        ? sortByDateDesc(sanitizeDocument(await PackagingPalettes()
            .find({ order_id: { $in: packagingOrderIds } })
            .lean()
            .exec()), "created_at")
        : [];
    const shipmentLines = stockLotIds.length > 0
        ? sortByDateDesc(sanitizeDocument(await ShipmentLines()
            .find({ lot_id: { $in: stockLotIds } })
            .lean()
            .exec()), "picked_at")
        : [];
    const shipmentIds = uniqueStrings(shipmentLines.map((row) => row.shipment_id));
    const shipments = shipmentIds.length > 0
        ? sortByDateDesc(sanitizeDocument(await ShipmentPreparations()
            .find({ id: { $in: shipmentIds } })
            .lean()
            .exec()), "created_at")
        : [];
    if (!reception && receptionIds.length > 0) {
        const receptionsByLots = sanitizeDocument(await Receptions()
            .find({ id: { $in: receptionIds } })
            .sort({ actual_arrival_date: -1 })
            .lean()
            .exec());
        reception = pickLatestByDate(receptionsByLots, "actual_arrival_date");
    }
    const supplierIds = uniqueStrings([
        reception?.supplier_id,
        ...stockLots.map((row) => row.supplier_id),
    ]);
    const supplierMap = supplierIds.length > 0
        ? new Map(sanitizeDocument(await Suppliers()
            .find({ id: { $in: supplierIds } })
            .select("id name")
            .lean()
            .exec()).map((row) => [readString(row.id), row]))
        : new Map();
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
    const auditLogs = sortByDateDesc(sanitizeDocument(await AuditLogs()
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
        .exec()), "performed_at");
    const businessTimeline = [];
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
        buildControlPoint("RECEPTION_METADATA", "Reception metadata", receptionLots.some((row) => readString(row.origin_country, row.origin_region, row.origin_farm, row.lot_supplier))
            ? "ok"
            : "missing", receptionLots.some((row) => readString(row.origin_country, row.origin_region, row.origin_farm, row.lot_supplier))
            ? "Origine, lot fournisseur ou ferme renseignes."
            : "Origine amont incomplete sur le lot de reception."),
        buildControlPoint("INBOUND_QC", "Inbound quality release", qcInspections.length > 0
            ? (qcInspections.some((row) => readString(row.decision).includes("REJ")) ? "warning" : "ok")
            : "missing", qcInspections.length > 0
            ? `${qcInspections.length} inspection(s) QC rattachee(s).`
            : "Aucune inspection QC retrouvee pour ce lot."),
        buildControlPoint("GENEALOGY", "Genealogy continuity", (subLots.length > 0 || productionAllocations.length > 0 || outputLots.length > 0 || stockLots.length > 0)
            ? "ok"
            : "warning", (subLots.length > 0 || productionAllocations.length > 0 || outputLots.length > 0 || stockLots.length > 0)
            ? "Le lot est relie a des descendants ou a des consommations internes."
            : "Aucune transformation ou descendance detectee; lot limite a la reception/stock."),
        buildControlPoint("DELIVERY", "Delivery linkage", shipments.length > 0 || shipmentLines.length > 0
            ? "ok"
            : "warning", shipments.length > 0 || shipmentLines.length > 0
            ? `${shipmentNumbers.length} expedition(s) retrouvee(s).`
            : "Aucune expedition client retrouvee pour ce lot."),
        buildControlPoint("AUDIT", "Immutable audit trail", auditLogs.length > 0 ? "ok" : "warning", auditLogs.length > 0
            ? `${auditLogs.length} evenement(s) d'audit relies au lot et a sa genealogie.`
            : "Aucun audit applicatif directement relie a ce lot."),
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
    const matchedRow = receptionExact
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
            supplier_name: readString(reception.supplier_name_snapshot)
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
            matched_reference: readString(matchedRow?.lot_number, matchedRow?.lot_internal, matchedRow?.lot_pf_number, matchedRow?.reception_number, matchedRow?.shipment_number, normalizedLotNumber) || normalizedLotNumber,
            canonical_lot_number: readString(stockLotExact?.lot_number, subLotExact?.lot_number, outputLotExact?.lot_pf_number, receptionLotExact?.lot_internal, receptionLotExact?.lot_supplier, reception?.reception_number, normalizedLotNumber) || normalizedLotNumber,
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
