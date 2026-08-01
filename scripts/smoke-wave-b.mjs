/**
 * Wave B margin smoke: purchase cost snapshot → triage close cost/kg →
 * costing summary + passport mass_balance claim.
 *
 *   npm run smoke:wave-b
 * Requires API server running (npm run server / dev).
 */
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";

const API = (process.env.SMOKE_API_URL || `http://127.0.0.1:${process.env.PORT || 4000}`).replace(/\/$/, "");
const PASSWORD = process.env.SMOKE_PASSWORD || "Test123!";

const request = async (method, path, token, body) => {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = { raw: text };
  }
  return { response, body: parsed };
};

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
  console.log(`  ✓ ${message}`);
};

const login = async (email) => {
  const { body } = await request("POST", "/api/auth/signin", null, { email, password: PASSWORD });
  const token = body?.data?.session?.access_token || body?.data?.access_token;
  if (!token) throw new Error(`Login failed: ${email}`);
  return token;
};

const seedActors = () =>
  new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--env-file=.env", "scripts/seed-test-actors.mjs"], {
      cwd: process.cwd(),
      stdio: "inherit",
    });
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`seed ${code}`))));
  });

const ensureSupplier = async (token) => {
  const code = "WB-COST-SUP";
  const listed = await request("POST", "/api/db/query", token, {
    table: "suppliers",
    filters: [{ column: "code", op: "eq", value: code }],
    limit: 1,
  });
  if (listed.body?.data?.[0]?.id) {
    const id = listed.body.data[0].id;
    await request("POST", "/api/db/update", token, {
      table: "suppliers",
      filters: [{ column: "id", op: "eq", value: id }],
      values: { agreed_price_tnd_per_kg: 8.5, is_active: true, supplier_status: "active" },
    });
    return id;
  }
  const today = new Date().toISOString().slice(0, 10);
  const created = await request("POST", "/api/db/insert", token, {
    table: "suppliers",
    values: {
      code,
      name: "Wave B Cost Supplier",
      supplier_status: "active",
      is_active: true,
      country: "TN",
      agreed_price_tnd_per_kg: 8.5,
      contract_start_date: today,
      contract_end_date: "2099-12-31",
    },
  });
  return created.body?.data?.[0]?.id;
};

const main = async () => {
  console.log("\nWave B margin smoke");
  await seedActors();

  const receptionToken = await login("operateur.reception@test.local");
  const triageToken = await login("operateur.triage.ia@test.local");
  const directionToken = await login("directeur.usine@test.local");
  const supplierId = await ensureSupplier(directionToken);
  assert(Boolean(supplierId), "supplier with agreed price ready");

  const intake = await request("POST", "/api/receptions/intake", receptionToken, {
    client_request_id: randomUUID(),
    supplier_id: supplierId,
    spontaneous_delivery: true,
    unit: "kg",
    quantity_total: 200,
    gross_weight_kg: 210,
    tare_weight_kg: 10,
    variety: "Deglet Nour",
    lots: [{ lot_supplier: `WB-${Date.now()}`, variety: "Deglet Nour", quantity: 200, unit: "kg" }],
  });
  const lot = intake.body?.data?.lots?.[0];
  const reception = intake.body?.data?.reception;
  assert(intake.response.ok && lot?.id, "intake lot created");
  assert(
    Number(lot.purchase_cost_tnd_per_kg) === 8.5 || Number(lot.purchase_cost_tnd) > 0,
    "purchase cost snapshot on lot",
  );

  for (const toStage of ["WEIGHED", "QC_DECIDED"]) {
    const advanced = await request(
      "POST",
      `/api/trust/lots/${encodeURIComponent(lot.id)}/advance`,
      directionToken,
      { toStage, collection: "smoke_wave_b", payload: { smoke: true }, route: "PREMIUM_WHOLE" },
    );
    assert(advanced.response.ok, `advance ${toStage}`);
  }

  const session = await request("POST", "/api/phase2/triage/sessions", triageToken, {
    line: "L1",
    parent_lot_number: lot.lot_internal,
    parent_reception_id: reception?.id,
    parent_weight_kg: 200,
    variety: "Deglet Nour",
    worker_count: 2,
    created_by: "smoke-wave-b",
  });
  const sessionId = session.body?.data?.id;
  assert(session.response.ok && sessionId, "triage session created");

  const weights = await request("PATCH", `/api/phase2/triage/sessions/${sessionId}/weights`, triageToken, {
    weight_extra_kg: 40,
    weight_cat1_kg: 100,
    weight_cat2_kg: 50,
    weight_reject_kg: 10,
  });
  assert(weights.response.ok, "triage weights set (balanced 200 kg)");

  const closed = await request("POST", `/api/phase2/triage/sessions/${sessionId}/close`, triageToken, {});
  assert(closed.response.ok, "triage session closed");

  const sessionAfter = await request("GET", `/api/phase2/triage/sessions/${sessionId}`, triageToken);
  const closedSession = sessionAfter.body?.data;
  assert(sessionAfter.response.ok && closedSession?.status === "TERMINE", "triage session status TERMINE");
  assert(
    Number(closedSession?.mass_balance_variance_pct) === 0,
    "mass_balance_variance_pct = 0 on close",
  );
  assert(Number(closedSession?.input_cost_tnd || closedSession?.material_cost_tnd) > 0, "triage cost persisted");

  const lotCost = await request("GET", `/api/costing/lots/${encodeURIComponent(lot.id)}`, directionToken);
  assert(lotCost.response.ok, "GET /api/costing/lots/:id");
  assert(lotCost.body?.data?.lot?.purchase_cost_tnd_per_kg != null, "lot cost view has purchase snapshot");
  assert(Array.isArray(lotCost.body?.data?.triage?.grades) && lotCost.body.data.triage.grades.length > 0, "grade costs present");

  const summary = await request("GET", "/api/costing/summary?period=month", directionToken);
  assert(summary.response.ok, "GET /api/costing/summary");
  assert(summary.body?.data?.basis === "standard", "summary basis = standard");
  assert(typeof summary.body?.data?.kpis?.costPerKg === "number", "summary exposes costPerKg KPI");

  const passport = await request("GET", `/api/trust/lots/${encodeURIComponent(lot.id)}/passport`, directionToken);
  assert(passport.response.ok, "GET passport");
  const claims = passport.body?.data?.claims || [];
  const mb = claims.find((c) => c.key === "mass_balance" || c.id === "mass_balance");
  assert(Boolean(mb), "passport mass_balance claim present");

  console.log("\nWave B smoke OK");
};

main().catch((error) => {
  console.error("\nWave B smoke FAILED:", error.message || error);
  process.exit(1);
});
