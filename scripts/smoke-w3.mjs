import { createHmac, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";

const API = (process.env.SMOKE_API_URL || `http://127.0.0.1:${process.env.PORT || 4000}`).replace(/\/$/, "");
const PASSWORD = process.env.SMOKE_PASSWORD || "Test123!";
const SIM_SECRET = process.env.WEIGHBRIDGE_SIMULATOR_SECRET || "royal-palm-simulator-dev";

const request = async (method, path, token, body, headers = {}) => {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  const parsed = text ? JSON.parse(text) : null;
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

const seedActors = () => new Promise((resolve, reject) => {
  const child = spawn(process.execPath, ["--env-file=.env", "scripts/seed-test-actors.mjs"], {
    cwd: process.cwd(),
    stdio: "inherit",
    shell: false,
  });
  child.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`Seed failed: ${code}`)));
});

const ensureSupplier = async (token) => {
  const listed = await request("POST", "/api/db/query", token, {
    table: "suppliers", filters: [], limit: 1,
  });
  if (listed.body?.data?.[0]?.id) return listed.body.data[0].id;
  const today = new Date().toISOString().slice(0, 10);
  const created = await request("POST", "/api/db/insert", token, {
    table: "suppliers",
    values: {
      code: "W3-SMOKE-SUP",
      name: "W3 Smoke Supplier",
      supplier_status: "active",
      is_active: true,
      country: "TN",
      contract_start_date: today,
      contract_end_date: "2099-12-31",
    },
  });
  return created.body?.data?.[0]?.id;
};

const signedReading = async (direction, weightKg) => {
  const row = {
    readingId: randomUUID(),
    deviceCode: "SIM-01",
    capturedAt: new Date().toISOString(),
    weightKg,
    unit: "kg",
    stable: true,
    direction,
  };
  const canonical = [
    row.deviceCode, row.readingId, row.capturedAt, row.weightKg.toFixed(3),
    row.unit, "1", row.direction,
  ].join(":");
  const signature = createHmac("sha256", SIM_SECRET).update(canonical).digest("hex");
  const first = await request("POST", "/api/weighbridge/readings", null, row, {
    "x-weighbridge-signature": signature,
  });
  const duplicate = await request("POST", "/api/weighbridge/readings", null, row, {
    "x-weighbridge-signature": signature,
  });
  assert(first.response.ok && duplicate.body?.data?.replayed === true, `${direction} signed reading deduplicates`);
  return row.readingId;
};

const main = async () => {
  console.log("\nW3 Edge Operations smoke");
  await seedActors();
  const receptionToken = await login("operateur.reception@test.local");
  const stockToken = await login("magasinier.wms@test.local");
  const directionToken = await login("directeur.usine@test.local");
  const supplierId = await ensureSupplier(directionToken);

  const clientRequestId = randomUUID();
  const intakePayload = {
    client_request_id: clientRequestId,
    supplier_id: supplierId,
    spontaneous_delivery: true,
    unit: "kg",
    quantity_total: 250,
    gross_weight_kg: 260,
    tare_weight_kg: 10,
    variety: "Deglet Nour",
    lots: [{ lot_supplier: `W3-${Date.now()}`, variety: "Deglet Nour", quantity: 250, unit: "kg" }],
  };
  const firstIntake = await request("POST", "/api/receptions/intake", receptionToken, intakePayload);
  const replayIntake = await request("POST", "/api/receptions/intake", receptionToken, intakePayload);
  const lot = firstIntake.body?.data?.lots?.[0];
  assert(firstIntake.response.ok && lot?.id, "offline-style intake replay creates a lot");
  assert(
    replayIntake.body?.data?.reception?.id === firstIntake.body?.data?.reception?.id,
    "intake client_request_id returns original result",
  );

  const scan = await request("POST", "/api/trust/scan/resolve", stockToken, {
    rawValue: lot.lot_internal || lot.id,
    scannerKind: "SMOKE",
  });
  const stockLotId = scan.body?.data?.stockLot?.id;
  const scanToken = scan.body?.data?.scanToken;
  assert(scan.response.ok && stockLotId && scanToken, "canonical scan resolves stock lot and issues proof");

  const movementBody = {
    request_id: randomUUID(),
    lot_id: stockLotId,
    movement_type: "ADJUSTMENT",
    quantity: 1,
    unit: "kg",
    scan_proof: { lotToken: scanToken },
  };
  const movement = await request("POST", "/api/stock/movements", stockToken, movementBody);
  assert(movement.response.ok, "single-use scan proof authorizes stock movement");
  const replayProof = await request("POST", "/api/stock/movements", stockToken, {
    ...movementBody,
    request_id: randomUUID(),
  });
  assert(replayProof.response.status === 400, "consumed scan proof rejects a different command");

  const grossId = await signedReading("GROSS", 260);
  const tareId = await signedReading("TARE", 10);
  for (const [type, readingId, weight] of [["GROSS", grossId, 260], ["TARE", tareId, 10]]) {
    const recorded = await request(
      "POST",
      `/api/reception-lots/${encodeURIComponent(lot.id)}/weighing`,
      receptionToken,
      { type, weight_kg: weight, source: "DEVICE", reading_id: readingId, supervisor: "W3 smoke" },
    );
    assert(recorded.response.ok, `${type} device reading creates weighing record`);
  }

  const verified = await request("GET", `/api/trust/lots/${encodeURIComponent(lot.id)}/verify`, receptionToken);
  const passport = await request("GET", `/api/trust/lots/${encodeURIComponent(lot.id)}/passport`, null);
  const chain = await request("GET", `/api/trust/lots/${encodeURIComponent(lot.id)}/chain`, receptionToken);
  const weighed = chain.body?.data?.events?.filter((event) => event.event_type === "LOT_WEIGHED") || [];
  assert(verified.body?.data?.valid === true, "lot hash chain remains valid");
  assert(weighed.length === 1, "gross/tare pair records exactly one WEIGHED stage");
  assert(passport.response.ok, "public passport remains available");
  console.log("\nW3 smoke passed.");
};

main().catch((error) => {
  console.error(`\nW3 smoke failed: ${error.stack || error.message}`);
  process.exit(1);
});
