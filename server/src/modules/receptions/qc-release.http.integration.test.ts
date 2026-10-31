// @vitest-environment node
/**
 * Every route that can release a lot, over real HTTP against a real replica set.
 * Skipped unless RECEPTION_IT_MONGO_URI is set; the database is dropped, so it must be local.
 * The checklist below is a fixture: it proves the server enforces whatever policy is
 * published, and is not a statement of the plant's quality rules.
 *
 * Nest needs the decorator metadata tsc emits, so this runs the compiled server:
 *   npm run server:build
 *   RECEPTION_IT_MONGO_URI=mongodb://127.0.0.1:27327/?replicaSet=rs0 npx vitest run qc-release.http
 */
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { getCollectionModel } from "../../db/dynamic-model.js";
import { ensureTrustIndexes } from "../../db/indexes.js";
import { AuthUserModel } from "../../models/auth-user.model.js";

const uri = process.env.RECEPTION_IT_MONGO_URI;
const DB_NAME = "qc_release_http_test";
const PASSWORD = "Local-test-password-1";
const PIN = "482915";
const ROLES = {
  operator: "operateur_reception",
  inspector: "inspecteur_qualite",
  nopin: "responsable_qualite",
  production: "responsable_production",
  warehouse: "magasinier_wms",
};
const WRITTEN = [
  "receptions_v2", "reception_lots", "reception_units", "stock_lots", "weighing_records", "lot_events",
  "reception_alerts", "reception_audit_logs_v2", "qc_inspections", "qc_check_results", "stock_movements",
  "epcis_events", "system_notifications", "idempotency_commands", "batches", "batch_movements",
  "production_orders", "production_lot_allocations", "purchase_order_receiving_lots",
];

const model = (name: string) => getCollectionModel(name);
const count = (name: string, filter: Record<string, unknown> = {}) => model(name).countDocuments(filter).exec();
const findOne = (name: string, filter: Record<string, unknown>) => model(name).findOne(filter).lean().exec() as Promise<any>;

const COMPILED = "../../../../server-dist";
let base = "";
let lotLifecycleService: { recordStageSafe: (...args: unknown[]) => Promise<unknown> };
let app: { close: () => Promise<void> };
const tokens = {} as Record<keyof typeof ROLES, string>;
let sequence = 0;

