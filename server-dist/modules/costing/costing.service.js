var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Injectable } from "@nestjs/common";
import { notFound } from "../../core/app-error.js";
import { getCollectionModel, sanitizeDocument } from "../../db/dynamic-model.js";
import { lotLifecycleService } from "../trust/lot-lifecycle.service.js";
const ReceptionLots = () => getCollectionModel("reception_lots");
const TriageSessions = () => getCollectionModel("triage_sessions");
const TriageSublots = () => getCollectionModel("triage_sublots");
let CostingService = class CostingService {
    /**
     * Lot cost view: purchase snapshot + grade split costs from the latest
     * closed triage session for this reception lot (if any).
     */
    async getLotCost(lotIdOrNumber) {
        const key = String(lotIdOrNumber || "").trim();
        if (!key)
            throw notFound("LOT_NOT_FOUND", "Lot introuvable.");
        let lot = sanitizeDocument(await ReceptionLots().findOne({ id: key }).lean().exec());
        if (!lot) {
            lot = sanitizeDocument(await ReceptionLots().findOne({ lot_internal: key }).lean().exec());
        }
        if (!lot && !key.includes("/")) {
            const resolved = await lotLifecycleService.resolveReceptionLotId({ lotNumber: key });
            if (resolved) {
                lot = sanitizeDocument(await ReceptionLots().findOne({ id: resolved }).lean().exec());
            }
        }
        if (!lot)
            throw notFound("LOT_NOT_FOUND", "Lot introuvable.");
        const lotId = String(lot.id);
        const lotNumber = String(lot.lot_internal || "");
        const receptionId = String(lot.reception_id || "");
        const sessionQuery = [];
        if (lotNumber)
            sessionQuery.push({ parent_lot_number: lotNumber });
        if (receptionId)
            sessionQuery.push({ parent_reception_id: receptionId });
        const session = sessionQuery.length
            ? sanitizeDocument(await TriageSessions()
                .findOne({ status: "TERMINE", $or: sessionQuery })
                .sort({ ended_at: -1, updated_at: -1 })
                .lean()
                .exec())
            : null;
        const sublots = session?.id
            ? (sanitizeDocument(await TriageSublots().find({ session_id: session.id }).lean().exec()) || [])
            : [];
        const grades = sublots.map((row) => ({
            grade: row.grade,
            lot_number: row.lot_number,
            weight_kg: Number(row.weight_kg || 0),
            destination: row.destination ?? null,
            cost_tnd: row.cost_tnd ?? null,
            cost_tnd_per_kg: row.cost_tnd_per_kg ?? null,
        }));
        return {
            lot: {
                id: lotId,
                lot_internal: lot.lot_internal ?? null,
                reception_id: lot.reception_id ?? null,
                quantity: Number(lot.quantity || 0),
                purchase_cost_tnd_per_kg: lot.purchase_cost_tnd_per_kg ?? null,
                purchase_cost_tnd: lot.purchase_cost_tnd ?? null,
                cost_source: lot.cost_source ?? null,
            },
            triage: session
                ? {
                    session_id: session.id,
                    session_number: session.session_number ?? null,
                    input_cost_tnd: session.input_cost_tnd ?? null,
                    mass_balance_variance_pct: session.mass_balance_variance_pct ?? null,
                    parent_weight_kg: Number(session.parent_weight_kg || 0),
                    grades,
                }
                : null,
        };
    }
};
CostingService = __decorate([
    Injectable()
], CostingService);
export { CostingService };
