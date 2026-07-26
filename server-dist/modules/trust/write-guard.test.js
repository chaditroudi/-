import { describe, expect, it } from "vitest";
import { AppError } from "../../core/app-error.js";
import { validateCoreDocument } from "./core-schemas.js";
import { assertCoreSchema, assertGenericDbMutationAllowed } from "./write-guard.js";
describe("W0 write guard", () => {
    it("forbids deletes on regulated collections via generic API", () => {
        expect(() => assertGenericDbMutationAllowed("reception_lots", "delete")).toThrow(AppError);
        expect(() => assertGenericDbMutationAllowed("qc_inspections", "delete")).toThrow(/REGULATED_DELETE_FORBIDDEN|cannot be deleted/);
        expect(() => assertGenericDbMutationAllowed("suppliers", "delete")).not.toThrow();
    });
    it("forbids updates and deletes on append-only logs", () => {
        expect(() => assertGenericDbMutationAllowed("stock_movements", "update")).toThrow(/append-only|IMMUTABLE/);
        expect(() => assertGenericDbMutationAllowed("lot_events", "insert")).toThrow(/trusted domain service/);
        expect(() => assertGenericDbMutationAllowed("stock_movements", "insert")).toThrow(/trusted domain service/);
        expect(() => assertGenericDbMutationAllowed("stock_movements", "insert", { trustedInternal: true })).not.toThrow();
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
        expect(() => assertCoreSchema("reception_lots", [{ quantity: 1 }])).toThrow(/Invalid reception_lots document|CORE_SCHEMA_VIOLATION/);
    });
});
