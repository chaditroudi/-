import { beforeEach, describe, expect, it, vi } from "vitest";

import { createInMemoryModel, type TestRow } from "../../test/in-memory-collection.js";

const store: Record<string, TestRow[]> = {};

vi.mock("../../db/dynamic-model.js", () => ({
  sanitizeDocument: <T>(value: T) => value,
  getCollectionModel: (collection: string) => createInMemoryModel(collection, store),
}));

vi.mock("../../db/defaults.js", () => ({
  prepareInsertDocument: vi.fn(async (collection: string, value: TestRow) => ({
    id: `${collection}-id-${(store[collection]?.length || 0) + 1}`,
    requisition_number: `DA-${(store[collection]?.length || 0) + 1}`,
    created_at: "2026-08-23T12:00:00.000Z",
    updated_at: "2026-08-23T12:00:00.000Z",
    ...value,
  })),
}));

const emitNotification = vi.fn(async (_input?: unknown) => null);
vi.mock("../notifications/notification-emitter.js", () => ({
  emitNotification: (input: unknown) => emitNotification(input),
}));

import {
  AUTO_REORDER_SOURCE,
  autoCreateThresholdRequisitions,
  autoReorderOnStockChange,
  evaluateStockReorderNeeds,
} from "./stock-reorder.service.js";

const seedProduct = (over: Partial<TestRow> = {}): TestRow => ({
  id: "prod-1",
  name: "Deglet Nour Fraiche",
  code: "MP-DN-001",
  unit: "kg",
  threshold_security: 2000,
  threshold_max: 10000,
  ...over,
});

const seedStockLot = (over: Partial<TestRow> = {}): TestRow => ({
  id: "lot-1",
  product_id: "prod-1",
  reception_lot_id: "rec-lot-1",
  lot_number: "LOT-A",
  status: "VALIDATED",
  current_quantity: 500,
  updated_at: "2026-08-23T10:00:00.000Z",
  ...over,
});

describe("stock threshold auto-reorder", () => {
  beforeEach(() => {
    Object.keys(store).forEach((key) => delete store[key]);
    emitNotification.mockClear();
    delete process.env.AUTO_REORDER_GATE;
  });

  it("flags a product whose available stock is below its security threshold", async () => {
    store.products = [seedProduct()];
    store.stock_lots = [seedStockLot({ current_quantity: 500 })];

    const needs = await evaluateStockReorderNeeds();

    expect(needs).toHaveLength(1);
    expect(needs[0]).toMatchObject({
      product_id: "prod-1",
      available_quantity: 500,
      threshold_security: 2000,
      trigger_lot_id: "lot-1",
      trigger_lot_code: "LOT-A",
      trigger_reception_lot_id: "rec-lot-1",
      already_requested: false,
    });
    // Réappro jusqu'au plafond: 10000 - 500 = 9500.
    expect(needs[0].suggested_quantity).toBe(9500);
  });

  it("ignores products at or above the threshold and non-available lots", async () => {
    store.products = [seedProduct()];
    store.stock_lots = [
      seedStockLot({ id: "lot-ok", current_quantity: 1800 }),
      seedStockLot({ id: "lot-quar", current_quantity: 5000, status: "QUARANTINE" }),
    ];

    const needs = await evaluateStockReorderNeeds();
    // 1800 available (quarantine excluded) < 2000 → still below.
    expect(needs).toHaveLength(1);

    store.stock_lots = [seedStockLot({ id: "lot-ok", current_quantity: 2500 })];
    expect(await evaluateStockReorderNeeds()).toHaveLength(0);
  });

  it("creates a DRAFT requisition linked to the triggering lot, then is idempotent", async () => {
    store.products = [seedProduct()];
    store.stock_lots = [seedStockLot({ current_quantity: 100 })];

    const first = await autoCreateThresholdRequisitions({ actorId: "user-1" });
    expect(first.created_count).toBe(1);

    const created = (store.purchase_requisitions || [])[0];
    expect(created).toMatchObject({
      status: "DRAFT",
      source: AUTO_REORDER_SOURCE,
      product_id: "prod-1",
      trigger_lot_id: "lot-1",
      urgency: "high",
      department: "stock",
    });
    expect(emitNotification).toHaveBeenCalledTimes(1);

    // Une DA ouverte existe déjà → aucune nouvelle création.
    const second = await autoCreateThresholdRequisitions({ actorId: "user-1" });
    expect(second.created_count).toBe(0);
    expect(store.purchase_requisitions).toHaveLength(1);
  });

  it("marks urgency critical when stock is fully depleted", async () => {
    store.products = [seedProduct()];
    store.stock_lots = [seedStockLot({ current_quantity: 0, status: "VALIDATED" })];

    await autoCreateThresholdRequisitions({ actorId: "user-1" });
    expect((store.purchase_requisitions || [])[0]).toMatchObject({ urgency: "critical" });
  });

  it("does nothing on stock change when the gate is off", async () => {
    process.env.AUTO_REORDER_GATE = "off";
    store.products = [seedProduct()];
    store.stock_lots = [seedStockLot({ current_quantity: 100 })];

    await autoReorderOnStockChange(["prod-1"], "user-1");
    expect(store.purchase_requisitions ?? []).toHaveLength(0);
  });

  it("creates via the stock-change hook when the gate is on", async () => {
    store.products = [seedProduct()];
    store.stock_lots = [seedStockLot({ current_quantity: 100 })];

    await autoReorderOnStockChange(["prod-1", "prod-1", null], "user-1");
    expect(store.purchase_requisitions).toHaveLength(1);
  });
});
