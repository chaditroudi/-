/**
 * Purchase-request workflow smoke:
 * Stock employee → Stock manager → Purchasing → (optional finance)
 *
 *   npm run smoke:pr-workflow
 *
 * Requires API on PORT (default 4000) and seeded actors.
 */
import { spawn } from "node:child_process";

const API = (process.env.SMOKE_API_URL || `http://127.0.0.1:${process.env.PORT || 4000}`).replace(/\/$/, "");
const PASSWORD = process.env.SMOKE_PASSWORD || "Test123!";

const ACTORS = {
  stockEmployee: "magasinier.wms@test.local",
  stockManager: "responsable.stock@test.local",
  buyer: "responsable.achats@test.local",
  purchasingManager: "directeur.achat@test.local",
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

const main = async () => {
  console.log("\nPurchase-request workflow smoke");
  console.log(`API ${API}\n`);

  const health = await request("GET", "/health");
  if (!health.ok) throw new Error(`API not healthy: ${health.status}`);
  ok("API healthy");

  await seedActors();
  ok("actors seeded");

  const stockEmp = await login(ACTORS.stockEmployee);
  const stockMgr = await login(ACTORS.stockManager);
  const buyer = await login(ACTORS.buyer);
  const purchMgr = await login(ACTORS.purchasingManager);
  const finance = await login(ACTORS.finance);
  ok("logins", "stock emp/mgr, buyer, purch mgr, finance");

  // ── Low amount path: dept → purchasing officer → APPROVED ──────────────
  console.log("\n[1] Low amount (< 1000) — Stock → Manager → Buyer");
  const lowCreate = await request("POST", "/api/purchasing/requisitions", stockEmp, {
    requester_name: "Moez Magasinier",
    department: "stock",
    material_name: "Cartons export 5kg",
    quantity: 100,
    unit: "pcs",
    urgency: "normal",
    justification: "Réassort magasin — smoke PR workflow",
    estimated_cost: 400,
    status: "SUBMITTED",
  });

  if (!lowCreate.ok) {
    fail("create+submit low DA", `HTTP ${lowCreate.status} ${JSON.stringify(lowCreate.body?.error || lowCreate.body)}`);
  } else {
    const low = lowCreate.body?.data;
    assertStatus(low?.status, "SUBMITTED", "low DA submitted");
    const lowId = low?.id;

    // Self-approve must fail
    const selfApprove = await request("POST", `/api/purchasing/requisitions/${lowId}/approve`, stockEmp, {});
    if (selfApprove.status === 400 || selfApprove.status === 403) {
      ok("SoD blocks self-approve", String(selfApprove.body?.error?.code || selfApprove.status));
    } else {
      fail("SoD blocks self-approve", `HTTP ${selfApprove.status}`);
    }

    // Peer stock employee (same dept, not manager) — we use stock emp again after manager path;
    // Stock manager approve
    const deptApprove = await request("POST", `/api/purchasing/requisitions/${lowId}/approve`, stockMgr, {
      reason: "OK stock",
    });
    if (!deptApprove.ok) {
      fail("dept manager approve", `HTTP ${deptApprove.status} ${JSON.stringify(deptApprove.body?.error || deptApprove.body)}`);
    } else {
      assertStatus(deptApprove.body?.data?.status, "PURCHASING_REVIEW", "after dept → PURCHASING_REVIEW");
      const sig = (deptApprove.body?.data?.approvals || []).find((a) => a.level === "dept_manager");
      if (sig?.approved_by_id) ok("dept signature has actor id", sig.approved_by);
      else fail("dept signature has actor id");
    }

    const buyApprove = await request("POST", `/api/purchasing/requisitions/${lowId}/approve`, buyer, {});
    if (!buyApprove.ok) {
      fail("buyer approve", `HTTP ${buyApprove.status} ${JSON.stringify(buyApprove.body?.error || buyApprove.body)}`);
    } else {
      assertStatus(buyApprove.body?.data?.status, "APPROVED", "low DA fully approved");
    }

    // Notifications: manager should have seen action-required; requester confirmation
    const mgrNotif = await findNotification(stockMgr, lowId, "PR_ACTION_REQUIRED");
    if (mgrNotif) ok("manager actionable notification", mgrNotif.notification_type);
    else fail("manager actionable notification", "not found (may be role-fallback timing)");

    const empConfirm = await findNotification(stockEmp, lowId, "PR_");
    if (empConfirm) ok("requester notification present", empConfirm.notification_type);
    else fail("requester notification present");
  }

  // ── Mid amount: needs purchasing manager ───────────────────────────────
  console.log("\n[2] Mid amount (>= 1000) — routes to purchasing manager");
  const midCreate = await request("POST", "/api/purchasing/requisitions", stockEmp, {
    requester_name: "Moez Magasinier",
    department: "stock",
    material_name: "Palette EUR",
    quantity: 50,
    unit: "pcs",
    urgency: "high",
    justification: "Smoke mid-threshold PR",
    estimated_cost: 2500,
    status: "SUBMITTED",
  });

  if (!midCreate.ok) {
    fail("create mid DA", `HTTP ${midCreate.status} ${JSON.stringify(midCreate.body?.error || midCreate.body)}`);
  } else {
    const midId = midCreate.body?.data?.id;
    const afterDept = await request("POST", `/api/purchasing/requisitions/${midId}/approve`, stockMgr, {});
    if (!afterDept.ok) {
      fail("mid dept approve", `HTTP ${afterDept.status} ${JSON.stringify(afterDept.body?.error || afterDept.body)}`);
    } else {
      assertStatus(afterDept.body?.data?.status, "PURCHASING_REVIEW", "mid after dept");
      if (afterDept.body?.data?.current_approval_level === "purchasing_manager") {
        ok("next level purchasing_manager", afterDept.body.data.current_approval_level);
      } else {
        fail("next level purchasing_manager", String(afterDept.body?.data?.current_approval_level));
      }
    }

    // Officer cannot sign purchasing_manager level
    const officerTry = await request("POST", `/api/purchasing/requisitions/${midId}/approve`, buyer, {});
    if (officerTry.status === 403 || officerTry.status === 400) {
      ok("officer blocked from manager level", String(officerTry.body?.error?.code || officerTry.status));
    } else if (officerTry.ok && officerTry.body?.data?.status === "PURCHASING_REVIEW") {
      // If matrix treated officer as signing something else — check still needs manager
      fail("officer blocked from manager level", `unexpected success status=${officerTry.body?.data?.status}`);
    } else {
      fail("officer blocked from manager level", `HTTP ${officerTry.status}`);
    }

    const mgrApprove = await request("POST", `/api/purchasing/requisitions/${midId}/approve`, purchMgr, {});
    if (!mgrApprove.ok) {
      fail("purchasing manager approve", `HTTP ${mgrApprove.status} ${JSON.stringify(mgrApprove.body?.error || mgrApprove.body)}`);
    } else {
      assertStatus(mgrApprove.body?.data?.status, "APPROVED", "mid DA approved by purch manager");
    }
  }

  // ── High amount: finance ───────────────────────────────────────────────
  console.log("\n[3] High amount (>= 10000) — finance approval");
  const highCreate = await request("POST", "/api/purchasing/requisitions", stockEmp, {
    requester_name: "Moez Magasinier",
    department: "stock",
    material_name: "Ligne conditionnement",
    quantity: 1,
    unit: "lot",
    urgency: "normal",
    justification: "Smoke finance threshold PR",
    estimated_cost: 15000,
    status: "SUBMITTED",
  });

  if (!highCreate.ok) {
    fail("create high DA", `HTTP ${highCreate.status}`);
  } else {
    const highId = highCreate.body?.data?.id;
    await request("POST", `/api/purchasing/requisitions/${highId}/approve`, stockMgr, {});
    const afterPurch = await request("POST", `/api/purchasing/requisitions/${highId}/approve`, purchMgr, {});
    if (!afterPurch.ok) {
      fail("high purch approve", `HTTP ${afterPurch.status} ${JSON.stringify(afterPurch.body?.error || afterPurch.body)}`);
    } else {
      assertStatus(afterPurch.body?.data?.status, "FINANCE_APPROVAL", "high → FINANCE_APPROVAL");
    }

    const finApprove = await request("POST", `/api/purchasing/requisitions/${highId}/approve`, finance, {});
    if (!finApprove.ok) {
      fail("finance approve", `HTTP ${finApprove.status} ${JSON.stringify(finApprove.body?.error || finApprove.body)}`);
    } else {
      assertStatus(finApprove.body?.data?.status, "APPROVED", "high DA approved by finance");
    }
  }

  // ── Return for changes ─────────────────────────────────────────────────
  console.log("\n[4] Return for changes branch");
  const retCreate = await request("POST", "/api/purchasing/requisitions", stockEmp, {
    requester_name: "Moez Magasinier",
    department: "stock",
    material_name: "Film étirable",
    quantity: 20,
    unit: "rouleaux",
    estimated_cost: 200,
    status: "SUBMITTED",
    justification: "Smoke return",
  });
  if (retCreate.ok) {
    const retId = retCreate.body?.data?.id;
    const returned = await request("POST", `/api/purchasing/requisitions/${retId}/return`, stockMgr, {
      reason: "Quantité à revoir",
    });
    if (!returned.ok) {
      fail("return for changes", `HTTP ${returned.status} ${JSON.stringify(returned.body?.error || returned.body)}`);
    } else {
      assertStatus(returned.body?.data?.status, "RETURNED_FOR_CHANGES", "returned");
      const resubmit = await request("POST", `/api/purchasing/requisitions/${retId}/submit`, stockEmp, {});
      if (!resubmit.ok) fail("resubmit after return", `HTTP ${resubmit.status}`);
      else assertStatus(resubmit.body?.data?.status, "SUBMITTED", "resubmitted");
    }
  } else {
    fail("create return DA", `HTTP ${retCreate.status}`);
  }

  console.log(`\n${failed === 0 ? "PASS" : "FAIL"} — ${failed} failure(s)\n`);
  process.exit(failed === 0 ? 0 : 1);
};

main().catch((error) => {
  console.error("\nSmoke crashed:", error);
  process.exit(1);
});
