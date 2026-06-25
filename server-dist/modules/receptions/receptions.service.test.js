import { beforeEach, describe, expect, it, vi } from "vitest";
import { receptionsService } from "./receptions.service.js";
const supplier = { id: "supplier-id-1", code: "SUP-0001", name: "Cooperative Oasis Tozeur" };
const created = {};
const receptions = new Map();
vi.mock("../../db/dynamic-model.js", () => ({
    sanitizeDocument: (value) => value,
    getCollectionModel: (collection) => {
        if (collection === "suppliers") {
            return {
                findOne: vi.fn((query) => ({
                    lean: () => ({
                        exec: async () => {
                            const clauses = query?.$or || [];
                            return clauses.some((clause) => clause.id === supplier.id || clause.code === supplier.code) ? supplier : null;
                        },
                    }),
                })),
            };
        }
        if (collection === "receptions_v2") {
            return {
                findOne: vi.fn((query) => ({
                    lean: () => ({
                        exec: async () => {
                            const clauses = query?.$or || [];
                            for (const clause of clauses) {
                                if (clause.id && receptions.has(clause.id)) {
                                    return receptions.get(clause.id) || null;
                                }
                            }
                            return null;
                        },
                    }),
                })),
                updateOne: vi.fn(() => ({
                    exec: async () => undefined,
                })),
                create: vi.fn(async (rows) => {
                    created[collection] = [...(created[collection] || []), ...rows];
                    rows.forEach((row) => {
                        if (row.id)
                            receptions.set(String(row.id), row);
                    });
                }),
                insertMany: vi.fn(async (rows) => {
                    created[collection] = [...(created[collection] || []), ...rows];
                    rows.forEach((row) => {
                        if (row.id)
                            receptions.set(String(row.id), row);
                    });
                }),
            };
        }
        return {
            findOne: vi.fn(() => ({
                lean: () => ({
                    exec: async () => null,
                }),
            })),
            updateOne: vi.fn(() => ({
                exec: async () => undefined,
            })),
            create: vi.fn(async (rows) => {
                created[collection] = [...(created[collection] || []), ...rows];
            }),
            insertMany: vi.fn(async (rows) => {
                created[collection] = [...(created[collection] || []), ...rows];
            }),
        };
    },
}));
vi.mock("../../db/defaults.js", () => ({
    prepareInsertDocument: vi.fn(async (collection, value) => ({
        id: `${collection}-id-${(created[collection]?.length || 0) + 1}`,
        created_at: "2026-05-24T12:00:00.000Z",
        updated_at: "2026-05-24T12:00:00.000Z",
        ...(collection === "receptions_v2" ? { reception_number: "REC-TEST-0001" } : {}),
        ...value,
    })),
}));
vi.mock("./reception-stock-sync.js", () => ({
    syncReceptionLotsToStock: vi.fn(async () => undefined),
    loadReceptionLots: vi.fn(async () => []),
}));
describe("receptionsService", () => {
    beforeEach(() => {
        Object.keys(created).forEach((key) => delete created[key]);
        receptions.clear();
    });
    it("accepts supplier code and stores the canonical supplier id during intake", async () => {
        const result = await receptionsService.intake({
            supplier_id: "SUP-0001",
            reception_type: "DATTE",
            unit: "kg",
            gross_weight_kg: 1000,
            tare_weight_kg: 100,
            unit_count: 1,
            lots: [{ lot_supplier: "LOT-A", quantity: 900 }],
        }, { id: "user-1" });
        expect(result.reception.supplier_id).toBe("supplier-id-1");
        expect(result.reception.supplier_code_snapshot).toBe("SUP-0001");
        expect(created.receptions_v2[0].supplier_id).toBe("supplier-id-1");
    });
    it("blocks a non-admin from starting QC on their own reception", async () => {
        receptions.set("rec-1", {
            id: "rec-1",
            created_by: "user-1",
            status: "EN_ATTENTE_QC",
        });
        await expect(receptionsService.startQcInspection({
            reception_id: "rec-1",
            inspector_name: "Inspecteur A",
        }, {
            id: "user-1",
            user_metadata: {
                roles: ["responsable_qualite"],
            },
        })).rejects.toMatchObject({
            code: "QC_ROLE_SEPARATION",
        });
    });
    it("allows an admin to override role separation and start QC on the same reception", async () => {
        receptions.set("rec-2", {
            id: "rec-2",
            created_by: "admin-1",
            status: "EN_ATTENTE_QC",
        });
        const inspection = await receptionsService.startQcInspection({
            reception_id: "rec-2",
            inspector_name: "Admin QC",
        }, {
            id: "admin-1",
            user_metadata: {
                roles: ["administrateur_systeme"],
            },
        });
        expect(inspection.reception_id).toBe("rec-2");
        expect(created.qc_inspections).toHaveLength(1);
    });
});
