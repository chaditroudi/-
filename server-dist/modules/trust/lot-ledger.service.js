var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Injectable } from "@nestjs/common";
import { badRequest, notFound } from "../../core/app-error.js";
import { getCollectionModel, sanitizeDocument } from "../../db/dynamic-model.js";
import { prepareInsertDocument } from "../../db/defaults.js";
import { buildLotEventRecord, inferLotIdsFromRow, mapCollectionToEventType, verifyLotEventChain, } from "./lot-ledger.js";
let LotLedgerService = class LotLedgerService {
    async getChain(lotId) {
        const rows = sanitizeDocument(await getCollectionModel("lot_events")
            .find({ lot_id: lotId })
            .sort({ sequence: 1 })
            .lean()
            .exec());
        return rows;
    }
    async verify(lotId) {
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
    async append(input) {
        if (!input.lotId) {
            throw badRequest("LOT_ID_REQUIRED", "lotId is required to append a ledger event.");
        }
        const Model = getCollectionModel("lot_events");
        const maxAttempts = 5;
        for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
            const last = sanitizeDocument(await Model.findOne({ lot_id: input.lotId }).sort({ sequence: -1 }).lean().exec());
            const sequence = Number(last?.sequence || 0) + 1;
            const record = buildLotEventRecord({
                lotId: input.lotId,
                eventType: input.eventType,
                collection: input.collection,
                action: input.action,
                actorId: input.actorId,
                payload: input.payload,
                relatedIds: input.relatedIds,
                prevHash: last?.hash || null,
            }, sequence);
            const prepared = await prepareInsertDocument("lot_events", record);
            try {
                await Model.create([prepared]);
                return sanitizeDocument(prepared);
            }
            catch (error) {
                const duplicate = Number(error?.code) === 11000;
                if (!duplicate || attempt === maxAttempts)
                    throw error;
                // Another event won this sequence. Re-read the tip and rebuild the
                // hash/sequence on the next iteration instead of forking the chain.
            }
        }
        throw new Error(`Unable to append lot event for ${input.lotId}.`);
    }
    async appendForMutation(input) {
        const appended = [];
        for (const row of input.rows) {
            const lotIds = inferLotIdsFromRow(input.collection, row);
            if (lotIds.length === 0)
                continue;
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
    async requireValidChain(lotId) {
        const result = await this.verify(lotId);
        if (!result.valid) {
            throw badRequest("LOT_CHAIN_BROKEN", `Lot event chain is broken for ${lotId}.`, result);
        }
        if (result.eventCount === 0) {
            throw notFound("LOT_CHAIN_EMPTY", `No ledger events found for lot ${lotId}.`);
        }
        return result;
    }
};
LotLedgerService = __decorate([
    Injectable()
], LotLedgerService);
export { LotLedgerService };
export const lotLedgerService = new LotLedgerService();
