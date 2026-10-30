import { beforeEach, describe, expect, it, vi } from "vitest";

import { prepareInsertDocument } from "../../db/defaults.js";
import { createInMemoryModel, type TestRow } from "../../test/in-memory-collection.js";
import { buildLotEventRecord, verifyLotEventChain, type LotEventRecord } from "../trust/lot-ledger.js";
import { PackagingService } from "./packaging.service.js";

const store: Record<string, TestRow[]> = {};
const packagingService = new PackagingService();

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

// sealPalette dynamically imports the real SiteSettingsModel (GS1 prefix lookup);
// without a DB its query never resolves and the test times out. Stub it.
vi.mock("../../models/site-settings.model.js", () => ({
  SiteSettingsModel: {
    findOne: () => ({ lean: () => ({ exec: async () => null }) }),
  },
}));

const seedPremiumChainThroughTriage = (lotId: string) => {
  const intake = buildLotEventRecord(
    { lotId, eventType: "LOT_CREATED", collection: "reception_lots", action: "GATE", prevHash: null },
    1,
  );
  const qc = buildLotEventRecord(
    { lotId, eventType: "QC_DECIDED", collection: "qc_inspections", action: "GATE", prevHash: intake.hash },
    2,
  );
  const ccp = buildLotEventRecord(
    { lotId, eventType: "CCP_COMPLETED", collection: "fumigation_cycles", action: "GATE", prevHash: qc.hash },
    3,
  );
  const triage = buildLotEventRecord(
    { lotId, eventType: "TRANSFORMED", collection: "triage_sessions", action: "GATE", prevHash: ccp.hash },
    4,
  );
  return [intake, qc, ccp, triage];
};

describe("packagingService.sealPalette ledger", () => {
  beforeEach(() => {
    Object.keys(store).forEach((key) => delete store[key]);
  });

  it("appends PACKED when sealing a palette linked to a golden-thread lot", async () => {
    const lotId = "reception-lot-pack";
    store.lot_events = seedPremiumChainThroughTriage(lotId) as unknown as TestRow[];
    store.reception_lots = [{ id: lotId, lot_internal: "LOT-PACK", reception_id: "rec-1" }];
    store.packaging_orders = [
      {
        id: "order-1",
        source_lot_number: "LOT-PACK",
        status: "EN_COURS",
      },
    ];
    store.packaging_palettes = [
      {
        id: "palette-1",
        order_id: "order-1",
        palette_number: "PAL-1",
        status: "OUVERTE",
      },
    ];

    await packagingService.sealPalette("palette-1", {
      order_id: "order-1",
      sealed_by: "user-1",
      seal_number: "SEAL-1",
      serial_counter: 42,
    });

    const events = (store.lot_events || []) as unknown as LotEventRecord[];
    expect(events.map((event) => event.event_type)).toContain("PACKAGED");
    const packed = events.find((event) => event.event_type === "PACKAGED");
    expect(packed?.payload).toMatchObject({ stage: "PACKED" });
    expect(verifyLotEventChain(events).valid).toBe(true);
    expect(store.packaging_palettes?.[0]).toMatchObject({
      sscc: null,
      sscc_status: "NON_PRODUCTION_PLACEHOLDER",
    });
  });
});

