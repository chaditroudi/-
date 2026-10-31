/**
 * B0 readiness smoke — gate modes + GS1 placeholder check.
 * Does not flip production gates; prints what to set next.
 *
 *   npm run smoke:b0
 */
import { resolveTestApi } from "./lib/api-target-guard.mjs";
import { spawn } from "node:child_process";

const API = resolveTestApi();
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

const seedActors = () =>
  new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--env-file=.env", "scripts/seed-test-actors.mjs"], {
      cwd: process.cwd(),
      stdio: "inherit",
    });
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`seed ${code}`))));
  });

const main = async () => {
  console.log("\nB0 trust gate smoke");
  await seedActors();
  const login = await request("POST", "/api/auth/signin", null, {
    email: "directeur.usine@test.local",
    password: PASSWORD,
  });
  const token = login.body?.data?.session?.access_token || login.body?.data?.access_token;
  if (!token) throw new Error("Login failed");

  const gates = await request("GET", "/api/trust/gates", token);
  if (!gates.response.ok) throw new Error(`GET /trust/gates failed: ${gates.response.status}`);
  const data = gates.body?.data;
  console.log("  gates:", JSON.stringify(data?.gates, null, 2));
  console.log("  gs1:", data?.gs1);
  console.log("  enforce_ready:", data?.enforce_ready);
  console.log("  next:", data?.next);

  if (!data?.gates) throw new Error("Missing gates payload");
  console.log("\n✓ B0 gate status readable");
  if (!data.enforce_ready) {
    console.log("  (expected until warn shift clean + GS1 real + env enforce)");
  }
};

main().catch((error) => {
  console.error("\n✗ smoke:b0 failed:", error.message || error);
  process.exit(1);
});
