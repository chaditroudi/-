import { describe, expect, it } from "vitest";
import { computeExportMargin, computeGradeSettlement, convertToTnd, resolveGradePriceTndPerKg, } from "./settlement-domain.js";
describe("resolveGradePriceTndPerKg", () => {
    it("uses grade book when present", () => {
        expect(resolveGradePriceTndPerKg({
            grade: "EXTRA",
            gradePrices: { EXTRA: 12 },
            agreedPriceTndPerKg: 8,
        })).toBe(12);
    });
    it("falls back to agreed price for sellable grades", () => {
        expect(resolveGradePriceTndPerKg({
            grade: "CATEGORIE_I",
            gradePrices: {},
            agreedPriceTndPerKg: 8.5,
        })).toBe(8.5);
    });
    it("defaults REJETE to zero", () => {
        expect(resolveGradePriceTndPerKg({
            grade: "REJETE",
            agreedPriceTndPerKg: 8.5,
        })).toBe(0);
    });
});
describe("computeGradeSettlement", () => {
    it("builds payable amount by grade with reject unpaid", () => {
        const result = computeGradeSettlement({
            agreedPriceTndPerKg: 10,
            gradePrices: { EXTRA: 14, REJETE: 0 },
            lines: [
                { grade: "EXTRA", weightKg: 40, lotNumber: "L-E" },
                { grade: "CATEGORIE_I", weightKg: 100, lotNumber: "L-1" },
                { grade: "REJETE", weightKg: 10, lotNumber: "L-R" },
            ],
        });
        expect(result.totalWeightKg).toBe(150);
        expect(result.payableWeightKg).toBe(140);
        expect(result.totalAmountTnd).toBe(14 * 40 + 10 * 100);
        expect(result.lines.find((l) => l.grade === "REJETE")?.amount_tnd).toBe(0);
    });
});
describe("FX + export margin", () => {
    it("converts EUR revenue to TND", () => {
        expect(convertToTnd({ amount: 100, currency: "EUR", fxRatesToTnd: { EUR: 3.4 } })).toEqual({
            currency: "EUR",
            fxRateToTnd: 3.4,
            amountTnd: 340,
        });
    });
    it("computes margin vs lot cost basis", () => {
        const margin = computeExportMargin({
            revenueInvoice: 1000,
            currency: "EUR",
            costTnd: 2000,
            fxRatesToTnd: { EUR: 3.35 },
        });
        expect(margin.amountTnd).toBe(3350);
        expect(margin.marginTnd).toBe(1350);
        expect(margin.marginPct).toBeCloseTo(40.2985, 2);
    });
});
