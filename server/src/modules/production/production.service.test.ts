import { beforeEach, describe, expect, it, vi } from "vitest";

import { createInMemoryModel, type TestRow } from "../../test/in-memory-collection.js";
import { ProductionService } from "./production.service.js";

const store: Record<string, TestRow[]> = {};
const productionService = new ProductionService();

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

vi.mock("../notifications/notification-emitter.js", () => ({
  emitNotification: vi.fn(async () => null),
}));

vi.mock("../trust/lot-lifecycle.service.js", () => ({
  lotLifecycleService: {
    recordMassBalanceSafe: vi.fn(async () => null),
  },
}));

describe("productionService mass balance", () => {
  beforeEach(() => {
    Object.keys(store).forEach((key) => delete store[key]);
    vi.stubEnv("TRUST_MASS_BALANCE_GATE", "enforce");
  });

  it("completes when output plus waste reconciles with allocated input", async () => {
    store.production_orders = [
      {
        id: "po-1",
        status: "IN_PROGRESS",
        actual_output_kg: 0,
      },
    ];
    store.production_steps = [
      { id: "step-1", production_order_id: "po-1", is_mandatory: true, status: "COMPLETED", name: "Triage" },
    ];
    store.production_lot_allocations = [
      { id: "alloc-1", production_order_id: "po-1", lot_id: "lot-1", allocated_kg: 100 },
    ];

    const result = await productionService.completeOrder(
      "po-1",
      { actual_output_kg: 92, waste_kg: 8 },
      "user-1",
    );

    expect(result).toMatchObject({
      status: "completed",
      actual_output_kg: 92,
      waste_kg: 8,
      mass_balance_variance_pct: 0,
    });
  });

  it("blocks completion when mass balance is outside tolerance", async () => {
    store.production_orders = [{ id: "po-2", status: "IN_PROGRESS" }];
    store.production_steps = [
      { id: "step-1", production_order_id: "po-2", is_mandatory: true, status: "COMPLETED" },
    ];
    store.production_lot_allocations = [
      { id: "alloc-1", production_order_id: "po-2", lot_id: "lot-1", allocated_kg: 100 },
    ];

    await expect(
      productionService.completeOrder("po-2", { actual_output_kg: 50, waste_kg: 0 }, "user-1"),
    ).rejects.toMatchObject({ code: "MASS_BALANCE_UNBALANCED" });
  });
});

describe("productionService partial consumption", () => {
  beforeEach(() => {
    Object.keys(store).forEach((key) => delete store[key]);
  });

  const releasedLot = (id: string, receivedKg: number, availableKg: number) => {
    store.reception_lots = [{ id, lot_internal: `L-${id}`, quantity: receivedKg, stock_status: "STOCK_LIBERE" }];
    store.stock_lots = [{ id: `stock-${id}`, reception_lot_id: id, lot_number: `L-${id}`, current_quantity: availableKg, initial_quantity: receivedKg, status: "VALIDATED", unit: "kg" }];
  };

  it("consumes the stock lot on start and keeps the received quantity as history", async () => {
    store.production_orders = [{ id: "po-3", status: "PLANNED", order_number: "OF-3" }];
    store.production_lot_allocations = [
      { id: "alloc-3", production_order_id: "po-3", lot_id: "lot-3", allocated_kg: 40, consumed_at: null },
    ];
    releasedLot("lot-3", 100, 100);

    await productionService.startOrder("po-3", "user-1");
    // A second « Démarrer » (double tap or retry) must not consume again.
    store.production_orders[0].status = "PLANNED";
    await productionService.startOrder("po-3", "user-1");

    expect(store.reception_lots[0]).toMatchObject({ quantity: 100, stock_status: "STOCK_LIBERE" });
    expect(store.stock_lots[0]).toMatchObject({ current_quantity: 60, status: "VALIDATED" });
    expect(store.stock_movements).toEqual([
      expect.objectContaining({ movement_type: "CONSOMMATION", lot_id: "stock-lot-3", quantity: 40, document_reference: "OF-3" }),
    ]);
    expect(store.production_lot_allocations[0]).toMatchObject({ consumed_kg: 40 });
    expect(store.production_orders[0].status).toBe("in_progress");
  });

  it("marks the stock lot consumed when the order takes everything", async () => {
    store.production_orders = [{ id: "po-6", status: "PLANNED", order_number: "OF-6" }];
    store.production_lot_allocations = [
      { id: "alloc-6", production_order_id: "po-6", lot_id: "lot-6", allocated_kg: 50, consumed_at: null },
    ];
    releasedLot("lot-6", 80, 50);

    await productionService.startOrder("po-6", "user-1");
    expect(store.stock_lots[0]).toMatchObject({ current_quantity: 0, status: "CONSUMED" });
  });

  it("rejects allocation above available stock, not above the received quantity", async () => {
    store.production_orders = [{ id: "po-4", status: "DRAFT" }];
    releasedLot("lot-4", 100, 25);

    await expect(
      productionService.allocateLot("po-4", { lot_id: "lot-4", allocated_kg: 40 }, "user-1"),
    ).rejects.toMatchObject({ code: "INSUFFICIENT_STOCK" });
  });

  it("refuses a lot whose stock is not released", async () => {
    store.production_orders = [{ id: "po-7", status: "DRAFT" }];
    releasedLot("lot-7", 100, 100);
    store.stock_lots[0].status = "BLOCKED";

    await expect(
      productionService.allocateLot("po-7", { lot_id: "lot-7", allocated_kg: 10 }, "user-1"),
    ).rejects.toMatchObject({ code: "LOT_NOT_LIBERE" });
  });

  it("returns only what was consumed when an in-progress order is cancelled", async () => {
    store.production_orders = [{ id: "po-5", status: "IN_PROGRESS", order_number: "OF-5" }];
    store.production_lot_allocations = [
      { id: "alloc-5", production_order_id: "po-5", lot_id: "lot-5", allocated_kg: 30, consumed_kg: 30, consumed_at: "2026-07-26T10:00:00.000Z" },
      { id: "alloc-5b", production_order_id: "po-5", lot_id: "lot-5b", allocated_kg: 20, consumed_kg: null, consumed_at: null },
    ];
    releasedLot("lot-5", 100, 70);
    store.reception_lots.push({ id: "lot-5b", quantity: 20, stock_status: "STOCK_LIBERE" });
    store.stock_lots.push({ id: "stock-lot-5b", reception_lot_id: "lot-5b", current_quantity: 20, status: "VALIDATED" });

    await productionService.cancelOrder("po-5", "erreur de planification", "user-1");

    expect(store.stock_lots[0]).toMatchObject({ current_quantity: 100, status: "VALIDATED" });
    expect(store.stock_lots[1]).toMatchObject({ current_quantity: 20 });
    expect(store.stock_movements).toEqual([
      expect.objectContaining({ movement_type: "RETOUR", lot_id: "stock-lot-5", quantity: 30 }),
    ]);
    expect(store.production_orders[0].status).toBe("cancelled");
  });
});
