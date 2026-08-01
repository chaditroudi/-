import { beforeEach, describe, expect, it, vi } from "vitest";
import { createInMemoryModel } from "../../test/in-memory-collection.js";
import { PackagingService } from "./packaging.service.js";
const store = {};
const packagingService = new PackagingService();
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
vi.mock("../notifications/notification-emitter.js", () => ({
    emitNotification: vi.fn(async () => null),
}));
vi.mock("../trust/lot-lifecycle.service.js", () => ({
    lotLifecycleService: {
        resolveReceptionLotId: vi.fn(async () => "lot-parent-1"),
        recordMassBalanceSafe: vi.fn(async () => null),
    },
}));
vi.mock("../costing/costing-rates.js", () => ({
    loadCostingRates: vi.fn(async () => ({
        labourRateTndPerHour: 8,
        energyTariffTndPerKwh: 0.4,
        overheadTndPerKg: 0.15,
        targetCostTndPerKg: 3,
    })),
}));
describe("packagingService mass balance", () => {
    beforeEach(() => {
        Object.keys(store).forEach((key) => delete store[key]);
        vi.stubEnv("TRUST_MASS_BALANCE_GATE", "warn");
    });
    it("consumes only the requested source weight from the triage stock lot", async () => {
        store.stock_lots = [
            {
                id: "stock-1",
                lot_number: "LOT-PACK-E",
                source_stage: "TRIAGE",
                current_quantity: 500,
                unit: "kg",
                status: "QUARANTINE",
            },
        ];
        await packagingService.createOrder({
            source_lot_number: "LOT-PACK-E",
            source_weight_kg: 200,
            bom_net_weight_g: 500,
            bom_name: "500g",
            grade: "EXTRA",
            line: "L1",
            created_by: "user-1",
        });
        expect(store.stock_lots[0]).toMatchObject({
            current_quantity: 300,
            status: "QUARANTINE",
        });
        expect(store.stock_movements[0]).toMatchObject({
            movement_type: "CONSOMMATION",
            quantity: 200,
        });
    });
    it("rejects over-consumption of triage stock", async () => {
        store.stock_lots = [
            {
                id: "stock-1",
                lot_number: "LOT-PACK-E",
                source_stage: "TRIAGE",
                current_quantity: 100,
                unit: "kg",
                status: "QUARANTINE",
            },
        ];
        await expect(packagingService.createOrder({
            source_lot_number: "LOT-PACK-E",
            source_weight_kg: 250,
            bom_net_weight_g: 500,
            bom_name: "500g",
            grade: "EXTRA",
            line: "L1",
        })).rejects.toMatchObject({ code: "INSUFFICIENT_STOCK" });
    });
    it("blocks packaging close when palette net kg do not reconcile under enforce", async () => {
        vi.stubEnv("TRUST_MASS_BALANCE_GATE", "enforce");
        store.packaging_orders = [
            {
                id: "order-1",
                order_number: "OF-1",
                status: "EN_COURS",
                started_at: "2026-07-26T08:00:00.000Z",
                source_weight_kg: 100,
                produced_units: 10,
                rejected_units: 0,
                target_units: 10,
                bom_net_weight_g: 500,
            },
        ];
        store.packaging_palettes = [
            { id: "pal-1", order_id: "order-1", net_weight_kg: 40, status: "SCELLE" },
        ];
        await expect(packagingService.closeOrder("order-1", {
            started_at: "2026-07-26T08:00:00.000Z",
            produced_units: 10,
        })).rejects.toMatchObject({ code: "MASS_BALANCE_UNBALANCED" });
    });
});
