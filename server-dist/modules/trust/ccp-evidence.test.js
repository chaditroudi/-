import { describe, expect, it } from "vitest";
import { digestReadings, evaluateColdChain, evaluateFumigationCcp } from "./ccp-evidence.js";
describe("Wave A CCP evidence", () => {
    it("requires readings and marks short cycles non-compliant", () => {
        const empty = evaluateFumigationCcp({
            protocol: "FUM-THERM-04",
            t0Start: "2026-07-26T10:00:00.000Z",
            readings: [],
            protocolConfig: { min_duration_min: 240, min_avg_concentration_gm3: 0.5 },
            now: "2026-07-26T11:00:00.000Z",
        });
        expect(empty.compliant).toBe(false);
        expect(empty.missing).toContain("readings");
        expect(empty.durationCompliant).toBe(false);
    });
    it("computes CT and accepts a complete therm protocol window", () => {
        const result = evaluateFumigationCcp({
            protocol: "FUM-THERM-04",
            t0Start: "2026-07-26T08:00:00.000Z",
            protocolConfig: { min_duration_min: 240, min_avg_concentration_gm3: 0.5 },
            now: "2026-07-26T12:30:00.000Z",
            readings: [
                {
                    read_at: "2026-07-26T09:00:00.000Z",
                    concentration_avg_gm3: 1.2,
                    external_leak_ppm: 0,
                    door_locked: true,
                    source: "DEVICE",
                    signature_verified: true,
                },
                {
                    read_at: "2026-07-26T11:00:00.000Z",
                    concentration_avg_gm3: 1.0,
                    external_leak_ppm: 0.1,
                    door_locked: true,
                    source: "DEVICE",
                    signature_verified: true,
                },
            ],
        });
        expect(result.compliant).toBe(true);
        expect(result.durationCompliant).toBe(true);
        expect(result.deviceVerifiedCount).toBe(2);
        expect(result.ctProduct).toBeGreaterThan(0);
        expect(result.readingsDigest).toHaveLength(64);
    });
    it("detects cold-chain excursions and digests evidence stably", () => {
        const cold = evaluateColdChain({
            temperatureMaxC: 8,
            temperatureMinC: 0,
            readings: [
                { reading_at: "2026-07-26T10:00:00.000Z", temperature_c: 4, condition_status: "ok" },
                { reading_at: "2026-07-26T10:20:00.000Z", temperature_c: 11, condition_status: "critical" },
            ],
        });
        expect(cold.intact).toBe(false);
        expect(cold.excursionCount).toBe(1);
        expect(digestReadings([{ reading_at: "a", temperature_c: 1 }])).toHaveLength(64);
    });
});
