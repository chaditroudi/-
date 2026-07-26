import { describe, expect, it } from "vitest";

import { classifyScan, extractScanReferences } from "./scan-parse.js";

describe("W3 canonical scan parser", () => {
  it("extracts lot references from passport URLs and JSON labels", () => {
    expect(
      extractScanReferences("https://mes.local/#/passport/LOT-2026-001"),
    ).toContain("LOT-2026-001");
    expect(
      extractScanReferences(JSON.stringify({ lot_internal: "LOT-77", sscc: "123456789012345678" })),
    ).toEqual(expect.arrayContaining(["LOT-77", "123456789012345678"]));
  });

  it("recognizes SSCC, lot and location formats", () => {
    expect(classifyScan("123456789012345678")).toBe("SSCC");
    expect(classifyScan("LOT-2026-001")).toBe("LOT");
    expect(classifyScan("CF-A1-02-03-1")).toBe("LOCATION");
  });
});
