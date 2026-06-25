import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { getCollectionModel, sanitizeDocument } from "../../db/dynamic-model.js";

const DocumentPrints = () => getCollectionModel("document_prints");

@Injectable()
export class DocumentPrintsService {
  async findBySourceAndType(source_id: string, document_type: string) {
    const doc = await DocumentPrints().findOne({ source_id, document_type }).lean().exec();
    return sanitizeDocument(doc);
  }

  async listBySource(source_id: string) {
    const docs = await DocumentPrints().find({ source_id }).lean().exec();
    return sanitizeDocument(docs);
  }

  async upsert(payload: Record<string, unknown>, actor: string) {
    const now = new Date().toISOString();
    const existing = await DocumentPrints().findOne({
      source_id: payload.source_id,
      document_type: payload.document_type,
    }).lean().exec();

    if (existing) {
      const updated = await DocumentPrints().findOneAndUpdate(
        { source_id: payload.source_id, document_type: payload.document_type },
        { $set: { ...payload, updated_at: now, updated_by: actor } },
        { returnDocument: "after" }
      ).lean().exec();
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

  async update(id: string, payload: Record<string, unknown>, actor: string) {
    const now = new Date().toISOString();
    const updated = await DocumentPrints().findOneAndUpdate(
      { id },
      { $set: { ...payload, updated_at: now, updated_by: actor } },
      { returnDocument: "after" }
    ).lean().exec();
    return sanitizeDocument(updated);
  }
}
