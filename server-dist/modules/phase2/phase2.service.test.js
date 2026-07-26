import { beforeEach, describe, expect, it, vi } from "vitest";
import { createInMemoryModel } from "../../test/in-memory-collection.js";
import { buildLotEventRecord, verifyLotEventChain } from "../trust/lot-ledger.js";
import { Phase2Service } from "./phase2.service.js";
const store = {};
const phase2Service = new Phase2Service();
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
describe("phase2Service golden-thread stages", () => {
    beforeEach(() => {
        Object.keys(store).forEach((key) => delete store[key]);
        vi.stubEnv("TRUST_CCP_GATE", "warn");
    });
    it("appends FUMIGATION_CCP after dual signature on a QC-released lot", async () => {
        const lotId = "reception-lot-fum";
        const intake = buildLotEventRecord({ lotId, eventType: "LOT_CREATED", collection: "reception_lots", action: "GATE", prevHash: null }, 1);
        const qc = buildLotEventRecord({ lotId, eventType: "QC_DECIDED", collection: "qc_inspections", action: "GATE", prevHash: intake.hash }, 2);
        store.lot_events = [intake, qc];
        store.reception_lots = [{ id: lotId, lot_internal: "LOT-FUM", reception_id: "rec-1" }];
        store.fumigation_cycles = [
            {
                id: "cycle-1",
                status: "VALIDATION",
                protocol: "PH3_STANDARD",
                operator_signed_at: "2026-07-26T10:00:00.000Z",
                operator_signer_id: "op-1",
                lot_refs: [{ lot_number: "LOT-FUM", reception_id: "rec-1" }],
            },
        ];
        store.fumigation_sensor_readings = [];
        await phase2Service.signFumigationCycle("cycle-1", {
            role: "quality",
            signerName: "QC Lead",
            signerId: "qc-1",
        });
        const events = (store.lot_events || []);
        expect(events.map((event) => event.event_type)).toContain("CCP_COMPLETED");
        expect(verifyLotEventChain(events).valid).toBe(true);
    });
    it("appends TRIAGE when closing a session whose parent has CCP", async () => {
        const lotId = "reception-lot-triage";
        const intake = buildLotEventRecord({ lotId, eventType: "LOT_CREATED", collection: "reception_lots", action: "GATE", prevHash: null }, 1);
        const qc = buildLotEventRecord({ lotId, eventType: "QC_DECIDED", collection: "qc_inspections", action: "GATE", prevHash: intake.hash }, 2);
        const ccp = buildLotEventRecord({ lotId, eventType: "CCP_COMPLETED", collection: "fumigation_cycles", action: "GATE", prevHash: qc.hash }, 3);
        store.lot_events = [intake, qc, ccp];
        store.reception_lots = [{ id: lotId, lot_internal: "LOT-TRI", reception_id: "rec-1" }];
        store.triage_sessions = [
            {
                id: "session-1",
                status: "EN_COURS",
                parent_lot_number: "LOT-TRI",
                parent_reception_id: "rec-1",
                session_number: "TRI-1",
                weight_extra_kg: 100,
                weight_cat1_kg: 50,
                weight_cat2_kg: 20,
                weight_reject_kg: 5,
                created_by: "user-1",
                started_at: "2026-07-26T08:00:00.000Z",
            },
        ];
        await phase2Service.closeTriageSession("session-1");
        const events = (store.lot_events || []);
        expect(events.map((event) => event.event_type)).toContain("TRANSFORMED");
        expect(verifyLotEventChain(events).valid).toBe(true);
    });
});
