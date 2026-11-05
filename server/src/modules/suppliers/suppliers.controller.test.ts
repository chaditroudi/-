import { beforeEach, describe, expect, it, vi } from "vitest";

import { createInMemoryModel, type TestRow } from "../../test/in-memory-collection.js";
import { SuppliersController } from "./suppliers.controller.js";

const store: Record<string, TestRow[]> = {};

vi.mock("../../db/dynamic-model.js", () => ({
  sanitizeDocument: <T>(value: T) => value,
  getCollectionModel: (collection: string) => createInMemoryModel(collection, store),
}));

const cs = {
  query: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
};

const receptionsService = {
  checkSupplierContractExpirations: vi.fn(),
};

const controller = new SuppliersController(cs as never, receptionsService as never);

const reqFor = (roles: string[], email = "owner@farm.test") => ({
  auth: { user: { id: "u-1", email, user_metadata: { roles } } },
});

describe("SuppliersController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    store.suppliers = [
      { id: "s-1", email: "owner@farm.test", name: "Mine", code: "sup-1" },
      { id: "s-2", email: "other@farm.test", name: "Theirs", code: "sup-2" },
    ];
    store.receptions_v2 = [{ id: "r-1", supplier_id: "s-1", status: "LIBERE" }];
  });

  it("returns one supplier by id for staff", async () => {
    cs.query.mockResolvedValueOnce([{ id: "s-1", name: "Mine" }]);
    const result = await controller.getOne(reqFor(["responsable_achats"]) as never, "s-1");
    expect(result).toEqual({ data: { id: "s-1", name: "Mine" } });
    expect(cs.query).toHaveBeenCalledWith(
      expect.objectContaining({
        table: "suppliers",
        filters: [{ type: "eq", column: "id", value: "s-1" }],
      }),
    );
  });

  it("refuses portal access to another supplier id", async () => {
    await expect(controller.getOne(reqFor(["fournisseur_externe"]) as never, "s-2")).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it("allows portal access to its own supplier id", async () => {
    cs.query.mockResolvedValueOnce([{ id: "s-1", name: "Mine", email: "owner@farm.test" }]);
    const result = await controller.getOne(reqFor(["fournisseur_externe"]) as never, "s-1");
    expect(result.data).toMatchObject({ id: "s-1" });
  });

  it("checks receptions_v2 for delete guard", async () => {
    cs.query.mockResolvedValueOnce([{ id: "r-1", supplier_id: "s-1" }]);
    const result = await controller.receptionCheck("s-1");
    expect(result).toEqual({ data: [{ id: "r-1", supplier_id: "s-1" }], hasReceptions: true });
    expect(cs.query).toHaveBeenCalledWith(
      expect.objectContaining({
        table: "receptions_v2",
        filters: [{ type: "eq", column: "supplier_id", value: "s-1" }],
        limit: 1,
      }),
    );
  });
});
