import { describe, expect, it } from "vitest";

import { isAllowedOrigin, parseAllowedOrigins } from "./cors.js";

describe("CORS origins", () => {
  const allowed = parseAllowedOrigins(" https://plant.example.com , https://other.example.com/ ");

  it("allows requests with no browser origin", () => {
    expect(isAllowedOrigin(undefined, [], "production")).toBe(true);
  });

  it("allows only exact origins in production", () => {
    expect(isAllowedOrigin("https://plant.example.com", allowed, "production")).toBe(true);
    expect(isAllowedOrigin("https://other.example.com", allowed, "production")).toBe(true);
    expect(isAllowedOrigin("https://plant.example.com.evil.test", allowed, "production")).toBe(false);
  });

  it("no longer allows every GitHub Pages site", () => {
    expect(isAllowedOrigin("https://attacker.github.io", allowed, "production")).toBe(false);
  });

  it("refuses localhost in production", () => {
    expect(isAllowedOrigin("http://localhost:5173", allowed, "production")).toBe(false);
  });

  it("allows local hosts in development, but not look-alikes", () => {
    expect(isAllowedOrigin("http://localhost:5173", [], "development")).toBe(true);
    expect(isAllowedOrigin("http://127.0.0.1:8080", [], "development")).toBe(true);
    expect(isAllowedOrigin("http://localhost.evil.test", [], "development")).toBe(false);
  });
});
