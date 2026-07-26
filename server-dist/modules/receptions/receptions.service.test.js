import { beforeEach, describe, expect, it, vi } from "vitest";
import { createInMemoryModel } from "../../test/in-memory-collection.js";
import { verifyLotEventChain } from "../trust/lot-ledger.js";
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
        return createInMemoryModel(collection, created);
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
    loadReceptionLots: vi.fn(async (receptionId) => (created.reception_lots || []).filter((lot) => lot.reception_id === receptionId)),
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
    it("appends a verifiable SUPPLIER_INTAKE ledger event for every lot created at intake", async () => {
        const ledgerFailure = vi.spyOn(console, "error").mockImplementation(() => undefined);
        await receptionsService.intake({
            supplier_id: "SUP-0001",
            reception_type: "DATTE",
            unit: "kg",
            gross_weight_kg: 1000,
            tare_weight_kg: 100,
            unit_count: 1,
            lots: [{ lot_supplier: "LOT-A", quantity: 900 }],
        }, { id: "user-1" });
        const events = (created.lot_events || []);
        expect(events).toHaveLength(1);
        expect(events[0].event_type).toBe("LOT_CREATED");
        expect(events[0].actor_id).toBe("user-1");
        expect(events[0].payload).toMatchObject({ stage: "SUPPLIER_INTAKE", route: "PREMIUM_WHOLE" });
        expect(verifyLotEventChain(events).valid).toBe(true);
        const w1Failures = ledgerFailure.mock.calls.filter((call) => String(call[0] ?? "").includes("lot lifecycle recordStage failed"));
        expect(w1Failures).toEqual([]);
        ledgerFailure.mockRestore();
    });
    it("bootstraps intake and appends QC_DECIDED to the ledger when QC accepts a lot", async () => {
        receptions.set("rec-3", { id: "rec-3", reception_number: "REC-TEST-0003", status: "EN_ATTENTE_QC" });
        created.qc_inspections = [{ id: "insp-1", reception_id: "rec-3" }];
        created.reception_lots = [{ id: "lot-1", reception_id: "rec-3", lot_internal: "LOT-A" }];
        await receptionsService.submitQcDecision({ inspectionId: "insp-1", decision: "ACCEPTE", qualitySummary: { grade: "A" } }, { id: "qc-1" });
        const events = (created.lot_events || []);
        expect(events.map((event) => event.event_type)).toEqual(["LOT_CREATED", "QC_DECIDED"]);
        expect(events[1].payload).toMatchObject({ stage: "QC_DECIDED", decision: "ACCEPTE" });
        expect(verifyLotEventChain(events).valid).toBe(true);
    });
    it("appends REJECTED to the ledger when QC rejects a lot", async () => {
        receptions.set("rec-4", { id: "rec-4", reception_number: "REC-TEST-0004", status: "EN_ATTENTE_QC" });
        created.qc_inspections = [{ id: "insp-2", reception_id: "rec-4" }];
        created.reception_lots = [{ id: "lot-rej", reception_id: "rec-4", lot_internal: "LOT-R" }];
        await receptionsService.submitQcDecision({ inspectionId: "insp-2", decision: "REJETE", qualitySummary: { grade: "R" }, comment: "moisissure" }, { id: "qc-2" });
        const events = (created.lot_events || []);
        expect(events.map((event) => event.event_type)).toEqual(["LOT_CREATED", "STATUS_CHANGED"]);
        expect(events[1].payload).toMatchObject({ stage: "REJECTED", decision: "REJETE", rejected: true });
        expect(verifyLotEventChain(events).valid).toBe(true);
    });
    it("appends WEIGHED after a verified gross+tare pair", async () => {
        created.reception_lots = [{ id: "lot-w", reception_id: "rec-w", lot_internal: "LOT-W", stock_status: "EN_QUARANTAINE" }];
        created.lot_events = [
            {
                lot_id: "lot-w",
                event_type: "LOT_CREATED",
                collection: "reception_lots",
                action: "GATE",
                actor_id: "user-1",
                payload: { stage: "SUPPLIER_INTAKE" },
                related_ids: [],
                prev_hash: "0".repeat(64),
                hash: "a".repeat(64),
                sequence: 1,
                at: "2026-07-26T10:00:00.000Z",
            },
        ];
        await receptionsService.recordWeighing("lot-w", { type: "GROSS", weight_kg: 1000, source: "MANUAL", manual_reason: "scale outage" }, { id: "user-1" });
        await receptionsService.recordWeighing("lot-w", { type: "TARE", weight_kg: 100, source: "MANUAL", manual_reason: "scale outage" }, { id: "user-1" });
        const events = (created.lot_events || []);
        expect(events.some((event) => event.event_type === "LOT_WEIGHED")).toBe(true);
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
