import { describe, expect, it } from "vitest";

import { AppError } from "../../core/app-error.js";
import { validateCoreDocument } from "./core-schemas.js";
import { assertBatchWrite, assertCoreSchema, assertGenericDbMutationAllowed, assertStockLotWrite } from "./write-guard.js";

describe("W0 write guard", () => {
  it("forbids deletes on regulated collections via generic API", () => {
    expect(() => assertGenericDbMutationAllowed("reception_lots", "delete")).toThrow(AppError);
    expect(() => assertGenericDbMutationAllowed("qc_inspections", "delete")).toThrow(/REGULATED_DELETE_FORBIDDEN|cannot be deleted/);
    expect(() => assertGenericDbMutationAllowed("suppliers", "delete")).not.toThrow();
  });

  it("keeps QC inspections to their domain service", () => {
    expect(() => assertGenericDbMutationAllowed("qc_inspections", "insert")).toThrow(/trusted domain service/);
    expect(() => assertGenericDbMutationAllowed("qc_inspections", "update")).toThrow(/trusted domain service/);
    expect(() => assertGenericDbMutationAllowed("qc_inspections", "update", { trustedInternal: true })).not.toThrow();
  });

  it("keeps QC evidence to its domain service", () => {
    expect(() => assertGenericDbMutationAllowed("qc_check_results", "insert")).toThrow(/trusted domain service/);
    expect(() => assertGenericDbMutationAllowed("qc_check_results", "update")).toThrow(/trusted domain service/);
  });

  it("gives a batch no QC decision of its own", () => {
    expect(() => assertBatchWrite({ batch_number: "B", qc_decision: "ACCEPT" })).toThrow(/contrôle qualité/);
    const decided = { qc_decision: "ACCEPT", qc_decision_by: "someone" };
    expect(() => assertBatchWrite({ ...decided, notes: "edit" }, decided)).not.toThrow();
    expect(() => assertBatchWrite({ ...decided, qc_decision: "REJECT" }, decided)).toThrow(AppError);
  });

  it("creates stock lots only in quarantine, unlinked, and without inventoriable quantity", () => {
    expect(() => assertStockLotWrite("insert", { status: "QUARANTINE", current_quantity: 0 })).not.toThrow();
    expect(() => assertStockLotWrite("insert", { status: "QUARANTINE", current_quantity: 10 })).toThrow(/STOCK_LOT_ORPHAN_QTY|quantité/);
    for (const status of ["VALIDATED", "STOCK_LIBERE", "LIBERE", "RELEASED"]) {
      expect(() => assertStockLotWrite("insert", { status })).toThrow(/contrôle qualité/);
    }
    expect(() => assertStockLotWrite("insert", { status: "QUARANTINE", entry_lot_id: "x" })).toThrow(AppError);
    expect(() => assertStockLotWrite("insert", { status: "QUARANTINE", qc_validated_by: "x" })).toThrow(AppError);
  });

  it("leaves quality fields of a stock lot to the QC workflow", () => {
    const before = { status: "QUARANTINE", current_quantity: 100, qc_validated_by: null, position: "A" };
    expect(() => assertStockLotWrite("update", { ...before, position: "B" }, before)).not.toThrow();
    expect(() => assertStockLotWrite("update", { ...before, current_quantity: "100" }, before)).not.toThrow();
    expect(() => assertStockLotWrite("update", { ...before, qc_validated_by: undefined }, before)).not.toThrow();
    expect(() => assertStockLotWrite("update", { ...before, status: "VALIDATED" }, before)).toThrow(AppError);
    expect(() => assertStockLotWrite("update", { ...before, current_quantity: 5000 }, before)).toThrow(AppError);
    expect(() => assertStockLotWrite("update", { ...before, qc_validated_by: "me" }, before)).toThrow(AppError);
  });

  it("forbids updates and deletes on append-only logs", () => {
    expect(() => assertGenericDbMutationAllowed("stock_movements", "update")).toThrow(/append-only|IMMUTABLE/);
    expect(() => assertGenericDbMutationAllowed("lot_events", "insert")).toThrow(/trusted domain service/);
    expect(() => assertGenericDbMutationAllowed("stock_movements", "insert")).toThrow(/trusted domain service/);
    expect(() =>
      assertGenericDbMutationAllowed("stock_movements", "insert", { trustedInternal: true }),
    ).not.toThrow();
  });

  it("validates core reception_lots schema", () => {
    const ok = validateCoreDocument("reception_lots", {
      reception_id: "rec-1",
      quantity: 250,
      unit: "kg",
    });
    expect(ok.ok).toBe(true);

    const bad = validateCoreDocument("reception_lots", {
      quantity: 10,
    });
    expect(bad.ok).toBe(false);

    expect(() =>
      assertCoreSchema("reception_lots", [{ quantity: 1 }]),
    ).toThrow(/Invalid reception_lots document|CORE_SCHEMA_VIOLATION/);
  });
});
