import { Injectable } from "@nestjs/common";

import { badRequest, notFound } from "../../core/app-error.js";
import { getCollectionModel, sanitizeDocument } from "../../db/dynamic-model.js";
import { prepareInsertDocument } from "../../db/defaults.js";
import { buildMongoFilter, buildSort } from "../../db/query.js";
import { removeReceptionLotsFromStock, syncReceptionLotsToStock } from "../receptions/reception-stock-sync.js";
import { appendSupplierPerformanceSnapshot, normalizeSupplierDocument } from "../suppliers/supplier-domain.js";
import { gateRulesService } from "../trust/gate-rules.service.js";
import { lotLedgerService } from "../trust/lot-ledger.service.js";
import { isRegulatedCollection } from "../trust/regulated-collections.js";
import { assertCoreSchema, assertGenericDbMutationAllowed } from "../trust/write-guard.js";

const findRows = async (collection: string, filter: Record<string, unknown>, orderBy?: any, limit?: number) => {
  const Model = getCollectionModel(collection);
  let query = Model.find(filter).lean();
  const sort = buildSort(orderBy);
  if (sort) query = query.sort(sort);
  if (limit) query = query.limit(Number(limit));
  return sanitizeDocument(await query.exec());
};

const syncCollectionSideEffects = async (collection: string, rows: any[], action: "insert" | "update" | "delete") => {
  if (collection === "reception_lots") {
    if (action === "delete") {
      await removeReceptionLotsFromStock(rows.map((row) => row.id));
      return;
    }

    const receptionIds = Array.from(new Set(rows.map((row) => row.reception_id).filter(Boolean)));
    const Receptions = getCollectionModel("receptions_v2");

    for (const receptionId of receptionIds) {
      const reception = sanitizeDocument(await Receptions.findOne({ id: receptionId }).lean().exec());
      const lots = sanitizeDocument(await getCollectionModel("reception_lots").find({ reception_id: receptionId }).lean().exec());
      await syncReceptionLotsToStock(lots, { reception, actorId: null });
    }
  }
};

const appendLedgerSafe = async (
  collection: string,
  action: "INSERT" | "UPDATE" | "DELETE",
  rows: any[],
  actorId?: string | null,
) => {
  if (!isRegulatedCollection(collection) || collection === "lot_events") return;
  if (!rows?.length) return;
  try {
    await lotLedgerService.appendForMutation({ collection, action, rows, actorId });
  } catch (error) {
    // Ledger must not silently fail for regulated writes — rethrow.
    throw error;
  }
};

const assertDomainGates = async (
  table: string,
  action: "insert" | "update",
  docs: Record<string, unknown>[],
  beforeRows: Record<string, unknown>[] = [],
) => {
  if (table === "production_orders") {
    for (const doc of docs) {
      await gateRulesService.assertProductionOrderWritable(doc);
    }
  }

  if (table === "shipment_preparations") {
    for (let i = 0; i < docs.length; i += 1) {
      const before = beforeRows[i] || beforeRows[0] || null;
      await gateRulesService.assertShipmentWritable(before, docs[i]);
    }
  }

  if (table === "production_lot_allocations") {
    for (const doc of docs) {
      const lotId = String(doc.lot_id || "");
      if (!lotId) continue;
      await gateRulesService.assertProductionOrderWritable({
        status: "RELEASED",
        input_lot_ids: [lotId],
      });
    }
  }
};

const duplicateIdentityClauses = (row: any) => {
  const clauses = [];
  if (row.code) clauses.push({ code: row.code });
  if (row.fiscal_identifier) clauses.push({ fiscal_identifier: row.fiscal_identifier });
  if (row.id_document_number) clauses.push({ id_document_number: row.id_document_number });
  return clauses;
};

const assertUniqueSuppliers = async (rows: any[], excludedIds: string[] = []) => {
  const seen = new Set<string>();
  for (const row of rows) {
    for (const field of ["code", "fiscal_identifier", "id_document_number"]) {
      const value = String(row[field] || "").trim().toLowerCase();
      if (!value) continue;
      const key = `${field}:${value}`;
      if (seen.has(key)) throw badRequest("SUPPLIER_DUPLICATE_IDENTITY", `Duplicate supplier ${field}.`);
      seen.add(key);
    }
  }

  const clauses = rows.flatMap(duplicateIdentityClauses);
  if (clauses.length === 0) return;

  const existing = await getCollectionModel("suppliers")
    .find({ $or: clauses, id: { $nin: excludedIds } })
    .lean()
    .exec();
  if (existing.length > 0) throw badRequest("SUPPLIER_DUPLICATE_IDENTITY", "Supplier code or identity document already exists.");
};

