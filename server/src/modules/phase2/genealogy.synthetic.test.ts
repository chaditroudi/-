import { beforeEach, describe, expect, it, vi } from "vitest";

import { prepareInsertDocument } from "../../db/defaults.js";
import { createInMemoryModel, type TestRow } from "../../test/in-memory-collection.js";
import { PackagingService } from "../packaging/packaging.service.js";
import { ProductionService } from "../production/production.service.js";
import { StockController } from "../stock/stock.controller.js";
import { buildGenealogyFromDossier } from "./genealogy-builder.js";
import { buildLotTraceabilityDossier } from "./traceability-dossier.js";

const LOT_A_KG = 100;
const LOT_B_KG = 80;
const CONSUMED_A_KG = 60;
const CONSUMED_B_KG = 40;
const OUTPUT_KG = 95;
const WASTE_KG = 5;
const OUTPUT_LOT = "PF-GEN-001";
const SHIPMENT_ID = "ship-gen";
const SHIPMENT_NUMBER = "SHP-GEN-001";

const store: Record<string, TestRow[]> = {};
const productionService = new ProductionService();
const packagingService = new PackagingService();

vi.mock("../../db/dynamic-model.js", () => ({
  sanitizeDocument: <T>(value: T) => value,
  getCollectionModel: (collection: string) => createInMemoryModel(collection, store),
}));

vi.mock("../../db/defaults.js", () => ({
  prepareInsertDocument: vi.fn(async (collection: string, value: TestRow) => ({
    id: `${collection}-id-${(store[collection]?.length || 0) + 1}`,
    created_at: "2026-09-27T10:00:00.000Z",
    updated_at: "2026-09-27T10:00:00.000Z",
    ...value,
  })),
}));

vi.mock("../notifications/notification-emitter.js", () => ({
  emitNotification: vi.fn(async () => null),
}));

vi.mock("../purchasing/stock-reorder.service.js", () => ({
  autoReorderOnStockChange: vi.fn(async () => null),
}));

vi.mock("../trust/scan.service.js", () => ({
  scanService: { consumeMoveProof: vi.fn(async () => ({ verified: false, mode: "warn" })) },
}));

vi.mock("../realtime/realtime.bus.js", () => ({
  publishRealtimeDbChange: vi.fn(),
}));

vi.mock("../../models/site-settings.model.js", () => ({
  SiteSettingsModel: {
    findOne: () => ({ lean: () => ({ exec: async () => null }) }),
  },
}));

const updateShipment = vi.fn(async ({ table, filters, values }: {
  table: string;
  filters: Array<{ value: string }>;
  values: TestRow;
}) => {
  const id = filters?.[0]?.value;
  const row = (store[table] || []).find((item) => item.id === id);
  if (row && values) Object.assign(row, values);
  return { after: row ? [row] : [] };
});

const stockController = new StockController({ update: updateShipment } as never);
const req = { auth: { user: { id: "user-1" } } };

const lot = (id: string) => store.reception_lots?.find((row) => row.id === id);

const reachable = (
  edges: Array<{ from: string; to: string }>,
  start: string,
  reverse = false,
) => {
  const next = new Map<string, string[]>();
  for (const edge of edges) {
    const from = reverse ? edge.to : edge.from;
    const to = reverse ? edge.from : edge.to;
    const list = next.get(from) ?? [];
    list.push(to);
    next.set(from, list);
  }
  const seen = new Set<string>();
  const stack = [start];
  while (stack.length > 0) {
    const id = stack.pop();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    for (const child of next.get(id) ?? []) stack.push(child);
  }
  return seen;
};

const trace = async (query: string) => {
  const dossier = await buildLotTraceabilityDossier(query);
  return { dossier, tree: buildGenealogyFromDossier(dossier as unknown as Record<string, unknown>) };
};

const assertNoNegative = () => {
  for (const row of [...(store.reception_lots || []), ...(store.stock_lots || [])]) {
    const quantity = Number(row.quantity ?? row.current_quantity ?? 0);
    expect(quantity).toBeGreaterThanOrEqual(0);
  }
};

