/**
 * The manufacturing thread through real cycles, not stage events. One lot goes from
 * reception to packaging, and its book stock must stay true at every step.
 *
 * EXPECTED TO FAIL until Phases 2 and 3: it records what is broken today and is their
 * acceptance test. It is not part of the Phase 0 gate.
 *
 *   SMOKE_API_URL=http://127.0.0.1:4170 node scripts/e2e/thread.e2e.mjs
 */
import { randomUUID } from "node:crypto";

import { assertTestStack, resolveTestApi } from "../lib/api-target-guard.mjs";
import { syntheticIntakeFields } from "../lib/intake-contract.mjs";
import { releaseThroughQc } from "../lib/qc-release.mjs";

const API = resolveTestApi();
await assertTestStack(API);

const PASSWORD = "Test123!";
const PIN = "482915";
const PRICE = 10;
const failures = [];

const request = async (method, path, token, body) => {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  return { ok: response.ok, status: response.status, body: text ? JSON.parse(text) : null };
};

const login = async (email) => {
  const { body } = await request("POST", "/api/auth/signin", null, { email, password: PASSWORD });
  return body?.data?.session?.access_token || body?.data?.access_token;
};

const expectThat = (condition, label, evidence = "") => {
  console.log(`  ${condition ? "PASS" : "FAIL"}  ${label}${evidence === "" ? "" : `  ${JSON.stringify(evidence)}`}`);
  if (!condition) failures.push(label);
};

const director = await login("directeur.usine@test.local");
const operator = await login("operateur.reception@test.local");
const quality = await login("responsable.qualite@test.local");
const triage = await login("operateur.triage.ia@test.local");
await request("POST", "/api/auth/signature-pin", quality, { pin: PIN, password: PASSWORD });

const supplier = await request("POST", "/api/suppliers", director, {
  code: `THREAD-${Date.now()}`, name: "Fournisseur fictif", supplier_status: "active", is_active: true, country: "TN",
  agreed_price_tnd_per_kg: PRICE, contract_start_date: new Date().toISOString().slice(0, 10), contract_end_date: "2099-12-31",
});
const intake = await request("POST", "/api/receptions/intake", operator, {
  client_request_id: randomUUID(), supplier_id: supplier.body.data.id, ...syntheticIntakeFields(), spontaneous_delivery: true,
  unit: "kg", quantity_total: 1000, gross_weight_kg: 1100, tare_weight_kg: 100, variety: "Deglet Nour",
  lots: [{ lot_supplier: `TH-${Date.now()}`, variety: "Deglet Nour", quantity: 1000, unit: "kg" }],
});
const lot = intake.body.data.lots[0];
const reception = intake.body.data.reception;

const stock = async () => {
  const rows = (await request("GET", "/api/stock/lots", director)).body?.data ?? [];
  return rows.filter((row) => row.source_lot_internal === lot.lot_internal || row.lot_number === lot.lot_internal);
};
const bookKg = async () => (await stock()).reduce((sum, row) => sum + Number(row.current_quantity || 0), 0);

await releaseThroughQc((method, path, body) => request(method, path, quality, body), reception.id, { pin: PIN });
expectThat((await bookKg()) === 1000, "book stock is 1,000 kg after QC", await bookKg());

const cycle = await request("POST", "/api/phase2/cleaning/cycles", director, {
  program: "STANDARD", lot_number: lot.lot_internal, reception_id: reception.id, variety: "Deglet Nour", operator_name: "script",
});
await request("POST", `/api/phase2/cleaning/cycles/${cycle.body.data.id}/close`, director, {
  weight_in_kg: 1000, weight_out_kg: 960, waste_weight_kg: 40, waste_category: "IMPURETES",
});
expectThat((await bookKg()) === 960, "cleaning removes 40 kg from book stock", await bookKg());

const session = await request("POST", "/api/phase2/triage/sessions", triage, {
  line: "L1", parent_lot_number: lot.lot_internal, parent_reception_id: reception.id, parent_weight_kg: 400,
  variety: "Deglet Nour", worker_count: 2, created_by: "script",
});
expectThat(!session.ok, "triage refuses a lot with no recorded fumigation", session.status);

const sessionId = session.body?.data?.id;
await request("PATCH", `/api/phase2/triage/sessions/${sessionId}/weights`, triage, {
  weight_extra_kg: 100, weight_cat1_kg: 200, weight_cat2_kg: 80, weight_reject_kg: 20,
});
await request("POST", `/api/phase2/triage/sessions/${sessionId}/close`, triage, {});

const after = await stock();
expectThat((await bookKg()) === 940, "triage of 400 kg leaves 940 kg, less 20 kg rejected", await bookKg());

const closed = (await request("GET", `/api/phase2/triage/sessions/${sessionId}`, triage)).body?.data;
expectThat(Number(closed?.material_cost_tnd) === 400 * PRICE, "triage charges only the 400 kg consumed", closed?.material_cost_tnd);

const sublot = after.find((row) => row.source_stage === "TRIAGE");
const packaging = await request("POST", "/api/packaging/orders", director, {
  client_request_id: randomUUID(), source_sublot_id: sublot?.id, source_lot_number: sublot?.lot_number, source_weight_kg: 50, grade: "EXTRA",
  bom_id: "script", bom_name: "script", bom_format: "1kg", bom_net_weight_g: 1000, line: "L1", planned_at: new Date().toISOString(), operator_name: "script", worker_count: 1,
});
expectThat(packaging.ok, "a released sub-lot reaches packaging", packaging.body?.error?.code ?? packaging.status);

const fake = await request("POST", `/api/trust/lots/${encodeURIComponent(lot.id)}/advance`, director, {
  toStage: "FUMIGATION_CCP", collection: "script", payload: {}, route: "PREMIUM_WHOLE",
});
expectThat(!fake.ok, "the ledger refuses a stage with no work behind it", fake.status);

console.log(`\n${failures.length === 0 ? "Thread complete." : `${failures.length} step(s) broken.`}`);
process.exit(failures.length === 0 ? 0 : 1);
