import { describe, expect, it } from "vitest";

import { resolveJwtSecret } from "./env.js";

const STRONG = "x".repeat(32);

describe("resolveJwtSecret", () => {
  it("refuses to start production without a secret", () => {
    expect(() => resolveJwtSecret("production", undefined)).toThrow(/JWT_SECRET/);
  });

  it("refuses the development default in production", () => {
    expect(() => resolveJwtSecret("production", "change-me-in-production")).toThrow(/JWT_SECRET/);
  });

  it("refuses a short secret in production", () => {
    expect(() => resolveJwtSecret("production", "x".repeat(31))).toThrow(/32/);
  });

  it("accepts a strong secret in production", () => {
    expect(resolveJwtSecret("production", STRONG)).toBe(STRONG);
  });

  it("keeps a development default outside production", () => {
    expect(resolveJwtSecret("development", undefined)).toBeTruthy();
  });
});