const http = async (method: string, path: string, token: string | null, body?: unknown) => {
  const response = await fetch(`${base}/api${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await response.json().catch(() => null) as any;
  return { status: response.status, data: payload?.data, code: payload?.error?.code ?? payload?.code };
};

const conforming = () => [
  { check_code: "CRIT", result: "CONFORME" },
  { check_code: "MAJ", result: "CONFORME" },
];

const delivery = async (lots?: Array<{ lot_supplier: string; quantity: number }>) => {
  sequence += 1;
  const { status, data } = await http("POST", "/receptions/intake", tokens.operator, {
    client_request_id: `qc-http-${sequence}-${Date.now()}`,
    supplier_id: "sup-http",
    reception_type: "DATTE",
    delivery_note_number: `BL-HTTP-${sequence}`,
    vehicle_number: "123 TU 4567",
    variety: "Deglet Nour",
    maturity_stage: "Tamar",
    harvest_method: "Manuelle traditionnelle",
    arrival_temperature_c: 24,
    storage_zone_code: "ZR-01",
    delivery_note_photos: ["data:image/jpeg;base64,AA", "data:image/jpeg;base64,BB"],
    weighing_source: "SCALE",
    gross_weight_kg: 1000,
    tare_weight_kg: 100,
    unit_count: 2,
    lots: lots ?? [{ lot_supplier: `LS-${sequence}`, quantity: 900 }],
  });
  expect(status).toBe(201);
  return { reception: data.reception, lot: data.lots[0] };
};

const startQc = async (receptionId: string) =>
  String((await http("POST", "/qc/start", tokens.inspector, { reception_id: receptionId, inspector_name: "Test" })).data.id);

const submit = (inspectionId: string, body: Record<string, unknown>, token = tokens.inspector) =>
  http("POST", "/qc/submit", token, { inspectionId, ...body });

const accepted = (inspectionId: string, extra: Record<string, unknown> = {}) =>
  submit(inspectionId, { decision: "ACCEPTE", pin: PIN, checkResults: conforming(), ...extra });

const held = async () => {
  const { reception, lot } = await delivery();
  const inspectionId = await startQc(reception.id);
  const { status } = await submit(inspectionId, {
    decision: "QUARANTAINE", comment: "Humidité à recontrôler", checkResults: [{ check_code: "MAJ", result: "NON_CONFORME" }],
  });
  expect(status).toBeLessThan(300);
  return { reception, lot, inspectionId };
};

const lotState = async (lotId: string) => ({
  reception: (await findOne("reception_lots", { id: lotId })).stock_status,
  stock: (await findOne("stock_lots", { reception_lot_id: lotId })).status,
});
const QUARANTINED = { reception: "EN_QUARANTAINE", stock: "QUARANTINE" };
const RELEASED = { reception: "STOCK_LIBERE", stock: "VALIDATED" };

const allocate = async (lotId: string) => {
  const order = await http("POST", "/production/orders", tokens.production, {
    order_type: "CONDITIONNEMENT", planned_quantity: 100, product_name: "Test",
  });
  expect(order.status).toBe(201);
  return http("POST", `/production/orders/${order.data.id}/allocate-lot`, tokens.production, { lot_id: lotId, allocated_kg: 50 });
};

describe.skipIf(!uri)("QC release over HTTP", { timeout: 30_000 }, () => {
  beforeAll(async () => {
    expect(String(uri)).toMatch(/127\.0\.0\.1|localhost/);
    process.env.MONGODB_URI = uri;
    process.env.MONGODB_DB_NAME = DB_NAME;
    const { connectToDatabase } = await import(/* @vite-ignore */ `${COMPILED}/db/mongoose.js`);
    await connectToDatabase();
    expect(mongoose.connection.name).toBe(DB_NAME);
    await mongoose.connection.dropDatabase();
    await ensureTrustIndexes();
    for (const name of WRITTEN) await mongoose.connection.db!.createCollection(name).catch(() => undefined);

    const passwordHash = await bcrypt.hash(PASSWORD, 4);
    const signaturePinHash = await bcrypt.hash(PIN, 4);
    const now = new Date().toISOString();
    for (const [key, role] of Object.entries(ROLES)) {
      await AuthUserModel.create({
        id: `user-${key}`, email: `${key}@test.local`, passwordHash, is_active: true, created_at: now, updated_at: now,
        ...(key === "inspector" ? { signaturePinHash } : {}),
        user_metadata: { full_name: key, role, roles: [role] },
      });
    }

    ({ lotLifecycleService } = await import(/* @vite-ignore */ `${COMPILED}/modules/trust/lot-lifecycle.service.js`));
    const { createApp } = await import(/* @vite-ignore */ `${COMPILED}/app.js`);
    const nest = await createApp();
    await nest.listen(0, "127.0.0.1");
    app = nest;
    base = (await nest.getUrl()).replace("[::1]", "127.0.0.1");
    for (const key of Object.keys(ROLES) as Array<keyof typeof ROLES>) {
      const signedIn = await http("POST", "/auth/signin", null, { email: `${key}@test.local`, password: PASSWORD });
      expect(signedIn).toMatchObject({ status: 201 });
      tokens[key] = signedIn.data.session?.access_token ?? signedIn.data.access_token;
    }
  }, 120_000);

  afterAll(async () => {
    await app?.close();
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  beforeEach(async () => {
    vi.stubEnv("TRUST_SCAN_GATE", "off");
    vi.stubEnv("NUMERIC_SIGNATURE_GATE", "");
    for (const name of [...WRITTEN, "qc_checklists", "qc_checklist_items", "suppliers"]) await model(name).deleteMany({}).exec();
    await model("suppliers").create([{ id: "sup-http", code: "SUP-HTTP", name: "Oasis", supplier_status: "active", is_active: true }]);
    await model("qc_checklists").create([{ id: "cl-1", code: "QC-TEST", reception_type: "DATTE", version: 3, is_active: true }]);
    await model("qc_checklist_items").create([
      { id: "item-crit", checklist_id: "cl-1", code: "CRIT", name: "Critique", severity: "CRITIQUE", sequence_order: 1, is_active: true },
      { id: "item-maj", checklist_id: "cl-1", code: "MAJ", name: "Majeur", severity: "MAJEUR", sequence_order: 2, is_active: true },
    ]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  describe("batch route", () => {
    it("draft, batch decision, lot edit and allocation no longer reach stock", async () => {
      const draft = await http("POST", "/receptions-v2", tokens.operator, {
        supplier_id: "sup-http", reception_type: "DATTE", delivery_note_number: "BL-DRAFT", variety: "Deglet Nour",
      });
      expect(draft.data.status).toBe("BROUILLON");
      const lot = await http("POST", "/reception-lots", tokens.operator, {
        reception_id: draft.data.id, lot_supplier: "D-1", quantity: 100, unit: "kg", variety: "Deglet Nour",
      });
      const batch = await http("POST", "/batches", tokens.production, { batch_number: "B-1", reception_id: draft.data.id });
      expect(batch.status).toBe(201);

      const decide = await http("POST", `/batches/${batch.data.id}/decide`, tokens.inspector, { decision: "ACCEPT" });
      expect(decide.status).toBe(404);

      await http("PATCH", `/reception-lots/${lot.data.id}`, tokens.operator, { notes: "edit" });
      expect(await lotState(lot.data.id)).toEqual(QUARANTINED);
      expect((await allocate(lot.data.id)).code).toBe("LOT_NOT_LIBERE");
    });

    it("a batch cannot carry a QC decision", async () => {
      const created = await http("POST", "/batches", tokens.production, { batch_number: "B-2", qc_decision: "ACCEPT" });
      expect(created.code).toBe("QC_DECISION_DOMAIN_ONLY");
      const batch = await http("POST", "/batches", tokens.production, { batch_number: "B-3" });
      const edit = await http("PATCH", `/batches/${batch.data.id}`, tokens.production, { qc_decision: "ACCEPT" });
      expect(edit.code).toBe("QC_DECISION_DOMAIN_ONLY");
    });
  });

  describe("stock promotion", () => {
    it("a lot edit does not promote stock when the reception lot already reads released", async () => {
      const draft = await http("POST", "/receptions-v2", tokens.operator, {
        supplier_id: "sup-http", reception_type: "DATTE", delivery_note_number: "BL-OLD", variety: "Deglet Nour",
      });
      const lot = await http("POST", "/reception-lots", tokens.operator, {
        reception_id: draft.data.id, lot_supplier: "D-2", quantity: 100, unit: "kg", variety: "Deglet Nour",
      });
      await model("reception_lots").updateOne({ id: lot.data.id }, { $set: { stock_status: "STOCK_LIBERE" } }).exec();

      await http("PATCH", `/reception-lots/${lot.data.id}`, tokens.operator, { notes: "edit" });

      expect((await findOne("stock_lots", { reception_lot_id: lot.data.id })).status).toBe("QUARANTINE");
      expect((await allocate(lot.data.id)).code).toBe("LOT_NOT_LIBERE");
    });

    it("a storage move does not promote held stock", async () => {
      const { reception, lot } = await delivery();
      await accepted(await startQc(reception.id));
      await model("stock_lots").updateOne({ reception_lot_id: lot.id }, { $set: { status: "BLOCKED" } }).exec();

      await http("POST", `/reception-lots/${lot.id}/storage-moves`, tokens.warehouse, { targetZone: "CF-01" });

      expect((await findOne("stock_lots", { reception_lot_id: lot.id })).status).toBe("BLOCKED");
    });

    it("a generic stock update cannot release a lot", async () => {
      const { lot } = await delivery();
      const stock = await findOne("stock_lots", { reception_lot_id: lot.id });
      const patch = await http("PATCH", `/stock/lots/${stock.id}`, tokens.warehouse, { status: "VALIDATED" });
      expect(patch.code).toBe("STOCK_LOT_DOMAIN_ONLY");
      expect(await lotState(lot.id)).toEqual(QUARANTINED);
    });
  });

  describe("evidence", () => {
    it("refuses a decision with no evidence and leaves nothing behind", async () => {
      const { reception, lot } = await delivery();
      const inspectionId = await startQc(reception.id);

      for (const decision of ["ACCEPTE", "QUARANTAINE", "REJETE"]) {
        const refused = await submit(inspectionId, { decision, pin: PIN, comment: "motif" });
        expect(refused.code).toBe("QC_EVIDENCE_INCOMPLETE");
      }

      expect((await findOne("qc_inspections", { id: inspectionId })).decision).toBeNull();
      expect(await count("qc_check_results")).toBe(0);
      expect(await lotState(lot.id)).toEqual(QUARANTINED);
    });

    it("refuses acceptance when a required check is missing or not applicable", async () => {
      const { reception, lot } = await delivery();
      const inspectionId = await startQc(reception.id);
      for (const checkResults of [
        [{ check_code: "CRIT", result: "CONFORME" }],
        [{ check_code: "CRIT", result: "CONFORME" }, { check_code: "MAJ", result: "NA" }],
      ]) {
        expect((await accepted(inspectionId, { checkResults })).code).toBe("QC_EVIDENCE_INCOMPLETE");
      }
      expect(await lotState(lot.id)).toEqual(QUARANTINED);
    });

    it("fails safely when no policy is published for the reception type", async () => {
      const { reception, lot } = await delivery();
      const inspectionId = await startQc(reception.id);
      await model("qc_checklists").updateMany({}, { $set: { is_active: false } }).exec();

      expect((await accepted(inspectionId)).code).toBe("QC_POLICY_UNAVAILABLE");
      expect(await lotState(lot.id)).toEqual(QUARANTINED);
    });

    it("fails safely when two policies are active", async () => {
      const { reception } = await delivery();
      const inspectionId = await startQc(reception.id);
      await model("qc_checklists").create([{ id: "cl-2", code: "QC-OTHER", reception_type: "DATTE", version: 1, is_active: true }]);

      expect((await accepted(inspectionId)).code).toBe("QC_POLICY_AMBIGUOUS");
    });

    it("records the checklist version and the published severity with the decision", async () => {
      const { reception, lot } = await delivery();
      const inspectionId = await startQc(reception.id);

      const decided = await accepted(inspectionId, {
        checkResults: [{ check_code: "CRIT", result: "CONFORME", severity: "MINEUR" }, { check_code: "MAJ", result: "CONFORME" }],
      });

      expect(decided.status).toBe(201);
      expect(await lotState(lot.id)).toEqual(RELEASED);
      const inspection = await findOne("qc_inspections", { id: inspectionId });
      expect(inspection).toMatchObject({ checklist_id: "cl-1", checklist_code: "QC-TEST", checklist_version: 3 });
      expect(await findOne("qc_check_results", { inspection_id: inspectionId, check_code: "CRIT" }))
        .toMatchObject({ severity: "CRITIQUE", checklist_item_id: "item-crit", checklist_version: 3 });
    });
  });

  describe("critical failures", () => {
    const criticalFailure = [{ check_code: "CRIT", result: "NON_CONFORME", severity: "MINEUR" }, { check_code: "MAJ", result: "CONFORME" }];

    it("blocks acceptance over a critical non-conformity, whatever is claimed", async () => {
      const { reception, lot } = await delivery();
      const inspectionId = await startQc(reception.id);

      const refused = await accepted(inspectionId, {
        checkResults: criticalFailure,
        recommendedDecision: "ACCEPTE",
        overrideJustification: "Justification suffisamment longue pour passer",
        overridePhoto: "data:image/jpeg;base64,AA",
      });

      expect(refused.code).toBe("QC_CRITICAL_NONCONFORMITY");
      expect(await lotState(lot.id)).toEqual(QUARANTINED);
    });

    it("blocks acceptance when an extra check or an automatic rejection reports a critical failure", async () => {
      const { reception } = await delivery();
      const inspectionId = await startQc(reception.id);
      const extra = await accepted(inspectionId, {
        checkResults: [...conforming(), { check_code: "INS", check_name: "Insectes", severity: "CRITIQUE", result: "NON_CONFORME" }],
      });
      expect(extra.code).toBe("QC_CRITICAL_NONCONFORMITY");
      const automatic = await accepted(inspectionId, { qualitySummary: { automaticRejectReasons: ["Moisissure"] } });
      expect(automatic.code).toBe("QC_CRITICAL_NONCONFORMITY");
    });

    it("a critical failure can still be rejected or held", async () => {
      const { reception, lot } = await delivery();
      const inspectionId = await startQc(reception.id);
      const decided = await submit(inspectionId, { decision: "REJETE", comment: "Contamination", checkResults: criticalFailure });
      expect(decided.status).toBe(201);
      expect((await lotState(lot.id)).reception).toBe("STOCK_REJETE");
    });

    it("a non-critical failure or a changed recommendation needs the RG-Q04 justification", async () => {
      const { reception, lot } = await delivery();
      const inspectionId = await startQc(reception.id);
      const failed = [{ check_code: "CRIT", result: "CONFORME" }, { check_code: "MAJ", result: "NON_CONFORME" }];

      expect((await accepted(inspectionId, { checkResults: failed })).code).toBe("QC_OVERRIDE_JUSTIFICATION_REQUIRED");
      expect((await accepted(inspectionId, { recommendedDecision: "QUARANTAINE" })).code).toBe("QC_OVERRIDE_JUSTIFICATION_REQUIRED");

      const justified = await accepted(inspectionId, {
        checkResults: failed,
        overrideJustification: "Écart mineur vérifié avec le responsable qualité",
        overridePhoto: "data:image/jpeg;base64,AA",
      });
      expect(justified.status).toBe(201);
      expect(await lotState(lot.id)).toEqual(RELEASED);
      expect((await findOne("qc_inspections", { id: inspectionId })).override_photo).toBe("data:image/jpeg;base64,AA");
    });
  });

  describe("signature", () => {
    it("refuses a release with no PIN when the gate is not configured", async () => {
      const { reception, lot } = await delivery();
      const inspectionId = await startQc(reception.id);
      expect((await submit(inspectionId, { decision: "ACCEPTE", checkResults: conforming() })).code).toBe("PIN_REQUIRED");
      expect(await lotState(lot.id)).toEqual(QUARANTINED);
      expect((await findOne("qc_inspections", { id: inspectionId })).decision).toBeNull();
    });

    it("refuses a wrong PIN", async () => {
      const { reception, lot } = await delivery();
      const inspectionId = await startQc(reception.id);
      const refused = await accepted(inspectionId, { pin: "000111" });
      expect(refused.status).toBe(401);
      expect(await lotState(lot.id)).toEqual(QUARANTINED);
    });

    it("refuses a signer with no PIN configured", async () => {
      const { reception, lot } = await delivery();
      const inspectionId = await startQc(reception.id);
      const refused = await submit(inspectionId, { decision: "ACCEPTE", pin: PIN, checkResults: conforming() }, tokens.nopin);
      expect(refused.code).toBe("PIN_NOT_CONFIGURED");
      expect(await lotState(lot.id)).toEqual(QUARANTINED);
    });

    it("a correct PIN releases and records the signer", async () => {
      const { reception, lot } = await delivery();
      expect((await accepted(await startQc(reception.id))).status).toBe(201);
      expect(await lotState(lot.id)).toEqual(RELEASED);
      expect(await findOne("reception_lots", { id: lot.id })).toMatchObject({ release_pin_verified: true, released_by: "user-inspector" });
    });

    it("refuses employees outside quality", async () => {
      const { reception, lot } = await delivery();
      const inspectionId = await startQc(reception.id);
      for (const token of [tokens.operator, tokens.warehouse, tokens.production]) {
        expect((await submit(inspectionId, { decision: "ACCEPTE", pin: PIN, checkResults: conforming() }, token)).status).toBe(403);
      }
      expect((await http("POST", `/reception-lots/${lot.id}/quality-status`, tokens.operator, { action: "RELEASE" })).status).toBe(403);
      expect(await lotState(lot.id)).toEqual(QUARANTINED);
    });
  });

  describe("release after a hold", () => {
    const release = (lotId: string, body: Record<string, unknown>, token = tokens.inspector) =>
      http("POST", `/reception-lots/${lotId}/quality-status`, token, { action: "RELEASE", reason: "Recontrôle conforme", ...body });

    it("refuses a release with no fresh evidence", async () => {
      const { lot } = await held();
      expect((await release(lot.id, { pin: PIN })).code).toBe("QC_EVIDENCE_INCOMPLETE");
      expect(await lotState(lot.id)).toEqual(QUARANTINED);
    });

    it("refuses a release with no PIN, or with a reason missing", async () => {
      const { lot } = await held();
      expect((await release(lot.id, { checkResults: conforming() })).code).toBe("PIN_REQUIRED");
      expect((await release(lot.id, { pin: PIN, checkResults: conforming(), reason: " " })).code).toBe("QC_RELEASE_REASON_REQUIRED");
      expect(await lotState(lot.id)).toEqual(QUARANTINED);
    });

    it("refuses a release over a critical failure", async () => {
      const { lot } = await held();
      const refused = await release(lot.id, { pin: PIN, checkResults: [{ check_code: "CRIT", result: "NON_CONFORME" }, { check_code: "MAJ", result: "CONFORME" }] });
      expect(refused.code).toBe("QC_CRITICAL_NONCONFORMITY");
    });

    it("a re-inspection releases the lot and keeps the earlier record", async () => {
      const { reception, lot, inspectionId } = await held();

      const released = await release(lot.id, { pin: PIN, checkResults: conforming() });

      expect(released.status).toBe(200);
      expect(await lotState(lot.id)).toEqual(RELEASED);
      expect((await findOne("qc_inspections", { id: inspectionId })).decision).toBe("QUARANTAINE");
      const fresh = await findOne("qc_inspections", { reception_id: reception.id, purpose: "REINSPECTION" });
      expect(fresh).toMatchObject({
        decision: "ACCEPTE", reception_lot_id: lot.id, supersedes_inspection_id: inspectionId,
        checklist_version: 3, release_pin_verified: true, decided_by: "user-inspector",
      });
      expect(await count("qc_check_results", { inspection_id: fresh.id })).toBe(2);
      expect(await count("reception_audit_logs_v2", { entity_id: lot.id, action: "LOT_RELEASED" })).toBe(1);
      expect(await count("reception_audit_logs_v2", { entity_id: fresh.id, action: "QC_REINSPECTION_DECIDED" })).toBe(1);
    });

    it("a second release creates nothing new", async () => {
      const { reception, lot } = await held();
      await release(lot.id, { pin: PIN, checkResults: conforming() });
      await release(lot.id, { pin: PIN, checkResults: conforming() });
      expect(await count("qc_inspections", { reception_id: reception.id, purpose: "REINSPECTION" })).toBe(1);
    });

    it("two simultaneous releases record one re-inspection", async () => {
      const { reception, lot } = await held();
      const results = await Promise.all([
        release(lot.id, { pin: PIN, checkResults: conforming() }),
        release(lot.id, { pin: PIN, checkResults: conforming() }),
      ]);
      expect(results.every((result) => result.status < 300)).toBe(true);
      expect(await count("qc_inspections", { reception_id: reception.id, purpose: "REINSPECTION" })).toBe(1);
    });

    it("a rejected lot cannot be released", async () => {
      const { reception, lot } = await delivery();
      await submit(await startQc(reception.id), { decision: "REJETE", comment: "Non conforme", checkResults: [{ check_code: "CRIT", result: "NON_CONFORME" }] });
      expect((await release(lot.id, { pin: PIN, checkResults: conforming() })).code).toBe("LOT_REJECTED");
    });

    it("accepting a held reception does not release a lot rejected on its own", async () => {
      const { reception, data } = await (async () => {
        const created = await delivery([{ lot_supplier: "A", quantity: 500 }, { lot_supplier: "B", quantity: 400 }]);
        return { reception: created.reception, data: await model("reception_lots").find({ reception_id: created.reception.id }).lean().exec() as any[] };
      })();
      const [rejected, kept] = data;
      await submit(await startQc(reception.id), { decision: "QUARANTAINE", comment: "Recontrôle", checkResults: conforming() });
      const moved = await http("POST", `/reception-lots/${rejected.id}/storage-moves`, tokens.warehouse, { targetZone: "ZONE_REJET" });
      expect(moved.status).toBe(201);

      expect((await accepted(await startQc(reception.id))).status).toBe(201);

      expect(await lotState(rejected.id)).toEqual({ reception: "STOCK_REJETE", stock: "BLOCKED" });
      expect(await lotState(kept.id)).toEqual(RELEASED);
    });

    it("a failed release leaves no partial state", async () => {
      const { reception, lot } = await held();
      vi.spyOn(lotLifecycleService, "recordStageSafe").mockRejectedValue(new Error("forced release failure"));

      expect((await release(lot.id, { pin: PIN, checkResults: conforming() })).status).toBeGreaterThanOrEqual(500);

      expect(await lotState(lot.id)).toEqual(QUARANTINED);
      expect(await count("qc_inspections", { reception_id: reception.id, purpose: "REINSPECTION" })).toBe(0);
      expect(await count("qc_check_results", { check_code: "CRIT" })).toBe(0);
    });
  });

  describe("concurrency and replay", () => {
    it("conflicting decisions record exactly one", async () => {
      const { reception, lot } = await delivery();
      const inspectionId = await startQc(reception.id);

      const results = await Promise.all([
        accepted(inspectionId),
        submit(inspectionId, { decision: "REJETE", comment: "Contamination", checkResults: conforming() }),
      ]);

      expect(results.filter((result) => result.status < 300)).toHaveLength(1);
      expect(results.filter((result) => result.code === "QC_ALREADY_DECIDED")).toHaveLength(1);
      const { decision } = await findOne("qc_inspections", { id: inspectionId });
      expect((await lotState(lot.id)).reception).toBe(decision === "ACCEPTE" ? "STOCK_LIBERE" : "STOCK_REJETE");
      expect(await count("qc_check_results", { inspection_id: inspectionId })).toBe(2);
    });

    it("a replayed approval changes nothing", async () => {
      const { reception, lot } = await delivery();
      const inspectionId = await startQc(reception.id);
      await accepted(inspectionId);
      const before = await findOne("reception_lots", { id: lot.id });

      const replay = await submit(inspectionId, { decision: "ACCEPTE" });

      expect(replay.status).toBeLessThan(300);
      expect(await findOne("reception_lots", { id: lot.id })).toMatchObject({ release_date: before.release_date, released_by: before.released_by });
      expect(await count("lot_events", { lot_id: lot.id, event_type: "QC_DECIDED" })).toBe(1);
      expect(await count("qc_check_results", { inspection_id: inspectionId })).toBe(2);
    });

    it("a replay never completes a release left in QC", async () => {
      const { reception, lot } = await delivery();
      const inspectionId = await startQc(reception.id);
      await model("qc_inspections").updateOne({ id: inspectionId }, { $set: { decision: "ACCEPTE" } }).exec();

      await submit(inspectionId, { decision: "ACCEPTE" });

      expect(await lotState(lot.id)).toEqual(QUARANTINED);
    });

    it("a failed decision leaves no partial state", async () => {
      const { reception, lot } = await delivery();
      const inspectionId = await startQc(reception.id);
      vi.spyOn(lotLifecycleService, "recordStageSafe").mockRejectedValue(new Error("forced QC failure"));

      expect((await accepted(inspectionId)).status).toBeGreaterThanOrEqual(500);

      expect((await findOne("qc_inspections", { id: inspectionId })).decision).toBeNull();
      expect(await count("qc_check_results")).toBe(0);
      expect(await lotState(lot.id)).toEqual(QUARANTINED);
    });
  });

  describe("production eligibility", () => {
    it("refuses to allocate a quarantined or blocked lot", async () => {
      const quarantined = await delivery();
      expect((await allocate(quarantined.lot.id)).code).toBe("LOT_NOT_LIBERE");

      const released = await delivery();
      await accepted(await startQc(released.reception.id));
      await model("stock_lots").updateOne({ reception_lot_id: released.lot.id }, { $set: { status: "BLOCKED" } }).exec();
      expect((await allocate(released.lot.id)).code).toBe("LOT_NOT_LIBERE");
    });

    it("refuses a split lot while one stock row is held", async () => {
      const { reception, lot } = await delivery();
      await accepted(await startQc(reception.id));
      await model("stock_lots").create([{ id: "st-held", lot_number: "SPLIT", reception_lot_id: lot.id, status: "BLOCKED", current_quantity: 10 }]);

      expect((await allocate(lot.id)).code).toBe("LOT_NOT_LIBERE");
    });

    it("allocates a released lot and ignores used-up split rows", async () => {
      const { reception, lot } = await delivery();
      await accepted(await startQc(reception.id));
      await model("stock_lots").create([{ id: "st-used", lot_number: "USED", reception_lot_id: lot.id, status: "CONSUMED", current_quantity: 0 }]);

      expect((await allocate(lot.id)).status).toBe(201);
    });
  });
});
