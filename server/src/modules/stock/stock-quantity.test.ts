import { beforeEach, describe, expect, it, vi } from "vitest";

import { createInMemoryModel, type TestRow } from "../../test/in-memory-collection.js";
import { changeStockLotQuantity, consumeStockLotKg, creditStockLotKg } from "./stock-quantity.js";

const store: Record<string, TestRow[]> = {};

vi.mock("../../db/dynamic-model.js", () => ({
  sanitizeDocument: <T>(value: T) => value,
  getCollectionModel: (collection: string) => createInMemoryModel(collection, store),
}));

describe("stock-quantity CAS", () => {
  beforeEach(() => {
    Object.keys(store).forEach((key) => delete store[key]);
    store.stock_lots = [{
      id: "lot-1",
      lot_number: "L1",
      current_quantity: 100,
      status: "VALIDATED",
    }];
  });

  it("consumes atomically and marks CONSUMED at zero", async () => {
    const change = await consumeStockLotKg("lot-1", 40, "2026-11-01T00:00:00.000Z");
    expect(change).toMatchObject({ before: 100, after: 60 });
    expect(store.stock_lots[0]).toMatchObject({ current_quantity: 60, status: "VALIDATED" });

    await consumeStockLotKg("lot-1", 60, "2026-11-01T00:00:00.000Z");
    expect(store.stock_lots[0]).toMatchObject({ current_quantity: 0, status: "CONSUMED" });
  });

  it("rejects negative available quantity", async () => {
    await expect(consumeStockLotKg("lot-1", 150, "2026-11-01T00:00:00.000Z")).rejects.toMatchObject({
      code: "INSUFFICIENT_STOCK",
    });
    expect(store.stock_lots[0].current_quantity).toBe(100);
  });

  it("credits back through the same primitive", async () => {
    await consumeStockLotKg("lot-1", 25, "2026-11-01T00:00:00.000Z");
    await creditStockLotKg("lot-1", 10, "2026-11-01T00:00:00.000Z");
    expect(store.stock_lots[0].current_quantity).toBe(85);
  });

  it("does not invent stock on a missing lot", async () => {
    await expect(changeStockLotQuantity("missing", -1, "2026-11-01T00:00:00.000Z")).rejects.toMatchObject({
      code: "STOCK_LOT_NOT_FOUND",
    });
  });
});
