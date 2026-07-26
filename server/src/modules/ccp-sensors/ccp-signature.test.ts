import { describe, expect, it } from "vitest";

import { canonicalCcpReading, signCcpReading } from "./ccp-signature.js";

describe("Wave A CCP device signing", () => {
  it("builds a stable canonical string and HMAC", () => {
    const input = {
      readingId: "r-1",
      deviceCode: "CCP-FUM-SIM-01",
      capturedAt: "2026-07-26T12:00:00.000Z",
      kind: "FUMIGATION" as const,
      targetRef: "cycle-1",
      value: 1.1,
      secondary: 0,
      flag: 1 as const,
    };
    expect(canonicalCcpReading(input)).toBe(
      "CCP-FUM-SIM-01:r-1:2026-07-26T12:00:00.000Z:FUMIGATION:cycle-1:1.100:0.000:1",
    );
    const signature = signCcpReading(input, "secret");
    expect(signature).toHaveLength(64);
    expect(signCcpReading(input, "secret")).toBe(signature);
    expect(signCcpReading({ ...input, value: 1.2 }, "secret")).not.toBe(signature);
  });
});
