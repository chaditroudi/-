var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Injectable } from "@nestjs/common";
import { notFound } from "../../core/app-error.js";
import { getCollectionModel, sanitizeDocument } from "../../db/dynamic-model.js";
import { LotLedgerService } from "./lot-ledger.service.js";
import { LotLifecycleService } from "./lot-lifecycle.service.js";
import { GOLDEN_THREAD_STAGES } from "./lot-state-machine.js";
let LotPassportService = class LotPassportService {
    ledger;
    lifecycle;
    constructor(ledger, lifecycle) {
        this.ledger = ledger;
        this.lifecycle = lifecycle;
    }
    async buildPassport(lotRef) {
        const lotId = await this.lifecycle.resolveReceptionLotId({ lotId: lotRef, lotNumber: lotRef });
        if (!lotId) {
            throw notFound("LOT_NOT_FOUND", `Lot ${lotRef} not found.`);
        }
        const lot = sanitizeDocument(await getCollectionModel("reception_lots").findOne({ id: lotId }).lean().exec());
        if (!lot)
            throw notFound("LOT_NOT_FOUND", `Lot ${lotRef} not found.`);
        const reception = lot.reception_id
            ? sanitizeDocument(await getCollectionModel("receptions_v2").findOne({ id: lot.reception_id }).lean().exec())
            : null;
        const state = await this.lifecycle.getState(lotId, "PREMIUM_WHOLE");
        const verifiedAt = new Date().toISOString();
        const verifiedWeighing = sanitizeDocument(await getCollectionModel("weighing_records").findOne({
            lot_id: lotId,
            source: "DEVICE",
            signature_verified: true,
        }).sort({ captured_at: -1, created_at: -1 }).lean().exec());
        const chain = state.events || [];
        const ccpEvent = [...chain].reverse().find((event) => event.event_type === "CCP_COMPLETED" || event.event_type === "CCP_SENSOR_ATTESTED");
        const coldBreach = chain.some((event) => event.event_type === "COLD_CHAIN_BREACH");
        const coldAttested = chain.some((event) => event.event_type === "COLD_CHAIN_ATTESTED" || event.event_type === "STOCK_MOVED");
        const claim = (key, label, value, verified = state.valid) => ({
            key,
            label,
            value: value == null || value === "" ? null : value,
            verified,
        });
        const ccpPayload = (ccpEvent?.payload || {});
        const claims = [
            claim("product", "Produit", "Deglet Nour — dattes Tunisie"),
            claim("lot_number", "N° lot", String(lot.lot_internal || lot.id)),
            claim("variety", "Variété", String(lot.variety || reception?.variety || "Deglet Nour")),
            claim("origin_country", "Pays d'origine", String(lot.origin_country || "Tunisie")),
            claim("origin_region", "Région / oasis", String(lot.origin_region || lot.origin_farm || reception?.origin_oasis || "Tozeur")),
            claim("harvest_date", "Récolte", lot.harvest_date ? String(lot.harvest_date).slice(0, 10) : null),
            claim("reception_date", "Réception usine", reception?.actual_arrival_date
                ? String(reception.actual_arrival_date).slice(0, 10)
                : lot.created_at
                    ? String(lot.created_at).slice(0, 10)
                    : null),
            claim("qc_decision", "Décision QC", String(reception?.qc_decision || lot.stock_status || null)),
            claim("qc_grade", "Grade", reception?.qc_grade ? String(reception.qc_grade) : null),
            claim("ccp_fumigation", "CCP fumigation", state.progress.completed.includes("FUMIGATION_CCP"), Boolean(ccpPayload.evidence_compliant ?? state.progress.completed.includes("FUMIGATION_CCP"))),
            claim("ccp_sensor_verified", "Capteurs CCP vérifiés", Number(ccpPayload.device_verified_count || 0) > 0, Number(ccpPayload.device_verified_count || 0) > 0),
            claim("ccp_ct_product", "Produit CT fumigation", ccpPayload.ct_product == null ? null : Number(ccpPayload.ct_product), Boolean(ccpPayload.evidence_compliant)),
            claim("device_weighing", "Pesée appareil vérifiée", Boolean(verifiedWeighing), Boolean(verifiedWeighing)),
            claim("weighbridge_calibration", "Étalonnage bascule valide", verifiedWeighing?.calibration_valid_until
                ? String(verifiedWeighing.calibration_valid_until).slice(0, 10)
                : null, Boolean(verifiedWeighing?.calibration_valid_until
                && String(verifiedWeighing.calibration_valid_until) >= verifiedAt)),
            claim("cold_chain_intact", "Chaîne du froid intacte", coldAttested && !coldBreach, coldAttested && !coldBreach),
            claim("cold_chain_excursions", "Excursions froid", coldBreach ? "détectées" : "aucune", !coldBreach),
            claim("triage", "Triage effectué", state.progress.completed.includes("TRIAGE")),
            claim("packed", "Conditionné", state.progress.completed.includes("PACKED")),
            claim("shipped", "Expédié", state.progress.completed.includes("SHIPPED")),
            claim("chain_valid", "Chaîne hash intacte", state.valid),
            claim("tip_hash", "Empreinte tip", state.tipHash),
        ];
        return {
            wave: "W2",
            lotId,
            lotNumber: String(lot.lot_internal || lot.id),
            brand: "Royal Palm Tunisia",
            plant: "Usine Tozeur",
            tipHash: state.tipHash,
            valid: state.valid,
            eventCount: state.eventCount,
            stage: state.stage,
            goldenThread: {
                route: "PREMIUM_WHOLE",
                stages: GOLDEN_THREAD_STAGES,
                progress: state.progress,
                complete: state.goldenThreadComplete,
            },
            claims,
            verifiedAt,
            disclaimer: "Passeport acheteur — chaque claim est ancrée sur le registre lot hash-chaîné du MES. Vérifiez tipHash pour confirmer l'intégrité.",
        };
    }
};
LotPassportService = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [LotLedgerService,
        LotLifecycleService])
], LotPassportService);
export { LotPassportService };
