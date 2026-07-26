import { describe, expect, it } from "vitest";

import { AppError } from "../../core/app-error.js";
import {
  assertMassBalanceClosed,
  computeMassBalance,
  DEFAULT_MASS_BALANCE_TOLERANCE_PCT,
} from "./mass-balance.js";

describe("mass balance", () => {
  it("closes when outputs plus waste equal input", () => {
    const result = computeMassBalance({
      inputKg: 1000,
      outputsKg: [700, 200],
      wasteKg: 100,
    });

    expect(result).toMatchObject({
      accountedKg: 1000,
      varianceKg: 0,
      variancePct: 0,
      balanced: true,
      tolerancePct: DEFAULT_MASS_BALANCE_TOLERANCE_PCT,
    });
  });

  it("reports shrinkage when grades under-sum the parent", () => {
    const result = computeMassBalance({
      inputKg: 1000,
      outputsKg: [600, 200],
      wasteKg: 50,
    });

    expect(result.accountedKg).toBe(850);
    expect(result.varianceKg).toBe(-150);
    expect(result.variancePct).toBe(-15);
    expect(result.balanced).toBe(false);
  });

  it("warns under warn mode and blocks under enforce", () => {
    const warn = assertMassBalanceClosed(
      { inputKg: 100, outputsKg: [80], wasteKg: 5 },
      { tolerancePct: 2, mode: "warn" },
    );
    expect(warn.action).toBe("warn");

    expect(() =>
      assertMassBalanceClosed(
        { inputKg: 100, outputsKg: [80], wasteKg: 5 },
        { tolerancePct: 2, mode: "enforce", context: "triage" },
      ),
    ).toThrow(AppError);

    try {
      assertMassBalanceClosed(
        { inputKg: 100, outputsKg: [80], wasteKg: 5 },
        { mode: "enforce" },
      );
    } catch (error) {
      expect(error).toMatchObject({ code: "MASS_BALANCE_UNBALANCED" });
    }

    const ok = assertMassBalanceClosed(
      { inputKg: 100, outputsKg: [98], wasteKg: 1 },
      { tolerancePct: 2, mode: "enforce" },
    );
    expect(ok.action).toBe("ok");
  });
});
