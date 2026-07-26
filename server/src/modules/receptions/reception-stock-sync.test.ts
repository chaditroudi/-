import { beforeEach, describe, expect, it, vi } from "vitest";

import { createInMemoryModel, type TestRow } from "../../test/in-memory-collection.js";
import { type LotEventRecord } from "../trust/lot-ledger.js";
import { syncReceptionLotsToStock } from "./reception-stock-sync.js";

const store: Record<string, TestRow[]> = {};

vi.mock("../../db/dynamic-model.js", () => ({
  sanitizeDocument: <T>(value: T) => value,
  getCollectionModel: (collection: string) => createInMemoryModel(collection, store),
}));

vi.mock("../../db/defaults.js", () => ({
  prepareInsertDocument: vi.fn(async (collection: string, value: TestRow) => ({
    id: `${collection}-id-${(store[collection]?.length || 0) + 1}`,
    created_at: "2026-07-26T12:00:00.000Z",
    updated_at: "2026-07-26T12:00:00.000Z",
    ...value,
  })),
}));

describe("syncReceptionLotsToStock", () => {
  beforeEach(() => {
    Object.keys(store).forEach((key) => delete store[key]);
    store.products = [{ id: "product-1", code: "MP-DN-001", is_active: true, category: "MP" }];
  });

  it("creates a stock projection and appends STOCK_SYNCED on the reception lot chain", async () => {
    await syncReceptionLotsToStock(
      [
        {
          id: "reception-lot-1",
          reception_id: "rec-1",
          lot_internal: "LOT-A",
          quantity: 900,
          stock_status: "EN_QUARANTAINE",
        },
      ],
      { reception: { id: "rec-1", reception_number: "REC-1", supplier_id: "sup-1" }, actorId: "user-1" },
    );

    expect(store.stock_lots).toHaveLength(1);
    expect(store.stock_lots[0]).toMatchObject({
      reception_lot_id: "reception-lot-1",
      entry_lot_id: "reception-lot-1",
      status: "QUARANTINE",
    });

    const events = (store.lot_events || []) as unknown as LotEventRecord[];
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      lot_id: "reception-lot-1",
      event_type: "STOCK_SYNCED",
      actor_id: "user-1",
      payload: expect.objectContaining({
        source_sync_reason: "SYNC_CREATE",
        status: "QUARANTINE",
      }),
    });
  });

  it("does not treat STOCK_SYNCED as a COLD_STORE golden-thread stage", async () => {
    const { stagesAchieved } = await import("../trust/lot-state-machine.js");

    await syncReceptionLotsToStock(
      [{ id: "reception-lot-2", lot_internal: "LOT-B", quantity: 100, stock_status: "EN_QUARANTAINE" }],
      { actorId: "user-1" },
    );

    const events = (store.lot_events || []) as unknown as LotEventRecord[];
    expect(stagesAchieved(events).has("COLD_STORE")).toBe(false);
  });
});
