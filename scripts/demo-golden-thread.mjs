/**
 * Live Deglet Nour premium golden-thread demo.
 * Reception → all stages → passport + recall.
 *
 *   npm run demo:golden-thread
 */
import { spawn } from "node:child_process";

const API = (process.env.SMOKE_API_URL || `http://127.0.0.1:${process.env.PORT || 4000}`).replace(/\/$/, "");
const PASSWORD = process.env.SMOKE_PASSWORD || "Test123!";

const STAGES = [
  "WEIGHED",
  "QC_DECIDED",
  "COLD_STORE",
  "FUMIGATION_CCP",
  "TRIAGE",
  "PACKED",
  "SHIPPED",
];

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
  return { response, body: text ? JSON.parse(text) : null };
};

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
  console.log(`  ✓ ${message}`);
};

const login = async (email) => {
  const { body } = await request("POST", "/api/auth/signin", null, { email, password: PASSWORD });
  const token = body?.data?.session?.access_token || body?.data?.access_token;
  if (!token) throw new Error(`Login failed for ${email}`);
  return token;
};

const seedActors = () => new Promise((resolve, reject) => {
  const child = spawn(process.execPath, ["--env-file=.env", "scripts/seed-test-actors.mjs"], {
    cwd: process.cwd(),
    stdio: "inherit",
  });
  child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`seed ${code}`))));
});

const ensureSupplier = async (token) => {
  const listed = await request("POST", "/api/db/query", token, { table: "suppliers", filters: [], limit: 1 });
  if (listed.body?.data?.[0]?.id) return listed.body.data[0].id;
  const today = new Date().toISOString().slice(0, 10);
  const created = await request("POST", "/api/db/insert", token, {
    table: "suppliers",
    values: {
      code: "DEMO-DN-SUP",
      name: "Demo Deglet Nour Supplier",
      supplier_status: "active",
      is_active: true,
      country: "TN",
      contract_start_date: today,
      contract_end_date: "2099-12-31",
    },
  });
  return created.body?.data?.[0]?.id;
};

const main = async () => {
  console.log("\nDeglet Nour golden-thread demo");
  await seedActors();
  const receptionToken = await login("operateur.reception@test.local");
  const directionToken = await login("directeur.usine@test.local");
  const supplierId = await ensureSupplier(directionToken);

  const intake = await request("POST", "/api/receptions/intake", receptionToken, {
    client_request_id: crypto.randomUUID(),
    supplier_id: supplierId,
    spontaneous_delivery: true,
    unit: "kg",
    quantity_total: 500,
    gross_weight_kg: 520,
    tare_weight_kg: 20,
    variety: "Deglet Nour",
    lots: [{ lot_supplier: `DEMO-DN-${Date.now()}`, variety: "Deglet Nour", quantity: 500, unit: "kg" }],
  });
  const lot = intake.body?.data?.lots?.[0];
  assert(intake.response.ok && lot?.id, `Intake created lot ${lot?.lot_internal || lot?.id}`);

  for (const toStage of STAGES) {
    const advanced = await request(
      "POST",
      `/api/trust/lots/${encodeURIComponent(lot.id)}/advance`,
      directionToken,
      { toStage, collection: "demo_golden_thread", payload: { demo: true, toStage }, route: "PREMIUM_WHOLE" },
    );
    assert(advanced.response.ok && advanced.body?.data, `Stage ${toStage}`);
  }

  const verified = await request("GET", `/api/trust/lots/${encodeURIComponent(lot.id)}/verify`, directionToken);
  const passport = await request("GET", `/api/trust/lots/${encodeURIComponent(lot.id)}/passport`, null);
  const recall = await request("POST", "/api/trust/recall", directionToken, { lotId: lot.id });
  const state = await request("GET", `/api/trust/lots/${encodeURIComponent(lot.id)}/state`, directionToken);

  assert(verified.body?.data?.valid === true, "Hash chain valid");
  assert(state.body?.data?.goldenThreadComplete === true, "Golden thread complete");
  assert(passport.response.ok, "Public passport available");
  assert(recall.response.ok, "Recall drill returned");

  console.log("\nDemo lot ready:");
  console.log(`  lotId:     ${lot.id}`);
  console.log(`  lotNumber: ${lot.lot_internal}`);
  console.log(`  passport:  ${API}/api/trust/lots/${encodeURIComponent(lot.id)}/passport`);
  console.log(`  UI:        /#/passport/${encodeURIComponent(lot.lot_internal || lot.id)}`);
};

main().catch((error) => {
  console.error(`\nDemo failed: ${error.stack || error.message}`);
  process.exit(1);
});
