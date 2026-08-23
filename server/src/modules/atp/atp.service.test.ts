import { beforeEach, describe, expect, it, vi } from "vitest";

import { createInMemoryModel, type TestRow } from "../../test/in-memory-collection.js";

const store: Record<string, TestRow[]> = {};

vi.mock("../../db/dynamic-model.js", () => ({
  sanitizeDocument: <T>(value: T) => value,
  getCollectionModel: (collection: string) => createInMemoryModel(collection, store),
}));

import { AtpService } from "./atp.service.js";

describe("AtpService ship week heuristic", () => {
  beforeEach(() => {
    Object.keys(store).forEach((key) => delete store[key]);
  });

  it("exposes promise API shape via instance methods", () => {
    const service = new AtpService();
    expect(typeof service.promise).toBe("function");
    expect(typeof service.summary).toBe("function");
    expect(typeof service.promiseForOrder).toBe("function");
  });

  it("computes and persists an ATP promise onto the export order", async () => {
    store.export_orders = [
      {
        id: "eo-1",
        order_ref: "EXP-1",
        total_weight_kg: 1000,
        lines: [{ lot_id: "l1", net_weight_kg: 1000, quality_grade: "EXTRA" }],
      },
    ];
    // Enough FEFO validated stock to fully cover the order → committed.
    store.stock_lots = [
      {
        id: "sl-1",
        status: "VALIDATED",
        grade: "EXTRA",
        current_quantity: 5000,
        reception_date: "2026-08-01",
        lot_number: "LOT-1",
      },
    ];
    store.storage_zones = [{ id: "z1", capacity_kg: 20000, current_load_kg: 5000, is_active: true }];

    const service = new AtpService();
    const result = await service.promiseForOrder("eo-1", "user-1");

    expect(result.promise.confidence).toBe("committed");
    expect(result.promise.covered_kg).toBe(1000);

    const persisted = (store.export_orders || [])[0];
    expect(persisted).toMatchObject({
      atp_ship_week: result.promise.ship_week,
      atp_confidence: "committed",
      atp_covered_kg: 1000,
      atp_promised_by: "user-1",
    });
    expect(persisted.atp_promised_at).toBeTruthy();
  });

  it("rejects an order with no weight to promise", async () => {
    store.export_orders = [{ id: "eo-empty", order_ref: "EXP-0", total_weight_kg: 0, lines: [] }];
    const service = new AtpService();
    await expect(service.promiseForOrder("eo-empty")).rejects.toThrow();
  });
});
