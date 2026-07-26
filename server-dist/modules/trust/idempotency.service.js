var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Injectable } from "@nestjs/common";
import { conflict } from "../../core/app-error.js";
import { prepareInsertDocument } from "../../db/defaults.js";
import { getCollectionModel, sanitizeDocument } from "../../db/dynamic-model.js";
const Commands = () => getCollectionModel("idempotency_commands");
const isDuplicateKey = (error) => Number(error?.code) === 11000;
let IdempotencyService = class IdempotencyService {
    async execute(input) {
        const key = String(input.key || "").trim();
        if (!key)
            return { data: await input.run(), replayed: false };
        const filter = { scope: input.scope, key };
        let claimed = false;
        try {
            const doc = await prepareInsertDocument("idempotency_commands", {
                ...filter,
                actor_id: input.actorId || null,
                status: "IN_PROGRESS",
                attempts: 1,
                response: null,
                error: null,
            });
            await Commands().create([doc]);
            claimed = true;
        }
        catch (error) {
            if (!isDuplicateKey(error))
                throw error;
        }
        if (!claimed) {
            const existing = sanitizeDocument(await Commands().findOne(filter).lean().exec());
            if (existing?.status === "COMPLETED") {
                return { data: existing.response, replayed: true };
            }
            if (existing?.status === "FAILED") {
                const reclaimed = await Commands().findOneAndUpdate({ ...filter, status: "FAILED" }, {
                    $set: {
                        status: "IN_PROGRESS",
                        actor_id: input.actorId || existing.actor_id || null,
                        error: null,
                        updated_at: new Date().toISOString(),
                    },
                    $inc: { attempts: 1 },
                }, { new: true }).lean().exec();
                claimed = Boolean(reclaimed);
            }
            if (!claimed) {
                throw conflict("IDEMPOTENT_IN_PROGRESS", "This operation is already synchronizing. Retry shortly.");
            }
        }
        try {
            const data = await input.run();
            await Commands().updateOne(filter, {
                $set: {
                    status: "COMPLETED",
                    response: data,
                    error: null,
                    completed_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                },
            }).exec();
            return { data, replayed: false };
        }
        catch (error) {
            await Commands().updateOne(filter, {
                $set: {
                    status: "FAILED",
                    error: error instanceof Error ? error.message : String(error),
                    updated_at: new Date().toISOString(),
                },
            }).exec();
            throw error;
        }
    }
};
IdempotencyService = __decorate([
    Injectable()
], IdempotencyService);
export { IdempotencyService };
export const idempotencyService = new IdempotencyService();
