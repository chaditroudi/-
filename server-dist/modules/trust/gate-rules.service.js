var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Injectable } from "@nestjs/common";
import { badRequest } from "../../core/app-error.js";
import { getCollectionModel, sanitizeDocument } from "../../db/dynamic-model.js";
import { assertLotsReleasedForProduction, assertNoOrganicConventionalMix, assertShipmentDossierComplete, evaluateShipmentDossierFromChain, isShipmentClosingStatus, } from "./gate-rules.js";
import { lotLedgerService } from "./lot-ledger.service.js";
const loadLotsByIds = async (ids) => {
    if (ids.length === 0)
        return [];
    const stockLots = sanitizeDocument(await getCollectionModel("stock_lots").find({ id: { $in: ids } }).lean().exec());
    const found = new Set(stockLots.map((lot) => lot.id));
    const missing = ids.filter((id) => !found.has(id));
    if (missing.length === 0)
        return stockLots;
    const receptionLots = sanitizeDocument(await getCollectionModel("reception_lots").find({ id: { $in: missing } }).lean().exec());
    return [...stockLots, ...receptionLots];
};
const pushId = (ids, value) => {
    const id = String(value || "").trim();
    if (id)
        ids.add(id);
};
const collectShipmentLotIds = (before, next) => {
    const ids = new Set();
    for (const source of [next, before]) {
        if (!source)
            continue;
        if (Array.isArray(source.lot_ids)) {
            for (const id of source.lot_ids)
                pushId(ids, id);
        }
        if (Array.isArray(source.lignes)) {
            for (const ligne of source.lignes) {
                const row = (ligne || {});
                pushId(ids, row.lot_id);
                pushId(ids, row.reception_lot_id);
            }
        }
    }
    return Array.from(ids);
};
const resolveReceptionLotId = async (lotId) => {
    const stock = sanitizeDocument(await getCollectionModel("stock_lots").findOne({ id: lotId }).lean().exec());
    if (stock?.reception_lot_id)
        return String(stock.reception_lot_id);
    if (stock?.entry_lot_id)
        return String(stock.entry_lot_id);
    return lotId;
};
const appendGateBlocked = async (input) => {
    try {
        await lotLedgerService.append({
            lotId: input.lotId,
            eventType: "GATE_BLOCKED",
            collection: input.collection,
            action: "GATE",
            actorId: input.actorId,
            payload: {
                code: input.code,
                message: input.message,
                ...(input.payload || {}),
            },
        });
    }
    catch (error) {
        console.error("[W0] GATE_BLOCKED append failed:", error);
    }
};
let GateRulesService = class GateRulesService {
    async assertProductionOrderWritable(doc) {
        const inputLotIds = Array.isArray(doc.input_lot_ids)
            ? doc.input_lot_ids.map((id) => String(id)).filter(Boolean)
            : [];
        const status = String(doc.status || "DRAFT").toUpperCase();
        const requiresReleasedLots = !["DRAFT", "CANCELLED", "CANCELED", "PLANIFIE", "PLANNED"].includes(status);
        if (!requiresReleasedLots) {
            if (inputLotIds.length > 1) {
                const lots = await loadLotsByIds(inputLotIds);
                assertNoOrganicConventionalMix(lots);
            }
            return;
        }
        const lots = await loadLotsByIds(inputLotIds);
        try {
            assertLotsReleasedForProduction(lots, inputLotIds);
            assertNoOrganicConventionalMix(lots);
        }
        catch (error) {
            const code = error?.code || "PRODUCTION_GATE_BLOCKED";
            const message = error instanceof Error ? error.message : String(error);
            for (const lotId of inputLotIds) {
                await appendGateBlocked({
                    lotId,
                    collection: "production_orders",
                    code,
                    message,
                    payload: { attempted_status: status },
                });
            }
            throw error;
        }
    }
    async assertShipmentWritable(before, next, options = {}) {
        const nextStatus = next.status ?? next.statut ?? before?.status ?? before?.statut;
        if (!isShipmentClosingStatus(typeof nextStatus === "string" ? nextStatus : null)) {
            return;
        }
        const collection = options.collection || "shipment_preparations";
        const requiresCcp = Boolean(next.requires_ccp ?? before?.requires_ccp ?? true);
        const lotIds = collectShipmentLotIds(before, next);
        if (lotIds.length === 0) {
            throw badRequest("SHIPMENT_DOSSIER_INCOMPLETE", "Shipment cannot close while the export dossier is incomplete.", { missing: ["genealogy"] });
        }
        for (const rawLotId of lotIds) {
            const lotId = await resolveReceptionLotId(rawLotId);
            const chain = await lotLedgerService.getChain(lotId);
            const dossier = evaluateShipmentDossierFromChain(chain, { requiresCcp });
            if (dossier.missing.length > 0) {
                await appendGateBlocked({
                    lotId,
                    collection,
                    actorId: options.actorId,
                    code: "SHIPMENT_DOSSIER_INCOMPLETE",
                    message: "Shipment cannot close while the export dossier is incomplete.",
                    payload: {
                        attempted_status: nextStatus,
                        missing: dossier.missing,
                        source_lot_id: rawLotId,
                    },
                });
                assertShipmentDossierComplete(dossier);
            }
        }
    }
};
GateRulesService = __decorate([
    Injectable()
], GateRulesService);
export { GateRulesService };
export const gateRulesService = new GateRulesService();
