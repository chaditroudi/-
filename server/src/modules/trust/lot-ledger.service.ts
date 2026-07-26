import { Injectable } from "@nestjs/common";

import { badRequest, notFound } from "../../core/app-error.js";
import { getCollectionModel, sanitizeDocument } from "../../db/dynamic-model.js";
import { prepareInsertDocument } from "../../db/defaults.js";
import {
  buildLotEventRecord,
  inferLotIdsFromRow,
  mapCollectionToEventType,
  verifyLotEventChain,
  type LotEventRecord,
  type LotEventType,
} from "./lot-ledger.js";

@Injectable()
export class LotLedgerService {
  async getChain(lotId: string): Promise<LotEventRecord[]> {
    const rows = sanitizeDocument(
      await getCollectionModel("lot_events")
        .find({ lot_id: lotId })
        .sort({ sequence: 1 })
        .lean()
        .exec(),
    ) as LotEventRecord[];
    return rows;
  }

  async verify(lotId: string) {
    const chain = await this.getChain(lotId);
    const result = verifyLotEventChain(chain);
    return {
      lotId,
      eventCount: chain.length,
      valid: result.valid,
      brokenAt: result.brokenAt,
      tipHash: chain.length > 0 ? chain[chain.length - 1].hash : null,
      events: chain,
    };
  }

  async append(input: {
    lotId: string;
    eventType: LotEventType;
    collection: string;
    action: "INSERT" | "UPDATE" | "DELETE" | "GATE";
    actorId?: string | null;
    payload?: Record<string, unknown>;
    relatedIds?: string[];
  }) {
    if (!input.lotId) {
      throw badRequest("LOT_ID_REQUIRED", "lotId is required to append a ledger event.");
    }

    const Model = getCollectionModel("lot_events");
    const maxAttempts = 5;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const last = sanitizeDocument(
        await Model.findOne({ lot_id: input.lotId }).sort({ sequence: -1 }).lean().exec(),
      ) as LotEventRecord | null;

      const sequence = Number(last?.sequence || 0) + 1;
      const record = buildLotEventRecord(
        {
          lotId: input.lotId,
          eventType: input.eventType,
          collection: input.collection,
          action: input.action,
          actorId: input.actorId,
          payload: input.payload,
          relatedIds: input.relatedIds,
          prevHash: last?.hash || null,
        },
        sequence,
      );

      const prepared = await prepareInsertDocument(
        "lot_events",
        record as unknown as Record<string, unknown>,
      );

      try {
        await Model.create([prepared]);
        return sanitizeDocument(prepared) as LotEventRecord;
      } catch (error) {
        const duplicate = Number((error as { code?: unknown } | null)?.code) === 11000;
        if (!duplicate || attempt === maxAttempts) throw error;
        // Another event won this sequence. Re-read the tip and rebuild the
        // hash/sequence on the next iteration instead of forking the chain.
      }
    }

    throw new Error(`Unable to append lot event for ${input.lotId}.`);
  }

  async appendForMutation(input: {
    collection: string;
    action: "INSERT" | "UPDATE" | "DELETE";
    rows: Record<string, unknown>[];
    actorId?: string | null;
  }) {
    const appended: LotEventRecord[] = [];

    for (const row of input.rows) {
      const lotIds = inferLotIdsFromRow(input.collection, row);
      if (lotIds.length === 0) continue;

      const eventType = mapCollectionToEventType(input.collection, input.action, row);
      for (const lotId of lotIds) {
        const related = lotIds.filter((id) => id !== lotId);
        const event = await this.append({
          lotId,
          eventType,
          collection: input.collection,
          action: input.action,
          actorId: input.actorId,
          payload: {
            id: row.id ?? null,
            status: row.status ?? row.stock_status ?? null,
            quantity: row.quantity ?? row.current_quantity ?? null,
          },
          relatedIds: related,
        });
        appended.push(event);
      }
    }

    return appended;
  }

  async requireValidChain(lotId: string) {
    const result = await this.verify(lotId);
    if (!result.valid) {
      throw badRequest("LOT_CHAIN_BROKEN", `Lot event chain is broken for ${lotId}.`, result);
    }
    if (result.eventCount === 0) {
      throw notFound("LOT_CHAIN_EMPTY", `No ledger events found for lot ${lotId}.`);
    }
    return result;
  }
}

export const lotLedgerService = new LotLedgerService();
