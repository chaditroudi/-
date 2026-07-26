import { describe, expect, it } from "vitest";
import { canonicalReading, signReading } from "./weighbridge-signature.js";
describe("W3 weighbridge signing", () => {
    const reading = {
        readingId: "R-1",
        deviceCode: "SIM-01",
        capturedAt: "2026-07-26T12:00:00.000Z",
        weightKg: 1250.5,
        unit: "kg",
        stable: true,
        direction: "GROSS",
    };
    it("produces a deterministic canonical frame and HMAC", () => {
        expect(canonicalReading(reading)).toBe("SIM-01:R-1:2026-07-26T12:00:00.000Z:1250.500:kg:1:GROSS");
        expect(signReading(reading, "secret")).toHaveLength(64);
        expect(signReading(reading, "secret")).toBe(signReading({ ...reading }, "secret"));
    });
    it("changes the signature when weight or secret changes", () => {
        expect(signReading(reading, "secret")).not.toBe(signReading({ ...reading, weightKg: 1250.6 }, "secret"));
        expect(signReading(reading, "secret")).not.toBe(signReading(reading, "other"));
    });
});
