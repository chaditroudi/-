import { describe, expect, it } from "vitest";

import { reconcileLots, usableUnderGate } from "./lot-reconciliation.mjs";

const lot = (id, stock_status, extra = {}) => ({ id, reception_id: `r-${id}`, lot_internal: id, stock_status, release_pin_verified: true, ...extra });
const stock = (id, reception_lot_id, status, extra = {}) => ({ id, reception_lot_id, status, current_quantity: 10, initial_quantity: 10, ...extra });
const accepted = (id) => ({ id: `i-${id}`, reception_id: `r-${id}`, decision: "ACCEPTE" });
const check = (id, severity = "MAJEUR", result = "CONFORME") => ({ inspection_id: `i-${id}`, check_code: "C1", severity, result });

const audit = (input) => reconcileLots({ receptionLots: [], stockLots: [], inspections: [], checkResults: [], batches: [], ...input });
const codes = (report) => report.findings.map((row) => row.code);

describe("lot reconciliation", () => {
  it("raises nothing for a lot released with evidence and a PIN", () => {
    const report = audit({
      receptionLots: [lot("a", "STOCK_LIBERE")], stockLots: [stock("s", "a", "VALIDATED")],
      inspections: [accepted("a")], checkResults: [check("a")],
    });
    expect(report.findings).toEqual([]);
    expect(report.totals.usable_under_gate).toBe(1);
  });

  it("flags stock released while the reception lot is not", () => {
    const report = audit({ receptionLots: [lot("a", "EN_QUARANTAINE")], stockLots: [stock("s", "a", "VALIDATED")] });
    expect(codes(report)).toEqual(["STOCK_RELEASED_RECEPTION_NOT"]);
    expect(report.totals.refused_by_gate).toBe(1);
  });

  it("flags a reception release that stock still holds", () => {
    const report = audit({
      receptionLots: [lot("a", "STOCK_LIBERE")], stockLots: [stock("s", "a", "QUARANTINE")],
      inspections: [accepted("a")], checkResults: [check("a")],
    });
    expect(codes(report)).toEqual(["RECEPTION_RELEASED_STOCK_HELD"]);
  });

  it("flags a release with no inspection and a batch decision behind it", () => {
    const report = audit({
      receptionLots: [lot("a", "STOCK_LIBERE", { release_pin_verified: null })],
      stockLots: [stock("s", "a", "VALIDATED")],
      batches: [{ reception_id: "r-a", qc_decision: "ACCEPT" }],
    });
    expect(codes(report).sort()).toEqual(["BATCH_DECISION_ON_RECEPTION", "RELEASED_WITHOUT_INSPECTION", "RELEASED_WITHOUT_VERIFIED_PIN"]);
  });

  it("flags acceptance with no evidence and acceptance over a critical failure", () => {
    const empty = audit({ receptionLots: [lot("a", "STOCK_LIBERE")], stockLots: [stock("s", "a", "VALIDATED")], inspections: [accepted("a")] });
    expect(codes(empty)).toEqual(["ACCEPTED_WITHOUT_EVIDENCE"]);
    const critical = audit({
      receptionLots: [lot("a", "STOCK_LIBERE")], stockLots: [stock("s", "a", "VALIDATED")],
      inspections: [accepted("a")], checkResults: [check("a", "CRITIQUE", "NON_CONFORME")],
    });
    expect(codes(critical)).toEqual(["ACCEPTED_WITH_CRITICAL_NONCONFORMITY"]);
  });

  it("flags a rejected lot that is not blocked", () => {
    expect(codes(audit({ receptionLots: [lot("a", "STOCK_REJETE")], stockLots: [stock("s", "a", "QUARANTINE")] })))
      .toEqual(["REJECTED_STOCK_NOT_BLOCKED"]);
  });

  it("reads a re-inspection for its own lot only", () => {
    const hold = { id: "i-hold", reception_id: "r", decision: "QUARANTAINE" };
    const fresh = { id: "i-new", reception_id: "r", decision: "ACCEPTE", reception_lot_id: "a" };
    const report = audit({
      receptionLots: [lot("a", "STOCK_LIBERE", { reception_id: "r" }), lot("b", "STOCK_LIBERE", { reception_id: "r" })],
      stockLots: [stock("s1", "a", "VALIDATED"), stock("s2", "b", "VALIDATED")],
      inspections: [hold, fresh],
      checkResults: [{ inspection_id: "i-new", check_code: "C", severity: "MAJEUR", result: "CONFORME" }],
    });
    expect(report.findings.map((row) => [row.code, row.lot_id])).toEqual([["RELEASED_AFTER_HOLD", "b"]]);
  });

  it("does not treat used-up stock as a mismatch", () => {
    const report = audit({
      receptionLots: [lot("a", "STOCK_LIBERE")], stockLots: [stock("s", "a", "CONSUMED")],
      inspections: [accepted("a")], checkResults: [check("a")],
    });
    expect(report.findings).toEqual([]);
    expect(usableUnderGate("STOCK_LIBERE", ["CONSUMED"])).toBe(true);
  });

  it("flags orphans, missing stock, splits and quantity above initial", () => {
    const report = audit({
      receptionLots: [lot("a", "EN_QUARANTAINE"), lot("b", "EN_QUARANTAINE")],
      stockLots: [
        stock("s1", "a", "QUARANTINE"), stock("s2", "a", "QUARANTINE"),
        stock("s3", "gone", "QUARANTINE"), stock("s4", "a", "QUARANTINE", { current_quantity: 20 }),
      ],
    });
    expect(new Set(codes(report))).toEqual(new Set(["MISSING_STOCK_LOT", "MULTIPLE_STOCK_LOTS", "ORPHAN_STOCK_LOT", "QUANTITY_ABOVE_INITIAL"]));
  });
});
