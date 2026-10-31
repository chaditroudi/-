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
  fingerprint?: string | null;
  updated_at?: string;
  created_at?: string;
};

/** A crash leaves a command IN_PROGRESS; past this age a retry may take it over. */
const IN_PROGRESS_LEASE_MS = 2 * 60 * 1000;

const Commands = () => getCollectionModel("idempotency_commands");
const isDuplicateKey = (error: unknown) =>
  Number((error as { code?: unknown } | null)?.code) === 11000;

@Injectable()
export class IdempotencyService {
  async execute<T>(input: {
    scope: string;
    key?: string | null;
    actorId?: string | null;
    /** Business content of the request: the same key with other content is refused, not replayed. */
    fingerprint?: string | null;
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
        fingerprint: input.fingerprint || null,
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
        if (input.fingerprint && existing.fingerprint && input.fingerprint !== existing.fingerprint) {
          throw conflict(
            "IDEMPOTENT_PAYLOAD_MISMATCH",
            "Cette opération est déjà enregistrée avec d'autres valeurs. Ouvrez l'enregistrement existant pour le corriger.",
            { response: existing.response },
          );
        }
        return { data: existing.response as T, replayed: true };
      }

      const lastTouched = Date.parse(String(existing?.updated_at || existing?.created_at || ""));
      const staleInProgress = existing?.status === "IN_PROGRESS"
        && Number.isFinite(lastTouched)
        && Date.now() - lastTouched > IN_PROGRESS_LEASE_MS;

      if (existing?.status === "FAILED" || staleInProgress) {
        const reclaimed = await Commands().findOneAndUpdate(
          { ...filter, status: existing.status, updated_at: existing.updated_at },
          {
            $set: {
              status: "IN_PROGRESS",
              actor_id: input.actorId || existing.actor_id || null,
              fingerprint: input.fingerprint || null,
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
