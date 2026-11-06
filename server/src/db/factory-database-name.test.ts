import { describe, expect, it, vi } from "vitest";
import {
  FACTORY_DATABASE_NAME_MAX_BYTES,
  FactoryDatabaseNameError,
  factoryDatabaseName,
  legacyFactoryDatabaseName,
  resolveFactoryDatabaseName,
  type FactoryDatabaseMapping,
} from "./factory-database-name.js";

const scope = { tenant_id: "demo-company", factory_id: "demo-site" };

describe("factory database names", () => {
  it("keeps a new name inside the Atlas shared-tier limit and distinct per factory", () => {
    const name = factoryDatabaseName("date_harvest_hub", scope);
    expect(Buffer.byteLength(name, "utf8")).toBeLessThanOrEqual(FACTORY_DATABASE_NAME_MAX_BYTES);
    expect(name).toMatch(/^dhh_f_[a-f0-9]{32}$/);
    expect(name).toBe("dhh_f_22fed28b3895f92b91e7abd47b3e4688");
    const legacy = legacyFactoryDatabaseName("date_harvest_hub", scope);
    expect(Buffer.byteLength(legacy, "utf8")).toBe(46);
    expect(legacy.startsWith(name)).toBe(true);
    expect(legacy).toBe("dhh_f_22fed28b3895f92b91e7abd47b3e46886145a7bf");
    expect(factoryDatabaseName("date_harvest_hub", { ...scope, tenant_id: "other-company" })).not.toBe(name);
    expect(factoryDatabaseName("date_harvest_hub", { ...scope, factory_id: "other-site" })).not.toBe(name);
    expect(factoryDatabaseName("other-control", scope)).not.toBe(name);
  });

  it("does not collide across five hundred factory ids at 128 bits", () => {
    const names = new Set(Array.from({ length: 500 }, (_, index) =>
      factoryDatabaseName("control", { tenant_id: "company", factory_id: `site-${index}` })));
    expect(names.size).toBe(500);
    for (const name of names) expect(Buffer.byteLength(name, "utf8")).toBe(38);
  });

  it("keeps a recorded name and does not look for a replacement database", async () => {
    const listDatabaseNames = vi.fn();
    const saveMapping = vi.fn();
    const name = await resolveFactoryDatabaseName({
      controlDatabase: "control",
      context: scope,
      listDatabaseNames,
      readMapping: async () => "dhh_f_22fed28b3895f92b91e7abd47b3e46886145a7bf",
      readOwner: async () => null,
      saveMapping,
    });
    expect(name).toBe("dhh_f_22fed28b3895f92b91e7abd47b3e46886145a7bf");
    expect(listDatabaseNames).not.toHaveBeenCalled();
    expect(saveMapping).not.toHaveBeenCalled();
  });

  it("adopts an existing long name instead of creating the short one", async () => {
    const legacy = legacyFactoryDatabaseName("control", scope);
    const saved: FactoryDatabaseMapping[] = [];
    const name = await resolveFactoryDatabaseName({
      controlDatabase: "control",
      context: scope,
      listDatabaseNames: async () => [legacy],
      readMapping: async () => null,
      readOwner: async () => null,
      saveMapping: async (mapping) => { saved.push(mapping); },
    });
    expect(name).toBe(legacy);
    expect(saved).toEqual([expect.objectContaining({ database_name: legacy, reason: "existing-legacy" })]);
  });

  it("records the short name only when neither database exists", async () => {
    const saved: FactoryDatabaseMapping[] = [];
    const name = await resolveFactoryDatabaseName({
      controlDatabase: "control",
      context: scope,
      listDatabaseNames: async () => ["date_harvest_hub"],
      readMapping: async () => null,
      readOwner: async () => null,
      saveMapping: async (mapping) => { saved.push(mapping); },
    });
    expect(name).toBe(factoryDatabaseName("control", scope));
    expect(Buffer.byteLength(name)).toBeLessThanOrEqual(38);
    expect(saved[0]?.reason).toBe("new");
  });

  it("refuses to choose when both names already exist", async () => {
    const saveMapping = vi.fn();
    await expect(resolveFactoryDatabaseName({
      controlDatabase: "control",
      context: scope,
      listDatabaseNames: async () => [factoryDatabaseName("control", scope), legacyFactoryDatabaseName("control", scope)],
      readMapping: async () => null,
      readOwner: async () => null,
      saveMapping,
    })).rejects.toBeInstanceOf(FactoryDatabaseNameError);
    expect(saveMapping).not.toHaveBeenCalled();
  });

  it("does not invent a name when the database list cannot be read", async () => {
    const saveMapping = vi.fn();
    await expect(resolveFactoryDatabaseName({
      controlDatabase: "control",
      context: scope,
      listDatabaseNames: async () => { throw new Error("not authorized"); },
      readMapping: async () => null,
      readOwner: async () => null,
      saveMapping,
    })).rejects.toMatchObject({ code: "FACTORY_DATABASE_UNRESOLVED" });
    expect(saveMapping).not.toHaveBeenCalled();
  });

  it("refuses a short name already owned by another factory", async () => {
    const saveMapping = vi.fn();
    await expect(resolveFactoryDatabaseName({
      controlDatabase: "control",
      context: scope,
      listDatabaseNames: async () => [],
      readMapping: async () => null,
      readOwner: async () => ({ tenant_id: "other", factory_id: "site" }),
      saveMapping,
    })).rejects.toMatchObject({ code: "FACTORY_DATABASE_COLLISION" });
    expect(saveMapping).not.toHaveBeenCalled();
  });
});
