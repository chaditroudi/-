import { describe, expect, it } from "vitest";

import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { findForbiddenBundleHosts, resolveTestApi } from "./api-target-guard.mjs";

describe("test API target", () => {
  it("has no default", () => {
    expect(() => resolveTestApi("")).toThrow(/test API URL is required/);
  });

  it("refuses the development stack", () => {
    expect(() => resolveTestApi("http://127.0.0.1:4000")).toThrow(/Refusing port 4000/);
    expect(() => resolveTestApi("http://localhost:8080/")).toThrow(/Refusing port 8080/);
  });

  it("refuses remote hosts", () => {
    expect(() => resolveTestApi("https://api.example.com")).toThrow(/Refusing api.example.com/);
  });

  it("accepts a separate local API", () => {
    expect(resolveTestApi("http://127.0.0.1:4127/")).toBe("http://127.0.0.1:4127");
    expect(resolveTestApi("http://localhost:4127/api/")).toBe("http://localhost:4127/api");
  });
});

describe("findForbiddenBundleHosts", () => {
  const bundleWith = (text) => {
    const dir = mkdtempSync(path.join(tmpdir(), "bundle-"));
    writeFileSync(path.join(dir, "app.js"), text);
    return dir;
  };

  it("passes a same-origin bundle", () => {
    expect(findForbiddenBundleHosts(bundleWith('const api = "/api";'))).toEqual([]);
  });

  it("finds a live host", () => {
    expect(findForbiddenBundleHosts(bundleWith('const api = "https://x.up.railway.app/api";'))).toHaveLength(1);
  });

  it("finds a path Git Bash rewrote", () => {
    expect(findForbiddenBundleHosts(bundleWith('const api = "C:/Program Files/Git/api";'))).toHaveLength(1);
  });
});