describe("packagingService.createOrder triage consumption", () => {
  beforeEach(() => {
    Object.keys(store).forEach((key) => delete store[key]);
  });

  it("does not create an order when the triage lot cannot cover the requested weight", async () => {
    store.stock_lots = [{
      id: "stock-1",
      lot_number: "LOT-TRI",
      source_stage: "TRIAGE",
      current_quantity: 10,
      status: "RELEASED",
      unit: "kg",
    }];

    await expect(packagingService.createOrder({
      source_lot_number: "LOT-TRI",
      source_weight_kg: 25,
      bom_net_weight_g: 500,
    })).rejects.toMatchObject({ code: "INSUFFICIENT_STOCK" });

    expect(store.packaging_orders || []).toHaveLength(0);
    expect(store.stock_lots?.[0]?.current_quantity).toBe(10);
    expect(store.stock_movements || []).toHaveLength(0);
  });

  it("writes the order and the consumption movement for a covered weight", async () => {
    store.stock_lots = [{
      id: "stock-1",
      lot_number: "LOT-TRI",
      source_stage: "TRIAGE",
      current_quantity: 40,
      status: "RELEASED",
      unit: "kg",
    }];

    const order = await packagingService.createOrder({
      source_lot_number: "LOT-TRI",
      source_weight_kg: 12.5,
      bom_net_weight_g: 500,
    }) as TestRow;

    expect(String(order.order_number)).toMatch(/^PKG-/);
    expect(store.packaging_orders).toHaveLength(1);
    expect(store.stock_lots?.[0]?.current_quantity).toBe(27.5);
    expect(store.stock_lots?.[0]?.status).toBe("RELEASED");
    expect(store.stock_movements).toHaveLength(1);
    expect(store.stock_movements?.[0]).toMatchObject({
      movement_type: "CONSOMMATION",
      quantity: 12.5,
      lot_id: "stock-1",
    });
    expect(store.system_audit_logs).toHaveLength(1);
    expect(store.system_audit_logs?.[0]).toMatchObject({ action: "PACKAGING_CONSUMPTION" });
  });

  it("does not create an order when the triage lot is missing, quarantined, or the movement write fails", async () => {
    await expect(packagingService.createOrder({
      source_lot_number: "MISSING",
      source_weight_kg: 5,
      bom_net_weight_g: 500,
    })).rejects.toMatchObject({ code: "TRIAGE_STOCK_NOT_FOUND" });
    expect(store.packaging_orders || []).toHaveLength(0);

    store.stock_lots = [{
      id: "stock-q",
      lot_number: "LOT-Q",
      source_stage: "TRIAGE",
      current_quantity: 20,
      status: "QUARANTINE",
      unit: "kg",
    }];
    await expect(packagingService.createOrder({
      source_lot_number: "LOT-Q",
      source_weight_kg: 5,
      bom_net_weight_g: 500,
    })).rejects.toMatchObject({ code: "LOT_NOT_CONSUMABLE" });
    expect(store.stock_lots[0].current_quantity).toBe(20);
    expect(store.packaging_orders || []).toHaveLength(0);

    store.stock_lots = [{
      id: "stock-1",
      lot_number: "LOT-TRI",
      source_stage: "TRIAGE",
      current_quantity: 40,
      status: "RELEASED",
      unit: "kg",
    }];
    const original = vi.mocked(prepareInsertDocument).getMockImplementation();
    vi.mocked(prepareInsertDocument).mockImplementation(async (collection: string, value: TestRow) => {
      if (collection === "stock_movements") throw new Error("movement write failed");
      return original?.(collection, value);
    });
    try {
      await expect(packagingService.createOrder({
        source_lot_number: "LOT-TRI",
        source_weight_kg: 10,
        bom_net_weight_g: 500,
      })).rejects.toThrow(/movement write failed/);
    } finally {
      vi.mocked(prepareInsertDocument).mockImplementation(original!);
    }
    expect(store.packaging_orders || []).toHaveLength(0);
    expect(store.stock_lots[0].current_quantity).toBe(40);
    expect(store.stock_movements || []).toHaveLength(0);
  });

  it("replays the same client request as one order and one consumption", async () => {
    store.stock_lots = [{
      id: "stock-1",
      lot_number: "LOT-TRI",
      source_stage: "TRIAGE",
      current_quantity: 40,
      status: "RELEASED",
      unit: "kg",
    }];
    const first = await packagingService.createOrder({
      client_request_id: "pkg-req-1",
      source_lot_number: "LOT-TRI",
      source_weight_kg: 8,
      bom_net_weight_g: 500,
    }) as TestRow;
    const second = await packagingService.createOrder({
      client_request_id: "pkg-req-1",
      source_lot_number: "LOT-TRI",
      source_weight_kg: 8,
      bom_net_weight_g: 500,
    }) as TestRow;

    expect(second.id).toBe(first.id);
    expect(store.packaging_orders).toHaveLength(1);
    expect(store.stock_movements).toHaveLength(1);
    expect(store.stock_lots[0].current_quantity).toBe(32);
  });
});
