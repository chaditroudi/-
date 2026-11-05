// @vitest-environment node
/**
 * Gate 4 A–Z acceptance: real authenticated native HTTP and a disposable replica set.
 * Build server first. Only account/settings/published checklist fixtures are inserted;
 * every supplier, purchase, reception, QC and manufacturing outcome uses its native API.
 * This synthetic factory explicitly selects GENERIC at intake: its control plan uses
 * post-triage hydration rather than premium whole's pre-triage fumigation requirement.
 * It does not establish premium-route CCP or physical factory/hardware acceptance.
 * APP_ENV=test GATE4_IT_MONGO_URI=mongodb://127.0.0.1:27441/?replicaSet=gate4rs
 */
import "reflect-metadata";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { AuthUserModel } from "../models/auth-user.model.js";
import { factoryConnection, runWithFactory } from "./factory-context.js";
import { getCollectionModel } from "./dynamic-model.js";
import { ensureTrustIndexes } from "./indexes.js";

const uri = process.env.GATE4_IT_MONGO_URI;
const DB = "gate4_journey_it";
const A = { tenant_id: "gate4-journey-company-a", factory_id: "acceptance-site" };
const B = { tenant_id: "gate4-journey-company-b", factory_id: "acceptance-site" };
const PASSWORD = "Gate4-local-acceptance-password-1";
const PIN = "482915";
const tokens: Record<string, string> = {};
let app: any;
let base = "";
let safeToClean = false;
const rows = (name: string, filter: Record<string, unknown> = {}, scope = A): Promise<any[]> =>
  runWithFactory(scope, () => getCollectionModel(name).find(filter).lean().exec()) as Promise<any[]>;
