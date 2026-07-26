import { describe, expect, it } from "vitest";

import {
  buildLotEventRecord,
  computeLotEventHash,
  inferLotIdsFromRow,
  lotLedgerGenesisHash,
  verifyLotEventChain,
} from "./lot-ledger.js";

describe("W0 lot event ledger", () => {
  it("chains hashes from genesis and verifies an intact chain", () => {
    const first = buildLotEventRecord(
      {
        lotId: "LOT-1",
        eventType: "LOT_CREATED",
        collection: "reception_lots",
        action: "INSERT",
        actorId: "user-1",
        payload: { quantity: 100 },
        prevHash: null,
        at: "2026-07-26T10:00:00.000Z",
      },
      1,
    );

    expect(first.prev_hash).toBe(lotLedgerGenesisHash());
    expect(first.hash).toHaveLength(64);

    const second = buildLotEventRecord(
      {
        lotId: "LOT-1",
        eventType: "QC_DECIDED",
        collection: "qc_inspections",
        action: "INSERT",
        actorId: "qc-1",
        payload: { decision: "ACCEPTE" },
        prevHash: first.hash,
        at: "2026-07-26T11:00:00.000Z",
      },
      2,
    );

    expect(second.prev_hash).toBe(first.hash);
    expect(verifyLotEventChain([first, second])).toEqual({
      valid: true,
      brokenAt: null,
      expectedHash: null,
    });
  });

  it("detects tampering when a payload is altered after the fact", () => {
    const event = buildLotEventRecord(
      {
        lotId: "LOT-2",
        eventType: "STOCK_MOVED",
        collection: "stock_movements",
        action: "INSERT",
        actorId: null,
        payload: { quantity: 10 },
        prevHash: null,
        at: "2026-07-26T12:00:00.000Z",
      },
      1,
    );

    const tampered = { ...event, payload: { quantity: 999 } };
    const result = verifyLotEventChain([tampered]);
    expect(result.valid).toBe(false);
    expect(result.brokenAt).toBe(0);
    expect(result.expectedHash).toBe(
      computeLotEventHash({
        lotId: tampered.lot_id,
        eventType: tampered.event_type,
        collection: tampered.collection,
        action: tampered.action,
        actorId: tampered.actor_id,
        payload: tampered.payload,
        relatedIds: tampered.related_ids,
        prevHash: tampered.prev_hash,
        sequence: tampered.sequence,
        at: tampered.at,
      }),
    );
  });

  it("infers lot ids from regulated row shapes", () => {
    expect(inferLotIdsFromRow("reception_lots", { id: "R1" })).toEqual(["R1"]);
    expect(
      inferLotIdsFromRow("production_orders", {
        id: "PO1",
        input_lot_ids: ["A", "B"],
      }),
    ).toEqual(["A", "B"]);
    expect(
      inferLotIdsFromRow("stock_movements", {
        id: "M1",
        lot_id: "S1",
        reception_lot_id: "R1",
      }),
    ).toEqual(["S1", "R1"]);
  });
});
