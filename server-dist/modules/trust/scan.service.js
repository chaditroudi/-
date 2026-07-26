var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { badRequest, notFound } from "../../core/app-error.js";
import { prepareInsertDocument } from "../../db/defaults.js";
import { getCollectionModel, sanitizeDocument } from "../../db/dynamic-model.js";
import { classifyScan, extractScanReferences } from "./scan-parse.js";
const ScanEvents = () => getCollectionModel("scan_events");
const nowIso = () => new Date().toISOString();
const gateMode = () => {
    const value = String(process.env.TRUST_SCAN_GATE || "warn").toLowerCase();
    return value === "off" || value === "enforce" ? value : "warn";
};
let ScanService = class ScanService {
    getMode() {
        return gateMode();
    }
    async resolve(input) {
        const rawValue = String(input.rawValue || "").trim();
        if (!rawValue)
            throw badRequest("SCAN_VALUE_REQUIRED", "A scanned value is required.");
        const references = extractScanReferences(rawValue);
        const stockLot = sanitizeDocument(await getCollectionModel("stock_lots").findOne({
            $or: references.flatMap((ref) => [
                { id: ref },
                { lot_number: ref },
                { source_lot_internal: ref },
                { source_lot_supplier: ref },
                { reception_lot_id: ref },
            ]),
        }).lean().exec());
        let resolvedStockLot = stockLot;
        let receptionLotId = stockLot?.reception_lot_id ? String(stockLot.reception_lot_id) : null;
        if (!resolvedStockLot) {
            const unit = sanitizeDocument(await getCollectionModel("reception_units").findOne({
                $or: references.flatMap((ref) => [
                    { id: ref }, { barcode: ref }, { sscc: ref },
                    { qr_code_payload: ref }, { qr_label_text: ref },
                ]),
            }).lean().exec());
            if (unit?.reception_lot_id) {
                receptionLotId = String(unit.reception_lot_id);
                resolvedStockLot = sanitizeDocument(await getCollectionModel("stock_lots")
                    .findOne({ reception_lot_id: receptionLotId }).lean().exec());
            }
        }
        const location = sanitizeDocument(await getCollectionModel("storage_locations").findOne({
            $or: references.flatMap((ref) => [{ id: ref }, { code: ref }]),
        }).lean().exec());
        if (!resolvedStockLot && !location) {
            throw notFound("SCAN_TARGET_NOT_FOUND", "The scanned lot, pallet or location was not found.");
        }
        const scannedAt = nowIso();
        const scanToken = randomUUID();
        const row = await prepareInsertDocument("scan_events", {
            scan_token: scanToken,
            raw_value: rawValue,
            references,
            parsed_kind: location ? "LOCATION" : classifyScan(rawValue),
            parsed_code: String(location?.code
                || resolvedStockLot?.lot_number
                || resolvedStockLot?.source_lot_internal
                || rawValue),
            resolved_reception_lot_id: receptionLotId,
            resolved_stock_lot_id: resolvedStockLot?.id ?? null,
            resolved_location_id: location?.id ?? null,
            resolved_location_code: location?.code ?? null,
            scanner_kind: String(input.scannerKind || "CAMERA").toUpperCase(),
            device_id: input.deviceId || null,
            actor_id: input.actorId,
            scanned_at: scannedAt,
            expires_at: new Date(Date.now() + 5 * 60_000).toISOString(),
            consumed_at: null,
            consumed_by_collection: null,
            consumed_by_movement_id: null,
        });
        await ScanEvents().create([row]);
        return {
            scanToken,
            expiresAt: row.expires_at,
            kind: row.parsed_kind,
            stockLot: resolvedStockLot,
            location,
            receptionLotId,
        };
    }
    async consumeMoveProof(input) {
        const mode = gateMode();
        if (mode === "off")
            return { mode, verified: false, exempt: true };
        const token = String(input.token || "").trim();
        if (!token) {
            if (mode === "warn") {
                console.warn(`[scan-gate] Missing proof for ${input.collection} by ${input.actorId}`);
                return { mode, verified: false, warning: "SCAN_PROOF_MISSING" };
            }
            throw badRequest("SCAN_PROOF_REQUIRED", "Scan the lot before recording this stock movement.");
        }
        const now = nowIso();
        const proof = sanitizeDocument(await ScanEvents().findOneAndUpdate({
            scan_token: token,
            actor_id: input.actorId,
            consumed_at: null,
            expires_at: { $gt: now },
        }, {
            $set: {
                consumed_at: now,
                consumed_by_collection: input.collection,
                updated_at: now,
            },
        }, { new: true }).lean().exec());
        if (!proof)
            throw badRequest("SCAN_PROOF_INVALID", "Scan proof is expired, consumed, or belongs to another actor.");
        if (input.expectedStockLotId
            && String(proof.resolved_stock_lot_id || "") !== String(input.expectedStockLotId)) {
            throw badRequest("SCAN_PROOF_LOT_MISMATCH", "The scan proof does not match the moved lot.");
        }
        return { mode, verified: true, proof };
    }
};
ScanService = __decorate([
    Injectable()
], ScanService);
export { ScanService };
export const scanService = new ScanService();
