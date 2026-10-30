import { afterEach, describe, expect, it, vi } from "vitest";

import { assertDeviceAllowed, simulatorSecret } from "./device-policy.js";

describe("device policy", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("has no fallback simulator secret", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("WEIGHBRIDGE_SIMULATOR_SECRET", "");
    expect(simulatorSecret("WEIGHBRIDGE_SIMULATOR_SECRET")).toBeNull();
  });

  it("uses the configured simulator secret outside production", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("WEIGHBRIDGE_SIMULATOR_SECRET", "local-secret");
    expect(simulatorSecret("WEIGHBRIDGE_SIMULATOR_SECRET")).toBe("local-secret");
  });

  it("offers no simulator in production, even when configured", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("WEIGHBRIDGE_SIMULATOR_SECRET", "local-secret");
    expect(simulatorSecret("WEIGHBRIDGE_SIMULATOR_SECRET")).toBeNull();
  });

  it("refuses a simulator device already stored in a production database", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(() => assertDeviceAllowed({ protocol: "SIMULATOR" })).toThrow(expect.objectContaining({ statusCode: 401 }));
  });

  it("accepts a real device in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(() => assertDeviceAllowed({ protocol: "HTTP_PUSH" })).not.toThrow();
  });

  it("accepts a simulator outside production", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(() => assertDeviceAllowed({ protocol: "SIMULATOR" })).not.toThrow();
  });
});
