import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import {
  isValidPinFormat,
  numericSignatureGateMode,
  releaseSignatureGateMode,
  hashSignaturePin,
} from "./numeric-signature.js";

describe("numeric-signature", () => {
  const previous = process.env.NUMERIC_SIGNATURE_GATE;

  afterEach(() => {
    if (previous === undefined) delete process.env.NUMERIC_SIGNATURE_GATE;
    else process.env.NUMERIC_SIGNATURE_GATE = previous;
  });

  describe("QC release gate", () => {
    afterEach(() => vi.unstubAllEnvs());

    it("fails closed when nothing is configured", () => {
      vi.stubEnv("NUMERIC_SIGNATURE_GATE", "");
      expect(releaseSignatureGateMode()).toBe("enforce");
    });

    it("lets a weaker mode be asked for explicitly outside production", () => {
      vi.stubEnv("NUMERIC_SIGNATURE_GATE", "warn");
      expect(releaseSignatureGateMode()).toBe("warn");
    });

    it("always enforces in production", () => {
      vi.stubEnv("NODE_ENV", "production");
      for (const mode of ["", "warn", "off"]) {
        vi.stubEnv("NUMERIC_SIGNATURE_GATE", mode);
        expect(releaseSignatureGateMode()).toBe("enforce");
      }
    });
  });

  it("accepts 4–6 digit PINs only", () => {
    expect(isValidPinFormat("1234")).toBe(true);
    expect(isValidPinFormat("123456")).toBe(true);
    expect(isValidPinFormat("123")).toBe(false);
    expect(isValidPinFormat("1234567")).toBe(false);
    expect(isValidPinFormat("12ab")).toBe(false);
  });

  it("reads NUMERIC_SIGNATURE_GATE", () => {
    process.env.NUMERIC_SIGNATURE_GATE = "enforce";
    expect(numericSignatureGateMode()).toBe("enforce");
    process.env.NUMERIC_SIGNATURE_GATE = "off";
    expect(numericSignatureGateMode()).toBe("off");
    process.env.NUMERIC_SIGNATURE_GATE = "warn";
    expect(numericSignatureGateMode()).toBe("warn");
  });

  it("hashes PIN with bcrypt", async () => {
    const hash = await hashSignaturePin("4821");
    expect(hash).toMatch(/^\$2[aby]?\$/);
    expect(hash).not.toContain("4821");
  });
});
