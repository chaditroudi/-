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
        if (existing) {
            const updated = await DocumentPrints().findOneAndUpdate({ source_id: payload.source_id, document_type: payload.document_type }, { $set: { ...payload, updated_at: now, updated_by: actor } }, { returnDocument: "after" }).lean().exec();
            return sanitizeDocument(updated);
        }
        const doc = {
            ...payload,
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
        const updated = await DocumentPrints().findOneAndUpdate({ id }, { $set: { ...payload, updated_at: now, updated_by: actor } }, { returnDocument: "after" }).lean().exec();
        return sanitizeDocument(updated);
    }
};
DocumentPrintsService = __decorate([
    Injectable()
], DocumentPrintsService);
export { DocumentPrintsService };
