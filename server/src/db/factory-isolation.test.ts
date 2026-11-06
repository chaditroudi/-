// @vitest-environment node
import { describe, expect, it } from "vitest";
import { getCollectionModel } from "./dynamic-model.js";
import { currentFactory, factoryDatabaseName, runWithFactory } from "./factory-context.js";

describe("factory model boundary", () => {
  it("refuses operational access without an authoritative factory context", () => {
    expect(() => getCollectionModel("stock_lots")).toThrow(/usine/i);
  });
  it("keeps overlapping and nested background operations in their captured factory", async () => {
    const a = { tenant_id: "company-a", factory_id: "site-a" };
    const b = { tenant_id: "company-b", factory_id: "site-a" };
    await Promise.all([a, b].map((scope) => runWithFactory(scope, async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      expect(currentFactory()).toEqual(scope);
      runWithFactory({ ...scope, factory_id: "other-site" }, () => expect(currentFactory()?.factory_id).toBe("other-site"));
      expect(currentFactory()).toEqual(scope);
    })));
    expect(currentFactory()).toBeUndefined();
  });
  it("separates company, factory and deployment identities without accepting database names", () => {
    const scope = { tenant_id: "company-a", factory_id: "site-a" };
    const name = factoryDatabaseName("control", scope);
    expect(name).toMatch(/^dhh_f_[a-f0-9]{32}$/);
    expect(Buffer.byteLength(name, "utf8")).toBeLessThanOrEqual(38);
    expect(factoryDatabaseName("control", { ...scope, tenant_id: "company-b" })).not.toBe(name);
    expect(factoryDatabaseName("control", { ...scope, factory_id: "site-b" })).not.toBe(name);
    expect(factoryDatabaseName("other-control", scope)).not.toBe(name);
    expect(() => runWithFactory({ ...scope, factory_id: "../auth_users" }, () => null)).toThrow();
  });
});
