import { beforeEach, describe, expect, it, vi } from "vitest";

import { createInMemoryModel, type TestRow } from "../../test/in-memory-collection.js";

/**
 * End-to-end reception scenarios: intake → purchase order → QC → stock →
 * cancellation, against in-memory collections with the real stock projection
 * and purchase-order domain.
 */

const store: Record<string, TestRow[]> = {};
const syncControl = vi.hoisted(() => ({ failNext: false }));
let sequence = 0;

vi.mock("../../db/dynamic-model.js", () => ({
  sanitizeDocument: <T>(value: T) => value,
  getCollectionModel: (collection: string) => createInMemoryModel(collection, store),
}));

vi.mock("../../db/defaults.js", () => ({
  prepareInsertDocument: vi.fn(async (collection: string, value: TestRow) => {
    sequence += 1;
    const generated: TestRow = {};
    if (collection === "receptions_v2") generated.reception_number = `REC-${sequence}`;
    if (collection === "reception_lots") generated.lot_internal = `LOT-${sequence}`;
    if (collection === "qc_inspections") generated.inspection_number = `QC-${sequence}`;
    return {
      id: `${collection}-${sequence}`,
      created_at: new Date(Date.UTC(2026, 9, 1, 0, 0, sequence)).toISOString(),
      updated_at: new Date(Date.UTC(2026, 9, 1, 0, 0, sequence)).toISOString(),
      ...value,
      ...generated,
    };
  }),
}));

vi.mock("../notifications/notification-emitter.js", () => ({
  emitNotification: vi.fn(async () => null),
}));

vi.mock("./reception-stock-sync.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./reception-stock-sync.js")>();
  return {
    ...actual,
    syncReceptionLotsToStock: vi.fn(async (...args: Parameters<typeof actual.syncReceptionLotsToStock>) => {
      if (syncControl.failNext) {
        syncControl.failNext = false;
        throw new Error("stock database unavailable");
      }
      return actual.syncReceptionLotsToStock(...args);
    }),
  };
});

const { receptionsService } = await import("./receptions.service.js");
const { collectionsService } = await import("../collections/collections.service.js");
const { ReceptionsExtController } = await import("../receptions-ext/receptions-ext.controller.js");
const extController = new ReceptionsExtController(collectionsService, receptionsService);
const { PurchasingService } = await import("../purchasing/purchasing.service.js");
const purchasingService = new PurchasingService();

const operator = { id: "op-1", user_metadata: { roles: ["operateur_reception"] } };
const inspector = { id: "qc-1", user_metadata: { roles: ["responsable_qualite"] } };

const rows = (collection: string) => store[collection] || [];
const one = (collection: string, id: unknown) => rows(collection).find((row) => row.id === id) as TestRow;
const stockFor = (lotId: unknown) => rows("stock_lots").find((row) => row.reception_lot_id === lotId) as TestRow;

const seed = () => {
  store.suppliers = [
    { id: "sup-1", code: "SUP-1", name: "Coopérative Oasis", supplier_status: "active" },
    { id: "sup-blocked", code: "SUP-B", name: "Fournisseur bloqué", supplier_status: "blocked" },
    { id: "sup-2", code: "SUP-2", name: "Autre fournisseur", supplier_status: "active" },
  ];
  store.purchase_orders = [
    { id: "po-1", order_number: "BC-1", supplier_id: "sup-1", status: "confirmed", invoice_status: "not_invoiced" },
  ];
  store.purchase_order_lines = [
    {
      id: "pol-1", order_id: "po-1", line_number: 1, quantity: 1000, confirmed_quantity: 1000,
      received_quantity: 0, accepted_quantity: 0, rejected_quantity: 0, invoiced_quantity: 0,
      over_delivery_tolerance_pct: 0, line_status: "open",
    },
  ];
};

/** Gross 1000.3 − tare 100.1 = 900.2 kg: catches float drift (900.1999…). */
const intakePayload = (overrides: TestRow = {}) => ({
  supplier_id: "sup-1",
  reception_type: "DATTE",
  unit: "kg",
  gross_weight_kg: 1000.3,
  tare_weight_kg: 100.1,
  unit_count: 1,
  lots: [{ lot_supplier: "LS-1", quantity: 900.2 }],
  ...overrides,
});

const deliveryOf = (kg: number, overrides: TestRow = {}) =>
  intakePayload({ gross_weight_kg: kg + 100, tare_weight_kg: 100, lots: [{ lot_supplier: `LS-${kg}`, quantity: kg }], ...overrides });

