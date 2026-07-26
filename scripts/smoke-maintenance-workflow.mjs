/**
 * Maintenance-request workflow smoke (second consumer of the approval engine):
 * requester → dept manager → Maintenance manager → (optional DAF) → complete
 *
 *   npm run smoke:maintenance-workflow
 *
 * Requires API on PORT (default 4000) and seeded actors.
 */
import { spawn } from "node:child_process";

const API = (process.env.SMOKE_API_URL || `http://127.0.0.1:${process.env.PORT || 4000}`).replace(/\/$/, "");
const PASSWORD = process.env.SMOKE_PASSWORD || "Test123!";

const ACTORS = {
  requester: "magasinier.wms@test.local", // stock employee
  deptManager: "responsable.stock@test.local", // stock department manager
  maintenanceManager: "responsable.maintenance@test.local",
  finance: "directeur.usine@test.local",
};

let failed = 0;

const ok = (name, detail = "") => console.log(`  ✓ ${name}${detail ? ` — ${detail}` : ""}`);
const fail = (name, detail = "") => {
  failed += 1;
  console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
};

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
  return { status: response.status, ok: response.ok, body: parsed };
};

const login = async (email) => {
  const { status, body } = await request("POST", "/api/auth/signin", null, { email, password: PASSWORD });
  const token = body?.data?.session?.access_token || body?.data?.access_token;
  if (!token) throw new Error(`Login failed for ${email}: HTTP ${status} ${JSON.stringify(body?.error || body)}`);
  return token;
};

const seedActors = () =>
  new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--env-file=.env", "scripts/seed-test-actors.mjs"], {
      cwd: process.cwd(),
      stdio: "inherit",
    });
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`seed exited ${code}`))));
  });

const assertStatus = (actual, expected, label) => {
  const normalized = String(actual || "").toUpperCase();
  if (normalized === String(expected).toUpperCase()) {
    ok(label, normalized);
    return true;
  }
  fail(label, `expected ${expected}, got ${actual}`);
  return false;
};

const findNotification = async (token, entityId, typePrefix) => {
  const listed = await request("GET", "/api/notifications?limit=50", token);
  const rows = listed.body?.data || listed.body || [];
  if (!Array.isArray(rows)) return null;
  return (
    rows.find(
      (row) =>
        String(row.entity_id || "") === String(entityId) &&
        String(row.notification_type || "").startsWith(typePrefix),
    ) || null
  );
};

const createRequest = (token, overrides) =>
  request("POST", "/api/maintenance/requests", token, {
    title: "Panne convoyeur ligne 2",
    equipment_name: "Convoyeur C-02",
    department: "stock",
    priority: "high",
    estimated_cost: 400,
    status: "SUBMITTED",
    ...overrides,
  });

