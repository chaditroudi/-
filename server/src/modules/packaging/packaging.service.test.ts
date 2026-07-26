import { beforeEach, describe, expect, it, vi } from "vitest";

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
  });
});
