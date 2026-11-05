import { beforeEach, describe, expect, it, vi } from "vitest";

import { createInMemoryModel, type TestRow } from "../../test/in-memory-collection.js";
import { applyInventoryAdjustment } from "./stock-adjustment.js";
import { applyQualityHold, releaseQualityHold } from "./stock-hold.js";
import { runStockIntegrityDiagnostics } from "./stock-diagnostics.js";
import { assertShipmentReadyToShip } from "./shipment-integrity.js";
import { PackagingService } from "../packaging/packaging.service.js";
import { Phase2Service } from "../phase2/phase2.service.js";
import { ProductionService } from "../production/production.service.js";
import { StockController } from "./stock.controller.js";

const store: Record<string, TestRow[]> = {};

vi.mock("../../db/dynamic-model.js", () => ({
  sanitizeDocument: <T>(value: T) => value,
  getCollectionModel: (collection: string) => createInMemoryModel(collection, store),
}));

vi.mock("../../db/defaults.js", () => ({
  prepareInsertDocument: vi.fn(async (collection: string, value: TestRow) => ({
    id: `${collection}-${(store[collection]?.length || 0) + 1}`,
    created_at: "2026-11-01T10:00:00.000Z",
    updated_at: "2026-11-01T10:00:00.000Z",
    ...value,
  })),
}));

vi.mock("../notifications/notification-emitter.js", () => ({
  emitNotification: vi.fn(async () => null),
}));

