/**
 * Automated smoke test for W0–W2 + role-targeted realtime notifications.
 *
 * Usage (repo root, server running on PORT):
 *   node --env-file=.env scripts/smoke-notifications.mjs
 *   npm run smoke:notifications
 *
 * Exit 0 = all checks passed; exit 1 = failures.
 */
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const API = (process.env.SMOKE_API_URL || `http://127.0.0.1:${process.env.PORT || 4000}`).replace(/\/$/, "");
const PASSWORD = process.env.SMOKE_PASSWORD || "Test123!";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const ACTORS = {
  reception: "operateur.reception@test.local",
  quality: "responsable.qualite@test.local",
  logistics: "responsable.logistique@test.local",
  direction: "directeur.usine@test.local",
};

const STAGES = [
  "WEIGHED",
  "QC_DECIDED",
  "COLD_STORE",
  "FUMIGATION_CCP",
  "TRIAGE",
  "PACKED",
  "SHIPPED",
];

const results = [];
let failed = 0;

const ok = (name, detail = "") => {
  results.push({ name, pass: true, detail });
  console.log(`  ✓ ${name}${detail ? ` — ${detail}` : ""}`);
};

const fail = (name, detail = "") => {
  failed += 1;
  results.push({ name, pass: false, detail });
  console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchJson(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text };
  }
  return { status: res.status, ok: res.ok, body };
}

async function waitForHealth(timeoutMs = 90_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const { ok: healthy, status } = await fetchJson(`${API}/health`);
      if (healthy || status === 200) return true;
    } catch {
      /* retry */
    }
    await sleep(1500);
  }
  return false;
}

function runSeedActors() {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ["--env-file=.env", "scripts/seed-test-actors.mjs"],
      { cwd: ROOT, stdio: "inherit", shell: false },
    );
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`seed exited ${code}`))));
  });
}

