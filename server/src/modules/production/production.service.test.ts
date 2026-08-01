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
      status: "COMPLETED",
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

  it("decrements lot quantity by allocated_kg on start", async () => {
    store.production_orders = [{ id: "po-3", status: "PLANNED", order_number: "OF-3" }];
    store.production_lot_allocations = [
      { id: "alloc-3", production_order_id: "po-3", lot_id: "lot-3", allocated_kg: 40 },
    ];
    store.reception_lots = [
      { id: "lot-3", lot_internal: "L-3", quantity: 100, stock_status: "STOCK_LIBERE" },
    ];

    await productionService.startOrder("po-3", "user-1");

    expect(store.reception_lots[0]).toMatchObject({
      quantity: 60,
      stock_status: "EN_PRODUCTION",
    });
    expect(store.production_lot_allocations[0]).toMatchObject({
      consumed_kg: 40,
    });
    expect(store.production_orders[0].status).toBe("IN_PROGRESS");
  });

  it("rejects allocation above available stock", async () => {
    store.production_orders = [{ id: "po-4", status: "DRAFT" }];
    store.reception_lots = [
      { id: "lot-4", quantity: 25, stock_status: "STOCK_LIBERE" },
    ];

    await expect(
      productionService.allocateLot("po-4", { lot_id: "lot-4", allocated_kg: 40 }, "user-1"),
    ).rejects.toMatchObject({ code: "INSUFFICIENT_STOCK" });
  });

  it("restores quantity on cancel of in-progress order", async () => {
    store.production_orders = [{ id: "po-5", status: "IN_PROGRESS" }];
    store.production_lot_allocations = [
      {
        id: "alloc-5",
        production_order_id: "po-5",
        lot_id: "lot-5",
        allocated_kg: 30,
        consumed_kg: 30,
      },
    ];
    store.reception_lots = [
      { id: "lot-5", quantity: 70, stock_status: "EN_PRODUCTION" },
    ];

    await productionService.cancelOrder("po-5", "test cancel", "user-1");

    expect(store.reception_lots[0]).toMatchObject({
      quantity: 100,
      stock_status: "STOCK_LIBERE",
    });
    expect(store.production_orders[0].status).toBe("CANCELLED");
  });
});