vi.mock("../../models/site-settings.model.js", () => ({
  SiteSettingsModel: {
    findOne: () => ({ lean: () => ({ exec: async () => null }) }),
  },
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

vi.mock("../costing/costing-rates.js", () => ({
  loadCostingRates: vi.fn(async () => ({
    labourRateTndPerHour: 0,
    energyTariffTndPerKwh: 0,
    overheadTndPerKg: 0,
    targetCostTndPerKg: 0,
  })),
}));

vi.mock("../phase2/traceability-dossier.js", () => ({
  buildLotTraceabilityDossier: vi.fn(async () => ({
    reception_lots: [{ id: "rl-1", lot_internal: "LOT-A" }],
    stock_lots: [],
    packaging_palettes: [],
    shipments: [],
  })),
}));

vi.mock("../phase2/genealogy-builder.js", () => ({
  buildGenealogyFromDossier: vi.fn(() => ({
    nodes: [
      { id: "rl-1", type: "reception_lot", label: "LOT-A", column: 0 },
      { id: "stock-child", type: "stock_lot", label: "LOT-A-E", column: 1 },
    ],
    edges: [{ from: "rl-1", to: "stock-child" }],
    stats: { stage_count: 2 },
  })),
}));

const update = vi.fn(async ({ filters, values }: any) => {
  const id = filters?.[0]?.value;
  const row = (store.shipment_preparations || []).find((item) => item.id === id);
  if (row && values) Object.assign(row, values);
  return { after: row ? [row] : [{ id, ...values }] };
});

describe("Gate 2 stock integrity journey", () => {
  const phase2 = new Phase2Service({ createFromTriageSafe: vi.fn(async () => null) } as any);
  const production = new ProductionService();
  const packaging = new PackagingService();
  const stock = new StockController({ update } as never);

  beforeEach(() => {
    Object.keys(store).forEach((key) => delete store[key]);
    update.mockClear();
    vi.stubEnv("TRUST_MASS_BALANCE_GATE", "enforce");
  });

  it("runs supplier→triage→packaging→pallet→expedition with CAS and idempotency", async () => {
    store.reception_lots = [{
      id: "rl-1",
      lot_internal: "LOT-A",
      reception_id: "rec-1",
      quantity: 100,
      stock_status: "STOCK_LIBERE",
      purchase_cost_tnd_per_kg: 5,
      purchase_cost_tnd: 500,
    }];
    store.stock_lots = [{
      id: "stock-mp",
      reception_lot_id: "rl-1",
      lot_number: "LOT-A",
      current_quantity: 100,
      initial_quantity: 100,
      status: "VALIDATED",
      unit: "kg",
      category: "MP",
    }];
    store.triage_sessions = [{
      id: "tri-1",
      status: "EN_COURS",
      parent_lot_number: "LOT-A",
      parent_reception_id: "rec-1",
      parent_weight_kg: 100,
      session_number: "TRI-A",
      weight_extra_kg: 70,
      weight_cat1_kg: 20,
      weight_cat2_kg: 5,
      weight_reject_kg: 5,
      total_sorted_kg: 100,
      created_by: "user-1",
      started_at: "2026-11-01T08:00:00.000Z",
    }];

    await phase2.closeTriageSession("tri-1");
    const replay = await phase2.closeTriageSession("tri-1");
    expect(replay.data).toMatchObject({ replayed: true });
    expect(store.stock_lots.find((row) => row.id === "stock-mp")).toMatchObject({
      current_quantity: 0,
      status: "CONSUMED",
    });
    const triageWip = store.stock_lots.find((row) => row.lot_number === "LOT-A-EX");
    expect(triageWip).toMatchObject({ status: "VALIDATED", current_quantity: 70, source_stage: "TRIAGE" });

    const pkg = await packaging.createOrder({
      client_request_id: "pkg-a-1",
      source_lot_number: "LOT-A-EX",
      source_weight_kg: 50,
      bom_net_weight_g: 500,
      grade: "EXTRA",
      created_by: "user-1",
    });
    await packaging.createOrder({
      client_request_id: "pkg-a-1",
      source_lot_number: "LOT-A-EX",
      source_weight_kg: 50,
      bom_net_weight_g: 500,
    });
    expect(store.packaging_orders).toHaveLength(1);
    expect(triageWip!.current_quantity).toBe(20);

    const palette = await packaging.createPalette({
      order_id: pkg.id,
      order_number: pkg.order_number,
      box_count: 100,
      gross_weight_per_box_g: 550,
    });
    // Force net weight to match consumed packaging input for this journey.
    const paletteRow = store.packaging_palettes![0];
    paletteRow.net_weight_kg = 50;

    await packaging.sealPalette(String(palette.id), {
      order_id: pkg.id,
      seal_number: "SEAL-A",
      sealed_by: "user-1",
    });
    const sealedAgain = await packaging.sealPalette(String(palette.id), {
      order_id: pkg.id,
      seal_number: "SEAL-A",
      sealed_by: "user-1",
    });
    expect(sealedAgain).toMatchObject({ replayed: true });
    const finished = store.stock_lots.filter((row) => row.source_stage === "PACKAGING");
    expect(finished).toHaveLength(1);
    expect(finished[0]).toMatchObject({ current_quantity: 50, status: "VALIDATED" });

    store.shipment_preparations = [{ id: "ship-a", status: "PREPARED" }];
    store.shipment_lines = [{
      id: "line-a",
      shipment_id: "ship-a",
      stock_lot_id: finished[0].id,
      quantity_kg: 50,
    }];

    await stock.expedition({ auth: { user: { id: "user-1" } } }, {
      shipmentId: "ship-a",
      pickedLines: [{ lot_id: finished[0].id, quantity: 50 }],
      status: "SHIPPED",
      requestId: "exp-a-1",
    });
    const expReplay = await stock.expedition({ auth: { user: { id: "user-1" } } }, {
      shipmentId: "ship-a",
      pickedLines: [{ lot_id: finished[0].id, quantity: 50 }],
      status: "SHIPPED",
      requestId: "exp-a-1",
    });
    expect(expReplay.replayed).toBe(true);
    expect(finished[0].current_quantity).toBe(0);
    expect(store.stock_movements?.filter((row) => row.movement_type === "EXPEDITION")).toHaveLength(1);
    expect(store.stock_movements?.[store.stock_movements.length - 1]).toMatchObject({
      shipment_id: "ship-a",
    });

    await assertShipmentReadyToShip("ship-a");
    const diagnostics = await runStockIntegrityDiagnostics();
    expect(diagnostics.readOnly).toBe(true);
    expect(diagnostics.findings.some((row) => row.code === "NEGATIVE_STOCK_QTY")).toBe(false);
  });

  it("applies inventory adjustment and quality hold through CAS", async () => {
    store.stock_lots = [{
      id: "stock-adj",
      lot_number: "ADJ-1",
      current_quantity: 40,
      status: "VALIDATED",
      unit: "kg",
    }, {
      id: "stock-child",
      lot_number: "LOT-A-E",
      reception_lot_id: "rl-1",
      current_quantity: 10,
      status: "VALIDATED",
      unit: "kg",
    }];

    const adj = await applyInventoryAdjustment({
      stockLotId: "stock-adj",
      countedQuantityKg: 38,
      reason: "Inventaire magasin",
      actorId: "user-1",
      requestId: "adj-1",
    });
    expect(adj.change).toMatchObject({ before: 40, after: 38 });
    const replay = await applyInventoryAdjustment({
      stockLotId: "stock-adj",
      countedQuantityKg: 38,
      reason: "Inventaire magasin",
      actorId: "user-1",
      requestId: "adj-1",
    });
    expect(replay.replayed).toBe(true);
    expect(store.stock_lots[0].current_quantity).toBe(38);

    const hold = await applyQualityHold({
      stockLotId: "stock-adj",
      reason: "Suspicion insectes",
      actorId: "qc-1",
      propagateGenealogy: true,
    });
    expect(hold.heldIds.length).toBeGreaterThan(0);
    expect(store.stock_lots.find((row) => row.id === "stock-adj")?.status).toBe("HOLD");

    await releaseQualityHold({
      stockLotId: "stock-adj",
      reason: "Contre-essai OK",
      actorId: "qc-1",
      propagateGenealogy: false,
    });
    expect(store.stock_lots.find((row) => row.id === "stock-adj")?.status).toBe("VALIDATED");
  });

  it("creates production output stock once on completion", async () => {
    store.reception_lots = [{
      id: "rl-prod",
      lot_internal: "LOT-P",
      stock_status: "STOCK_LIBERE",
      quantity: 80,
    }];
    store.stock_lots = [{
      id: "stock-p",
      reception_lot_id: "rl-prod",
      lot_number: "LOT-P",
      current_quantity: 80,
      status: "VALIDATED",
      unit: "kg",
    }];
    store.production_orders = [{
      id: "of-1",
      order_number: "OF-1",
      status: "planned",
    }];
    store.production_lot_allocations = [{
      id: "alloc-1",
      production_order_id: "of-1",
      lot_id: "rl-prod",
      allocated_kg: 50,
    }];
    store.production_steps = [{
      id: "step-1",
      production_order_id: "of-1",
      is_mandatory: true,
      status: "completed",
      waste_quantity: 2,
    }];

    await production.startOrder("of-1", "user-1");
    await production.completeOrder("of-1", { actual_output_kg: 48, waste_kg: 2 }, "user-1");
    await production.completeOrder("of-1", { actual_output_kg: 48, waste_kg: 2 }, "user-1");

    const outputs = store.stock_lots.filter((row) => row.source_stage === "PRODUCTION");
    expect(outputs).toHaveLength(1);
    expect(outputs[0]).toMatchObject({
      current_quantity: 48,
      status: "VALIDATED",
      production_order_id: "of-1",
    });
    expect(store.stock_lots.find((row) => row.id === "stock-p")?.current_quantity).toBe(30);
  });
});
