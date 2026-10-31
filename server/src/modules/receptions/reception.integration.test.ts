// @vitest-environment node
/**
 * Runs against a real MongoDB replica set, because transactions, write conflicts
 * and unique indexes cannot be proved on the in-memory model. Skipped unless
 * RECEPTION_IT_MONGO_URI is set; the database is dropped, so it must be local.
 *
 *   mongod --replSet rs0 --port 27327 ...
 *   RECEPTION_IT_MONGO_URI=mongodb://127.0.0.1:27327/?replicaSet=rs0 npx vitest run reception.integration
 */
import mongoose from "mongoose";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { getCollectionModel } from "../../db/dynamic-model.js";
import { ensureTrustIndexes } from "../../db/indexes.js";
import { CollectionsService } from "../collections/collections.service.js";
import { ReceptionsExtController } from "../receptions-ext/receptions-ext.controller.js";
import { StockController } from "../stock/stock.controller.js";
import { gateRulesService } from "../trust/gate-rules.service.js";
import { lotLifecycleService } from "../trust/lot-lifecycle.service.js";
import { TrustController } from "../trust/trust.controller.js";
import { IdempotencyService } from "../trust/idempotency.service.js";
import * as purchaseOrderDomain from "../purchasing/purchase-order-domain.js";
import { addRealtimeClient, removeRealtimeClient } from "../realtime/realtime.bus.js";
import { ReceptionDraftsService } from "./reception-drafts.service.js";
import { receptionsService } from "./receptions.service.js";

const uri = process.env.RECEPTION_IT_MONGO_URI;
const DB_NAME = "reception_integration_test";
const operator = { id: "op-it" };
const inspector = { id: "qc-it" };

const SIDE_EFFECT_COLLECTIONS = [
  "receptions_v2", "reception_lots", "reception_units", "stock_lots", "weighing_records",
  "lot_events", "reception_alerts", "reception_audit_logs_v2", "purchase_order_receiving_lots",
];

const model = (name: string) => getCollectionModel(name);
const count = (name: string, filter: Record<string, unknown> = {}) => model(name).countDocuments(filter).exec();

const persistedCounts = async () =>
  Object.fromEntries(await Promise.all(SIDE_EFFECT_COLLECTIONS.map(async (name) => [name, await count(name)])));

const noRows = Object.fromEntries(SIDE_EFFECT_COLLECTIONS.map((name) => [name, 0]));

let sequence = 0;
const delivery = (overrides: Record<string, unknown> = {}): Record<string, any> & { client_request_id: string } => {
  sequence += 1;
  return {
    client_request_id: `it-${sequence}`,
    supplier_id: "sup-it",
    reception_type: "DATTE",
    delivery_note_number: `BL-IT-${sequence}`,
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
    lots: [{ lot_supplier: `LS-${sequence}`, quantity: 900 }],
    ...overrides,
  };
};

const captureRealtime = () => {
  const events: Array<{ event: string; payload: { resource?: string } }> = [];
  addRealtimeClient({
    id: "it-client", userId: "op-it", roles: ["operateur_reception"], seesAll: false,
    write: (event, payload) => events.push({ event, payload: payload as { resource?: string } }),
    end: () => undefined,
  });
  return events;
};