const seedSourceLots = () => {
  store.reception_lots = [
    { id: "lot-a", lot_internal: "LOT-A", quantity: LOT_A_KG, stock_status: "STOCK_LIBERE", unit: "kg" },
    { id: "lot-b", lot_internal: "LOT-B", quantity: LOT_B_KG, stock_status: "STOCK_LIBERE", unit: "kg" },
  ];
};

const recordOutputLot = (orderId: string) => {
  const allocations = store.production_lot_allocations || [];
  store.production_output_lots = [{
    id: "out-1",
    production_order_id: orderId,
    lot_pf_number: OUTPUT_LOT,
    quantity: OUTPUT_KG,
    unit: "kg",
    recorded_at: "2026-09-27T10:00:00.000Z",
    parent_lot_ids: allocations.map((row) => row.lot_id),
    parent_lots_snapshot: allocations.map((row) => ({
      reception_lot_id: row.lot_id,
      lot_internal: row.lot_id === "lot-a" ? "LOT-A" : "LOT-B",
      lot_supplier: "",
      reception_number: null,
      allocated_quantity: row.allocated_kg,
      unit: "kg",
    })),
  }];
};

describe("synthetic lot genealogy", () => {
  beforeEach(() => {
    Object.keys(store).forEach((key) => delete store[key]);
    updateShipment.mockReset();
    updateShipment.mockImplementation(async ({ table, filters, values }) => {
      const id = filters?.[0]?.value;
      const row = (store[table] || []).find((item) => item.id === id);
      if (row && values) Object.assign(row, values);
      return { after: row ? [row] : [] };
    });
    vi.stubEnv("TRUST_MASS_BALANCE_GATE", "enforce");
  });

  it("traces lot A and lot B through one output, one pallet, and one shipment", async () => {
    expect(CONSUMED_A_KG + CONSUMED_B_KG).toBe(OUTPUT_KG + WASTE_KG);
    seedSourceLots();

    const order = await productionService.createOrder({
      order_number: "OF-GEN",
      production_type: "STANDARD",
      target_output_kg: OUTPUT_KG,
    }, "user-1");
    const orderId = String(order.id);
    await productionService.allocateLot(orderId, { lot_id: "lot-a", allocated_kg: CONSUMED_A_KG }, "user-1");
    await productionService.allocateLot(orderId, { lot_id: "lot-b", allocated_kg: CONSUMED_B_KG }, "user-1");
    store.production_orders![0].status = "PLANNED";

    await productionService.startOrder(orderId, "user-1");
    await expect(productionService.startOrder(orderId, "user-1")).rejects.toMatchObject({
      code: "INVALID_TRANSITION",
    });
    expect(lot("lot-a")).toMatchObject({ quantity: LOT_A_KG - CONSUMED_A_KG });
    expect(lot("lot-b")).toMatchObject({ quantity: LOT_B_KG - CONSUMED_B_KG });
    expect(store.production_lot_allocations).toEqual(expect.arrayContaining([
      expect.objectContaining({ lot_id: "lot-a", consumed_kg: CONSUMED_A_KG }),
      expect.objectContaining({ lot_id: "lot-b", consumed_kg: CONSUMED_B_KG }),
    ]));

    store.production_steps = [{
      id: "step-1",
      production_order_id: orderId,
      is_mandatory: true,
      status: "COMPLETED",
      name: "Transformation",
    }];
    const completed = await productionService.completeOrder(
      orderId,
      { actual_output_kg: OUTPUT_KG, waste_kg: WASTE_KG },
      "user-1",
    );
    expect(completed).toMatchObject({
      actual_output_kg: OUTPUT_KG,
      waste_kg: WASTE_KG,
      mass_balance_variance_pct: 0,
    });
    const balanceEvents = (store.lot_events || []).filter((row) => row.event_type === "MASS_BALANCE_CHECKED");
    expect(balanceEvents.map((row) => row.lot_id).sort()).toEqual(["lot-a", "lot-b"]);
    expect(balanceEvents[0]?.payload).toMatchObject({ input_kg: CONSUMED_A_KG + CONSUMED_B_KG, output_kg: OUTPUT_KG, waste_kg: WASTE_KG });

    recordOutputLot(orderId);
    store.stock_lots = [{
      id: "stock-output",
      lot_number: OUTPUT_LOT,
      source_stage: "TRIAGE",
      source_lot_internal: OUTPUT_LOT,
      status: "RELEASED",
      current_quantity: OUTPUT_KG,
      unit: "kg",
    }];

    const packagingOrder = await packagingService.createOrder({
      client_request_id: "pkg-gen-1",
      source_lot_number: OUTPUT_LOT,
      source_weight_kg: OUTPUT_KG,
      bom_net_weight_g: 500,
      grade: "A",
      created_by: "user-1",
    });
    const replayedOrder = await packagingService.createOrder({
      client_request_id: "pkg-gen-1",
      source_lot_number: OUTPUT_LOT,
      source_weight_kg: OUTPUT_KG,
      bom_net_weight_g: 500,
    });
    expect(replayedOrder.id).toBe(packagingOrder.id);
    expect(store.packaging_orders).toHaveLength(1);
    expect(store.stock_lots?.find((row) => row.id === "stock-output")).toMatchObject({
      current_quantity: 0,
      status: "CONSUMED",
    });
    expect(store.stock_movements?.filter((row) => row.movement_type === "CONSOMMATION")).toHaveLength(1);

    const palette = await packagingService.createPalette({
      order_id: packagingOrder.id,
      order_number: packagingOrder.order_number,
      box_count: 100,
      gross_weight_per_box_g: 1000,
    });
    expect(palette.net_weight_kg).toBe(OUTPUT_KG);
    await packagingService.sealPalette(String(palette.id), {
      order_id: packagingOrder.id,
      palette_number: palette.palette_number,
      seal_number: "SEAL-GEN",
      sealed_by: "user-1",
    });
    const finished = store.stock_lots?.find((row) => row.source_stage === "PACKAGING");
    expect(finished).toMatchObject({
      source_lot_internal: OUTPUT_LOT,
      current_quantity: OUTPUT_KG,
      status: "VALIDATED",
    });

    store.shipment_preparations = [{
      id: SHIPMENT_ID,
      shipment_number: SHIPMENT_NUMBER,
      status: "PREPARED",
      customer_name: "Buyer",
    }];
    const shipped = await stockController.expedition(req, {
      shipmentId: SHIPMENT_ID,
      pickedLines: [{ lot_id: finished!.id, quantity: OUTPUT_KG }],
      status: "SHIPPED",
      requestId: "exp-gen-1",
    });
    const replayedShipment = await stockController.expedition(req, {
      shipmentId: SHIPMENT_ID,
      pickedLines: [{ lot_id: finished!.id, quantity: OUTPUT_KG }],
      status: "SHIPPED",
      requestId: "exp-gen-1",
    });
    expect(shipped.replayed).toBe(false);
    expect(replayedShipment.replayed).toBe(true);
    expect(finished!.current_quantity).toBe(0);
    expect(store.stock_movements?.filter((row) => row.movement_type === "EXPEDITION")).toHaveLength(1);
    expect(store.shipment_preparations?.[0]?.status).toBe("SHIPPED");
    assertNoNegative();

    const forward = await trace("LOT-A");
    const output = (forward.dossier.output_lots as TestRow[])[0];
    expect(output.parent_lot_ids).toEqual(expect.arrayContaining(["lot-a", "lot-b"]));
    expect((output.parent_lots_snapshot as TestRow[]).map((row) => row.lot_internal).sort()).toEqual(["LOT-A", "LOT-B"]);
    const tree = forward.tree;
    const outputNode = tree.nodes.find((node) => node.type === "output_lot");
    const paletteNode = tree.nodes.find((node) => node.type === "palette");
    const shipmentNode = tree.nodes.find((node) => node.type === "shipment");
    expect(outputNode?.label).toBe(OUTPUT_LOT);
    expect(paletteNode?.id).toBe(palette.id);
    expect(shipmentNode?.id).toBe(SHIPMENT_ID);
    const fromA = reachable(tree.edges, "lot-a");
    const fromB = reachable(tree.edges, "lot-b");
    for (const target of [outputNode!.id, paletteNode!.id, shipmentNode!.id]) {
      expect(fromA.has(target)).toBe(true);
      expect(fromB.has(target)).toBe(true);
    }

    const reverse = await trace(SHIPMENT_NUMBER);
    const back = reachable(reverse.tree.edges, SHIPMENT_ID, true);
    expect(back.has(paletteNode!.id)).toBe(true);
    expect(back.has(outputNode!.id)).toBe(true);
    expect(back.has("lot-a")).toBe(true);
    expect(back.has("lot-b")).toBe(true);
    expect(reverse.tree.nodes.filter((node) => node.type === "reception_lot").map((node) => node.label).sort())
      .toEqual(["LOT-A", "LOT-B"]);
  });

  it("restores source lots when completion is rejected and the order is cancelled", async () => {
    seedSourceLots();
    const order = await productionService.createOrder({
      order_number: "OF-FAIL",
      production_type: "STANDARD",
    }, "user-1");
    const orderId = String(order.id);
    await productionService.allocateLot(orderId, { lot_id: "lot-a", allocated_kg: CONSUMED_A_KG }, "user-1");
    await productionService.allocateLot(orderId, { lot_id: "lot-b", allocated_kg: CONSUMED_B_KG }, "user-1");
    store.production_orders![0].status = "PLANNED";
    await productionService.startOrder(orderId, "user-1");
    store.production_steps = [{
      id: "step-fail",
      production_order_id: orderId,
      is_mandatory: true,
      status: "COMPLETED",
    }];

    await expect(productionService.completeOrder(
      orderId,
      { actual_output_kg: 50, waste_kg: 0 },
      "user-1",
    )).rejects.toMatchObject({ code: "MASS_BALANCE_UNBALANCED" });
    expect(store.production_output_lots || []).toHaveLength(0);
    expect(lot("lot-a")?.quantity).toBe(LOT_A_KG - CONSUMED_A_KG);
    expect(lot("lot-b")?.quantity).toBe(LOT_B_KG - CONSUMED_B_KG);

    await productionService.cancelOrder(orderId, "completion rejected", "user-1");
    expect(lot("lot-a")).toMatchObject({ quantity: LOT_A_KG, stock_status: "STOCK_LIBERE" });
    expect(lot("lot-b")).toMatchObject({ quantity: LOT_B_KG, stock_status: "STOCK_LIBERE" });
    const { tree } = await trace("LOT-A");
    expect(tree.nodes.some((node) => node.type === "output_lot")).toBe(false);
    assertNoNegative();
  });

  it("does not record a pallet when palette insert fails", async () => {
    store.production_output_lots = [{
      id: "out-1",
      lot_pf_number: OUTPUT_LOT,
      quantity: OUTPUT_KG,
      parent_lot_ids: ["lot-a", "lot-b"],
      parent_lots_snapshot: [
        { reception_lot_id: "lot-a", lot_internal: "LOT-A", allocated_quantity: CONSUMED_A_KG, unit: "kg" },
        { reception_lot_id: "lot-b", lot_internal: "LOT-B", allocated_quantity: CONSUMED_B_KG, unit: "kg" },
      ],
    }];
    store.reception_lots = [
      { id: "lot-a", lot_internal: "LOT-A", quantity: LOT_A_KG - CONSUMED_A_KG, stock_status: "EN_PRODUCTION", unit: "kg" },
      { id: "lot-b", lot_internal: "LOT-B", quantity: LOT_B_KG - CONSUMED_B_KG, stock_status: "EN_PRODUCTION", unit: "kg" },
    ];
    store.stock_lots = [{
      id: "stock-output",
      lot_number: OUTPUT_LOT,
      source_stage: "TRIAGE",
      status: "RELEASED",
      current_quantity: OUTPUT_KG,
      unit: "kg",
    }];
    const packagingOrder = await packagingService.createOrder({
      source_lot_number: OUTPUT_LOT,
      source_weight_kg: OUTPUT_KG,
      bom_net_weight_g: 500,
    });
    const original = vi.mocked(prepareInsertDocument).getMockImplementation();
    vi.mocked(prepareInsertDocument).mockImplementation(async (collection, value) => {
      if (collection === "packaging_palettes") throw new Error("palette insert failed");
      return original!(collection, value);
    });
    try {
      await expect(packagingService.createPalette({
        order_id: packagingOrder.id,
        box_count: 100,
        gross_weight_per_box_g: 1000,
      })).rejects.toThrow(/palette insert failed/);
    } finally {
      vi.mocked(prepareInsertDocument).mockImplementation(original!);
    }

    expect(store.packaging_palettes || []).toHaveLength(0);
    expect(store.production_output_lots?.[0]).toMatchObject({ quantity: OUTPUT_KG, lot_pf_number: OUTPUT_LOT });
    const { tree } = await trace(OUTPUT_LOT);
    expect(tree.nodes.some((node) => node.type === "palette")).toBe(false);
    expect(tree.nodes.filter((node) => node.type === "reception_lot").map((node) => node.id).sort())
      .toEqual(["lot-a", "lot-b"]);
    assertNoNegative();
  });

  it("drops the shipment link when expedition persistence fails", async () => {
    store.reception_lots = [
      { id: "lot-a", lot_internal: "LOT-A", quantity: LOT_A_KG - CONSUMED_A_KG, unit: "kg" },
      { id: "lot-b", lot_internal: "LOT-B", quantity: LOT_B_KG - CONSUMED_B_KG, unit: "kg" },
    ];
    store.production_output_lots = [{
      id: "out-1",
      lot_pf_number: OUTPUT_LOT,
      quantity: OUTPUT_KG,
      parent_lot_ids: ["lot-a", "lot-b"],
      parent_lots_snapshot: [
        { reception_lot_id: "lot-a", lot_internal: "LOT-A" },
        { reception_lot_id: "lot-b", lot_internal: "LOT-B" },
      ],
    }];
    store.packaging_orders = [{ id: "pkg-1", order_number: "PKG-1", source_lot_number: OUTPUT_LOT, status: "PLANIFIE" }];
    store.packaging_palettes = [{ id: "pal-1", order_id: "pkg-1", palette_number: "PAL-1", status: "SCELLE", net_weight_kg: OUTPUT_KG }];
    store.stock_lots = [{
      id: "stock-fg",
      lot_number: "PAL-1",
      source_stage: "PACKAGING",
      source_lot_internal: OUTPUT_LOT,
      status: "VALIDATED",
      current_quantity: OUTPUT_KG,
      unit: "kg",
    }];
    store.shipment_preparations = [{ id: SHIPMENT_ID, shipment_number: SHIPMENT_NUMBER, status: "PREPARED" }];
    updateShipment.mockRejectedValueOnce(new Error("shipment write failed"));

    await expect(stockController.expedition(req, {
      shipmentId: SHIPMENT_ID,
      pickedLines: [{ lot_id: "stock-fg", quantity: OUTPUT_KG }],
      status: "SHIPPED",
      requestId: "exp-fail",
    })).rejects.toThrow(/shipment write failed/);

    expect(store.stock_lots?.[0]).toMatchObject({ current_quantity: OUTPUT_KG, status: "VALIDATED" });
    expect(store.stock_movements || []).toHaveLength(0);
    expect(store.shipment_preparations?.[0]?.status).toBe("PREPARED");
    const { tree } = await trace(OUTPUT_LOT);
    expect(tree.nodes.some((node) => node.type === "palette")).toBe(true);
    expect(tree.nodes.some((node) => node.type === "output_lot")).toBe(true);
    expect(tree.nodes.some((node) => node.type === "shipment")).toBe(false);
    expect(reachable(tree.edges, "out-1", true).has("lot-a")).toBe(true);
    expect(reachable(tree.edges, "out-1", true).has("lot-b")).toBe(true);
    assertNoNegative();
  });
});
