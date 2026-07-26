/**
 * Wave A CCP sensors smoke: sensor attestation + cold breach + evidence gate payload.
 *   npm run smoke:wave-a
 */
import { createHmac, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";

const API = (process.env.SMOKE_API_URL || `http://127.0.0.1:${process.env.PORT || 4000}`).replace(/\/$/, "");
const PASSWORD = process.env.SMOKE_PASSWORD || "Test123!";
const CCP_SECRET = process.env.CCP_SIMULATOR_SECRET || "royal-palm-ccp-simulator-dev";

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
  return { response, body: text ? JSON.parse(text) : null };
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
      code: "WA-CCP-SUP",
      name: "Wave A CCP Supplier",
      supplier_status: "active",
      is_active: true,
      country: "TN",
      contract_start_date: today,
      contract_end_date: "2099-12-31",
    },
  });
  return created.body?.data?.[0]?.id;
};

const signCcp = ({ deviceCode, readingId, capturedAt, kind, targetRef, value, secondary, flag }) =>
  createHmac("sha256", CCP_SECRET)
    .update([deviceCode, readingId, capturedAt, kind, targetRef, Number(value).toFixed(3), Number(secondary).toFixed(3), String(flag)].join(":"))
    .digest("hex");

const main = async () => {
  console.log("\nWave A CCP sensors smoke");
  await seedActors();
  const receptionToken = await login("operateur.reception@test.local");
  const productionToken = await login("operateur.fumigation@test.local");
  const stockToken = await login("magasinier.wms@test.local");
  const directionToken = await login("directeur.usine@test.local");
  const supplierId = await ensureSupplier(directionToken);

  const intake = await request("POST", "/api/receptions/intake", receptionToken, {
    client_request_id: randomUUID(),
    supplier_id: supplierId,
    spontaneous_delivery: true,
    unit: "kg",
    quantity_total: 200,
    gross_weight_kg: 210,
    tare_weight_kg: 10,
    variety: "Deglet Nour",
    lots: [{ lot_supplier: `WA-${Date.now()}`, variety: "Deglet Nour", quantity: 200, unit: "kg" }],
  });
  const lot = intake.body?.data?.lots?.[0];
  assert(intake.response.ok && lot?.id, "intake lot created");

  for (const toStage of ["WEIGHED", "QC_DECIDED"]) {
    const advanced = await request("POST", `/api/trust/lots/${encodeURIComponent(lot.id)}/advance`, directionToken, {
      toStage, collection: "smoke_wave_a", payload: { smoke: true }, route: "PREMIUM_WHOLE",
    });
    assert(advanced.response.ok, `advance ${toStage}`);
  }

  const cycle = await request("POST", "/api/phase2/fumigation/cycles", productionToken, {
    chamber: "FU-01",
    protocol: "FUM-THERM-04",
    lot_refs: [{ lot_number: lot.lot_internal, reception_id: intake.body.data.reception.id }],
    total_weight_kg: 200,
  });
  const cycleId = cycle.body?.data?.id;
  assert(cycle.response.ok && cycleId, "fumigation cycle created");

  await request("PATCH", `/api/phase2/fumigation/cycles/${cycleId}`, productionToken, {
    dose_applied_g: 100,
    product_lot_number: lot.lot_internal,
    photo_disposition_urls: ["https://example.local/photo.jpg"],
    status: "CHARGEMENT",
  });
  const started = await request("POST", `/api/phase2/fumigation/cycles/${cycleId}/start`, productionToken, {});
  assert(started.response.ok, "fumigation cycle started");

  const fumReadingId = randomUUID();
  const fumCapturedAt = new Date().toISOString();
  const fumBody = {
    readingId: fumReadingId,
    deviceCode: "CCP-FUM-SIM-01",
    capturedAt: fumCapturedAt,
    kind: "FUMIGATION",
    cycleId,
    concentrationAvgGm3: 1.1,
    externalLeakPpm: 0,
    doorLocked: true,
  };
  const fumSig = signCcp({
    deviceCode: fumBody.deviceCode,
    readingId: fumReadingId,
    capturedAt: fumCapturedAt,
    kind: "FUMIGATION",
    targetRef: cycleId,
    value: 1.1,
    secondary: 0,
    flag: 1,
  });
  const reading = await request("POST", "/api/ccp-sensors/readings", null, fumBody, {
    "x-ccp-signature": fumSig,
  });
  assert(reading.response.ok, "HMAC fumigation sensor reading stored");
  assert(reading.body?.data?.reading?.signature_verified === true, "fumigation signature verified");

  const chainAfterSensor = await request("GET", `/api/trust/lots/${encodeURIComponent(lot.id)}/chain`, directionToken);
  const sensorEvents = chainAfterSensor.body?.data?.events?.filter((e) => e.event_type === "CCP_SENSOR_ATTESTED") || [];
  assert(sensorEvents.length >= 1, "CCP_SENSOR_ATTESTED appended to lot ledger");

  const zones = await request("GET", "/api/storage/module3/zones", stockToken);
  const coldZone = (zones.body?.data || []).find((zone) =>
    String(zone.storage_family || "").toLowerCase() === "cold"
    || String(zone.zone_type || "").toLowerCase() === "cold_room"
    || String(zone.code || "").toUpperCase().startsWith("CF"),
  );
  assert(coldZone?.id, "cold zone available for reading");

  const coldReadingId = randomUUID();
  const coldCapturedAt = new Date().toISOString();
  const coldBody = {
    readingId: coldReadingId,
    deviceCode: "CCP-COLD-SIM-01",
    capturedAt: coldCapturedAt,
    kind: "COLD",
    zoneCode: coldZone.code,
    temperatureC: 12,
    humidityPercent: 55,
  };
  const coldSig = signCcp({
    deviceCode: coldBody.deviceCode,
    readingId: coldReadingId,
    capturedAt: coldCapturedAt,
    kind: "COLD",
    targetRef: String(coldZone.code).toUpperCase(),
    value: 12,
    secondary: 55,
    flag: 1,
  });
  const coldReading = await request("POST", "/api/ccp-sensors/readings", null, coldBody, {
    "x-ccp-signature": coldSig,
  });
  assert(coldReading.response.ok, `HMAC cold storage reading accepted (${coldReading.response.status})`);
  assert(coldReading.body?.data?.coldChain?.intact === false, "cold chain excursion detected");

  const passport = await request("GET", `/api/trust/lots/${encodeURIComponent(lot.id)}/passport`, null);
  assert(passport.response.ok, "passport still public");
  const claims = passport.body?.data?.claims || [];
  assert(claims.some((c) => c.key === "ccp_sensor_verified"), "passport exposes ccp_sensor_verified claim");
  assert(claims.some((c) => c.key === "cold_chain_intact" || c.key === "cold_chain_excursions"), "passport exposes cold-chain claims");
  console.log("\nWave A smoke passed.");
};

main().catch((error) => {
  console.error(`\nWave A smoke failed: ${error.stack || error.message}`);
  process.exit(1);
});