const inspect = async (receptionId: string, decision: string, extra: TestRow = {}) => {
  const inspection = await receptionsService.startQcInspection({ reception_id: receptionId }, inspector as any);
  return receptionsService.submitQcDecision(
    { inspectionId: String(inspection.id), decision, qualitySummary: { grade: "EXTRA", score: 92 }, ...extra },
    inspector as any,
  );
};

describe("reception lifecycle", () => {
  beforeEach(() => {
    vi.stubEnv("NUMERIC_SIGNATURE_GATE", "off");
    vi.stubEnv("TRUST_SCAN_GATE", "off");
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    Object.keys(store).forEach((key) => delete store[key]);
    sequence = 0;
    syncControl.failNext = false;
    seed();
  });

  describe("registration", () => {
    it("persists a valid intake in quarantine with an exact net weight", async () => {
      const { reception, lots } = await receptionsService.intake(intakePayload(), operator);

      expect(reception.status).toBe("EN_ATTENTE_QC");
      expect(reception.quantity_total).toBe(900.2);
      expect(lots).toHaveLength(1);
      expect(lots[0].stock_status).toBe("EN_QUARANTAINE");
      const stock = stockFor(lots[0].id);
      expect(stock.status).toBe("QUARANTINE");
      expect(stock.current_quantity).toBe(900.2);
    });

    it("ignores state and identifiers chosen by the client", async () => {
      const { reception, lots } = await receptionsService.intake(
        intakePayload({
          status: "LIBERE",
          qc_decision: "ACCEPTE",
          reception_number: "HACK-1",
          lots: [{ lot_supplier: "LS-1", quantity: 900.2, stock_status: "STOCK_LIBERE", lot_internal: "LOT-HACK" }],
        }),
        operator,
      );

      expect(reception.status).toBe("EN_ATTENTE_QC");
      expect(reception.qc_decision).toBeUndefined();
      expect(reception.reception_number).not.toBe("HACK-1");
      expect(lots[0].stock_status).toBe("EN_QUARANTAINE");
      expect(lots[0].lot_internal).not.toBe("LOT-HACK");
      expect(stockFor(lots[0].id).status).toBe("QUARANTINE");
    });

    it.each([
      ["missing supplier", { supplier_id: "" }, "SUPPLIER_REQUIRED"],
      ["no lot", { lots: [] }, "LOTS_REQUIRED"],
      ["non-numeric lot quantity", { lots: [{ lot_supplier: "A", quantity: "abc" }] }, "INVALID_LOT_QUANTITY"],
      ["tare above gross", { gross_weight_kg: 100, tare_weight_kg: 200 }, "NET_WEIGHT_NOT_POSITIVE"],
      ["lots not matching the net weight", { lots: [{ lot_supplier: "A", quantity: 800 }] }, "LOT_QUANTITY_MISMATCH"],
      ["total not matching the lots", { quantity_total: 950 }, "QUANTITY_TOTAL_MISMATCH"],
      ["blocked supplier", { supplier_id: "sup-blocked" }, "SUPPLIER_BLOCKED"],
    ])("refuses an intake with %s and writes nothing", async (_label, overrides, code) => {
      await expect(receptionsService.intake(intakePayload(overrides), operator)).rejects.toMatchObject({ code });
      expect(rows("receptions_v2")).toHaveLength(0);
      expect(rows("stock_lots")).toHaveLength(0);
    });

    it("returns the first reception when the same request is replayed", async () => {
      const payload = deliveryOf(400, { client_request_id: "req-1", purchase_order_id: "po-1" });
      const first = await receptionsService.intake(payload, operator);
      const second = await receptionsService.intake(payload, operator);

      expect(second.reception.id).toBe(first.reception.id);
      expect(rows("receptions_v2")).toHaveLength(1);
      expect(rows("stock_lots")).toHaveLength(1);
      expect(one("purchase_order_lines", "pol-1").received_quantity).toBe(400);
    });
  });

  describe("purchase order receiving", () => {
    it("tracks partial and multiple deliveries without overcounting", async () => {
      const first = await receptionsService.intake(deliveryOf(400, { purchase_order_id: "po-1" }), operator);
      expect(first.reception.purchase_order_number).toBe("BC-1");
      expect(one("purchase_order_lines", "pol-1")).toMatchObject({ received_quantity: 400, line_status: "partially_delivered" });
      expect(one("purchase_orders", "po-1").status).toBe("partially_delivered");

      await receptionsService.intake(deliveryOf(600, { purchase_order_id: "po-1" }), operator);
      expect(one("purchase_order_lines", "pol-1")).toMatchObject({ received_quantity: 1000, line_status: "delivered" });
      expect(one("purchase_orders", "po-1")).toMatchObject({ status: "delivered", goods_receipt_count: 2 });
    });

    it("refuses an over-receipt before writing a reception, lot or stock", async () => {
      await receptionsService.intake(deliveryOf(900, { purchase_order_id: "po-1" }), operator);

      await expect(
        receptionsService.intake(deliveryOf(150, { purchase_order_id: "po-1" }), operator),
      ).rejects.toMatchObject({ code: "OVERDELIVERY_TOLERANCE_EXCEEDED", details: { remaining_quantity: 100 } });
      expect(rows("receptions_v2")).toHaveLength(1);
      expect(rows("stock_lots")).toHaveLength(1);
      expect(one("purchase_order_lines", "pol-1").received_quantity).toBe(900);

      // A fully delivered order is closed for receipt.
      await receptionsService.intake(deliveryOf(100, { purchase_order_id: "po-1" }), operator);
      await expect(
        receptionsService.intake(deliveryOf(1, { purchase_order_id: "po-1" }), operator),
      ).rejects.toMatchObject({ code: "PURCHASE_ORDER_NOT_RECEIVABLE" });
    });

    it("a line received at Réceptions cannot also be received directly from the order", async () => {
      await receptionsService.intake(deliveryOf(400, { purchase_order_id: "po-1" }), operator);

      await expect(
        purchasingService.receiveOrderLine("po-1", { lineId: "pol-1", receivedNow: 400, supplierLot: "LS-400", qcStatus: "accepted" }),
      ).rejects.toMatchObject({ code: "LINE_RECEIVED_BY_RECEPTION" });
      expect(one("purchase_order_lines", "pol-1")).toMatchObject({ received_quantity: 400, accepted_quantity: 0 });
    });

    it("refuses an order that belongs to another supplier", async () => {
      await expect(
        receptionsService.intake(deliveryOf(400, { supplier_id: "sup-2", purchase_order_id: "po-1" }), operator),
      ).rejects.toMatchObject({ code: "PURCHASE_ORDER_SUPPLIER_MISMATCH" });
      expect(rows("receptions_v2")).toHaveLength(0);
    });
  });

  describe("quality decision", () => {
    it("accepting releases the stock and the purchase order quantity", async () => {
      const { reception, lots } = await receptionsService.intake(deliveryOf(400, { purchase_order_id: "po-1" }), operator);
      await inspect(String(reception.id), "ACCEPTE");

      expect(one("receptions_v2", reception.id)).toMatchObject({ status: "LIBERE", qc_decision: "ACCEPTE" });
      expect(one("reception_lots", lots[0].id).stock_status).toBe("STOCK_LIBERE");
      expect(stockFor(lots[0].id).status).toBe("VALIDATED");
      expect(one("purchase_order_lines", "pol-1")).toMatchObject({ accepted_quantity: 400, rejected_quantity: 0 });
    });

    it("rejecting keeps the material out of available stock and out of release zones", async () => {
      const { reception, lots } = await receptionsService.intake(deliveryOf(400, { purchase_order_id: "po-1" }), operator);
      await inspect(String(reception.id), "REJETE", { comment: "moisissure" });

      expect(one("receptions_v2", reception.id).status).toBe("REJETE");
      expect(stockFor(lots[0].id).status).toBe("BLOCKED");
      expect(one("purchase_order_lines", "pol-1")).toMatchObject({ accepted_quantity: 0, rejected_quantity: 400 });
      await expect(
        receptionsService.moveReceptionLotToStorage({ lotId: String(lots[0].id), targetZone: "CF-01" }, operator),
      ).rejects.toMatchObject({ code: "LOT_REJECTED" });
    });

    it("refuses an unknown decision value", async () => {
      const { reception } = await receptionsService.intake(intakePayload(), operator);
      await expect(inspect(String(reception.id), "accepted")).rejects.toMatchObject({ code: "INVALID_QC_DECISION" });
      expect(one("receptions_v2", reception.id).status).toBe("EN_QC");
    });

    it("records a double submit once and refuses a conflicting second decision", async () => {
      const { reception } = await receptionsService.intake(intakePayload(), operator);
      const inspection = await receptionsService.startQcInspection({ reception_id: reception.id }, inspector as any);
      const submit = (decision: string) =>
        receptionsService.submitQcDecision(
          {
            inspectionId: String(inspection.id),
            decision,
            checkResults: [{ check_code: "HUM", check_name: "Humidité", result: "CONFORME", measured_value: "22" }],
          },
          inspector as any,
        );

      await Promise.all([submit("ACCEPTE"), submit("ACCEPTE")]);
      expect(rows("qc_check_results")).toHaveLength(1);
      await expect(submit("REJETE")).rejects.toMatchObject({ code: "QC_ALREADY_DECIDED" });
      expect(one("receptions_v2", reception.id).status).toBe("LIBERE");
      expect(rows("qc_check_results")).toHaveLength(1);
    });

    it("reuses the open inspection and refuses to reopen QC on a closed reception", async () => {
      const { reception } = await receptionsService.intake(intakePayload(), operator);
      const first = await receptionsService.startQcInspection({ reception_id: reception.id }, inspector as any);
      const second = await receptionsService.startQcInspection({ reception_id: reception.id }, inspector as any);
      expect(second.id).toBe(first.id);
      expect(rows("qc_inspections")).toHaveLength(1);

      await receptionsService.submitQcDecision({ inspectionId: String(first.id), decision: "ACCEPTE" }, inspector as any);
      await expect(
        receptionsService.startQcInspection({ reception_id: reception.id }, inspector as any),
      ).rejects.toMatchObject({ code: "RECEPTION_NOT_INSPECTABLE" });
      expect(one("receptions_v2", reception.id).status).toBe("LIBERE");
    });

    it("completes a decision on retry after the stock sync failed", async () => {
      const { reception, lots } = await receptionsService.intake(intakePayload(), operator);
      const inspection = await receptionsService.startQcInspection({ reception_id: reception.id }, inspector as any);

      syncControl.failNext = true;
      await expect(
        receptionsService.submitQcDecision({ inspectionId: String(inspection.id), decision: "ACCEPTE" }, inspector as any),
      ).rejects.toThrow(/Renvoyez la décision QC/);
      expect(one("receptions_v2", reception.id).status).toBe("EN_QC");

      await receptionsService.submitQcDecision({ inspectionId: String(inspection.id), decision: "ACCEPTE" }, inspector as any);
      expect(one("receptions_v2", reception.id).status).toBe("LIBERE");
      expect(stockFor(lots[0].id).status).toBe("VALIDATED");
    });
  });

  describe("lot-level quality and storage", () => {
    it("a storage move cannot release a lot QC has not released", async () => {
      const { reception, lots } = await receptionsService.intake(intakePayload(), operator);
      const lotId = String(lots[0].id);

      await expect(
        receptionsService.moveReceptionLotToStorage({ lotId, targetZone: "CF-01" }, operator),
      ).rejects.toMatchObject({ code: "QC_RELEASE_REQUIRED" });
      expect(stockFor(lotId).status).toBe("QUARANTINE");

      await inspect(String(reception.id), "ACCEPTE");
      await receptionsService.moveReceptionLotToStorage({ lotId, targetZone: "CF-01" }, { id: "wms-1" });
      expect(one("reception_lots", lotId)).toMatchObject({ stock_status: "STOCK_LIBERE", released_by: "qc-1" });
    });

    it("partial acceptance: only the released lot becomes available and the PO reconciles", async () => {
      const { reception, lots } = await receptionsService.intake(
        intakePayload({
          gross_weight_kg: 1100, tare_weight_kg: 100, purchase_order_id: "po-1",
          lots: [{ lot_supplier: "A", quantity: 600 }, { lot_supplier: "B", quantity: 400 }],
        }),
        operator,
      );
      const [lotA, lotB] = lots.map((lot) => String(lot.id));

      await expect(
        receptionsService.changeLotQualityStatus(lotA, { action: "RELEASE" }, inspector as any),
      ).rejects.toMatchObject({ code: "QC_INSPECTION_REQUIRED" });

      await inspect(String(reception.id), "QUARANTAINE", { comment: "humidité à confirmer" });
      expect(one("receptions_v2", reception.id).status).toBe("BLOQUE");
      expect(one("purchase_orders", "po-1").status).toBe("on_hold");

      await receptionsService.changeLotQualityStatus(lotA, { action: "RELEASE", reason: "labo conforme" }, inspector as any);
      expect(stockFor(lotA).status).toBe("VALIDATED");
      expect(stockFor(lotB).status).toBe("QUARANTINE");
      expect(one("receptions_v2", reception.id).status).toBe("BLOQUE");
      expect(one("purchase_order_lines", "pol-1")).toMatchObject({ received_quantity: 1000, accepted_quantity: 600 });

      const available = rows("stock_lots")
        .filter((row) => row.status === "VALIDATED")
        .reduce((sum, row) => sum + Number(row.current_quantity), 0);
      expect(available).toBe(600);
    });

    it("putting a released lot back in quarantine needs a reason and blocks its stock", async () => {
      const { reception, lots } = await receptionsService.intake(intakePayload(), operator);
      const lotId = String(lots[0].id);
      await inspect(String(reception.id), "ACCEPTE");

      await expect(
        receptionsService.changeLotQualityStatus(lotId, { action: "QUARANTINE" }, inspector as any),
      ).rejects.toMatchObject({ code: "QUARANTINE_REASON_REQUIRED" });
      await receptionsService.changeLotQualityStatus(lotId, { action: "QUARANTINE", reason: "suspicion infestation" }, inspector as any);

      expect(stockFor(lotId).status).toBe("QUARANTINE");
      expect(one("receptions_v2", reception.id).status).toBe("BLOQUE");
      expect(rows("reception_audit_logs_v2").some((log) => log.action === "LOT_QUARANTINED")).toBe(true);
    });

    it("a non-conforming lab result blocks released stock (RG-Q07)", async () => {
      const { reception, lots } = await receptionsService.intake(intakePayload(), operator);
      await inspect(String(reception.id), "ACCEPTE");

      await receptionsService.blockReceptionForLab(String(reception.id), { reason: "aflatoxines > seuil" }, inspector as any);

      expect(one("reception_lots", lots[0].id).stock_status).toBe("EN_QUARANTAINE");
      expect(stockFor(lots[0].id).status).toBe("QUARANTINE");
      expect(one("receptions_v2", reception.id)).toMatchObject({ status: "BLOQUE", qc_decision: "QUARANTAINE" });
    });
  });

  describe("cancellation and corrections", () => {
    it("cancelling reverses stock and the purchase order without deleting history", async () => {
      const { reception, lots } = await receptionsService.intake(deliveryOf(400, { purchase_order_id: "po-1" }), operator);
      const receptionId = String(reception.id);

      await expect(receptionsService.cancelReception(receptionId, {}, operator)).rejects.toMatchObject({
        code: "CANCELLATION_REASON_REQUIRED",
      });
      await receptionsService.cancelReception(receptionId, { reason: "erreur de fournisseur" }, operator);
      await receptionsService.cancelReception(receptionId, { reason: "erreur de fournisseur" }, operator);

      expect(one("receptions_v2", receptionId)).toMatchObject({ status: "ANNULE", cancellation_reason: "erreur de fournisseur" });
      expect(one("reception_lots", lots[0].id).stock_status).toBe("STOCK_REJETE");
      expect(stockFor(lots[0].id)).toMatchObject({ status: "BLOCKED", current_quantity: 0, initial_quantity: 400 });
      expect(rows("stock_movements")).toEqual([
        expect.objectContaining({ movement_type: "AJUSTEMENT", adjustment_direction: "OUT", quantity: 400 }),
      ]);
      expect(rows("purchase_order_receiving_lots")).toEqual([expect.objectContaining({ qc_outcome: "cancelled" })]);
      expect(one("purchase_order_lines", "pol-1")).toMatchObject({ received_quantity: 0, line_status: "open" });
      expect(one("purchase_orders", "po-1")).toMatchObject({ status: "confirmed", goods_receipt_count: 0 });

      // The order is open again for the full quantity.
      await receptionsService.intake(deliveryOf(1000, { purchase_order_id: "po-1" }), operator);
      expect(one("purchase_order_lines", "pol-1").received_quantity).toBe(1000);
    });

    it("refuses to cancel after a QC decision or once stock has moved", async () => {
      const decided = await receptionsService.intake(intakePayload(), operator);
      await inspect(String(decided.reception.id), "ACCEPTE");
      await expect(
        receptionsService.cancelReception(String(decided.reception.id), { reason: "trop tard" }, operator),
      ).rejects.toMatchObject({ code: "RECEPTION_NOT_CANCELLABLE" });

      const consumed = await receptionsService.intake(intakePayload(), operator);
      stockFor(consumed.lots[0].id).current_quantity = 500;
      await expect(
        receptionsService.cancelReception(String(consumed.reception.id), { reason: "erreur" }, operator),
      ).rejects.toMatchObject({ code: "RECEPTION_STOCK_CONSUMED" });
      expect(one("receptions_v2", consumed.reception.id).status).toBe("EN_ATTENTE_QC");
    });

    it("re-weighing amends a released lot without reopening QC and validates the net first", async () => {
      const { reception, lots } = await receptionsService.intake(intakePayload(), operator);
      const lotId = String(lots[0].id);
      await inspect(String(reception.id), "ACCEPTE");

      await receptionsService.recordWeighing(lotId, { type: "GROSS", weight_kg: 1000, manual_reason: "contrôle" }, operator);
      await receptionsService.recordWeighing(lotId, { type: "TARE", weight_kg: 99.9, manual_reason: "contrôle" }, operator);
      expect(one("reception_lots", lotId).net_weight_kg).toBe(900.1);
      expect(one("receptions_v2", reception.id).status).toBe("LIBERE");

      await expect(
        receptionsService.recordWeighing(lotId, { type: "TARE", weight_kg: 2000 }, operator),
      ).rejects.toMatchObject({ code: "NET_WEIGHT_NOT_POSITIVE" });
      expect(rows("weighing_records")).toHaveLength(2);
    });

    it("a draft goes to QC only once it has a supplier and a weighed lot", async () => {
      store.receptions_v2 = [{ id: "draft-1", reception_number: "REC-D1", status: "BROUILLON", supplier_id: null }];
      const req = { auth: { user: operator } };

      await expect(
        extController.updateReceptionStatus("draft-1", req, { status: "EN_ATTENTE_QC" }),
      ).rejects.toMatchObject({ code: "RECEPTION_INCOMPLETE", details: { missing: ["fournisseur", "au moins un lot avec une quantité"] } });
      expect(one("receptions_v2", "draft-1").status).toBe("BROUILLON");

      one("receptions_v2", "draft-1").supplier_id = "sup-1";
      store.reception_lots = [{ id: "draft-lot", reception_id: "draft-1", quantity: 250, stock_status: "EN_QUARANTAINE" }];
      const { data } = await extController.updateReceptionStatus("draft-1", req, { status: "EN_ATTENTE_QC" });
      expect(data).toMatchObject({ status: "EN_ATTENTE_QC", validated_by: "op-1" });
      expect(rows("reception_audit_logs_v2")).toEqual([
        expect.objectContaining({ action: "STATUS_CHANGE", previous_state: { status: "BROUILLON" }, new_state: { status: "EN_ATTENTE_QC" } }),
      ]);
    });

    it("the audit trail names who acted, never a raw user id", async () => {
      store.profiles = [{ id: "p-1", user_id: "op-1", full_name: "Sami Ben Ali" }];
      const { reception } = await receptionsService.intake(intakePayload(), operator);
      await receptionsService.cancelReception(String(reception.id), { reason: "BL erroné" }, operator);

      const logs = await receptionsService.listReceptionAuditLogs(String(reception.id));
      expect(logs).toEqual([expect.objectContaining({ action: "CANCELLED", performed_by: "op-1", performed_by_name: "Sami Ben Ali" })]);
    });

    it("generic database writes cannot change QC or reception status", async () => {
      const { reception, lots } = await receptionsService.intake(intakePayload(), operator);

      await expect(
        collectionsService.update({
          table: "reception_lots",
          filters: [{ type: "eq", column: "id", value: lots[0].id }],
          values: { stock_status: "STOCK_LIBERE" },
        }),
      ).rejects.toMatchObject({ code: "QUALITY_STATUS_DOMAIN_ONLY" });
      await expect(
        collectionsService.update({
          table: "receptions_v2",
          filters: [{ type: "eq", column: "id", value: reception.id }],
          values: { status: "LIBERE" },
        }),
      ).rejects.toMatchObject({ code: "RECEPTION_STATUS_DOMAIN_ONLY" });
      expect(stockFor(lots[0].id).status).toBe("QUARANTINE");

      const { after } = await collectionsService.update({
        table: "reception_lots",
        filters: [{ type: "eq", column: "id", value: lots[0].id }],
        values: { origin_farm: "Oasis Nefta" },
      });
      expect(after[0]).toMatchObject({ origin_farm: "Oasis Nefta", stock_status: "EN_QUARANTAINE" });
    });
  });
});