async function login(email) {
  const { status, body } = await fetchJson(`${API}/api/auth/signin`, {
    method: "POST",
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  const token = body?.data?.session?.access_token || body?.data?.access_token || body?.access_token;
  if (!token) {
    throw new Error(`Login failed for ${email}: HTTP ${status} ${JSON.stringify(body?.error || body)}`);
  }
  return token;
}

async function api(token, method, pathname, payload) {
  return fetchJson(`${API}${pathname}`, {
    method,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });
}

async function ensureSupplier(token) {
  const listed = await api(token, "POST", "/api/db/query", {
    table: "suppliers",
    filters: [],
    limit: 5,
    orderBy: { column: "created_at", ascending: false },
  });
  const any = Array.isArray(listed.body?.data) ? listed.body.data.find((row) => row?.id) : null;
  if (any?.id) return String(any.id);

  const today = new Date().toISOString().slice(0, 10);
  const created = await api(token, "POST", "/api/db/insert", {
    table: "suppliers",
    values: {
      code: "SMOKE-SUP",
      name: "Smoke Test Supplier",
      supplier_status: "active",
      is_active: true,
      country: "TN",
      contract_start_date: today,
      contract_end_date: "2099-12-31",
    },
  });
  const row = created.body?.data?.[0] || created.body?.data;
  if (!row?.id) {
    throw new Error(`Could not create supplier: ${JSON.stringify(created.body)}`);
  }
  return String(row.id);
}

async function intakeLot(token, supplierId) {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  const { status, body } = await api(token, "POST", "/api/receptions/intake", {
    supplier_id: supplierId,
    spontaneous_delivery: true,
    unit: "kg",
    quantity_total: 250,
    gross_weight_kg: 260,
    tare_weight_kg: 10,
    variety: "Deglet Nour",
    lots: [
      {
        variety: "Deglet Nour",
        quantity: 250,
        unit: "kg",
        calibre: "Standard",
        lot_supplier: `SMOKE-${stamp}`,
      },
    ],
  });
  if (!body?.data?.lots?.[0]?.id) {
    throw new Error(`Intake failed HTTP ${status}: ${JSON.stringify(body?.error || body)}`);
  }
  return {
    receptionId: String(body.data.reception.id),
    lotId: String(body.data.lots[0].id),
    lotInternal: String(body.data.lots[0].lot_internal || body.data.lots[0].id),
  };
}

async function advance(token, lotId, toStage) {
  const { status, body } = await api(token, "POST", `/api/trust/lots/${encodeURIComponent(lotId)}/advance`, {
    toStage,
    collection: "smoke_test",
    payload: { smoke: true, toStage },
    route: "PREMIUM_WHOLE",
  });
  if (!body?.data) {
    throw new Error(`Advance ${toStage} failed HTTP ${status}: ${JSON.stringify(body?.error || body)}`);
  }
  return body.data;
}

async function listNotifications(token) {
  const { status, body } = await api(token, "GET", "/api/notifications?limit=200");
  if (!status || status >= 400) {
    throw new Error(`list notifications HTTP ${status}: ${JSON.stringify(body)}`);
  }
  return Array.isArray(body?.data) ? body.data : [];
}

function findLotNotifs(rows, lotId, types) {
  return rows.filter((n) => {
    const type = String(n.notification_type || "");
    const entity = String(n.entity_id || "");
    const metaLot = String(n.metadata?.lot_id || "");
    const matchType = !types || types.includes(type);
    return matchType && (entity === lotId || metaLot === lotId || String(n.message || "").includes(lotId));
  });
}

async function main() {
  console.log(`\nSmoke notifications @ ${API}\n`);

  if (!(await waitForHealth(15_000))) {
    console.log("API not up yet — waiting longer (start with npm run server / npm run dev)...");
    if (!(await waitForHealth(75_000))) {
      fail("API health", `No response from ${API}/health`);
      process.exit(1);
    }
  }
  ok("API health");

  console.log("\nSeeding test actors...");
  try {
    await runSeedActors();
    ok("Seed actors");
  } catch (err) {
    fail("Seed actors", String(err.message || err));
  }

  let receptionToken;
  let qualityToken;
  let logisticsToken;
  let directionToken;

  console.log("\nLogging in actors...");
  try {
    receptionToken = await login(ACTORS.reception);
    qualityToken = await login(ACTORS.quality);
    logisticsToken = await login(ACTORS.logistics);
    directionToken = await login(ACTORS.direction);
    ok("Login 4 actors", "reception / quality / logistics / direction");
  } catch (err) {
    fail("Login actors", String(err.message || err));
    process.exit(1);
  }

  console.log("\nCreating Deglet Nour intake lot...");
  let lotId;
  let lotInternal;
  try {
    const supplierId = await ensureSupplier(directionToken);
    const intake = await intakeLot(receptionToken, supplierId);
    lotId = intake.lotId;
    lotInternal = intake.lotInternal;
    ok("Reception intake", `lot ${lotInternal} (${lotId})`);
  } catch (err) {
    fail("Reception intake", String(err.message || err));
    process.exit(1);
  }

  // Allow emitter + SSE write settle
  await sleep(800);

  console.log("\nAdvancing golden thread...");
  for (const stage of STAGES) {
    try {
      const data = await advance(directionToken, lotId, stage);
      if (data.skipped && data.error) {
        fail(`Advance ${stage}`, String(data.error?.message || data.error));
      } else {
        ok(`Advance ${stage}`, data.skipped ? "already present" : "recorded");
      }
      await sleep(250);
    } catch (err) {
      fail(`Advance ${stage}`, String(err.message || err));
    }
  }

  await sleep(1000);

  console.log("\nTrust verify / state / passport / recall...");
  try {
    const verify = await api(directionToken, "GET", `/api/trust/lots/${encodeURIComponent(lotId)}/verify`);
    if (verify.body?.data?.valid) ok("Hash chain verify", `events=${verify.body.data.events?.length ?? "?"}`);
    else fail("Hash chain verify", JSON.stringify(verify.body));
  } catch (err) {
    fail("Hash chain verify", String(err.message || err));
  }

  try {
    const state = await api(directionToken, "GET", `/api/trust/lots/${encodeURIComponent(lotId)}/state`);
    const stage = state.body?.data?.stage || state.body?.data?.progress?.current;
    const complete = Boolean(state.body?.data?.goldenThreadComplete);
    if (stage === "SHIPPED" || complete) ok("Golden thread state", `stage=${stage} complete=${complete}`);
    else fail("Golden thread state", `stage=${stage} complete=${complete}`);
  } catch (err) {
    fail("Golden thread state", String(err.message || err));
  }

  try {
    const passport = await fetchJson(`${API}/api/trust/lots/${encodeURIComponent(lotId)}/passport`);
    if (passport.ok && passport.body?.data) ok("Public passport (no auth)", `claims present`);
    else fail("Public passport (no auth)", `HTTP ${passport.status}`);
  } catch (err) {
    fail("Public passport (no auth)", String(err.message || err));
  }

  try {
    const recall = await api(directionToken, "POST", "/api/trust/recall", { lotId });
    if (recall.ok && recall.body?.data) ok("Recall drill", `keys=${Object.keys(recall.body.data).join(",")}`);
    else fail("Recall drill", JSON.stringify(recall.body?.error || recall.body));
  } catch (err) {
    fail("Recall drill", String(err.message || err));
  }

  console.log("\nRole-scoped notifications...");
  try {
    const [qualityNotifs, logisticsNotifs, directionNotifs] = await Promise.all([
      listNotifications(qualityToken),
      listNotifications(logisticsToken),
      listNotifications(directionToken),
    ]);

    const qualityShip = findLotNotifs(qualityNotifs, lotId, ["LOT_SHIPPED"]);
    const logisticsShip = findLotNotifs(logisticsNotifs, lotId, ["LOT_SHIPPED"]);
    const directionShip = findLotNotifs(directionNotifs, lotId, ["LOT_SHIPPED"]);

    const qualityQc = findLotNotifs(qualityNotifs, lotId, ["LOT_QC_DECIDED", "QC_DECISION_RECORDED", "LOT_SUPPLIER_INTAKE", "RECEPTION_CREATED"]);
    const logisticsQc = findLotNotifs(logisticsNotifs, lotId, ["LOT_QC_DECIDED", "QC_DECISION_RECORDED", "LOT_SUPPLIER_INTAKE", "RECEPTION_CREATED"]);

    if (logisticsShip.length > 0) ok("Logistics sees LOT_SHIPPED", `count=${logisticsShip.length}`);
    else fail("Logistics sees LOT_SHIPPED", "none found in scoped list");

    if (qualityShip.length === 0) ok("Quality does NOT see LOT_SHIPPED", "scoped correctly");
    else fail("Quality does NOT see LOT_SHIPPED", `leaked count=${qualityShip.length}`);

    if (directionShip.length > 0) ok("Direction sees LOT_SHIPPED", "sees-all oversight");
    else fail("Direction sees LOT_SHIPPED", "director should see all");

    if (qualityQc.length > 0) ok("Quality sees intake/QC notifs", `count=${qualityQc.length}`);
    else fail("Quality sees intake/QC notifs", "expected reception/quality space items");

    // Logistics may still see empty-target legacy docs; for this lot's QC types should be empty if targeted
    const logisticsTargetedQc = logisticsQc.filter(
      (n) => Array.isArray(n.target_roles) && n.target_roles.length > 0,
    );
    if (logisticsTargetedQc.length === 0) {
      ok("Logistics does NOT see targeted QC/intake", "scoped correctly");
    } else {
      fail("Logistics does NOT see targeted QC/intake", `leaked=${logisticsTargetedQc.map((n) => n.notification_type).join(",")}`);
    }

    // Dedup: advance SHIPPED again should not create a second unread identical notif
    await advance(directionToken, lotId, "SHIPPED");
    await sleep(500);
    const logisticsAfter = await listNotifications(logisticsToken);
    const shipUnread = findLotNotifs(logisticsAfter, lotId, ["LOT_SHIPPED"]).filter((n) => !n.is_read);
    if (shipUnread.length <= 1) ok("Dedup LOT_SHIPPED", `unread=${shipUnread.length}`);
    else fail("Dedup LOT_SHIPPED", `unread=${shipUnread.length} (expected ≤1)`);
  } catch (err) {
    fail("Role-scoped notifications", String(err.message || err));
  }

  console.log("\n────────────────────────────");
  console.log(`Result: ${results.filter((r) => r.pass).length}/${results.length} passed`);
  if (failed > 0) {
    console.log(`${failed} failed`);
    process.exit(1);
  }
  console.log("SMOKE PASS");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
