import { describe, expect, it } from "vitest";

import {
  PLACEHOLDER_GS1_COMPANY_PREFIX,
  computeGS1CheckDigit,
  generateSSCC,
  isPlaceholderGs1Prefix,
  normalizeGs1Prefix,
} from "./gs1-sscc.js";

describe("gs1-sscc", () => {
  it("normalizes to placeholder when unset", () => {
    expect(normalizeGs1Prefix(null)).toBe(PLACEHOLDER_GS1_COMPANY_PREFIX);
    expect(isPlaceholderGs1Prefix("09999999")).toBe(true);
  });

  it("accepts a real-looking 8-digit company prefix", () => {
    expect(normalizeGs1Prefix("62100001")).toBe("62100001");
    expect(isPlaceholderGs1Prefix("62100001")).toBe(false);
  });

  it("builds an 18-digit SSCC with a valid check digit", () => {
    const sscc = generateSSCC(42, "62100001");
    expect(sscc).toHaveLength(18);
    expect(sscc.slice(0, 1)).toBe("0");
    expect(sscc.slice(1, 9)).toBe("62100001");
    const body = sscc.slice(0, 17);
    expect(sscc.slice(17)).toBe(computeGS1CheckDigit(body));
  });
});