@Injectable()
export class CollectionsService {
  async query(payload: any) {
    const table = String(payload.table || "");
    if (!table) throw badRequest("TABLE_REQUIRED", "Table is required.");
    return findRows(table, buildMongoFilter(payload.filters || []), payload.orderBy, payload.limit);
  }

  async insert(payload: any) {
    const table = String(payload.table || "");
    if (!table) throw badRequest("TABLE_REQUIRED", "Table is required.");

    assertGenericDbMutationAllowed(table, "insert", { trustedInternal: Boolean(payload.trustedInternal) });

    const values = Array.isArray(payload.values) ? payload.values : [payload.values];
    const prepared = [];
    for (const value of values) {
      prepared.push(await prepareInsertDocument(table, value || {}));
    }

    assertCoreSchema(table, prepared);
    await assertDomainGates(table, "insert", prepared);

    if (table === "suppliers") await assertUniqueSuppliers(prepared);

    if (prepared.length > 0) await getCollectionModel(table).insertMany(prepared);

    await syncCollectionSideEffects(table, prepared, "insert");
    await appendLedgerSafe(table, "INSERT", prepared, payload.actorId || null);
    return sanitizeDocument(prepared);
  }

  async update(payload: any) {
    const table = String(payload.table || "");
    if (!table) throw badRequest("TABLE_REQUIRED", "Table is required.");

    assertGenericDbMutationAllowed(table, "update", { trustedInternal: Boolean(payload.trustedInternal) });

    const query = buildMongoFilter(payload.filters || []);
    const Model = getCollectionModel(table);
    const before = sanitizeDocument(await Model.find(query).lean().exec());

    if (table === "suppliers") {
      if (before.length === 0) return { before, after: [] };

      const actorId = payload.actorId || null;
      const normalizedRows = before.map((row: any) => {
        const next = normalizeSupplierDocument(payload.values || {}, row);
        next.id = row.id;
        next.created_at = row.created_at;
        next.updated_at = new Date().toISOString();
        next.performance_history = appendSupplierPerformanceSnapshot(row, next, actorId);
        return sanitizeDocument(next);
      });

      await assertUniqueSuppliers(normalizedRows, before.map((row: any) => row.id).filter(Boolean));

      for (const row of normalizedRows) {
        const id = row.id;
        const updateValues = { ...row };
        delete updateValues._id;
        await Model.updateOne({ id }, { $set: updateValues }).exec();
      }

      await syncCollectionSideEffects(table, normalizedRows, "update");
      return { before, after: normalizedRows };
    }

    const updateValues = sanitizeDocument({
      ...(payload.values || {}),
      updated_at: new Date().toISOString(),
    });
    delete updateValues.id;
    delete updateValues.created_at;

    const projectedAfter = before.map((row: any) => sanitizeDocument({ ...row, ...updateValues }));
    assertCoreSchema(table, projectedAfter);
    await assertDomainGates(table, "update", projectedAfter, before);

    await Model.updateMany(query, { $set: updateValues }).exec();

    const ids = before.map((row: any) => row.id).filter(Boolean);
    const after = ids.length > 0
      ? sanitizeDocument(await Model.find({ id: { $in: ids } }).lean().exec())
      : [];

    await syncCollectionSideEffects(table, after, "update");
    await appendLedgerSafe(table, "UPDATE", after, payload.actorId || null);
    return { before, after };
  }

  async remove(payload: any) {
    const table = String(payload.table || "");
    if (!table) throw badRequest("TABLE_REQUIRED", "Table is required.");

    assertGenericDbMutationAllowed(table, "delete", { trustedInternal: Boolean(payload.trustedInternal) });

    const query = buildMongoFilter(payload.filters || []);
    const Model = getCollectionModel(table);
    const rows = sanitizeDocument(await Model.find(query).lean().exec());
    if (rows.length === 0) throw notFound("ROWS_NOT_FOUND", "No rows matched the delete request.");

    await Model.deleteMany(query).exec();
    await syncCollectionSideEffects(table, rows, "delete");
    await appendLedgerSafe(table, "DELETE", rows, payload.actorId || null);
    return rows;
  }
}

export const collectionsService = new CollectionsService();
