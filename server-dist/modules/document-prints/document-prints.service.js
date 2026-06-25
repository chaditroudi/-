var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { getCollectionModel, sanitizeDocument } from "../../db/dynamic-model.js";
const DocumentPrints = () => getCollectionModel("document_prints");
const BON_EXPEDITION_PRODUCT_KEYS = [
    "branche1",
    "branche2",
    "vrac",
    "vrac_sec",
    "branche_sec",
    "alig_khouat",
];
const asText = (value) => (typeof value === "string" ? value.trim() : "");
const asBoolean = (value, fallback = false) => typeof value === "boolean" ? value : fallback;
const normalizeBonExpeditionRow = (value) => {
    const row = value && typeof value === "object" ? value : {};
    const sourceLots = Array.isArray(row.source_lots)
        ? row.source_lots.map((entry) => String(entry ?? "").trim()).filter(Boolean)
        : [];
    const totalKg = typeof row.total_kg === "number" && Number.isFinite(row.total_kg) ? row.total_kg : null;
    return {
        nature_caisse: asText(row.nature_caisse),
        quantite_caisse: asText(row.quantite_caisse),
        observation: asText(row.observation),
        source_lots: sourceLots,
        total_kg: totalKg,
    };
};
const normalizeBonExpeditionFormData = (value) => {
    const form = value && typeof value === "object" ? value : {};
    const legacyObs = {
        branche1: asText(form.obs_branche1),
        branche2: asText(form.obs_branche2),
        vrac: asText(form.obs_vrac),
        vrac_sec: asText(form.obs_vrac_sec),
        branche_sec: asText(form.obs_branche_sec),
        alig_khouat: asText(form.obs_alig),
    };
    const rawProducts = form.products && typeof form.products === "object" ? form.products : {};
    const products = Object.fromEntries(BON_EXPEDITION_PRODUCT_KEYS.map((key) => {
        const normalized = normalizeBonExpeditionRow(rawProducts[key]);
        if (!normalized.observation && legacyObs[key]) {
            normalized.observation = legacyObs[key];
        }
        return [key, normalized];
    }));
    return {
        version: typeof form.version === "number" && Number.isFinite(form.version) ? form.version : 2,
        document_number: asText(form.document_number),
        year: asText(form.year),
        document_date: asText(form.document_date),
        lieu_expedition: asText(form.lieu_expedition || form.lieu_reception),
        supplier_code: asText(form.supplier_code),
        supplier_name: asText(form.supplier_name),
        conventional: asBoolean(form.conventional, !asBoolean(form.tn_bio_001, false)),
        tn_bio_001: asBoolean(form.tn_bio_001),
        ggp: asBoolean(form.ggp),
        vehicle_number: asText(form.vehicle_number),
        driver_name: asText(form.driver_name),
        lieu_reception: asText(form.lieu_reception),
        controleur_code: asText(form.controleur_code),
        responsable_nom: asText(form.responsable_nom),
        signataire_nom: asText(form.signataire_nom),
        general_observation: asText(form.general_observation),
        casse_gc: asText(form.casse_gc),
        casse_p: asText(form.casse_p),
        casse_l: asText(form.casse_l),
        products,
    };
};
const normalizePayload = (payload, existing) => {
    const documentType = String(payload.document_type ?? existing?.document_type ?? "");
    if (documentType !== "BON_EXPEDITION")
        return payload;
    return {
        ...payload,
        template_version: typeof payload.template_version === "number"
            ? payload.template_version
            : typeof existing?.template_version === "number"
                ? existing.template_version
                : 2,
        print_count: typeof payload.print_count === "number"
            ? payload.print_count
            : typeof existing?.print_count === "number"
                ? existing.print_count
                : 0,
        last_printed_at: payload.last_printed_at === undefined
            ? existing?.last_printed_at ?? null
            : payload.last_printed_at,
        last_printed_by: payload.last_printed_by === undefined
            ? existing?.last_printed_by ?? null
            : payload.last_printed_by,
        form_data: normalizeBonExpeditionFormData(payload.form_data),
    };
};
let DocumentPrintsService = class DocumentPrintsService {
    async findBySourceAndType(source_id, document_type) {
        const doc = await DocumentPrints().findOne({ source_id, document_type }).lean().exec();
        return sanitizeDocument(doc);
    }
    async listBySource(source_id) {
        const docs = await DocumentPrints().find({ source_id }).lean().exec();
        return sanitizeDocument(docs);
    }
    async upsert(payload, actor) {
        const now = new Date().toISOString();
        const existing = await DocumentPrints().findOne({
            source_id: payload.source_id,
            document_type: payload.document_type,
        }).lean().exec();
        const normalizedPayload = normalizePayload(payload, existing);
        if (existing) {
            const updated = await DocumentPrints().findOneAndUpdate({ source_id: payload.source_id, document_type: payload.document_type }, { $set: { ...normalizedPayload, updated_at: now, updated_by: actor } }, { returnDocument: "after" }).lean().exec();
            return sanitizeDocument(updated);
        }
        const doc = {
            ...normalizedPayload,
            id: randomUUID(),
            created_at: now,
            updated_at: now,
            created_by: actor,
        };
        await DocumentPrints().create(doc);
        return sanitizeDocument(doc);
    }
    async update(id, payload, actor) {
        const now = new Date().toISOString();
        const existing = await DocumentPrints().findOne({ id }).lean().exec();
        const normalizedPayload = normalizePayload(payload, existing);
        const updated = await DocumentPrints().findOneAndUpdate({ id }, { $set: { ...normalizedPayload, updated_at: now, updated_by: actor } }, { returnDocument: "after" }).lean().exec();
        return sanitizeDocument(updated);
    }
};
DocumentPrintsService = __decorate([
    Injectable()
], DocumentPrintsService);
export { DocumentPrintsService };
