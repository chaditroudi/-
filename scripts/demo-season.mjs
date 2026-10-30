/**
 * One-click season demo A→Z — Deglet Nour golden thread + QC lab trail notes.
 *
 *   npm run demo:season
 *
 * Requires API up (npm run server) and .env.
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
  if (!token) throw new Error(`Login failed for ${email}`);
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
  const listed = await request("GET", "/api/suppliers", token);
  if (listed.body?.data?.[0]?.id) return listed.body.data[0].id;
  const today = new Date().toISOString().slice(0, 10);
  const created = await request("POST", "/api/suppliers", token, {
    code: "SEASON-DN-SUP",
    name: "Season Demo Deglet Nour",
    supplier_status: "active",
    is_active: true,
    country: "TN",
    contract_start_date: today,
    contract_end_date: "2099-12-31",
  });
  return created.body?.data?.id;
};

const main = async () => {
  const seasonTag = `SEASON-${new Date().toISOString().slice(0, 10)}`;
  console.log(`\nDemo season A→Z — ${seasonTag}`);
  await seedActors();
  const receptionToken = await login("operateur.reception@test.local");
  const directionToken = await login("directeur.usine@test.local");
  const supplierId = await ensureSupplier(directionToken);

  const lotSupplier = `${seasonTag}-${Date.now()}`;
  const intake = await request("POST", "/api/receptions/intake", receptionToken, {
    client_request_id: crypto.randomUUID(),
    supplier_id: supplierId,
    spontaneous_delivery: true,
    unit: "kg",
    quantity_total: 750,
    gross_weight_kg: 780,
    tare_weight_kg: 30,
    variety: "Deglet Nour",
    notes: `demo:season lab trail humidity=22.4 defects=3.1`,
    lots: [
      {
        lot_supplier: lotSupplier,
        variety: "Deglet Nour",
        quantity: 750,
        unit: "kg",
      },
    ],
  });
  const lot = intake.body?.data?.lots?.[0];
  assert(intake.response.ok && lot?.id, `Intake created lot ${lot?.lot_internal || lot?.id}`);

  for (const toStage of STAGES) {
    const payload = {
      demo: true,
      season: seasonTag,
      toStage,
      ...(toStage === "QC_DECIDED"
        ? { lab_humidity_pct: 22.4, lab_defects_pct: 3.1, decision: "ACCEPTE" }
        : {}),
      ...(toStage === "PACKED" ? { label: "PF", net_weight_kg: 12.5 } : {}),
    };
    const advanced = await request(
      "POST",
      `/api/trust/lots/${encodeURIComponent(lot.id)}/advance`,
      directionToken,
      { toStage, collection: "demo_season", payload, route: "PREMIUM_WHOLE" },
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
  assert(recall.response.ok && recall.body?.data?.under60s !== false, "Recall drill OK");

  console.log("\nSeason demo lot ready:");
  console.log(`  season:    ${seasonTag}`);
  console.log(`  lotId:     ${lot.id}`);
  console.log(`  lotNumber: ${lot.lot_internal}`);
  console.log(`  passport:  ${API}/api/trust/lots/${encodeURIComponent(lot.id)}/passport`);
  console.log(`  UI:        /#/passport/${encodeURIComponent(lot.lot_internal || lot.id)}`);
  console.log(`  Accueil:   follow lot ${lot.lot_internal || lot.id}`);
};

main().catch((error) => {
  console.error("\n✗ demo:season failed:", error.message || error);
  process.exit(1);
});
