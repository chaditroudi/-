import { createHash } from "node:crypto";
const GENESIS_HASH = "0".repeat(64);
export const lotLedgerGenesisHash = () => GENESIS_HASH;
export const computeLotEventHash = (parts) => {
    const canonical = JSON.stringify({
        lot_id: parts.lotId,
        event_type: parts.eventType,
        collection: parts.collection,
        action: parts.action,
        actor_id: parts.actorId,
        payload: parts.payload,
        related_ids: [...parts.relatedIds].sort(),
        prev_hash: parts.prevHash || GENESIS_HASH,
        sequence: parts.sequence,
        at: parts.at,
    });
    return createHash("sha256").update(canonical).digest("hex");
};
export const buildLotEventRecord = (input, sequence) => {
    const at = input.at || new Date().toISOString();
    const actorId = input.actorId ?? null;
    const payload = input.payload || {};
    const relatedIds = input.relatedIds || [];
    const prevHash = input.prevHash || GENESIS_HASH;
    const hash = computeLotEventHash({
        lotId: input.lotId,
        eventType: input.eventType,
        collection: input.collection,
        action: input.action,
        actorId,
        payload,
        relatedIds,
        prevHash,
        sequence,
        at,
    });
    return {
        lot_id: input.lotId,
        event_type: input.eventType,
        collection: input.collection,
        action: input.action,
        actor_id: actorId,
        payload,
        related_ids: relatedIds,
        prev_hash: prevHash,
        hash,
        sequence,
        at,
    };
};
export const verifyLotEventChain = (events) => {
    if (events.length === 0) {
        return { valid: true, brokenAt: null, expectedHash: null };
    }
    const ordered = [...events].sort((a, b) => a.sequence - b.sequence);
    let expectedPrev = GENESIS_HASH;
    for (let i = 0; i < ordered.length; i += 1) {
        const event = ordered[i];
        if (event.sequence !== i + 1) {
            return { valid: false, brokenAt: i, expectedHash: null };
        }
        const prev = event.prev_hash || GENESIS_HASH;
        if (prev !== expectedPrev) {
            return { valid: false, brokenAt: i, expectedHash: expectedPrev };
        }
        const recomputed = computeLotEventHash({
            lotId: event.lot_id,
            eventType: event.event_type,
            collection: event.collection,
            action: event.action,
            actorId: event.actor_id,
            payload: event.payload || {},
            relatedIds: event.related_ids || [],
            prevHash: prev,
            sequence: event.sequence,
            at: event.at,
        });
        if (recomputed !== event.hash) {
            return { valid: false, brokenAt: i, expectedHash: recomputed };
        }
        expectedPrev = event.hash;
    }
    return { valid: true, brokenAt: null, expectedHash: null };
};
export const inferLotIdsFromRow = (collection, row) => {
    const ids = new Set();
    const push = (value) => {
        if (typeof value === "string" && value.trim())
            ids.add(value.trim());
    };
    if (collection === "reception_lots" || collection === "stock_lots") {
        push(row.id);
    }
    push(row.lot_id);
    push(row.reception_lot_id);
    push(row.parent_lot_id);
    push(row.source_lot_id);
    push(row.stock_lot_id);
    if (Array.isArray(row.input_lot_ids)) {
        for (const id of row.input_lot_ids)
            push(id);
    }
    if (Array.isArray(row.child_lot_ids)) {
        for (const id of row.child_lot_ids)
            push(id);
    }
    if (Array.isArray(row.lot_ids)) {
        for (const id of row.lot_ids)
            push(id);
    }
    return Array.from(ids);
};
export const mapCollectionToEventType = (collection, action, row) => {
    if (collection === "reception_lots" && action === "INSERT")
        return "LOT_CREATED";
    if (collection === "qc_inspections")
        return "QC_DECIDED";
    if (collection === "fumigation_cycles")
        return "CCP_COMPLETED";
    if (collection === "fumigation_sensor_readings")
        return "CCP_SENSOR_ATTESTED";
    if (collection === "storage_condition_readings")
        return "COLD_CHAIN_ATTESTED";
    if (collection === "storage_door_events")
        return "COLD_CHAIN_BREACH";
    if (collection === "stock_lots" && action === "INSERT")
        return "STOCK_SYNCED";
    if (collection === "stock_movements" || collection === "storage_location_movements")
        return "STOCK_MOVED";
    if (collection === "triage_sublots" || collection === "production_orders" || collection === "production_output_lots") {
        return "TRANSFORMED";
    }
    if (collection === "packaging_palettes" || collection === "packaging_orders")
        return "PACKAGED";
    if (collection === "shipment_preparations" || collection === "bon_expeditions")
        return "SHIPPED";
    if (row?.stock_status || row?.status)
        return "STATUS_CHANGED";
    return "GENERIC_MUTATION";
};
