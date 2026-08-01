/**
 * Wave C smoke: grade settlement from triage + export margin with FX.
 *   npm run smoke:wave-c
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
  const code = "WC-SETTLE-SUP";
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
      values: {
        agreed_price_tnd_per_kg: 8,
        grade_prices_tnd_per_kg: { EXTRA: 12, CATEGORIE_I: 8, CATEGORIE_II: 5, REJETE: 0 },
        is_active: true,
        supplier_status: "active",
      },
    });
    return id;
  }
  const today = new Date().toISOString().slice(0, 10);
  const created = await request("POST", "/api/db/insert", token, {
    table: "suppliers",
    values: {
      code,
      name: "Wave C Settlement Supplier",
      supplier_status: "active",
      is_active: true,
      country: "TN",
      agreed_price_tnd_per_kg: 8,
      grade_prices_tnd_per_kg: { EXTRA: 12, CATEGORIE_I: 8, CATEGORIE_II: 5, REJETE: 0 },
      contract_start_date: today,
      contract_end_date: "2099-12-31",
    },
  });
  return created.body?.data?.[0]?.id;
};

const main = async () => {
  console.log("\nWave C settlement + margin smoke");
  await seedActors();
  const receptionToken = await login("operateur.reception@test.local");
  const triageToken = await login("operateur.triage.ia@test.local");
  const directionToken = await login("directeur.usine@test.local");
  const supplierId = await ensureSupplier(directionToken);
  assert(Boolean(supplierId), "supplier with grade prices ready");

  const intake = await request("POST", "/api/receptions/intake", receptionToken, {
    client_request_id: randomUUID(),
    supplier_id: supplierId,
    spontaneous_delivery: true,
    unit: "kg",
    quantity_total: 200,
    gross_weight_kg: 210,
    tare_weight_kg: 10,
    variety: "Deglet Nour",
    lots: [{ lot_supplier: `WC-${Date.now()}`, variety: "Deglet Nour", quantity: 200, unit: "kg" }],
  });
  const lot = intake.body?.data?.lots?.[0];
  const reception = intake.body?.data?.reception;
  assert(intake.response.ok && lot?.id, "intake lot created");

  for (const toStage of ["WEIGHED", "QC_DECIDED"]) {
    const advanced = await request(
      "POST",
      `/api/trust/lots/${encodeURIComponent(lot.id)}/advance`,
      directionToken,
      { toStage, collection: "smoke_wave_c", payload: { smoke: true }, route: "PREMIUM_WHOLE" },
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
    created_by: "smoke-wave-c",
  });
  const sessionId = session.body?.data?.id;
  assert(session.response.ok && sessionId, "triage session created");

  await request("PATCH", `/api/phase2/triage/sessions/${sessionId}/weights`, triageToken, {
    weight_extra_kg: 40,
    weight_cat1_kg: 100,
    weight_cat2_kg: 50,
    weight_reject_kg: 10,
  });
  const closed = await request("POST", `/api/phase2/triage/sessions/${sessionId}/close`, triageToken, {});
  assert(closed.response.ok, "triage closed");

  const settlement = await request(
    "POST",
    `/api/settlements/from-triage/${sessionId}`,
    directionToken,
    {},
  );
  assert(settlement.response.ok && settlement.body?.data?.id, "settlement from triage");
  // 40*12 + 100*8 + 50*5 + 10*0 = 480 + 800 + 250 = 1530
  assert(Number(settlement.body.data.total_amount_tnd) === 1530, "grade settlement amount 1530 TND");

  const approved = await request(
    "POST",
    `/api/settlements/${settlement.body.data.id}/approve`,
    directionToken,
    {},
  );
  assert(approved.response.ok && approved.body?.data?.status === "APPROVED", "settlement approved");

  const exportOrder = await request("POST", "/api/export-orders", directionToken, {
    order_ref: `WC-EXP-${Date.now()}`,
    customer_name: "Wave C Buyer",
    customer_country: "EU",
    currency: "EUR",
    contract_language: "fr",
    status: "confirmed",
    total_weight_kg: 40,
    total_amount: 1000,
    lines: [
      {
        lot_id: lot.id,
        lot_ref: lot.lot_internal,
        product_name: "Deglet Nour EXTRA",
        net_weight_kg: 40,
        unit_price: 25,
        currency: "EUR",
        quality_grade: "EXTRA",
      },
    ],
  });
  const orderId = exportOrder.body?.data?.id;
  assert(exportOrder.response.ok && orderId, "export order created");

  const margin = await request("GET", `/api/export-orders/${orderId}/margin`, directionToken);
  assert(margin.response.ok, "GET export margin");
  assert(margin.body?.data?.currency === "EUR", "margin currency EUR");
  assert(Number(margin.body?.data?.fx_rate_to_tnd) > 0, "fx rate present");
  assert(typeof margin.body?.data?.margin_tnd === "number", "margin_tnd computed");

  console.log("\nWave C smoke OK");
};

main().catch((error) => {
  console.error("\nWave C smoke FAILED:", error.message || error);
  process.exit(1);
});
