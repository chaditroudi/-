import { beforeEach, describe, expect, it, vi } from "vitest";
import { createInMemoryModel } from "../../test/in-memory-collection.js";
import { ProductionService } from "./production.service.js";
const store = {};
const productionService = new ProductionService();
vi.mock("../../db/dynamic-model.js", () => ({
    sanitizeDocument: (value) => value,
    getCollectionModel: (collection) => createInMemoryModel(collection, store),
}));
vi.mock("../../db/defaults.js", () => ({
    prepareInsertDocument: vi.fn(async (collection, value) => ({
        id: `${collection}-id-${(store[collection]?.length || 0) + 1}`,
        created_at: "2026-07-26T12:00:00.000Z",
        updated_at: "2026-07-26T12:00:00.000Z",
        ...value,
    })),
}));
describe("productionService mass balance", () => {
    beforeEach(() => {
        Object.keys(store).forEach((key) => delete store[key]);
        vi.stubEnv("TRUST_MASS_BALANCE_GATE", "enforce");
    });
    it("completes when output plus waste reconciles with allocated input", async () => {
        store.production_orders = [
            {
                id: "po-1",
                status: "IN_PROGRESS",
                actual_output_kg: 0,
            },
        ];
        store.production_steps = [
            { id: "step-1", production_order_id: "po-1", is_mandatory: true, status: "COMPLETED", name: "Triage" },
        ];
        store.production_lot_allocations = [
            { id: "alloc-1", production_order_id: "po-1", lot_id: "lot-1", allocated_kg: 100 },
        ];
        const result = await productionService.completeOrder("po-1", { actual_output_kg: 92, waste_kg: 8 }, "user-1");
        expect(result).toMatchObject({
            status: "COMPLETED",
            actual_output_kg: 92,
            waste_kg: 8,
            mass_balance_variance_pct: 0,
        });
    });
    it("blocks completion when mass balance is outside tolerance", async () => {
        store.production_orders = [{ id: "po-2", status: "IN_PROGRESS" }];
        store.production_steps = [
            { id: "step-1", production_order_id: "po-2", is_mandatory: true, status: "COMPLETED" },
        ];
        store.production_lot_allocations = [
            { id: "alloc-1", production_order_id: "po-2", lot_id: "lot-1", allocated_kg: 100 },
        ];
        await expect(productionService.completeOrder("po-2", { actual_output_kg: 50, waste_kg: 0 }, "user-1")).rejects.toMatchObject({ code: "MASS_BALANCE_UNBALANCED" });
    });
});
