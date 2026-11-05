import { describe, expect, it } from "vitest";
import { redactWorkerFinancials } from "./financial-visibility.js";

describe("operator financial projection", () => {
  it("removes monetary totals as well as unit prices while preserving operational totals", () => {
    expect(redactWorkerFinancials({ total: 100, total_kg: 100, subtotal: 1215, total_amount: 1500, tax_amount: 285,
      invoice_amount: 1500, unit_price: 3, lines: [{ quantity: 500, unitPrice: 3, line_total: 1500 }] }))
      .toEqual({ total: 100, total_kg: 100, lines: [{ quantity: 500 }] });
  });
});
