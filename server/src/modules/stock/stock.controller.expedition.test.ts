import { beforeEach, describe, expect, it, vi } from "vitest";

import { createInMemoryModel, type TestRow } from "../../test/in-memory-collection.js";
import { StockController } from "./stock.controller.js";

const store: Record<string, TestRow[]> = {};

vi.mock("../../db/dynamic-model.js", () => ({
  sanitizeDocument: <T>(value: T) => value,
  getCollectionModel: (collection: string) => createInMemoryModel(collection, store),
}));

vi.mock("../../db/defaults.js", () => ({
  prepareInsertDocument: vi.fn(async (collection: string, value: TestRow) => ({
    id: `${collection}-id-${(store[collection]?.length || 0) + 1}`,
    ...value,
  })),
}));

vi.mock("../trust/scan.service.js", () => ({
  scanService: { consumeMoveProof: vi.fn(async () => ({ verified: false, mode: "warn" })) },
}));

vi.mock("../realtime/realtime.bus.js", () => ({
  publishRealtimeDbChange: vi.fn(),
}));

vi.mock("../purchasing/stock-reorder.service.js", () => ({
  autoReorderOnStockChange: vi.fn(async () => null),
}));

const update = vi.fn(async () => ({ after: [{ id: "ship-1", status: "SHIPPED" }] }));
const controller = new StockController({ update } as never);

const req = { auth: { user: { id: "user-1" } } };

describe("StockController.expedition", () => {
  beforeEach(() => {
    Object.keys(store).forEach((key) => delete store[key]);
    update.mockReset();
    update.mockResolvedValue({ after: [{ id: "ship-1", status: "SHIPPED" }] });
    store.stock_lots = [{
      id: "lot-1",
      lot_number: "PF-1",
      status: "VALIDATED",
      current_quantity: 80,
    }];
  });

  it("decrements a released lot and writes one expedition movement", async () => {
    const result = await controller.expedition(req, {
      shipmentId: "ship-1",
      pickedLines: [{ lot_id: "lot-1", quantity: 30 }],
      status: "SHIPPED",
      requestId: "exp-1",
    });

    expect(result.replayed).toBe(false);
    expect(store.stock_lots?.[0]?.current_quantity).toBe(50);
    expect(store.stock_movements).toHaveLength(1);
    expect(store.stock_movements?.[0]).toMatchObject({
      movement_type: "EXPEDITION",
      quantity: 30,
      request_id: "exp-1:lot-1",
    });
  });

  it("does not consume again when the same request id is submitted", async () => {
    const body = {
      shipmentId: "ship-1",
      pickedLines: [{ lot_id: "lot-1", quantity: 30 }],
      status: "SHIPPED",
      requestId: "exp-1",
    };
    await controller.expedition(req, body);
    const replay = await controller.expedition(req, body);

    expect(replay.replayed).toBe(true);
    expect(store.stock_lots?.[0]?.current_quantity).toBe(50);
    expect(store.stock_movements).toHaveLength(1);
    expect(update).toHaveBeenCalledTimes(1);
  });

  it("restores the lot when the shipment update fails", async () => {
    update.mockRejectedValueOnce(new Error("shipment write failed"));

    await expect(controller.expedition(req, {
      shipmentId: "ship-1",
      pickedLines: [{ lot_id: "lot-1", quantity: 25 }],
      status: "SHIPPED",
      requestId: "exp-fail",
    })).rejects.toThrow(/shipment write failed/);

    expect(store.stock_lots?.[0]?.current_quantity).toBe(80);
    expect(store.stock_lots?.[0]?.status).toBe("VALIDATED");
    expect(store.stock_movements || []).toHaveLength(0);
  });

  it("rejects a quarantined lot before changing stock", async () => {
    store.stock_lots = [{
      id: "lot-1",
      lot_number: "PF-1",
      status: "QUARANTINE",
      current_quantity: 80,
    }];

    await expect(controller.expedition(req, {
      shipmentId: "ship-1",
      pickedLines: [{ lot_id: "lot-1", quantity: 10 }],
      status: "SHIPPED",
    })).rejects.toMatchObject({ code: "LOT_NOT_CONSUMABLE" });

    expect(store.stock_lots[0].current_quantity).toBe(80);
    expect(update).not.toHaveBeenCalled();
  });
});
