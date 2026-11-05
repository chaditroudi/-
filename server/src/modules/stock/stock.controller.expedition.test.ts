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

  it("refuses freeform stock movement inserts (Gate 2 P0)", async () => {
    await expect(controller.createMovement()).rejects.toMatchObject({
      code: "STOCK_MOVEMENT_DOMAIN_ONLY",
    });
  });

  it("refuses SHIPPED patch without an expedition pick (Gate 2 P0)", async () => {
    store.shipment_preparations = [{ id: "ship-1", status: "PREPARED" }];
    store.stock_movements = [];
    await expect(
      controller.updateShipment(req, "ship-1", { status: "SHIPPED" }),
    ).rejects.toMatchObject({ code: "SHIPMENT_PICK_REQUIRED" });
    expect(update).not.toHaveBeenCalled();
  });

  it("allows SHIPPED patch after expedition movements exist", async () => {
    store.shipment_preparations = [{ id: "ship-1", status: "PREPARED" }];
    store.stock_movements = [{
      id: "mov-1",
      shipment_id: "ship-1",
      movement_type: "EXPEDITION",
      quantity: 10,
    }];
    const result = await controller.updateShipment(req, "ship-1", { status: "SHIPPED", notes: "ok" });
    expect(update).toHaveBeenCalled();
    expect(result.data).toMatchObject({ id: "ship-1", status: "SHIPPED" });
  });

  it("rejects SHIPPED when shipment lines are only partially picked", async () => {
    store.shipment_preparations = [{ id: "ship-1", status: "PREPARED" }];
    store.shipment_lines = [{
      id: "line-1",
      shipment_id: "ship-1",
      stock_lot_id: "lot-1",
      quantity_kg: 40,
    }];
    store.stock_movements = [{
      id: "mov-1",
      shipment_id: "ship-1",
      lot_id: "lot-1",
      movement_type: "EXPEDITION",
      quantity: 10,
    }];
    await expect(
      controller.updateShipment(req, "ship-1", { status: "SHIPPED" }),
    ).rejects.toMatchObject({ code: "SHIPMENT_PICK_INCOMPLETE" });
    expect(update).not.toHaveBeenCalled();
  });

  it("writes shipment_id on expedition movements", async () => {
    await controller.expedition(req, {
      shipmentId: "ship-1",
      pickedLines: [{ lot_id: "lot-1", quantity: 10 }],
      status: "SHIPPED",
      requestId: "exp-ship-id",
    });
    expect(store.stock_movements?.[0]).toMatchObject({
      shipment_id: "ship-1",
      document_reference: "ship-1",
    });
  });
});
