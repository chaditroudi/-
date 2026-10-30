import { beforeEach, describe, expect, it, vi } from "vitest";

import { createInMemoryModel, type TestRow } from "../../test/in-memory-collection.js";
import { SettlementService } from "./settlement.service.js";

const store: Record<string, TestRow[]> = {};

vi.mock("../../db/dynamic-model.js", () => ({
  sanitizeDocument: <T>(value: T) => value,
  getCollectionModel: (collection: string) => createInMemoryModel(collection, store),
}));

vi.mock("../../db/defaults.js", () => ({ prepareInsertDocument: async (_: string, row: TestRow) => row }));

const service = new SettlementService();

describe("settlement separation of duties", () => {
  beforeEach(() => {
    store.supplier_settlements = [{ id: "st-1", status: "DRAFT", created_by: "maker", total_amount_tnd: 100 }];
  });

  it("refuses approval by the person who created the settlement", async () => {
    await expect(service.transition("st-1", "APPROVED", "maker")).rejects.toMatchObject({
      statusCode: 403,
      code: "SEPARATION_OF_DUTIES",
    });
    expect(store.supplier_settlements[0].status).toBe("DRAFT");
  });

  it("refuses approval with no identified approver", async () => {
    await expect(service.transition("st-1", "APPROVED", null)).rejects.toMatchObject({ code: "SEPARATION_OF_DUTIES" });
  });

  it("allows approval by someone else", async () => {
    const row = await service.transition("st-1", "APPROVED", "checker");
    expect(row).toMatchObject({ status: "APPROVED", approved_by: "checker" });
  });
});