const main = async () => {
  console.log("\nMaintenance-request workflow smoke");
  console.log(`API ${API}\n`);

  const health = await request("GET", "/health");
  if (!health.ok) throw new Error(`API not healthy: ${health.status}`);
  ok("API healthy");

  await seedActors();
  ok("actors seeded");

  const requester = await login(ACTORS.requester);
  const deptMgr = await login(ACTORS.deptManager);
  const maintMgr = await login(ACTORS.maintenanceManager);
  const finance = await login(ACTORS.finance);
  ok("logins", "requester, dept mgr, maintenance mgr, finance");

  // ── Low cost: dept → maintenance → APPROVED → COMPLETED ────────────────
  console.log("\n[1] Low cost (< 5000) — Stock req → Stock mgr → Maintenance");
  const lowCreate = await createRequest(requester, { estimated_cost: 400 });
  if (!lowCreate.ok) {
    fail("create+submit low request", `HTTP ${lowCreate.status} ${JSON.stringify(lowCreate.body?.error || lowCreate.body)}`);
  } else {
    const low = lowCreate.body?.data;
    assertStatus(low?.status, "SUBMITTED", "low request submitted");
    const lowId = low?.id;

    const selfApprove = await request("POST", `/api/maintenance/requests/${lowId}/approve`, requester, {});
    if (selfApprove.status === 400 || selfApprove.status === 403) {
      ok("SoD blocks self-approve", String(selfApprove.body?.error?.code || selfApprove.status));
    } else {
      fail("SoD blocks self-approve", `HTTP ${selfApprove.status}`);
    }

    const deptApprove = await request("POST", `/api/maintenance/requests/${lowId}/approve`, deptMgr, {
      reason: "Besoin justifié",
    });
    if (!deptApprove.ok) {
      fail("dept manager approve", `HTTP ${deptApprove.status} ${JSON.stringify(deptApprove.body?.error || deptApprove.body)}`);
    } else {
      assertStatus(deptApprove.body?.data?.status, "MAINTENANCE_REVIEW", "after dept → MAINTENANCE_REVIEW");
      if (deptApprove.body?.data?.current_approval_level === "maintenance_manager") {
        ok("next level maintenance_manager");
      } else {
        fail("next level maintenance_manager", String(deptApprove.body?.data?.current_approval_level));
      }
    }

    const maintApprove = await request("POST", `/api/maintenance/requests/${lowId}/approve`, maintMgr, {});
    if (!maintApprove.ok) {
      fail("maintenance approve", `HTTP ${maintApprove.status} ${JSON.stringify(maintApprove.body?.error || maintApprove.body)}`);
    } else {
      assertStatus(maintApprove.body?.data?.status, "APPROVED", "low request approved");
    }

    const complete = await request("POST", `/api/maintenance/requests/${lowId}/complete`, maintMgr, {
      reason: "Intervention réalisée",
    });
    if (!complete.ok) {
      fail("complete intervention", `HTTP ${complete.status} ${JSON.stringify(complete.body?.error || complete.body)}`);
    } else {
      assertStatus(complete.body?.data?.status, "COMPLETED", "intervention closed");
    }

    const mgrNotif = await findNotification(maintMgr, lowId, "MR_ACTION_REQUIRED");
    if (mgrNotif) ok("maintenance actionable notification", mgrNotif.notification_type);
    else fail("maintenance actionable notification", "not found (may be role-fallback timing)");

    const reqNotif = await findNotification(requester, lowId, "MR_");
    if (reqNotif) ok("requester notification present", reqNotif.notification_type);
    else fail("requester notification present");
  }

  // ── High cost: adds finance (DAF) step ─────────────────────────────────
  console.log("\n[2] High cost (>= 5000) — finance (DAF) approval");
  const highCreate = await createRequest(requester, { estimated_cost: 8000, title: "Remplacement moteur" });
  if (!highCreate.ok) {
    fail("create high request", `HTTP ${highCreate.status}`);
  } else {
    const highId = highCreate.body?.data?.id;
    await request("POST", `/api/maintenance/requests/${highId}/approve`, deptMgr, {});
    const afterMaint = await request("POST", `/api/maintenance/requests/${highId}/approve`, maintMgr, {});
    if (!afterMaint.ok) {
      fail("high maintenance approve", `HTTP ${afterMaint.status} ${JSON.stringify(afterMaint.body?.error || afterMaint.body)}`);
    } else {
      assertStatus(afterMaint.body?.data?.status, "FINANCE_APPROVAL", "high → FINANCE_APPROVAL");
    }

    const finApprove = await request("POST", `/api/maintenance/requests/${highId}/approve`, finance, {});
    if (!finApprove.ok) {
      fail("finance approve", `HTTP ${finApprove.status} ${JSON.stringify(finApprove.body?.error || finApprove.body)}`);
    } else {
      assertStatus(finApprove.body?.data?.status, "APPROVED", "high request approved by finance");
    }
  }

  // ── Return for changes branch ──────────────────────────────────────────
  console.log("\n[3] Return for changes branch");
  const retCreate = await createRequest(requester, { estimated_cost: 300, title: "Graissage roulements" });
  if (retCreate.ok) {
    const retId = retCreate.body?.data?.id;
    const returned = await request("POST", `/api/maintenance/requests/${retId}/return`, deptMgr, {
      reason: "Préciser l'équipement",
    });
    if (!returned.ok) {
      fail("return for changes", `HTTP ${returned.status} ${JSON.stringify(returned.body?.error || returned.body)}`);
    } else {
      assertStatus(returned.body?.data?.status, "RETURNED_FOR_CHANGES", "returned");
      const resubmit = await request("POST", `/api/maintenance/requests/${retId}/submit`, requester, {});
      if (!resubmit.ok) fail("resubmit after return", `HTTP ${resubmit.status}`);
      else assertStatus(resubmit.body?.data?.status, "SUBMITTED", "resubmitted");
    }
  } else {
    fail("create return request", `HTTP ${retCreate.status}`);
  }

  console.log(`\n${failed === 0 ? "PASS" : "FAIL"} — ${failed} failure(s)\n`);
  process.exit(failed === 0 ? 0 : 1);
};

main().catch((error) => {
  console.error("\nSmoke crashed:", error);
  process.exit(1);
});
