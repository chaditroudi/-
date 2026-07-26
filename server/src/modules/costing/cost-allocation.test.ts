import { describe, expect, it } from "vitest";

import { allocateCostByWeight, snapshotPurchaseCost } from "./cost-allocation.js";

describe("allocateCostByWeight", () => {
  it("spreads cost across good grades and leaves reject at zero", () => {
    const result = allocateCostByWeight({
      inputCostTnd: 1750,
      outputs: [
        { id: "EXTRA", weightKg: 100, valueWeight: 1 },
        { id: "CATEGORIE_I", weightKg: 50, valueWeight: 1 },
        { id: "CATEGORIE_II", weightKg: 20, valueWeight: 1 },
        { id: "REJETE", weightKg: 5, valueWeight: 0 },
      ],
    });

    expect(result.allocatedCostTnd).toBe(1750);
    expect(result.unallocatedCostTnd).toBe(0);
    expect(result.costBearingWeightKg).toBe(170);

    const byId = Object.fromEntries(result.streams.map((stream) => [stream.id, stream]));
    expect(byId.REJETE.costTnd).toBe(0);
    expect(byId.REJETE.costTndPerKg).toBe(0);
    // 1750 / 170 ≈ 10.2941 — reject loss inflates good grades.
    expect(byId.EXTRA.costTndPerKg).toBeCloseTo(10.2941, 3);
    expect(byId.CATEGORIE_I.costTnd + byId.EXTRA.costTnd + byId.CATEGORIE_II.costTnd).toBe(1750);
  });

  it("returns zeros when there is no input cost", () => {
    const result = allocateCostByWeight({
      inputCostTnd: 0,
      outputs: [{ id: "EXTRA", weightKg: 100 }],
    });
    expect(result.streams[0].costTndPerKg).toBe(0);
    expect(result.unallocatedCostTnd).toBe(0);
  });

  it("keeps all cost unallocated when every stream is reject", () => {
    const result = allocateCostByWeight({
      inputCostTnd: 100,
      outputs: [{ id: "REJETE", weightKg: 40, valueWeight: 0 }],
    });
    expect(result.allocatedCostTnd).toBe(0);
    expect(result.unallocatedCostTnd).toBe(100);
  });
});

describe("snapshotPurchaseCost", () => {
  it("multiplies agreed price by quantity", () => {
    expect(snapshotPurchaseCost({ quantityKg: 200, agreedPriceTndPerKg: 8.5 })).toEqual({
      purchase_cost_tnd_per_kg: 8.5,
      purchase_cost_tnd: 1700,
      cost_source: "supplier.agreed_price_tnd_per_kg",
    });
  });

  it("returns nulls when price is missing", () => {
    expect(snapshotPurchaseCost({ quantityKg: 200, agreedPriceTndPerKg: null })).toEqual({
      purchase_cost_tnd_per_kg: null,
      purchase_cost_tnd: null,
      cost_source: null,
    });
  });
});
