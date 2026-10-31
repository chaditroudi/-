import { describe, expect, it } from "vitest";

import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { findForbiddenBundleHosts, resolveTestApi, refuseHealthReport } from "./api-target-guard.mjs";

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

describe("refuseHealthReport", () => {
  it("accepts a disposable local stack", () => {
    expect(refuseHealthReport({ environment: "test", database_host_class: "local" })).toBeNull();
    expect(refuseHealthReport({ environment: "dev", database_host_class: "local" })).toBeNull();
  });

  it.each(["live-dev", "staging", "production", null, undefined])("refuses environment %s", (environment) => {
    expect(refuseHealthReport({ environment, database_host_class: "local" })).toMatch(/environment/);
  });

  it("refuses a test label on a remote database", () => {
    expect(refuseHealthReport({ environment: "test", database_host_class: "remote" })).toMatch(/not local/);
  });

  it("refuses an API too old to say what it is", () => {
    expect(refuseHealthReport({ ok: true })).toMatch(/environment/);
    expect(refuseHealthReport(null)).toMatch(/environment/);
  });
});
