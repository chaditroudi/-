import { beforeEach, describe, expect, it, vi } from "vitest";

import { createInMemoryModel, type TestRow } from "../../test/in-memory-collection.js";
import { assertOwnSupplier, filterOwnSuppliers, isSupplierPortalUser, ownSupplierId } from "./supplier-portal-scope.js";

const store: Record<string, TestRow[]> = {};

vi.mock("../../db/dynamic-model.js", () => ({
  sanitizeDocument: <T>(value: T) => value,
  getCollectionModel: (collection: string) => createInMemoryModel(collection, store),
}));

const reqFor = (roles: string[], email = "owner@farm.test") => ({
  auth: { user: { id: "u-1", email, user_metadata: { roles } } },
});
const portal = reqFor(["fournisseur_externe"]);
const staff = reqFor(["responsable_achats"]);

describe("supplier portal scope", () => {
  beforeEach(() => {
    store.suppliers = [
      { id: "s-1", email: "Owner@Farm.test", name: "Mine" },
      { id: "s-2", email: "other@farm.test", name: "Theirs" },
    ];
  });

  it("identifies a portal account, not a member of staff", () => {
    expect(isSupplierPortalUser(portal)).toBe(true);
    expect(isSupplierPortalUser(staff)).toBe(false);
    expect(isSupplierPortalUser(reqFor(["fournisseur_externe", "responsable_achats"]))).toBe(false);
  });

  it("shows a portal account only its own supplier row", () => {
    expect(filterOwnSuppliers(portal, store.suppliers as never).map((row: TestRow) => row.id)).toEqual(["s-1"]);
  });

  it("shows staff every supplier", () => {
    expect(filterOwnSuppliers(staff, store.suppliers as never)).toHaveLength(2);
  });

  it("refuses another supplier's records", async () => {
    await expect(assertOwnSupplier(portal, "s-2")).rejects.toMatchObject({ statusCode: 403 });
  });

  it("allows its own records", async () => {
    await expect(assertOwnSupplier(portal, "s-1")).resolves.toBeUndefined();
  });

  it("leaves staff unrestricted", async () => {
    await expect(assertOwnSupplier(staff, "s-2")).resolves.toBeUndefined();
  });

  it("finds the supplier that belongs to the account", async () => {
    await expect(ownSupplierId(portal)).resolves.toBe("s-1");
  });

  it("finds nothing for an account linked to no supplier", async () => {
    await expect(ownSupplierId(reqFor(["fournisseur_externe"], "nobody@farm.test"))).resolves.toBeNull();
  });
});
