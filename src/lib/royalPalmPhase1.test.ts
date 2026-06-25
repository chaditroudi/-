import { describe, expect, it } from "vitest";
import {
  computeQcScore,
  computeReceptionDraftSignals,
  computeSupplierAlerts,
  hasValidBioCertification,
} from "@/lib/royalPalmPhase1";

describe("royalPalmPhase1", () => {
  it("flags supplier risks from score, rejection rate, and contract expiry", () => {
    const alerts = computeSupplierAlerts({
      quality_score: 55,
      rejection_rate: 22,
      contract_end_date: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
      last_delivery_date: new Date(Date.now() - 19 * 30 * 24 * 60 * 60 * 1000).toISOString(),
    });

    expect(alerts).toEqual(
      expect.arrayContaining([
        "Score fournisseur sous 60/100",
        "Taux de rejet superieur a 20%",
      ]),
    );
  });

  it("detects reception weight and temperature alerts", () => {
    const result = computeReceptionDraftSignals({
      netWeightKg: 4700,
      declaredWeightKg: 5200,
      arrivalTemperatureC: 36,
      departureTime: "06:00",
      actualArrivalDate: "2026-05-06T11:30:00.000Z",
      bioDeclared: true,
      supplier: { certifications: [] },
    });

    expect(result.declaredWeightAlert).toBe("warning");
    expect(result.temperatureAlert).toBe("critical");
    expect(result.recommendedStatus).toBe("BLOQUE");
  });

  it("accepts valid bio certifications", () => {
    expect(
      hasValidBioCertification({
        certifications: [{ name: "Bio UE", validUntil: "2099-12-31" }],
      }),
    ).toBe(true);
  });

  it("computes an extra grade for a clean lot", () => {
    const result = computeQcScore({
      humidity: [22.1, 23.5, 22.8],
      calibers: [47, 47.5, 46.2, 48, 47.8, 46.8, 47.3, 48.1, 46.9, 46.4],
      insectsPercent: 0.5,
      moldPercent: 0,
      fermentationPercent: 0,
      mechanicalDamagePercent: 3,
      crystallizationPercent: 1,
      discolorationPercent: 0,
      tasteScore: 5,
      textureScore: 4,
      appearanceScore: 5,
    });

    expect(result.classification).toBe("EXTRA");
    expect(result.recommendedDecision).toBe("ACCEPTE");
    expect(result.finalScore).toBeGreaterThan(85);
  });

  it("automatically rejects severe mold", () => {
    const result = computeQcScore({
      humidity: [31.2, 29.8, 30.5],
      calibers: [40, 39, 41, 40, 39.5, 40.2, 39.8, 40.1, 39.7, 40.4],
      insectsPercent: 0,
      moldPercent: 4,
      fermentationPercent: 0,
      mechanicalDamagePercent: 0,
      crystallizationPercent: 0,
      discolorationPercent: 0,
      tasteScore: 2,
      textureScore: 2,
      appearanceScore: 2,
    });

    expect(result.automaticReject).toBe(true);
    expect(result.classification).toBe("REJETE");
    expect(result.recommendedDecision).toBe("REJETE");
  });
});
