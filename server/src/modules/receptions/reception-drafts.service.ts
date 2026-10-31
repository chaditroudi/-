import { Injectable } from "@nestjs/common";

import { badRequest, conflict, notFound } from "../../core/app-error.js";
import { prepareInsertDocument } from "../../db/defaults.js";
import { getCollectionModel, sanitizeDocument } from "../../db/dynamic-model.js";

const Drafts = () => getCollectionModel("reception_drafts");

/** The list only needs the summary; the form and its photos load when a draft is opened. */
const DRAFT_LIST_PROJECTION = { payload: 0 };

type SaveDraftInput = {
  id?: unknown;
  version?: unknown;
  stage?: unknown;
  summary?: unknown;
  payload?: unknown;
};

/**
 * A delivery in progress: the truck is on site but nothing is booked, so a draft
 * touches no lot, stock or order. The draft id is the intake's client_request_id,
 * which makes confirmation the one canonical intake and closes the draft with it.
 */
@Injectable()
export class ReceptionDraftsService {
  async listOpen() {
    return sanitizeDocument(
      await Drafts().find({ status: "OPEN" }, DRAFT_LIST_PROJECTION).sort({ updated_at: -1 }).limit(100).lean().exec(),
    );
  }

  async get(id: string) {
    const draft = sanitizeDocument(await Drafts().findOne({ id }).lean().exec());
    if (!draft) throw notFound("RECEPTION_DRAFT_NOT_FOUND", "Ce brouillon n'existe plus.");
    return draft;
  }

  /** Optimistic: a save from an outdated screen is refused and returns the newer draft. */
  async save(input: SaveDraftInput, actorId: string | null) {
    const id = String(input.id || "").trim();
    if (!id) throw badRequest("DRAFT_ID_REQUIRED", "id is required.");
    if (!input.payload || typeof input.payload !== "object") {
      throw badRequest("DRAFT_PAYLOAD_REQUIRED", "payload is required.");
    }
    const now = new Date().toISOString();
    const fields = {
      stage: input.stage ?? null,
      summary: input.summary ?? null,
      payload: input.payload,
      updated_by: actorId,
      updated_at: now,
    };

    const existing = sanitizeDocument(await Drafts().findOne({ id }).lean().exec()) as Record<string, unknown> | null;
    if (!existing) {
      const draft = await prepareInsertDocument("reception_drafts", {
        ...fields, id, status: "OPEN", version: 1, created_by: actorId,
      });
      try {
        await Drafts().create([draft]);
        return sanitizeDocument(draft);
      } catch (error) {
        if (Number((error as { code?: unknown })?.code) !== 11000) throw error;
        throw await this.staleError(id);
      }
    }
    if (existing.status !== "OPEN") {
      throw conflict("DRAFT_CLOSED", "Cette réception a déjà été confirmée ou abandonnée.", {
        reception_id: existing.reception_id ?? null,
      });
    }

    const version = Number(input.version);
    const updated = await Drafts().updateOne(
      { id, status: "OPEN", version },
      { $set: { ...fields, version: version + 1 } },
    ).exec();
    if (Number(updated.modifiedCount || 0) !== 1) throw await this.staleError(id);
    return this.get(id);
  }

  async abandon(id: string, actorId: string | null) {
    const now = new Date().toISOString();
    await Drafts().updateOne(
      { id, status: "OPEN" },
      { $set: { status: "ABANDONED", abandoned_by: actorId, abandoned_at: now, updated_at: now }, $unset: { payload: "" } },
    ).exec();
    return { id };
  }

  private async staleError(id: string) {
    return conflict("DRAFT_STALE", "Ce brouillon a été modifié sur un autre poste.", {
      draft: await this.get(id).catch(() => null),
    });
  }
}
