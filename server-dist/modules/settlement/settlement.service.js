var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
/**
 * Wave C — supplier/farmer settlements from closed triage splits.
 */
import { Injectable } from "@nestjs/common";
import { badRequest, notFound } from "../../core/app-error.js";
import { prepareInsertDocument } from "../../db/defaults.js";
import { getCollectionModel, sanitizeDocument } from "../../db/dynamic-model.js";
import { computeGradeSettlement, } from "./settlement-domain.js";
const Settlements = () => getCollectionModel("supplier_settlements");
const TriageSessions = () => getCollectionModel("triage_sessions");
const TriageSublots = () => getCollectionModel("triage_sublots");
const Receptions = () => getCollectionModel("receptions_v2");
const Suppliers = () => getCollectionModel("suppliers");
const readString = (...values) => {
    for (const value of values) {
        const text = String(value ?? "").trim();
        if (text)
            return text;
    }
    return "";
};
let SettlementService = class SettlementService {
    async list(filters) {
        const query = {};
        if (filters?.supplierId)
            query.supplier_id = filters.supplierId;
        if (filters?.status)
            query.status = filters.status;
        return sanitizeDocument(await Settlements().find(query).sort({ created_at: -1 }).limit(200).lean().exec()) || [];
    }
    async get(id) {
        const row = sanitizeDocument(await Settlements().findOne({ id }).lean().exec());
        if (!row)
            throw notFound("SETTLEMENT_NOT_FOUND", "Règlement fournisseur introuvable.");
        return row;
    }
    /**
     * Build (or refresh) a DRAFT settlement from a closed triage session's grades.
     */
    async createFromTriageSession(sessionId, actorId) {
        const session = sanitizeDocument(await TriageSessions().findOne({ id: sessionId }).lean().exec());
        if (!session)
            throw notFound("TRIAGE_SESSION_NOT_FOUND", "Session de triage introuvable.");
        if (session.status !== "TERMINE") {
            throw badRequest("TRIAGE_NOT_CLOSED", "Le règlement grade ne peut être calculé que sur une session TERMINE.");
        }
        const existing = sanitizeDocument(await Settlements()
            .findOne({ triage_session_id: sessionId, status: { $ne: "CANCELLED" } })
            .lean()
            .exec());
        if (existing && existing.status !== "DRAFT") {
            throw badRequest("SETTLEMENT_LOCKED", `Règlement déjà ${existing.status} pour cette session.`);
        }
        const receptionId = readString(session.parent_reception_id);
        const reception = receptionId
            ? (sanitizeDocument(await Receptions().findOne({ id: receptionId }).lean().exec()) || null)
            : null;
        const supplierId = readString(reception?.supplier_id);
        if (!supplierId) {
            throw badRequest("SUPPLIER_REQUIRED", "La réception parent n'a pas de fournisseur — règlement impossible.");
        }
        const supplier = sanitizeDocument(await Suppliers().findOne({ id: supplierId }).lean().exec());
        if (!supplier)
            throw notFound("SUPPLIER_NOT_FOUND", "Fournisseur introuvable.");
        const sublots = sanitizeDocument(await TriageSublots().find({ session_id: sessionId }).lean().exec()) || [];
        const gradeLines = sublots.length > 0
            ? sublots.map((row) => ({
                grade: String(row.grade || ""),
                weightKg: Number(row.weight_kg || 0),
                lotNumber: row.lot_number ? String(row.lot_number) : null,
            }))
            : [
                {
                    grade: "EXTRA",
                    weightKg: Number(session.weight_extra_kg || 0),
                    lotNumber: null,
                },
                {
                    grade: "CATEGORIE_I",
                    weightKg: Number(session.weight_cat1_kg || 0),
                    lotNumber: null,
                },
                {
                    grade: "CATEGORIE_II",
                    weightKg: Number(session.weight_cat2_kg || 0),
                    lotNumber: null,
                },
                {
                    grade: "REJETE",
                    weightKg: Number(session.weight_reject_kg || 0),
                    lotNumber: null,
                },
            ];
        const computed = computeGradeSettlement({
            lines: gradeLines,
            gradePrices: (supplier.grade_prices_tnd_per_kg || null),
            agreedPriceTndPerKg: Number(supplier.agreed_price_tnd_per_kg),
        });
        if (computed.totalWeightKg <= 0) {
            throw badRequest("SETTLEMENT_EMPTY", "Aucun poids grade à régler.");
        }
        const now = new Date().toISOString();
        const payload = {
            settlement_number: existing?.settlement_number,
            supplier_id: supplierId,
            supplier_name: readString(supplier.name) || null,
            triage_session_id: sessionId,
            triage_session_number: readString(session.session_number) || null,
            reception_id: receptionId || null,
            parent_lot_number: readString(session.parent_lot_number) || null,
            currency: "TND",
            status: "DRAFT",
            lines: computed.lines,
            total_weight_kg: computed.totalWeightKg,
            payable_weight_kg: computed.payableWeightKg,
            total_amount_tnd: computed.totalAmountTnd,
            agreed_price_tnd_per_kg: Number(supplier.agreed_price_tnd_per_kg) || null,
            grade_prices_tnd_per_kg: supplier.grade_prices_tnd_per_kg || null,
            basis: "triage_grades",
            notes: null,
            approved_at: null,
            approved_by: null,
            paid_at: null,
            paid_by: null,
            created_by: actorId || existing?.created_by || null,
            updated_at: now,
        };
        if (existing?.id) {
            await Settlements()
                .updateOne({ id: existing.id }, { $set: payload })
                .exec();
            return this.get(String(existing.id));
        }
        const doc = await prepareInsertDocument("supplier_settlements", {
            ...payload,
            created_at: now,
        });
        await Settlements().insertOne(doc);
        return this.get(String(doc.id));
    }
    /** Best-effort draft creation after triage close (never throws to caller). */
    async createFromTriageSafe(sessionId, actorId) {
        try {
            return await this.createFromTriageSession(sessionId, actorId);
        }
        catch (error) {
            console.warn("[settlement] auto-draft skipped:", {
                sessionId,
                error: error instanceof Error ? error.message : error,
            });
            return null;
        }
    }
    async transition(id, toStatus, actorId) {
        const current = await this.get(id);
        const status = String(current.status || "DRAFT");
        const allowed = {
            DRAFT: ["APPROVED", "CANCELLED"],
            APPROVED: ["PAID", "CANCELLED"],
            PAID: [],
            CANCELLED: [],
        };
        if (!allowed[status]?.includes(toStatus)) {
            throw badRequest("INVALID_SETTLEMENT_TRANSITION", `Impossible de passer de ${status} à ${toStatus}.`);
        }
        const now = new Date().toISOString();
        const patch = { status: toStatus, updated_at: now };
        if (toStatus === "APPROVED") {
            patch.approved_at = now;
            patch.approved_by = actorId || null;
        }
        if (toStatus === "PAID") {
            patch.paid_at = now;
            patch.paid_by = actorId || null;
            // Roll up paid amount onto supplier metrics.
            const supplierId = readString(current.supplier_id);
            if (supplierId) {
                const amount = Number(current.total_amount_tnd || 0);
                await Suppliers()
                    .updateOne({ id: supplierId }, {
                    $inc: { total_paid_amount_tnd: amount },
                    $set: { updated_at: now },
                })
                    .exec();
            }
        }
        await Settlements().updateOne({ id }, { $set: patch }).exec();
        return this.get(id);
    }
};
SettlementService = __decorate([
    Injectable()
], SettlementService);
export { SettlementService };
