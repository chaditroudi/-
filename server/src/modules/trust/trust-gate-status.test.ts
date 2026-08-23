import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";

import { getTrustGateStatus } from "./trust-gate-status.js";
import { resetSwallowedStageFailureCount } from "./lot-lifecycle.service.js";

describe("getTrustGateStatus", () => {
  const envKeys = [
    "TRUST_SCAN_GATE",
    "TRUST_CCP_GATE",
    "TRUST_MASS_BALANCE_GATE",
    "TRUST_STAGE_GATE",
    "GS1_COMPANY_PREFIX",
  ] as const;
  const previous: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of envKeys) previous[key] = process.env[key];
    resetSwallowedStageFailureCount();
  });

  afterEach(() => {
    for (const key of envKeys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  });

  it("reports warn defaults and placeholder GS1 as not enforce-ready", () => {
    delete process.env.TRUST_SCAN_GATE;
    delete process.env.TRUST_CCP_GATE;
    delete process.env.TRUST_MASS_BALANCE_GATE;
    delete process.env.TRUST_STAGE_GATE;
    delete process.env.GS1_COMPANY_PREFIX;

    const status = getTrustGateStatus(null);
    expect(status.gates.scan).toBe("warn");
    expect(status.gates.ccp).toBe("warn");
    expect(status.gates.stage).toBe("warn");
    expect(status.gs1.placeholder).toBe(true);
    expect(status.enforce_ready).toBe(false);
  });

  it("is enforce_ready when all hard gates enforce and GS1 is real", () => {
    process.env.TRUST_SCAN_GATE = "enforce";
    process.env.TRUST_CCP_GATE = "enforce";
    process.env.TRUST_STAGE_GATE = "enforce";
    process.env.TRUST_MASS_BALANCE_GATE = "warn";

    const status = getTrustGateStatus("62100001");
    expect(status.gs1.placeholder).toBe(false);
    expect(status.enforce_ready).toBe(true);
  });
});