describe.skipIf(!uri)("reception on a real replica set", () => {
  beforeAll(async () => {
    expect(String(uri)).toMatch(/127\.0\.0\.1|localhost/);
    await mongoose.connect(String(uri), { dbName: DB_NAME });
    await mongoose.connection.dropDatabase();
    await ensureTrustIndexes();
    // Multi-document transactions cannot create collections under a catalog conflict.
    for (const name of [...SIDE_EFFECT_COLLECTIONS, "stock_movements", "epcis_events", "system_notifications", "counters"]) {
      await mongoose.connection.db!.createCollection(name).catch(() => undefined);
    }
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  beforeEach(async () => {
    vi.stubEnv("NUMERIC_SIGNATURE_GATE", "off");
    vi.stubEnv("TRUST_SCAN_GATE", "off");
    for (const name of [
      ...SIDE_EFFECT_COLLECTIONS, "suppliers", "purchase_orders", "purchase_order_lines", "reception_drafts",
      "idempotency_commands", "weighbridge_readings", "qc_inspections", "site_settings",
    ]) {
      await model(name).deleteMany({}).exec();
    }
    await model("suppliers").create([{ id: "sup-it", code: "SUP-IT", name: "Oasis Test", supplier_status: "active" }]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    removeRealtimeClient("it-client");
  });

  describe("atomic intake", () => {
    it("commits reception, lots, units, stock, weighing, ledger and audit together", async () => {
      const { reception, lots } = await receptionsService.intake(delivery(), operator);

      expect(reception.status).toBe("EN_ATTENTE_QC");
      expect(lots).toHaveLength(1);
      expect(await count("stock_lots", { reception_lot_id: lots[0].id, status: "QUARANTINE" })).toBe(1);
      expect(await count("weighing_records", { reception_id: reception.id })).toBe(2);
      expect(await count("reception_units")).toBe(2);
      const stages = await model("lot_events").find({ lot_id: lots[0].id }).sort({ sequence: 1 }).lean().exec();
      expect(stages.map((event: { event_type: string }) => event.event_type)).toEqual(
        expect.arrayContaining(["LOT_CREATED", "LOT_WEIGHED"]),
      );
      expect(await count("reception_audit_logs_v2", { action: "RECEPTION_CONFIRMED" })).toBe(1);
    });

    it("leaves nothing behind and publishes nothing when the WEIGHED stage fails", async () => {
      const events = captureRealtime();
      const real = lotLifecycleService.recordStageSafe.bind(lotLifecycleService);
      vi.spyOn(lotLifecycleService, "recordStageSafe").mockImplementation(async (input) => {
        if (input.toStage === "WEIGHED") throw new Error("forced failure between critical writes");
        return real(input);
      });

      await expect(receptionsService.intake(delivery(), operator)).rejects.toThrow(/forced failure/);

      expect(await persistedCounts()).toEqual(noRows);
      expect(events).toEqual([]);
    });

    it("rolls back when the purchase order booking fails after every other write", async () => {
      await model("purchase_orders").create([{ id: "po-it", order_number: "PO-IT", supplier_id: "sup-it", status: "confirmed" }]);
      await model("purchase_order_lines").create([{ id: "pol-it", order_id: "po-it", quantity: 5000, received_quantity: 0 }]);
      vi.spyOn(purchaseOrderDomain, "registerReceptionAgainstPurchaseOrder").mockRejectedValue(new Error("forced PO failure"));

      await expect(
        receptionsService.intake(delivery({ purchase_order_id: "po-it", purchase_order_line_id: "pol-it" }), operator),
      ).rejects.toThrow(/forced PO failure/);

      expect(await persistedCounts()).toEqual(noRows);
      const line = await model("purchase_order_lines").findOne({ id: "pol-it" }).lean().exec();
      expect(line.received_quantity).toBe(0);
    });

    it("keeps the draft open when the confirmation rolls back, so the employee loses nothing", async () => {
      const drafts = new ReceptionDraftsService();
      const payload = delivery();
      const id = String(payload.client_request_id);
      await drafts.save({ id, payload }, "op-it");
      vi.spyOn(lotLifecycleService, "recordStageSafe").mockRejectedValue(new Error("forced failure"));

      await expect(receptionsService.intake({ ...payload, draft_version: 1 }, operator)).rejects.toThrow(/forced failure/);

      expect(await drafts.get(id)).toMatchObject({ status: "OPEN", version: 1 });
    });

    it("publishes reception events only after the commit, without the record", async () => {
      const events = captureRealtime();
      const seenDuringWrite: number[] = [];
      const real = lotLifecycleService.recordStageSafe.bind(lotLifecycleService);
      vi.spyOn(lotLifecycleService, "recordStageSafe").mockImplementation(async (input) => {
        seenDuringWrite.push(events.length);
        return real(input);
      });

      await receptionsService.intake(delivery(), operator);

      expect(seenDuringWrite.every((length) => length === 0)).toBe(true);
    });
  });

  describe("idempotency", () => {
    const idempotency = new IdempotencyService();
    const submit = (payload: ReturnType<typeof delivery>, fingerprint = "same") =>
      idempotency.execute({
        scope: "reception_intake",
        key: payload.client_request_id,
        actorId: operator.id,
        fingerprint,
        run: () => receptionsService.intake(payload, operator),
      });

    it("refuses a request without a key before writing", async () => {
      const { client_request_id: _key, ...payload } = delivery();
      await expect(receptionsService.intake(payload, operator)).rejects.toMatchObject({ code: "CLIENT_REQUEST_ID_REQUIRED" });
      expect(await persistedCounts()).toEqual(noRows);
    });

    it("stores no null key, and historical null keys do not collide", async () => {
      await model("receptions_v2").collection.insertMany([
        { id: "old-1", client_request_id: null },
        { id: "old-2", client_request_id: null },
      ]);
      const { reception } = await receptionsService.intake(delivery(), operator);
      expect(reception.client_request_id).toEqual(expect.any(String));
    });

    it("a repeated key returns the first reception", async () => {
      const payload = delivery();
      const first = await submit(payload);
      const second = await submit(payload);

      expect(second.replayed).toBe(true);
      expect(second.data.reception.id).toBe(first.data.reception.id);
      expect(await count("receptions_v2")).toBe(1);
      expect(await count("stock_lots")).toBe(1);
    });

    it("concurrent submissions of one key create exactly one reception", async () => {
      const payload = delivery();
      const results = await Promise.allSettled(Array.from({ length: 6 }, () => submit(payload)));

      expect(results.some((result) => result.status === "fulfilled")).toBe(true);
      for (const result of results) {
        if (result.status === "rejected") expect(result.reason).toMatchObject({ code: "IDEMPOTENT_IN_PROGRESS" });
      }
      expect(await count("receptions_v2")).toBe(1);
      expect(await count("reception_lots")).toBe(1);
      expect(await count("stock_lots")).toBe(1);
    });

    it("the unique index holds even past the idempotency gate", async () => {
      const payload = delivery();
      const results = await Promise.allSettled([
        receptionsService.intake(payload, operator),
        receptionsService.intake(payload, operator),
      ]);

      expect(results.some((result) => result.status === "fulfilled")).toBe(true);
      expect(await count("receptions_v2")).toBe(1);
      expect(await count("stock_lots")).toBe(1);
    });

    it("refuses the same key with different content and names what exists", async () => {
      const payload = delivery();
      const first = await submit(payload, "weights-a");

      await expect(submit({ ...payload, gross_weight_kg: 1200 }, "weights-b")).rejects.toMatchObject({
        code: "IDEMPOTENT_PAYLOAD_MISMATCH",
        details: { response: { reception: { id: first.data.reception.id } } },
      });
      expect(await count("receptions_v2")).toBe(1);
    });

    it("a retry after a crash takes over the stale command and completes once", async () => {
      const payload = delivery();
      await model("idempotency_commands").collection.insertOne({
        id: "stale", scope: "reception_intake", key: payload.client_request_id, status: "IN_PROGRESS",
        updated_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
      });

      const result = await submit(payload);

      expect(result.replayed).toBe(false);
      expect(await count("receptions_v2")).toBe(1);
    });

    it("a retry after a crash just past the commit returns the committed reception", async () => {
      const payload = delivery();
      const committed = await receptionsService.intake(payload, operator);
      await model("idempotency_commands").collection.insertOne({
        id: "stale-2", scope: "reception_intake", key: payload.client_request_id, status: "IN_PROGRESS",
        updated_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
      });

      const result = await submit(payload);

      expect(result.data.reception.id).toBe(committed.reception.id);
      expect(await count("receptions_v2")).toBe(1);
    });

    it("a fresh in-progress command is not taken over", async () => {
      const payload = delivery();
      await model("idempotency_commands").collection.insertOne({
        id: "fresh", scope: "reception_intake", key: payload.client_request_id, status: "IN_PROGRESS",
        updated_at: new Date().toISOString(),
      });

      await expect(submit(payload)).rejects.toMatchObject({ code: "IDEMPOTENT_IN_PROGRESS" });
      expect(await count("receptions_v2")).toBe(0);
    });
  });

  describe("concurrency", () => {
    it("deliveries at the same time all commit with distinct numbers", async () => {
      const results = await Promise.all(Array.from({ length: 5 }, () => receptionsService.intake(delivery(), operator)));
      const numbers = results.map((result) => result.reception.reception_number);
      const lotIds = results.map((result) => result.lots[0].lot_internal);

      expect(new Set(numbers).size).toBe(5);
      expect(new Set(lotIds).size).toBe(5);
    });

    it("two deliveries cannot over-receive one order line", async () => {
      await model("purchase_orders").create([{ id: "po-c", order_number: "PO-C", supplier_id: "sup-it", status: "confirmed" }]);
      await model("purchase_order_lines").create([{ id: "pol-c", order_id: "po-c", quantity: 1000, received_quantity: 0 }]);
      const order = { purchase_order_id: "po-c", purchase_order_line_id: "pol-c" };

      const results = await Promise.allSettled([
        receptionsService.intake(delivery({ ...order, gross_weight_kg: 800, tare_weight_kg: 100, lots: [{ lot_supplier: "A", quantity: 700 }] }), operator),
        receptionsService.intake(delivery({ ...order, gross_weight_kg: 800, tare_weight_kg: 100, lots: [{ lot_supplier: "B", quantity: 700 }] }), operator),
      ]);

      expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
      const line = await model("purchase_order_lines").findOne({ id: "pol-c" }).lean().exec();
      expect(line.received_quantity).toBe(700);
      expect(await count("receptions_v2")).toBe(1);
    });

    it("two receptions cannot consume one weighbridge reading", async () => {
      await model("weighbridge_readings").create([
        { id: "r-g", reading_key: "k-g", reading_id: "G1", device_code: "DEV", weight_kg: 1000, direction: "GROSS", stable: true, signature_verified: true, consumed: false },
        { id: "r-t", reading_key: "k-t", reading_id: "T1", device_code: "DEV", weight_kg: 100, direction: "TARE", stable: true, signature_verified: true, consumed: false },
      ]);
      const device = { gross_reading_id: "G1", tare_reading_id: "T1", weighing_source: undefined };

      const results = await Promise.allSettled([
        receptionsService.intake(delivery(device), operator),
        receptionsService.intake(delivery(device), operator),
      ]);

      const committed = results.filter((result) => result.status === "fulfilled");
      expect(committed).toHaveLength(1);
      expect(await count("receptions_v2", { weighing_source: "DEVICE", weighing_verified_device: true })).toBe(1);
      expect(await count("weighing_records", { source: "DEVICE", signature_verified: true })).toBe(2);
    });

    it("two employees on one draft: the stale confirmation is refused", async () => {
      const drafts = new ReceptionDraftsService();
      const payload = delivery();
      const id = String(payload.client_request_id);
      await drafts.save({ id, payload }, "op-a");
      await drafts.save({ id, version: 1, payload: { ...payload, gross_weight_kg: 1100 } }, "op-b");

      await expect(drafts.save({ id, version: 1, payload }, "op-a"))
        .rejects.toMatchObject({ code: "DRAFT_STALE" });
      await expect(receptionsService.intake({ ...payload, draft_version: 1 }, operator))
        .rejects.toMatchObject({ code: "DRAFT_STALE" });
      expect(await count("receptions_v2")).toBe(0);

      await receptionsService.intake({ ...payload, draft_version: 2 }, operator);
      expect(await drafts.get(id)).toMatchObject({ status: "CONFIRMED" });
    });
  });

  describe("QC handoff", () => {
    it("a double QC submit records one decision and a failure rolls the whole decision back", async () => {
      const { reception, lots } = await receptionsService.intake(delivery(), operator);
      const inspection = await receptionsService.startQcInspection({ reception_id: reception.id }, inspector);

      const real = lotLifecycleService.recordStageSafe.bind(lotLifecycleService);
      vi.spyOn(lotLifecycleService, "recordStageSafe").mockRejectedValueOnce(new Error("forced QC failure"));
      await expect(
        receptionsService.submitQcDecision({ inspectionId: String(inspection.id), decision: "ACCEPTE" }, inspector),
      ).rejects.toThrow(/forced QC failure/);

      const rolledBack = await model("reception_lots").findOne({ id: lots[0].id }).lean().exec();
      expect(rolledBack.stock_status).toBe("EN_QUARANTAINE");
      expect(await count("stock_lots", { status: "QUARANTINE" })).toBe(1);
      const open = await model("qc_inspections").findOne({ id: inspection.id }).lean().exec();
      expect(open.decision).toBeNull();

      vi.spyOn(lotLifecycleService, "recordStageSafe").mockImplementation(real);
      await Promise.all([
        receptionsService.submitQcDecision({ inspectionId: String(inspection.id), decision: "ACCEPTE" }, inspector),
        receptionsService.submitQcDecision({ inspectionId: String(inspection.id), decision: "ACCEPTE" }, inspector),
      ]);
      expect(await count("stock_lots", { status: "VALIDATED" })).toBe(1);
      const qcEvents = await count("lot_events", { lot_id: lots[0].id, event_type: "QC_DECIDED" });
      expect(qcEvents).toBe(1);
    });
  });

  it("a cancellation failure leaves stock and the order untouched", async () => {
    await model("purchase_orders").create([{ id: "po-x", order_number: "PO-X", supplier_id: "sup-it", status: "confirmed" }]);
    await model("purchase_order_lines").create([{ id: "pol-x", order_id: "po-x", quantity: 2000, received_quantity: 0 }]);
    const { reception, lots } = await receptionsService.intake(
      delivery({ purchase_order_id: "po-x", purchase_order_line_id: "pol-x" }),
      operator,
    );
    vi.spyOn(purchaseOrderDomain, "reversePurchaseOrderReception").mockRejectedValue(new Error("forced cancel failure"));

    await expect(receptionsService.cancelReception(String(reception.id), { reason: "BL erroné" }, operator))
      .rejects.toThrow(/forced cancel failure/);

    const stock = await model("stock_lots").findOne({ reception_lot_id: lots[0].id }).lean().exec();
    expect(stock.current_quantity).toBe(900);
    expect(await count("receptions_v2", { status: "EN_ATTENTE_QC" })).toBe(1);
  });

  describe("quality decisions cannot be written around the QC workflow", () => {
    const cs = new CollectionsService();
    const stockRoutes = new StockController(cs);
    const stageRoutes = new TrustController(
      undefined as never, lotLifecycleService, undefined as never, undefined as never, undefined as never,
    );
    const warehouse = { auth: { user: { id: "wh-it" } } };

    const quarantinedLot = async () => {
      const { reception, lots } = await receptionsService.intake(delivery(), operator);
      const stock = await model("stock_lots").findOne({ reception_lot_id: lots[0].id }).lean().exec();
      return { reception, receptionLot: lots[0], stockId: String(stock.id) };
    };

    const decided = async (decisionFields: Record<string, unknown> = {}) => {
      const { reception, receptionLot } = await quarantinedLot();
      const inspection = await receptionsService.startQcInspection({ reception_id: reception.id }, inspector);
      await receptionsService.submitQcDecision({
        inspectionId: String(inspection.id), decision: "QUARANTAINE", labSampleRequired: true, ...decisionFields,
      }, inspector);
      return { inspectionId: String(inspection.id), reception, receptionLot };
    };

    const labResult = { analysis_type: "Aflatoxines", result_value: "1.2", threshold: null, conformant: true, notes: null };

    it("a stock route cannot release a quarantined lot", async () => {
      const { stockId } = await quarantinedLot();
      await expect(stockRoutes.updateLot(warehouse, stockId, { status: "VALIDATED" }))
        .rejects.toMatchObject({ code: "STOCK_LOT_DOMAIN_ONLY" });
      expect((await model("stock_lots").findOne({ id: stockId }).lean().exec()).status).toBe("QUARANTINE");
    });

    it("a stock route cannot change a lot's quantity or its link to the reception lot", async () => {
      const { stockId } = await quarantinedLot();
      for (const change of [{ current_quantity: 5000 }, { initial_quantity: 5000 }, { reception_lot_id: "other" }]) {
        await expect(stockRoutes.updateLot(warehouse, stockId, change))
          .rejects.toMatchObject({ code: "STOCK_LOT_DOMAIN_ONLY" });
      }
      expect((await model("stock_lots").findOne({ id: stockId }).lean().exec()).current_quantity).toBe(900);
    });

    it("a stock route can still place a lot", async () => {
      const { stockId } = await quarantinedLot();
      const { data } = await stockRoutes.updateLot(warehouse, stockId, { position: "A-12" });
      expect(data.position).toBe("A-12");
    });

    it("a stock route cannot create a released lot", async () => {
      await expect(stockRoutes.createLot(warehouse, { lot_number: "X", status: "VALIDATED", current_quantity: 5000 }))
        .rejects.toMatchObject({ code: "STOCK_LOT_DOMAIN_ONLY" });
      expect(await count("stock_lots")).toBe(0);
    });

    it("a stock route cannot attach a new lot to a reception lot", async () => {
      await expect(stockRoutes.createLot(warehouse, { lot_number: "X", reception_lot_id: "rl-1" }))
        .rejects.toMatchObject({ code: "STOCK_LOT_DOMAIN_ONLY" });
    });

    it("the QC decision still releases stock", async () => {
      const { reception, stockId } = await quarantinedLot();
      const inspection = await receptionsService.startQcInspection({ reception_id: reception.id }, inspector);
      await receptionsService.submitQcDecision({ inspectionId: String(inspection.id), decision: "ACCEPTE" }, inspector);
      expect((await model("stock_lots").findOne({ id: stockId }).lean().exec()).status).toBe("VALIDATED");
    });

    it("an inspection has no general edit route", async () => {
      const { inspectionId } = await decided({ comment: "original" });
      expect("updateQcInspection" in ReceptionsExtController.prototype).toBe(false);
      await expect(cs.update({
        table: "qc_inspections",
        filters: [{ type: "eq", column: "id", value: inspectionId }],
        values: { comment: "rewritten" },
      })).rejects.toThrow(/trusted domain service/);
      expect((await model("qc_inspections").findOne({ id: inspectionId }).lean().exec()).comment).toBe("original");
    });

    it("lab results append, are stamped by the server and leave the decision alone", async () => {
      const { inspectionId } = await decided({ comment: "original" });
      await receptionsService.recordLabResults(inspectionId, { results: [labResult] }, inspector);
      await receptionsService.recordLabResults(inspectionId, {
        results: [{ ...labResult, analysis_type: "Pesticides", entered_by: "someone else", entered_at: "2001-01-01" }],
        decision: "ACCEPTE",
        comment: "rewritten",
      } as never, inspector);

      const row = await model("qc_inspections").findOne({ id: inspectionId }).lean().exec();
      expect(row.lab_analysis_results.map((entry: { analysis_type: string }) => entry.analysis_type))
        .toEqual(["Aflatoxines", "Pesticides"]);
      expect(row.lab_analysis_results[1].entered_by).toBe(inspector.id);
      expect(row.lab_analysis_results[1].entered_at).not.toBe("2001-01-01");
      expect(row.decision).toBe("QUARANTAINE");
      expect(row.comment).toBe("original");
    });

    it("each lab submission leaves an audit row", async () => {
      const { inspectionId } = await decided();
      await receptionsService.recordLabResults(inspectionId, { results: [labResult] }, inspector);
      expect(await count("reception_audit_logs_v2", { entity_id: inspectionId, action: "LAB_RESULTS_RECORDED" })).toBe(1);
    });

    it("lab results are refused where no sample was requested or the entry is incomplete", async () => {
      const { inspectionId } = await decided({ labSampleRequired: false });
      await expect(receptionsService.recordLabResults(inspectionId, { results: [labResult] }, inspector))
        .rejects.toMatchObject({ code: "LAB_SAMPLE_NOT_REQUESTED" });

      const sampled = await decided();
      for (const results of [[], [{ ...labResult, result_value: " " }], [{ ...labResult, conformant: "yes" }]]) {
        await expect(receptionsService.recordLabResults(sampled.inspectionId, { results }, inspector))
          .rejects.toMatchObject({ code: "LAB_RESULTS_INVALID" });
      }
    });

    it("production refuses a lot released on one side only", async () => {
      const { receptionLot, stockId } = await quarantinedLot();
      await model("stock_lots").updateOne({ id: stockId }, { $set: { status: "VALIDATED" } }).exec();
      for (const id of [stockId, receptionLot.id]) {
        await expect(gateRulesService.assertProductionOrderWritable({ status: "RELEASED", input_lot_ids: [id] }))
          .rejects.toMatchObject({ code: "PRODUCTION_LOT_NOT_RELEASED" });
      }

      await model("stock_lots").updateOne({ id: stockId }, { $set: { status: "BLOCKED" } }).exec();
      await model("reception_lots").updateOne({ id: receptionLot.id }, { $set: { stock_status: "STOCK_LIBERE" } }).exec();
      for (const id of [stockId, receptionLot.id]) {
        await expect(gateRulesService.assertProductionOrderWritable({ status: "RELEASED", input_lot_ids: [id] }))
          .rejects.toMatchObject({ code: "PRODUCTION_LOT_NOT_RELEASED" });
      }
    });

    it("production accepts a lot released by QC, by either id", async () => {
      const { reception, receptionLot, stockId } = await quarantinedLot();
      const inspection = await receptionsService.startQcInspection({ reception_id: reception.id }, inspector);
      await receptionsService.submitQcDecision({ inspectionId: String(inspection.id), decision: "ACCEPTE" }, inspector);
      for (const id of [stockId, receptionLot.id]) {
        await expect(gateRulesService.assertProductionOrderWritable({ status: "RELEASED", input_lot_ids: [id] }))
          .resolves.toBeUndefined();
      }
    });

    it("the stage override cannot record a QC outcome", async () => {
      const { receptionLot } = await quarantinedLot();
      for (const toStage of ["QC_DECIDED", "REJECTED", "qc_decided"]) {
        await expect(stageRoutes.advance(String(receptionLot.id), { toStage } as never, warehouse))
          .rejects.toMatchObject({ code: "STAGE_DOMAIN_ONLY" });
      }
      expect(await count("lot_events", { lot_id: receptionLot.id, event_type: "QC_DECIDED" })).toBe(0);
    });

    it("the stage override still records operational stages", async () => {
      const { reception, receptionLot } = await quarantinedLot();
      const inspection = await receptionsService.startQcInspection({ reception_id: reception.id }, inspector);
      await receptionsService.submitQcDecision({ inspectionId: String(inspection.id), decision: "ACCEPTE" }, inspector);
      await stageRoutes.advance(String(receptionLot.id), { toStage: "COLD_STORE", payload: {} } as never, warehouse);
      expect(await count("lot_events", { lot_id: receptionLot.id, event_type: "STOCK_MOVED" })).toBe(1);
    });
  });
});
