import { beforeEach, describe, expect, it, vi } from "vitest";

import { createInMemoryModel, type TestRow } from "../../test/in-memory-collection.js";
import { buildLotEventRecord, type LotEventRecord } from "./lot-ledger.js";
import { gateRulesService } from "./gate-rules.service.js";

const store: Record<string, TestRow[]> = {};

vi.mock("../../db/dynamic-model.js", () => ({
  sanitizeDocument: <T>(value: T) => value,
  getCollectionModel: (collection: string) => createInMemoryModel(collection, store),
}));

vi.mock("../../db/defaults.js", () => ({
  prepareInsertDocument: vi.fn(async (_collection: string, value: TestRow) => ({
    id: `lot_events-id-${(store.lot_events?.length || 0) + 1}`,
    created_at: "2026-07-26T12:00:00.000Z",
    updated_at: "2026-07-26T12:00:00.000Z",
    ...value,
  })),
}));

const seedCompleteChain = (lotId: string) => {
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
  const packed = buildLotEventRecord(
    { lotId, eventType: "PACKAGED", collection: "packaging_palettes", action: "GATE", prevHash: ccp.hash },
    4,
  );
  store.lot_events = [intake, qc, ccp, packed] as unknown as TestRow[];
};

describe("gateRulesService.assertShipmentWritable", () => {
  beforeEach(() => {
    Object.keys(store).forEach((key) => delete store[key]);
  });

  it("allows non-closing statuses without reading the ledger", async () => {
    await expect(
      gateRulesService.assertShipmentWritable(null, { status: "DRAFT", lot_ids: ["lot-1"] }),
    ).resolves.toBeUndefined();
    expect(store.lot_events || []).toHaveLength(0);
  });

  it("blocks closure when the ledger dossier is incomplete and appends GATE_BLOCKED", async () => {
    const intake = buildLotEventRecord(
      { lotId: "lot-1", eventType: "LOT_CREATED", collection: "reception_lots", action: "GATE", prevHash: null },
      1,
    );
    store.lot_events = [intake as unknown as TestRow];

    await expect(
      gateRulesService.assertShipmentWritable(
        null,
        { status: "CLOSED", lot_ids: ["lot-1"] },
        { collection: "shipment_preparations" },
      ),
    ).rejects.toMatchObject({ code: "SHIPMENT_DOSSIER_INCOMPLETE" });

    const events = (store.lot_events || []) as unknown as LotEventRecord[];
    expect(events.some((event) => event.event_type === "GATE_BLOCKED")).toBe(true);
  });

  it("allows closure when the ledger proves genealogy, QC, CCP and packaging", async () => {
    seedCompleteChain("lot-1");

    await expect(
      gateRulesService.assertShipmentWritable(
        null,
        { statut: "EXPEDIE", lignes: [{ reception_lot_id: "lot-1" }] },
        { collection: "bon_expeditions" },
      ),
    ).resolves.toBeUndefined();
  });

  it("ignores client dossier booleans and still blocks on an incomplete chain", async () => {
    store.lot_events = [];

    await expect(
      gateRulesService.assertShipmentWritable(null, {
        status: "SHIPPED",
        lot_ids: ["lot-missing"],
        qc_complete: true,
        ccp_complete: true,
        packaging_complete: true,
        dossier_genealogy_ok: true,
      }),
    ).rejects.toMatchObject({ code: "SHIPMENT_DOSSIER_INCOMPLETE" });
  });
});