const one = async (name: string, filter: Record<string, unknown>) => {
  const found = await rows(name, filter);
  expect(found, `${name} ${JSON.stringify(filter)}`).toHaveLength(1);
  return found[0];
};
const http = async (method: string, path: string, actor = "admin", body?: unknown) => {
  const response = await fetch(`${base}/api${path}`, {
    method, signal: AbortSignal.timeout(20_000),
    headers: { "Content-Type": "application/json", ...(tokens[actor] ? { Authorization: `Bearer ${tokens[actor]}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await response.json() as any;
  return { status: response.status, data: payload.data, error: payload.error, replayed: payload.replayed };
};
const ok = async (method: string, path: string, actor = "admin", body?: unknown): Promise<any> => {
  const response = await http(method, path, actor, body);
  expect(response.status, `${method} ${path}: ${JSON.stringify(response)}`).toBeLessThan(300);
  expect(response.status).toBeGreaterThanOrEqual(200);
  return response.data;
};
const scan = async (stockId: string) => (await ok("POST", "/trust/scan/resolve", "admin", {
  rawValue: stockId, scannerKind: "CAMERA", deviceId: "gate4-acceptance-scanner",
})).scanToken;
const inventoryKg = async () => (await rows("stock_lots")).reduce((sum, row) => sum + Number(row.current_quantity || 0), 0);
const evidence = [{ check_code: "SAFETY", result: "CONFORME" }, { check_code: "IDENTITY", result: "CONFORME" }];

describe.skipIf(!uri)("Gate 4 native HTTP industrial journey", () => {
  beforeAll(async () => {
    if (process.env.APP_ENV !== "test" || !/^mongodb:\/\/127\.0\.0\.1:27441\/\?replicaSet=gate4rs$/.test(uri!)) {
      throw Error("Gate 4 journey requires its explicit disposable local replica set");
    }
    process.env.MONGODB_URI = uri;
    process.env.MONGODB_DB_NAME = DB;
    vi.stubEnv("TRUST_STAGE_GATE", "enforce");
    vi.stubEnv("TRUST_SCAN_GATE", "enforce");
    vi.stubEnv("TRUST_MASS_BALANCE_GATE", "enforce");
    vi.stubEnv("NUMERIC_SIGNATURE_GATE", "enforce");
    const compiled = "../../../server-dist";
    const { connectToDatabase } = await import(/* @vite-ignore */ `${compiled}/db/mongoose.js`);
    await connectToDatabase();
    expect(mongoose.connection.name).toBe(DB);
    safeToClean = true;
    await mongoose.connection.dropDatabase();
    const passwordHash = await bcrypt.hash(PASSWORD, 4);
    const signaturePinHash = await bcrypt.hash(PIN, 4);
    const now = new Date().toISOString();
    for (const [actor, scope, role] of [
      ["admin", A, "administrateur_systeme"], ["quality", A, "inspecteur_qualite"],
      ["foreign", B, "administrateur_systeme"],
    ] as const) {
      await AuthUserModel.create({ id: `gate4-journey-${actor}`, email: `${actor}@gate4-journey.test`,
        ...scope, passwordHash, signaturePinHash, is_active: true, created_at: now, updated_at: now,
        user_metadata: { full_name: `Gate4 ${actor}`, roles: [role], role } });
    }
    for (const scope of [A, B]) await runWithFactory(scope, async () => {
      await factoryConnection().dropDatabase();
      await ensureTrustIndexes(factoryConnection().db, true);
      await getCollectionModel("site_settings").create({ id: "global", company_name: `Gate4 ${scope.tenant_id}`,
        costing: { labour_rate_tnd_per_hour: 0, energy_tariff_tnd_per_kwh: 0, overhead_tnd_per_kg: 0 },
        quality: { mass_balance_tolerance_pct: 0 }, documents: { gs1_company_prefix: "6191234" } });
    });
    await runWithFactory(A, async () => {
      await getCollectionModel("qc_checklists").create({ id: "gate4-reviewed-datte-policy", code: "G4-DATTE", reception_type: "DATTE", version: 1, is_active: true });
      await getCollectionModel("qc_checklist_items").create([
        { id: "g4-safety", checklist_id: "gate4-reviewed-datte-policy", code: "SAFETY", name: "Synthetic control-plan safety evidence", severity: "CRITIQUE", sequence_order: 1, is_active: true },
        { id: "g4-identity", checklist_id: "gate4-reviewed-datte-policy", code: "IDENTITY", name: "Supplier and lot identity", severity: "MAJEUR", sequence_order: 2, is_active: true },
      ]);
    });
    const { createApp } = await import(/* @vite-ignore */ `${compiled}/app.js`);
    app = await createApp();
    await app.listen(0, "127.0.0.1");
    base = await app.getUrl();
    for (const actor of ["admin", "quality", "foreign"]) {
      const login = await ok("POST", "/auth/signin", actor, { email: `${actor}@gate4-journey.test`, password: PASSWORD });
      tokens[actor] = login.access_token;
      expect(tokens[actor]).toBeTruthy();
    }
  }, 120_000);

  afterAll(async () => {
    vi.useRealTimers();
    await app?.close();
    if (safeToClean && mongoose.connection.name === DB && mongoose.connection.readyState === 1) {
      for (const scope of [A, B]) await runWithFactory(scope, () => factoryConnection().dropDatabase());
      await mongoose.connection.dropDatabase();
    }
    await mongoose.disconnect();
    vi.unstubAllEnvs();
  }, 30_000);

  it("reconciles purchase, QC, cleaning, partial triage, treatment, packaging, PF and customer shipment", async () => {
    const supplier = await ok("POST", "/suppliers", "admin", {
      code: "G4-JOURNEY-SUP", name: "Isolated Gate4 supplier", supplier_status: "active", is_active: true, agreed_price_tnd_per_kg: 10,
    });
    const purchase = await ok("POST", "/purchasing/orders", "admin", {
      order: { supplier_id: supplier.id, currency: "TND" },
      lines: [{ description: "Dates for isolated acceptance", quantity: 1000, unit: "kg", unit_price: 10 }],
    });
    expect(purchase.total_amount).toBe(10000);
    await ok("POST", `/purchasing/orders/${purchase.id}/approve`, "admin", { approverName: "Gate4 acceptance manager" });
    await ok("POST", `/purchasing/orders/${purchase.id}/confirm`, "admin", { expectedDate: new Date().toISOString().slice(0, 10) });
    const intakeBody = {
      client_request_id: "gate4-journey-intake", supplier_id: supplier.id, purchase_order_id: purchase.id,
      purchase_order_line_id: purchase.lines[0].id, reception_type: "DATTE", manufacturing_route: "GENERIC",
      delivery_note_number: "G4-BL-1000", vehicle_number: "123 TU 4567", variety: "Deglet Nour",
      maturity_stage: "Tamar", harvest_method: "Manuelle traditionnelle", arrival_temperature_c: 24,
      storage_zone_code: "ZR-01", delivery_note_photos: ["data:image/jpeg;base64,AA", "data:image/jpeg;base64,BB"],
      weighing_source: "SCALE", gross_weight_kg: 1100, tare_weight_kg: 100, unit_count: 2,
      lots: [{ lot_supplier: "G4-SUP-1000", quantity: 1000 }],
    };
    const intake = await ok("POST", "/receptions/intake", "admin", intakeBody);
    const reception = intake.reception;
    const lot = intake.lots[0];
    const mp = await one("stock_lots", { reception_lot_id: lot.id });
    expect(mp).toMatchObject({ current_quantity: 1000, status: "QUARANTINE" });
    expect(await inventoryKg()).toBe(1000);
    const repeatedIntake = await ok("POST", "/receptions/intake", "admin", intakeBody);
    expect(repeatedIntake.reception.id).toBe(reception.id);
    expect(await rows("receptions_v2")).toHaveLength(1);
    const inspection = await ok("POST", "/qc/start", "quality", { reception_id: reception.id, inspector_name: "Gate4 quality" });
    const qc = { inspectionId: inspection.id, decision: "ACCEPTE", pin: PIN, checkResults: evidence };
    const missingEvidence = await http("POST", "/qc/submit", "quality", { ...qc, checkResults: [] });
    expect(missingEvidence.error?.code).toBe("QC_EVIDENCE_INCOMPLETE");
    const wrongPin = await http("POST", "/qc/submit", "quality", { ...qc, pin: "000111" });
    expect(wrongPin.status).toBe(401);
    expect((await one("stock_lots", { id: mp.id })).status).toBe("QUARANTINE");
    await ok("POST", "/qc/submit", "quality", qc);
    expect(await one("reception_lots", { id: lot.id })).toMatchObject({ stock_status: "STOCK_LIBERE", release_pin_verified: true,
      purchase_cost_tnd: 10000, purchase_cost_tnd_per_kg: 10, manufacturing_route: "GENERIC" });
    expect(await rows("qc_check_results", { inspection_id: inspection.id })).toHaveLength(2);
    await ok("POST", `/reception-lots/${lot.id}/storage-moves`, "admin", { targetZone: "CF-01", scanProof: { lotToken: await scan(mp.id) } });

    const cleaning = await ok("POST", "/phase2/cleaning/cycles", "admin", {
      lot_number: lot.lot_internal, reception_id: reception.id, program: "STANDARD", operator_name: "Gate4 cleaning",
    });
    const cleaningClose = { weight_in_kg: 1000, weight_out_kg: 960, waste_weight_kg: 40, waste_category: "IMPURETES" };
    await ok("POST", `/phase2/cleaning/cycles/${cleaning.id}/close`, "admin", cleaningClose);
    expect(await inventoryKg()).toBe(960);
    expect(await one("stock_lots", { id: mp.id })).toMatchObject({ current_quantity: 0, status: "CONSUMED" });
    const cleaned = await one("stock_lots", { source_stage: "CLEANING" });
    expect(cleaned).toMatchObject({ parent_stock_lot_id: mp.id, reception_lot_id: lot.id, cleaning_cycle_id: cleaning.id });
    expect(cleaned.current_quantity).toBe(960);
    expect(cleaned.lot_number).toBe(lot.lot_internal);
    expect(cleaned.cost_tnd_per_kg).toBeCloseTo(10000 / 960, 4);
    await ok("POST", `/phase2/cleaning/cycles/${cleaning.id}/close`, "admin", cleaningClose);
    expect(await rows("stock_lots", { source_stage: "CLEANING" })).toHaveLength(1);
    expect(await inventoryKg()).toBe(960);

    const triage = await ok("POST", "/phase2/triage/sessions", "admin", {
      line: "L1", parent_reception_id: reception.id, parent_lot_number: cleaned.lot_number,
      parent_weight_kg: 400, worker_count: 1, variety: "Deglet Nour",
    });
    await ok("PATCH", `/phase2/triage/sessions/${triage.id}/weights`, "admin", {
      weight_extra_kg: 380, weight_cat1_kg: 0, weight_cat2_kg: 0, weight_reject_kg: 20,
    });
    await ok("POST", `/phase2/triage/sessions/${triage.id}/close`, "admin", {});
    expect(await inventoryKg()).toBe(940);
    expect((await one("stock_lots", { id: cleaned.id })).current_quantity).toBe(560);
    const graded = await one("stock_lots", { source_stage: "TRIAGE" });
    const sublot = await one("triage_sublots", { session_id: triage.id, grade: "EXTRA" });
    const triagedMaterial = 400 * 10000 / 960;
    expect((await one("triage_sessions", { id: triage.id })).material_cost_tnd).toBeCloseTo(triagedMaterial, 2);
    expect(graded.cost_tnd_per_kg).toBeCloseTo(triagedMaterial / 380, 4);
    expect(graded).toMatchObject({ current_quantity: 380, reception_lot_id: lot.id, source_reception_id: reception.id, parent_stock_lot_id: cleaned.id });
    expect((await one("triage_sublots", { session_id: triage.id, grade: "REJETE" })).weight_kg).toBe(20);
    await ok("POST", `/phase2/triage/sessions/${triage.id}/close`, "admin", {});
    expect(await inventoryKg()).toBe(940);

    // Actual post-triage conditioning, with recorded sensor/exit evidence and a
    // zero-gain balanced treatment (no stock/output fixture or provider mock).
    const treatment = await ok("POST", "/phase2/hydration/cycles", "admin", {
      chamber: "H1", lot_refs: [{ lot_number: graded.lot_number, reception_id: reception.id, weight_kg: 380 }],
      humidity_in_percent: 18, operator_name: "Gate4 hydration",
    });
    await ok("PATCH", `/phase2/hydration/cycles/${treatment.id}/sensors`, "admin", {
      temperature_t1_c: 40, temperature_t2_c: 42, air_humidity_percent: 80, steam_injected_kg: 0, energy_kwh: 0,
    });
    await ok("POST", `/phase2/hydration/cycles/${treatment.id}/record-exit`, "quality", {
      humidity_out_1: 23, humidity_out_2: 24, humidity_out_3: 25, inspector_name: "Gate4 quality",
    });
    expect((await http("POST", `/phase2/hydration/cycles/${treatment.id}/close`, "admin", {
      weight_in_kg: 380, weight_out_kg: 300, waste_kg: 0, steam_injected_kg: 0,
    })).error?.code).toBe("MASS_BALANCE_UNBALANCED");
    expect((await one("hydration_cycles", { id: treatment.id })).status).toBe("EN_COURS");
    await ok("POST", `/phase2/hydration/cycles/${treatment.id}/close`, "admin", { weight_in_kg: 380, weight_out_kg: 380, waste_kg: 0, steam_injected_kg: 0 });
    expect(await one("hydration_cycles", { id: treatment.id })).toMatchObject({ status: "TERMINE", conformity: "VERT", humidity_out_avg: 24, mass_balance_variance_pct: 0 });
    expect(await inventoryKg()).toBe(940);

    const label = await ok("POST", "/packaging/label-templates", "admin", { name: "Gate4 500g identity label", code: "G4-500" });
    await ok("POST", `/packaging/label-templates/${label.id}/approve`, "quality", { approved_by: "Gate4 quality" });
    const bom = await ok("POST", "/packaging/boms", "admin", { name: "Gate4 500g pack", code: "G4-500G", net_weight_g: 500, unit_cost_tnd: 0.2, label_template_id: label.id });
    const packagingBody = { client_request_id: "gate4-journey-packaging", source_sublot_id: sublot.id,
      source_lot_number: graded.lot_number, source_weight_kg: 100, grade: "EXTRA", bom_id: bom.id,
      bom_name: bom.name, bom_net_weight_g: 500, label_template_id: label.id, worker_count: 1, line: "L1" };
    const packaging = await ok("POST", "/packaging/orders", "admin", packagingBody);
    expect((await one("stock_lots", { id: graded.id })).current_quantity).toBe(280);
    expect((await ok("POST", "/packaging/orders", "admin", packagingBody)).id).toBe(packaging.id);
    await ok("POST", `/packaging/orders/${packaging.id}/start`, "admin", { label_status: "VALIDE" });
    await ok("PATCH", `/packaging/orders/${packaging.id}/progress`, "admin", { produced_units: 200, rejected_units: 0 });
    const palette = await ok("POST", "/packaging/palettes", "admin", { order_id: packaging.id, order_number: packaging.order_number,
      bom_id: bom.id, box_count: 200, gross_weight_per_box_g: 550 });
    expect(palette.net_weight_kg).toBe(100);
    await ok("POST", `/packaging/orders/${packaging.id}/close`, "admin", { produced_units: 200, rejected_units: 0, bom_net_weight_g: 500, waste_kg: 0 });
    const packaged = await one("packaging_orders", { id: packaging.id });
    expect(packaged.material_cost_tnd).toBeCloseTo(100 * triagedMaterial / 380, 2);
    expect(packaged.packaging_cost_tnd).toBe(40);
    expect(packaged.total_cost_tnd).toBeCloseTo(100 * triagedMaterial / 380 + 40, 2);
    await ok("POST", `/packaging/palettes/${palette.id}/seal`, "admin", { seal_number: "G4-SEAL-001", sealed_by: "Gate4 warehouse" });
    const pf = await one("stock_lots", { packaging_palette_id: palette.id });
    expect(pf).toMatchObject({ category: "PF", current_quantity: 100, status: "VALIDATED", reception_lot_id: lot.id });
    expect(pf.cost_tnd_per_kg).toBeCloseTo(packaged.total_cost_tnd / 100, 4);
    await ok("POST", `/packaging/palettes/${palette.id}/seal`, "admin", { seal_number: "G4-SEAL-001", sealed_by: "Gate4 warehouse" });
    expect(await rows("stock_lots", { packaging_palette_id: palette.id })).toHaveLength(1);
    expect(await inventoryKg()).toBe(940);

    const customer = await ok("POST", "/customers", "admin", { code: "G4-JOURNEY-CUS", name: "Isolated Gate4 buyer", country: "FR", is_active: true });
    const customerOrder = await ok("POST", "/export-orders", "admin", { customer_id: customer.id, customer_name: customer.name,
      customer_country: "FR", quantity_kg: 60, total_weight_kg: 60, status: "CONFIRMED", lot_id: lot.id, lot_number: lot.lot_internal });
    const shipmentRows = await ok("POST", "/stock/shipments", "admin", { customer_id: customer.id, customer_name: customer.name,
      export_order_id: customerOrder.id, order_id: customerOrder.id, status: "PREPARING", lot_id: lot.id, lot_number: lot.lot_internal });
    const shipment = Array.isArray(shipmentRows) ? shipmentRows[0] : shipmentRows;
    await ok("POST", "/stock/shipment-lines", "admin", { shipment_id: shipment.id, stock_lot_id: pf.id, lot_id: pf.id, quantity_kg: 60 });
    expect((await http("PATCH", `/stock/shipments/${shipment.id}`, "admin", { status: "SHIPPED" })).error?.code).toBe("SHIPMENT_PICK_REQUIRED");
    const expeditionBody = { shipmentId: shipment.id, requestId: "gate4-journey-shipment", status: "READY",
      pickedLines: [{ lot_id: pf.id, quantity: 60, scan_token: await scan(pf.id) }] };
    await ok("POST", "/stock/expedition", "admin", expeditionBody);
    await ok("POST", "/stock/expedition", "admin", expeditionBody);
    await ok("PATCH", `/stock/shipments/${shipment.id}`, "admin", { status: "SHIPPED" });
    expect((await one("stock_lots", { id: pf.id })).current_quantity).toBe(40);
    expect(await rows("stock_movements", { shipment_id: shipment.id, movement_type: "EXPEDITION" })).toHaveLength(1);
    expect(await one("shipment_preparations", { id: shipment.id })).toMatchObject({ status: "SHIPPED", customer_id: customer.id, export_order_id: customerOrder.id });
    expect((await ok("GET", `/customers/${customer.id}`)).id).toBe(customer.id);
    expect((await ok("GET", `/export-orders/${customerOrder.id}`)).customer_id).toBe(customer.id);

    // 1000 input = 880 on hand + 40 cleaning waste + 20 triage reject + 60 shipped.
    expect(await inventoryKg()).toBe(880);
    const remaining = await rows("stock_lots");
    expect(remaining.every((row) => Number(row.current_quantity) >= 0)).toBe(true);
    expect(await one("reception_lots", { id: lot.id })).toMatchObject({ purchase_cost_tnd: 10000, purchase_cost_tnd_per_kg: 10 });
    const retainedValue = remaining.reduce((sum, row) => sum + Number(row.current_quantity || 0) * Number(row.cost_tnd_per_kg || 0), 0);
    const shippedValue = 60 * Number(pf.cost_tnd_per_kg);
    expect(retainedValue + shippedValue).toBeCloseTo(10040, 1);
    const verified = await ok("GET", `/trust/lots/${lot.id}/verify`);
    expect(verified.valid).toBe(true);
    expect(verified.eventCount).toBeGreaterThan(6);
    const state = await ok("GET", `/trust/lots/${lot.id}/state`);
    expect(state.route).toBe("GENERIC");
    expect(state.goldenThreadComplete).toBe(true);
    expect(state.progress.missing).toEqual([]);

    for (const path of ["/suppliers", "/purchasing/orders", "/receptions", "/stock/lots", "/packaging/orders", "/packaging/palettes", "/customers", "/export-orders", "/stock/shipments"]) {
      expect(await ok("GET", path, "foreign"), `foreign factory ${path}`).toEqual([]);
    }
    expect((await ok("GET", `/trust/lots/${lot.id}/chain`, "foreign")).events).toEqual([]);
    expect((await http("POST", "/stock/adjustments", "foreign", { stock_lot_id: pf.id, delta_kg: -1, reason: "foreign object attempt" })).status).toBe(404);
    expect((await http("POST", `/phase2/cleaning/cycles/${cleaning.id}/close`, "foreign", cleaningClose)).status).toBe(404);
    expect((await one("stock_lots", { id: pf.id })).current_quantity).toBe(40);
    expect(await rows("stock_lots", {}, B)).toHaveLength(0);

    // A separate native premium intake cannot inherit the generic journey's
    // exception or downgrade its sticky route through a state query.
    const premiumIntake = await ok("POST", "/receptions/intake", "admin", {
      ...intakeBody, client_request_id: "gate4-journey-premium-negative", purchase_order_id: undefined,
      purchase_order_line_id: undefined, manufacturing_route: "PREMIUM_WHOLE", delivery_note_number: "G4-PREMIUM-NEGATIVE",
      gross_weight_kg: 200, tare_weight_kg: 100, lots: [{ lot_supplier: "G4-PREMIUM-100", quantity: 100 }],
    });
    const premiumLot = premiumIntake.lots[0];
    const premiumQc = await ok("POST", "/qc/start", "quality", { reception_id: premiumIntake.reception.id, inspector_name: "Gate4 quality" });
    await ok("POST", "/qc/submit", "quality", { inspectionId: premiumQc.id, decision: "ACCEPTE", pin: PIN, checkResults: evidence });
    const premiumTriage = await ok("POST", "/phase2/triage/sessions", "admin", {
      line: "L1", parent_reception_id: premiumIntake.reception.id, parent_lot_number: premiumLot.lot_internal, parent_weight_kg: 100, worker_count: 1,
    });
    await ok("PATCH", `/phase2/triage/sessions/${premiumTriage.id}/weights`, "admin", { weight_extra_kg: 95, weight_cat1_kg: 0, weight_cat2_kg: 0, weight_reject_kg: 5 });
    const premiumBlocked = await http("POST", `/phase2/triage/sessions/${premiumTriage.id}/close`, "admin", {});
    expect(premiumBlocked.error?.code).toBe("LOT_CCP_REQUIRED");
    expect((await one("triage_sessions", { id: premiumTriage.id })).status).toBe("EN_COURS");
    expect(await rows("triage_sublots", { session_id: premiumTriage.id })).toHaveLength(0);
    expect(await inventoryKg()).toBe(980);
    const premiumState = await ok("GET", `/trust/lots/${premiumLot.id}/state?route=GENERIC`);
    expect(premiumState.route).toBe("PREMIUM_WHOLE");
    expect(premiumState.progress.completed).not.toContain("TRIAGE");
  }, 120_000);
});
