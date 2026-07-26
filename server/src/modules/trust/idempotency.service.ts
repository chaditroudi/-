import { Injectable } from "@nestjs/common";

import { conflict } from "../../core/app-error.js";
import { prepareInsertDocument } from "../../db/defaults.js";
import { getCollectionModel, sanitizeDocument } from "../../db/dynamic-model.js";

type CommandRow = {
  id?: string;
  scope?: string;
  key?: string;
  actor_id?: string | null;
  status?: "IN_PROGRESS" | "COMPLETED" | "FAILED";
  response?: unknown;
  error?: string | null;
  attempts?: number;
};

const Commands = () => getCollectionModel("idempotency_commands");
const isDuplicateKey = (error: unknown) =>
  Number((error as { code?: unknown } | null)?.code) === 11000;

@Injectable()
export class IdempotencyService {
  async execute<T>(input: {
    scope: string;
    key?: string | null;
    actorId?: string | null;
    run: () => Promise<T>;
  }): Promise<{ data: T; replayed: boolean }> {
    const key = String(input.key || "").trim();
    if (!key) return { data: await input.run(), replayed: false };

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
    } catch (error) {
      if (!isDuplicateKey(error)) throw error;
    }

    if (!claimed) {
      const existing = sanitizeDocument(
        await Commands().findOne(filter).lean().exec(),
      ) as CommandRow | null;

      if (existing?.status === "COMPLETED") {
        return { data: existing.response as T, replayed: true };
      }

      if (existing?.status === "FAILED") {
        const reclaimed = await Commands().findOneAndUpdate(
          { ...filter, status: "FAILED" },
          {
            $set: {
              status: "IN_PROGRESS",
              actor_id: input.actorId || existing.actor_id || null,
              error: null,
              updated_at: new Date().toISOString(),
            },
            $inc: { attempts: 1 },
          },
          { new: true },
        ).lean().exec();
        claimed = Boolean(reclaimed);
      }

      if (!claimed) {
        throw conflict(
          "IDEMPOTENT_IN_PROGRESS",
          "This operation is already synchronizing. Retry shortly.",
        );
      }
    }

    try {
      const data = await input.run();
      await Commands().updateOne(
        filter,
        {
          $set: {
            status: "COMPLETED",
            response: data,
            error: null,
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        },
      ).exec();
      return { data, replayed: false };
    } catch (error) {
      await Commands().updateOne(
        filter,
        {
          $set: {
            status: "FAILED",
            error: error instanceof Error ? error.message : String(error),
            updated_at: new Date().toISOString(),
          },
        },
      ).exec();
      throw error;
    }
  }
}

export const idempotencyService = new IdempotencyService();
